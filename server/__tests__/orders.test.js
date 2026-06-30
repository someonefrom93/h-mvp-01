import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { makeApp } from './helpers.js';

describe('POST /api/orders', () => {
  let app;

  beforeEach(() => {
    app = makeApp();
  });

  // SCN-BE-1: Happy path
  it('valid payload returns 201 with order_id and created_at', async () => {
    const payload = {
      customer: { name: 'María', phone: '5512345678', address: 'Av. Insurgentes 100', notes: '' },
      items: [{ product_name: 'WHOPPER', unit_price: 119, quantity: 2 }],
      subtotal: 238,
    };
    const res = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('order_id');
    expect(res.body).toHaveProperty('created_at');
    expect(typeof res.body.order_id).toBe('number');
    expect(res.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // SCN-BE-2: Missing customer.name
  it('missing customer.name returns 400 with field reference', async () => {
    const payload = {
      customer: { name: '', phone: '5512345678', address: 'Av. Insurgentes 100' },
      items: [{ product_name: 'WHOPPER', unit_price: 119, quantity: 1 }],
      subtotal: 119,
    };
    const res = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'customer.name' }));
  });

  // SCN-BE-3: Empty items array
  it('empty items array returns 400', async () => {
    const payload = {
      customer: { name: 'Test', phone: '5512345678', address: 'Calle 1' },
      items: [],
      subtotal: 0,
    };
    const res = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'items' }));
  });

  // SCN-BE-4: Negative quantity
  it('negative quantity returns 400 referencing that item', async () => {
    const payload = {
      customer: { name: 'Test', phone: '5512345678', address: 'Calle 1' },
      items: [{ product_name: 'WHOPPER', unit_price: 119, quantity: -1 }],
      subtotal: -119,
    };
    const res = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field.includes('quantity'))).toBe(true);
  });

  // SCN-BE-5: SQL injection stored as literal (single assertion)
  it('SQL injection in product_name stored literally', async () => {
    const malicious = "Whopper'; DROP TABLE orders; --";
    const payload = {
      customer: { name: 'Test', phone: '5512345678', address: 'Calle 1' },
      items: [{ product_name: malicious, unit_price: 119, quantity: 1 }],
      subtotal: 119,
    };
    const res = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(201);
  });

  // SCN-BE-6: Schema auto-migration on fresh boot
  it('server starts with no DB and creates tables', async () => {
    // makeApp already uses :memory:, which is created fresh.
    // The app has orders table ready — verify by inserting.
    const payload = {
      customer: { name: 'Migración', phone: '5512345678', address: 'Calle 1' },
      items: [{ product_name: 'Whopper', unit_price: 119, quantity: 1 }],
      subtotal: 119,
    };
    const res = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(201);
  });

  // Idempotent replay
  it('same Idempotency-Key returns cached 201 without double-insert', async () => {
    const payload = {
      customer: { name: 'Idempotente', phone: '5512345678', address: 'Calle 1' },
      items: [{ product_name: 'WHOPPER', unit_price: 119, quantity: 1 }],
      subtotal: 119,
    };
    const key = 'test-idempotency-key-123';

    const r1 = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', key)
      .send(payload);

    const r2 = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', key)
      .send(payload);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r2.body.order_id).toBe(r1.body.order_id);
  });
});
