/**
 * Hand-written order payload validator.
 * Returns { ok: true, value } or { ok: false, errors: [{ field, message }] }
 */
function validateOrderPayload(body) {
  const errors = [];
  const customer = body?.customer ?? {};

  if (typeof customer.name !== 'string' || customer.name.trim() === '') {
    errors.push({ field: 'customer.name', message: 'required' });
  }
  if (typeof customer.phone !== 'string' || customer.phone.trim() === '') {
    errors.push({ field: 'customer.phone', message: 'required' });
  }
  if (typeof customer.address !== 'string' || customer.address.trim() === '') {
    errors.push({ field: 'customer.address', message: 'required' });
  }

  if (!Array.isArray(body?.items) || body.items.length === 0) {
    errors.push({ field: 'items', message: 'must be a non-empty array' });
  }

  body?.items?.forEach((item, i) => {
    if (typeof item?.product_name !== 'string' || item.product_name === '') {
      errors.push({ field: `items[${i}].product_name`, message: 'required' });
    }
    if (typeof item?.unit_price !== 'number' || item.unit_price < 0) {
      errors.push({ field: `items[${i}].unit_price`, message: 'must be a non-negative number' });
    }
    if (typeof item?.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      errors.push({ field: `items[${i}].quantity`, message: 'must be a positive integer' });
    }
  });

  if (typeof body?.subtotal !== 'number' || body.subtotal < 0) {
    errors.push({ field: 'subtotal', message: 'must be a non-negative number' });
  }

  return errors.length === 0 ? { ok: true, value: body } : { ok: false, errors };
}

export { validateOrderPayload };
