import { describe, it, expect } from 'vitest';
import { buildWaLink } from '../lib/whatsapp.js';

describe('buildWaLink', () => {
  const baseOrder = {
    orderId: 42,
    items: [{ product_name: 'WHOPPER®', unit_price: 119, quantity: 2 }],
    customer: {
      name: 'María',
      phone: '5512345678',
      address: 'Av. Insurgentes 100',
      notes: '',
    },
    subtotal: 238,
  };

  // SCN-WA-2: URL starts with https://wa.me/<digits>?text=
  it('output URL starts with https://wa.me/<digits>?text=', () => {
    const url = buildWaLink({ ...baseOrder, phone: '5215512345678' });
    expect(url).toMatch(/^https:\/\/wa\.me\/\d{10,15}\?text=/);
  });

  // SCN-WA-2: no '+' in the generated URL
  it('no "+" in generated URL', () => {
    const url = buildWaLink({ ...baseOrder, phone: '5215512345678' });
    expect(url).not.toContain('+');
  });

  // defensive: spaces/dashes in phone arg stripped
  it('strips non-digit characters from phone', () => {
    const url = buildWaLink({ ...baseOrder, phone: ' 521-5512-345-678 ' });
    // After stripping, phone segment should be digits only
    expect(url).toMatch(/^https:\/\/wa\.me\/5215512345678\?text=/);
    // No non-digit chars in the URL path
    expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  });

  // REQ-WA-5: Spanish chars survive encoding round-trip
  it('Spanish chars in name/address survive encodeURIComponent round-trip', () => {
    const order = {
      orderId: 1,
      items: [{ product_name: 'WHOPPER', unit_price: 119, quantity: 1 }],
      customer: {
        name: 'María José',
        phone: '5512345678',
        address: 'Calle Niños Héroes #123',
        notes: 'Sin cebolla',
      },
      subtotal: 119,
    };
    const url = buildWaLink({ ...order, phone: '5215512345678' });
    const text = decodeURIComponent(url.split('?text=')[1]);
    expect(text).toContain('María José');
    expect(text).toContain('Calle Niños Héroes');
    expect(text).toContain('Sin cebolla');
    // No double-encoding: %25 should not appear (would indicate double-encoding)
    expect(url).not.toContain('%25');
  });

  // defensive: HTML chars encoded as %3C not &lt;
  it('HTML in product_name encoded as %3C not &lt;', () => {
    const order = {
      orderId: 1,
      items: [{ product_name: '<script>alert(1)</script>', unit_price: 100, quantity: 1 }],
      customer: { name: 'Test', phone: '5512345678', address: 'Calle 1', notes: '' },
      subtotal: 100,
    };
    const url = buildWaLink({ ...order, phone: '5215512345678' });
    const text = decodeURIComponent(url.split('?text=')[1]);
    expect(text).toContain('<script>alert(1)</script>');
    // < is encoded as %3C (not &lt;), > as %3E; parentheses are unreserved so stay as ()
    expect(url).toContain('%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    expect(url).not.toContain('&lt;');
  });

  // SCN-WA-4: 20-item order → URL ≤ 2000 chars (or has summary truncation)
  it('20-item order produces a valid URL', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      product_name: `Producto ${i + 1}`,
      unit_price: 50 + i,
      quantity: 1,
    }));
    const order = {
      orderId: 99,
      items,
      customer: {
        name: 'Test User',
        phone: '5512345678',
        address: 'Calle Test',
        notes: '',
      },
      subtotal: items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
    };
    const url = buildWaLink({ ...order, phone: '5215512345678' });
    // URL must be syntactically valid
    expect(url).toMatch(/^https:\/\/wa\.me\/\d{10,15}\?text=/);
    // If truncated, should contain summary marker
    if (url.length > 2000) {
      expect(url).toContain('...y');
      expect(url).toContain('artículos más');
    }
  });

  // SCN-WA-4: URL > 2000 chars → truncation with "...y N artículos más"
  it('URL > 2000 chars triggers truncation with "...y N artículos más"', () => {
    // Build an order large enough to exceed MAX (2000 chars in the URL)
    const longName = 'A'.repeat(500); // long product names to push URL length over 2000
    const items = Array.from({ length: 10 }, () => ({
      product_name: longName,
      unit_price: 999,
      quantity: 99,
    }));
    const order = {
      orderId: 1,
      items,
      customer: {
        name: 'Test',
        phone: '5512345678',
        address: 'Calle 1',
        notes: '',
      },
      subtotal: items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
    };
    const url = buildWaLink({ ...order, phone: '5215512345678' });
    // Truncation should fire and produce a shorter URL (though still > 2000 for extreme cases)
    const text = decodeURIComponent(url.split('?text=')[1]);
    expect(text).toContain('... y ');
    expect(text).toContain('artículos más');
    // Summary shows 5 remaining items
    expect(text).toMatch(/5 artículos más/);
  });

  // REQ-WA-3: message body contains order header, itemized list, subtotal, customer block
  it('message body contains all required sections', () => {
    const url = buildWaLink({ ...baseOrder, phone: '5215512345678' });
    const text = decodeURIComponent(url.split('?text=')[1]);
    expect(text).toContain('Nuevo pedido #42');
    expect(text).toContain('2 × WHOPPER® = $238');
    expect(text).toContain('Subtotal: $238');
    expect(text).toContain('Cliente: María');
    expect(text).toContain('Teléfono: 5512345678');
    expect(text).toContain('Dirección: Av. Insurgentes 100');
  });

  // notes are optional — empty notes should not show "Notas: "
  it('empty notes omitted from message', () => {
    const url = buildWaLink({ ...baseOrder, phone: '5215512345678' });
    const text = decodeURIComponent(url.split('?text=')[1]);
    expect(text).not.toContain('Notas:');
  });

  // notes present → included
  it('notes included when present', () => {
    const order = {
      ...baseOrder,
      customer: { ...baseOrder.customer, notes: 'Sin cebolla' },
    };
    const url = buildWaLink({ ...order, phone: '5215512345678' });
    const text = decodeURIComponent(url.split('?text=')[1]);
    expect(text).toContain('Notas: Sin cebolla');
  });
});
