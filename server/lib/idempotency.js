/**
 * In-memory idempotency store with 24h TTL.
 * Lazy-sweeps expired entries on every call to withIdempotency.
 */
const store = new Map();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function withIdempotency(key, fn) {
  const now = Date.now();
  // Lazy sweep
  for (const [k, v] of store) {
    if (v.expiresAt < now) store.delete(k);
  }

  if (key) {
    const cached = store.get(key);
    if (cached && cached.expiresAt > now) {
      return { cached: true, response: cached.response };
    }
  }

  const response = fn();
  if (key) {
    store.set(key, { response, expiresAt: now + TTL_MS });
  }
  return { cached: false, response };
}

export { withIdempotency };
