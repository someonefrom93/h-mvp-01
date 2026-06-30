// @vitest-environment jsdom
/**
 * CartStore unit tests — jsdom environment.
 * Run with: npx vitest run
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k), clear: () => m.clear() };
}

function makeBus() {
  const listeners = new Map();
  return {
    addEventListener: (t, h) => (listeners.has(t) ? listeners.get(t) : listeners.set(t, []), listeners.get(t).push(h)),
    removeEventListener: (t, h) => { if (listeners.has(t)) listeners.set(t, listeners.get(t).filter(x => x !== h)); },
    fireStorage: (k, v) => listeners.has('storage') && listeners.get('storage').forEach(fn => fn({ key: k, newValue: v, oldValue: null })),
  };
}

// Mirrors app.js CartStore — factored here for isolated testing
function createCartStore({ storage, bus }) {
  const STORAGE_KEY = 'burger_cart_v1';
  let items = (() => { try { const r = storage.getItem(STORAGE_KEY); if (!r) return []; const d = JSON.parse(r); return (d?.version === 1 && Array.isArray(d.items)) ? d.items : []; } catch { return []; } })();
  const subscribers = new Set();
  function save() { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items })); }
  function emit() { subscribers.forEach(fn => fn(getItems())); }
  function getItems() { return items.slice(); }
  function subtotal() { return items.reduce((s, i) => s + i.unit_price * i.quantity, 0); }
  function count() { return items.reduce((n, i) => n + i.quantity, 0); }
  function add(product) {
    const e = items.find(i => i.id === product.id);
    e ? e.quantity++ : items.push({ id: product.id, name: product.name, unit_price: product.unit_price, category: product.category, quantity: 1 });
    save(); emit();
  }
  function remove(productId) { const idx = items.findIndex(i => i.id === productId); if (idx !== -1) { items.splice(idx, 1); save(); emit(); } }
  function setQty(productId, qty) { qty <= 0 ? remove(productId) : (() => { const item = items.find(i => i.id === productId); if (item) { item.quantity = qty; save(); emit(); } })(); }
  function clear() { items = []; save(); emit(); }
  bus.addEventListener('storage', e => { if (e.key === STORAGE_KEY) { items = (() => { try { const r = storage.getItem(STORAGE_KEY); if (!r) return []; const d = JSON.parse(r); return (d?.version === 1 && Array.isArray(d.items)) ? d.items : []; } catch { return []; } })(); emit(); } });
  return { add, remove, setQty, clear, getItems, subtotal, count, subscribe: fn => { subscribers.add(fn); return () => subscribers.delete(fn); } };
}

const WHOPPER  = { id: 'whopper', name: 'WHOPPER®', unit_price: 119, category: 'hamburguesas' };
const BIG_KING = { id: 'big-king', name: 'Big King', unit_price: 129, category: 'hamburguesas' };

describe('CartStore', () => {
  let storage, bus;
  beforeEach(() => { storage = makeStorage(); bus = makeBus(); vi.stubGlobal('localStorage', storage); vi.stubGlobal('window', bus); });

  // REQ-CA-1
  describe('add', () => {
    it('new product → qty 1 (SCN-CA-1)', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); expect(s.count()).toBe(1); expect(s.getItems()[0].quantity).toBe(1); });
    it('same product twice → qty merged to 2 (SCN-CA-2)', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); s.add(WHOPPER); expect(s.count()).toBe(2); expect(s.getItems()).toHaveLength(1); expect(s.getItems()[0].quantity).toBe(2); });
    it('two distinct products → both present', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); s.add(BIG_KING); expect(s.count()).toBe(2); expect(s.getItems()).toHaveLength(2); });
  });

  describe('remove', () => {
    it('removes correct item', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); s.add(BIG_KING); s.remove('whopper'); expect(s.getItems().map(i => i.id)).not.toContain('whopper'); });
    it('idempotent on unknown id', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); s.remove('unknown'); expect(s.count()).toBe(1); });
  });

  describe('setQty', () => {
    it('sets quantity', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); s.setQty('whopper', 3); expect(s.count()).toBe(3); });
    it('qty=0 removes item (SCN-CA-4)', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); s.setQty('whopper', 0); expect(s.count()).toBe(0); expect(s.getItems()).toHaveLength(0); });
    it('negative qty removes item', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); s.setQty('whopper', -1); expect(s.count()).toBe(0); });
  });

  describe('clear', () => {
    it('empties cart', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); s.add(BIG_KING); s.clear(); expect(s.getItems()).toHaveLength(0); expect(s.count()).toBe(0); });
  });

  describe('subtotal()', () => {
    it('sum of unit_price × quantity', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); s.add(WHOPPER); s.add(BIG_KING); expect(s.subtotal()).toBe(119 * 2 + 129); });
    it('empty cart → 0', () => { expect(createCartStore({ storage, bus }).subtotal()).toBe(0); });
  });

  describe('count()', () => {
    it('sum of all quantities', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); s.add(WHOPPER); s.add(BIG_KING); expect(s.count()).toBe(3); });
  });

  describe('getItems()', () => {
    it('returns snapshot — external mutation does not affect internal state', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); s.getItems().push({ id: 'hacked', quantity: 999 }); expect(s.getItems()).toHaveLength(1); });
  });

  // REQ-CA-2 — localStorage round-trip
  describe('localStorage round-trip (SCN-CA-3)', () => {
    it('cart survives simulated reload', () => { const s1 = createCartStore({ storage, bus }); s1.add(WHOPPER); s1.add(WHOPPER); s1.add(BIG_KING); const s2 = createCartStore({ storage, bus }); expect(s2.count()).toBe(3); expect(s2.subtotal()).toBe(119 * 2 + 129); });
    it('malformed JSON → empty cart', () => { storage.setItem('burger_cart_v1', 'not json {{{'); expect(createCartStore({ storage, bus }).count()).toBe(0); });
    it('missing version → empty cart', () => { storage.setItem('burger_cart_v1', JSON.stringify({ items: [{ id: 'x', quantity: 1 }] })); expect(createCartStore({ storage, bus }).count()).toBe(0); });
    it('non-array items → empty cart', () => { storage.setItem('burger_cart_v1', JSON.stringify({ version: 1, items: 'wrong' })); expect(createCartStore({ storage, bus }).count()).toBe(0); });
  });

  // REQ-CA-3 — cross-tab sync
  describe('cross-tab storage event (SCN-CA-5)', () => {
    it('storage event from another tab fires subscribers and reloads state', () => {
      const s = createCartStore({ storage, bus }); const calls = []; s.subscribe(calls.push.bind(calls));
      const newData = JSON.stringify({ version: 1, items: [{ id: 'big-king', name: 'Big King', unit_price: 129, category: 'hamburguesas', quantity: 1 }] });
      storage.setItem('burger_cart_v1', newData); bus.fireStorage('burger_cart_v1', newData);
      expect(s.count()).toBe(1); expect(calls).toHaveLength(1); expect(calls[0][0].id).toBe('big-king');
    });
    it('unrelated key → no effect', () => { const s = createCartStore({ storage, bus }); s.add(WHOPPER); bus.fireStorage('other_key', 'val'); expect(s.count()).toBe(1); });
  });

  // REQ-CA-4 — subscriber notifications
  describe('subscribers (REQ-CA-4)', () => {
    it('all subscribers fire on mutation', () => { const s = createCartStore({ storage, bus }); const c1 = [], c2 = []; s.subscribe(c1.push.bind(c1)); s.subscribe(c2.push.bind(c2)); s.add(WHOPPER); expect(c1).toHaveLength(1); expect(c2).toHaveLength(1); });
    it('unsubscribe stops notifications', () => { const s = createCartStore({ storage, bus }); const c = []; const u = s.subscribe(c.push.bind(c)); s.add(WHOPPER); expect(c).toHaveLength(1); u(); s.add(WHOPPER); expect(c).toHaveLength(1); });
  });
});
