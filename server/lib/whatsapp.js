/**
 * buildWaLink — pure function, no IO.
 *
 * Builds a wa.me deep link for a completed order.
 *
 * @param {object} opts
 * @param {number} opts.orderId
 * @param {Array<{product_name: string, unit_price: number, quantity: number}>} opts.items
 * @param {{name: string, phone: string, address: string, notes?: string}} opts.customer
 * @param {number} opts.subtotal
 * @param {string} opts.phone  — digits-only business phone from config.BUSINESS_PHONE
 * @returns {string}  https://wa.me/<phone>?text=<encoded>
 */
function buildWaLink({ orderId, items, customer, subtotal, phone }) {
  const MAX = 2000;

  // Header
  const header = `Nuevo pedido #${orderId}\n----------------\n`;

  // Customer block
  const customerBlock =
    `\n----------------\nSubtotal: $${subtotal}\n\nCliente: ${customer.name}\nTeléfono: ${customer.phone}\nDirección: ${customer.address}` +
    (customer.notes ? `\nNotas: ${customer.notes}` : '');

  // Defensively strip any non-digit characters from phone (spaces, dashes, +)
  const cleanPhone = phone.replace(/\D/g, '');
  const urlBase = `https://wa.me/${cleanPhone}?text=`;

  // Build the item lines
  const lines = items.map(
    (i) => `${i.quantity} × ${i.product_name} = $${i.unit_price * i.quantity}`
  );

  let body = header + lines.join('\n') + customerBlock;
  let url = urlBase + encodeURIComponent(body);

  // If URL exceeds MAX, truncate: keep first 5 items + summary
  if (url.length > MAX) {
    const kept = lines.slice(0, 5);
    const restCount = items.length - 5;
    const restTotal = items
      .slice(5)
      .reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const summary = `... y ${restCount} artículos más ($${restTotal})`;
    body = header + kept.join('\n') + '\n' + summary + customerBlock;
    url = urlBase + encodeURIComponent(body);
  }

  return url;
}

export { buildWaLink };
