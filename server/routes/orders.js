import express from 'express';
import { validateOrderPayload } from '../lib/validate.js';
import { withIdempotency } from '../lib/idempotency.js';
import { buildWaLink } from '../lib/whatsapp.js';
import { BUSINESS_PHONE } from '../config.js';

const router = express.Router();

/**
 * POST /api/orders
 *
 * Request body:
 * {
 *   customer: { name, phone, address, notes? },
 *   items: [{ product_name, unit_price, quantity }],
 *   subtotal
 * }
 *
 * Headers:
 *   Content-Type: application/json
 *   Idempotency-Key: <uuid> (optional)
 *
 * Response 201: { order_id, created_at, whatsapp_link }
 * Response 400: { errors: [{ field, message }] }
 * Response 500: { error: "Internal server error" }
 */
router.post('/', (req, res) => {
  const idempotencyKey = req.get('Idempotency-Key') || null;

  const validation = validateOrderPayload(req.body);
  if (!validation.ok) {
    return res.status(400).json({ errors: validation.errors });
  }

  const { customer, items, subtotal } = validation.value;

  const { cached, response } = withIdempotency(idempotencyKey, () => {
    const createdAt = new Date().toISOString();

    const insertOrder = req.db.prepare(`
      INSERT INTO orders (customer_name, customer_phone, address, notes, subtotal, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertItem = req.db.prepare(`
      INSERT INTO order_items (order_id, product_name, unit_price, quantity, line_total)
      VALUES (?, ?, ?, ?, ?)
    `);

    const createTransaction = req.db.transaction(() => {
      const result = insertOrder.run(
        customer.name,
        customer.phone,
        customer.address,
        customer.notes || '',
        subtotal,
        createdAt
      );
      const orderId = result.lastInsertRowid;

      for (const item of items) {
        insertItem.run(
          orderId,
          item.product_name,
          item.unit_price,
          item.quantity,
          item.unit_price * item.quantity
        );
      }

      return orderId;
    });

    let orderId;
    try {
      orderId = createTransaction();
    } catch (err) {
      console.error(err);
      return { status: 500, body: { error: 'Internal server error' } };
    }

    const whatsapp_link = buildWaLink({
      orderId,
      items,
      customer,
      subtotal,
      phone: BUSINESS_PHONE,
    });

    return { status: 201, body: { order_id: orderId, created_at: createdAt, whatsapp_link } };
  });

  return res.status(response.status).json(response.body);
});

export default router;
