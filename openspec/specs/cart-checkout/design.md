# Design: cart-checkout

> Outcome: turn the existing 17-card Burger King México clone from a static showcase into a functional ordering flow — real cart state, slide-in drawer, customer checkout, order persistence, WhatsApp handoff — without changing the visual design or the existing dirty work tree.

## Quick path

1. **PR 1** drops a `server/` directory with Node + Express + SQLite. Single port (`3000`) serves the static files and the API. `POST /api/orders` is the first and only endpoint; vitest + supertest land with it.
2. **PR 2a** introduces `CartStore` (closure singleton, `burger_cart_v1` localStorage, observer pattern) and wires 17 "Agregar al carrito" buttons to it. Replaces the `$0.00` demo counter with a real `.cart-badge`.
3. **PR 2b** adds the right-side `.cart-drawer` (native `<dialog>` with `showModal()`, ± controls, subtotal footer, "Ir a pagar" stub).
4. **PR 3** opens a full-screen `<dialog>` checkout modal — name/phone/address/notes form, draft-persisted under `burger_checkout_draft_v1`, single in-flight POST, success/error states.
5. **PR 4** generates the `wa.me/` link server-side (`server/lib/whatsapp.js`), returns it in the 201 body, renders `<a target="_blank">` on the success screen.
6. **PR 5** is polish — empty-cart copy, clear-cart confirmation, `aria-live`, focus-visible, and the `.card--revealed` refactor that finally lets `.card:hover` lift work.

## Decisions at a glance

| Decision | Choice | Why |
|---|---|---|
| Project layout | `server/` at repo root with its own `package.json` | Matches Node idiom; keeps static files at root; no workspace overhead for a 6-PR MVP |
| Dev topology | **Single port** — back-end serves the static files | Avoids CORS configuration; one process to run |
| CartStore shape | Closure singleton exposing `add/remove/setQty/clear/getItems/subtotal/count/subscribe` | Matches the existing IIFE module style; one instance per page is the only sane model |
| Subscriber model | Plain `subscribe(fn)` returning unsubscribe | 20-line implementation; no abstraction needed |
| Product IDs | Static `DATA_PRODUCTS` map in `app.js` mapping card id → `{id, name, unit_price, category}` | Stable, explicit, survives renaming; avoids slug-of-title parsing |
| Validation | Hand-written in route handler | zod's ~15 KB is wasted on five required-field checks for an MVP |
| Idempotency | `Idempotency-Key` header, in-memory `Map` with 24h TTL | Spec calls for it; SQLite-backed persistence can be added later without changing the route shape |
| CORS | **Not needed** — single port | See "Dev topology" |
| Drawer modal | Native `<dialog>` + `showModal()` | Built-in focus trap, ESC handling, backdrop; zero dependencies |
| Checkout modal | Full-screen `<dialog>` overlay, not an in-page section | Single-task interruption; clean focus boundary; matches existing drawer UX |
| Card-reveal fix | Option B: `card.classList.add('card--revealed')` — replace inline style with class | No HTML change; declarative CSS; `.card:hover` keeps winning the cascade |
| Vitest config | `server/vitest.config.js` first; top-level config added only if/when front-end tests need jsdom | YAGNI; current tests target server code only |
| Quantity controls | ± buttons with explicit × remove (decision locked in `_decisions.md`) | Most-expected ordering UX |

---

## 1. Project layout

**Choice**: `server/` directory at repo root with its own `package.json`.

**Rejected**:
- `backend/` subdirectory — less idiomatic in Node land; `server/` is the convention.
- npm workspaces monorepo split — over-engineering for 6 PRs on a project whose front-end has zero npm dependencies and stays that way.

**Final tree after PR 1**:

```
.
├── index.html                  (extended in PRs 2a/2b/3/5)
├── styles.css                  (extended in PRs 2a/2b/3/5)
├── app.js                      (extended in PRs 2a/2b/3/4/5)
├── server/
│   ├── package.json            (NEW — PR 1)
│   ├── vitest.config.js        (NEW — PR 1)
│   ├── index.js                (NEW — PR 1; Express app, serves static + API)
│   ├── config.js               (NEW — PR 1; PORT, DB_PATH, BUSINESS_PHONE)
│   ├── db.js                   (NEW — PR 1; better-sqlite3 wrapper)
│   ├── migrate.js              (NEW — PR 1; schema_version table + DDL)
│   ├── routes/
│   │   └── orders.js           (NEW — PR 1; POST /api/orders)
│   ├── lib/
│   │   ├── validate.js         (NEW — PR 1; hand-written payload validation)
│   │   ├── idempotency.js      (NEW — PR 1; in-memory key store + TTL)
│   │   └── whatsapp.js         (NEW — PR 4; buildWaLink())
│   └── __tests__/
│       ├── orders.test.js      (NEW — PR 1; supertest happy + sad paths)
│       └── whatsapp.test.js    (NEW — PR 4)
└── README.md                   (updated PR 1 with two-terminal dev instructions)
```

**Run commands** (after PR 1):

| Purpose | Command | Port |
|---|---|---|
| Back-end only (dev) | `npm --prefix server run dev` | 3000 |
| Back-end tests | `npm --prefix server test` | — |
| Static files (legacy, if needed) | `python3 -m http.server 5173` | 5173 |

`npm --prefix server run dev` invokes `node --watch server/index.js` (Node 22+ has `--watch` built in; if Node <22, fall back to `nodemon server/index.js`).

The back-end mounts the repo root as static: `app.use(express.static(path.join(__dirname, '..')))`. `/api/*` is mounted first so the static handler doesn't shadow it. This means one URL — `http://localhost:3000` — serves the page and the API.

## 2. CartStore internals (PR 2a)

### 2.1 Module shape

**Choice**: Closure singleton.

```js
// app.js — appended to the existing IIFE
const CartStore = (() => {
  const STORAGE_KEY = 'burger_cart_v1';
  let items = load();
  const subscribers = new Set();

  function load() { /* read localStorage, return [] on miss/bad-shape */ }
  function save()  { /* localStorage.setItem(STORAGE_KEY, JSON.stringify(...)) */ }
  function emit()  { subscribers.forEach(fn => fn(getItems())); }

  return {
    add(product) { /* merge by id, +1 quantity */ },
    remove(productId) { /* splice */ },
    setQty(productId, qty) { /* set; remove if qty <= 0 */ },
    clear() { /* empty array */ },
    getItems() { return items.slice(); },         // snapshot
    subtotal() { return items.reduce((s, i) => s + i.unit_price * i.quantity, 0); },
    count()    { return items.reduce((n, i) => n + i.quantity, 0); },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
  };
})();
```

**Why a singleton**: There is exactly one cart per browser tab. A factory would let a careless caller create a second instance and diverge from `localStorage`. A class would add `new` ceremony for no benefit. A closure matches the existing IIFE pattern.

### 2.2 Subscriber model

`subscribe(fn)` adds to a `Set` and returns an unsubscribe function. The nav badge subscribes once at boot; the cart drawer (PR 2b) subscribes when it mounts and unsubscribes on close to avoid leaks. No `EventTarget`, no `EventEmitter` — both are heavier and not warranted.

### 2.3 localStorage serialization

Shape on disk:

```json
{
  "version": 1,
  "items": [
    { "id": "whopper", "name": "WHOPPER®", "unit_price": 119, "category": "hamburguesas", "quantity": 2 }
  ]
}
```

**Version handling**: `version` is read on load. If it is missing or not `1`, treat as empty (do not throw). Future bumps (e.g. `burger_cart_v2`) would either migrate or clear — implementation cost is low because the shape is the only one we own.

**Tab sync**: `window.addEventListener('storage', e => { if (e.key === STORAGE_KEY) { items = load(); emit(); } })`. The `storage` event fires only in *other* tabs, never the one that wrote — so we do not double-emit.

### 2.4 Product ID strategy

**Choice**: Static `DATA_PRODUCTS` map at the top of `app.js`, mirroring the 17 menu cards.

```js
const DATA_PRODUCTS = [
  { id: 'whopper',           name: 'WHOPPER®',           unit_price: 119, category: 'hamburguesas' },
  { id: 'big-king',          name: 'Big King',           unit_price: 129, category: 'hamburguesas' },
  { id: 'hamburguesa-bbq',   name: 'Hamburguesa BBQ',    unit_price: 109, category: 'hamburguesas' },
  { id: 'doble-queso',       name: 'Doble Queso',        unit_price:  89, category: 'hamburguesas' },
  { id: 'pollo-crujiente',   name: 'Pollo Crujiente',    unit_price:  99, category: 'pollo' },
  { id: 'nuggets-6',         name: 'Nuggets (6 piezas)', unit_price:  69, category: 'pollo' },
  { id: 'pollo-bbq',         name: 'Pollo BBQ',          unit_price: 109, category: 'pollo' },
  { id: 'papas-francesa',    name: 'Papas a la Francesa',unit_price:  49, category: 'acompanamientos' },
  { id: 'onion-rings',       name: 'Onion Rings',        unit_price:  55, category: 'acompanamientos' },
  { id: 'papas-supreme',     name: 'Papas Supreme',      unit_price:  69, category: 'acompanamientos' },
  { id: 'ensalada-fresca',   name: 'Ensalada Fresca',    unit_price:  59, category: 'acompanamientos' },
  { id: 'coca-cola',         name: 'Coca-Cola',          unit_price:  35, category: 'bebidas' },
  { id: 'limonada-natural',  name: 'Limonada Natural',   unit_price:  39, category: 'bebidas' },
  { id: 'malteada-chocolate',name: 'Malteada de Chocolate', unit_price: 59, category: 'bebidas' },
  { id: 'sundae-chocolate',  name: 'Sundae de Chocolate',unit_price:  45, category: 'postres' },
  { id: 'pie-de-manzana',    name: 'Pie de Manzana',     unit_price:  39, category: 'postres' },
  { id: 'cono-de-nieve',     name: 'Cono de Nieve',      unit_price:  29, category: 'postres' },
];
```

PR 2a adds `data-product-id="..."` to each menu card and a tiny render-time lookup: `CartStore.add(DATA_PRODUCTS.find(p => p.id === card.dataset.productId))`. The button click handler reads from the map, not from the DOM — prices and names stay in one place.

**Why a map and not parsing**: Card titles contain `®`, accents, and (in the future) variant suffixes. A slug-of-title parser would need a normalization table anyway. The map makes renames explicit and lets future menu changes (price edits, new products) live in JS without touching HTML.

### 2.5 CartStore tests (PR 2a)

Vitest unit tests in a new top-level `tests/cart-store.test.js`. Use `vi.stubGlobal('localStorage', memoryStorage)` where `memoryStorage` is a 20-line in-memory implementation backing `getItem`/`setItem`/`removeItem`. Pattern:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeMemoryStorage() {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), clear: () => m.clear() };
}

beforeEach(() => { vi.stubGlobal('localStorage', makeMemoryStorage()); vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} }); });
```

Covered cases: add (merges quantity), remove, setQty to zero removes, setQty negative removes, clear, subtotal math, count math, localStorage round-trip, `storage` event triggers reload, multiple subscribers all fire.

The CartStore code lives inside the existing IIFE in `app.js` for production, but is also factored into a small factory `createCartStore({ storage, bus })` exposed at module scope so tests can instantiate isolated stores. The IIFE version becomes `const CartStore = createCartStore({ storage: localStorage, bus: window })`.

## 3. Express + SQLite module boundaries (PR 1)

### 3.1 File responsibilities

| File | LOC est | Responsibility |
|---|---|---|
| `server/index.js` | ~40 | Express app factory, mounts `/api/orders`, serves `../` as static, opens DB, runs migrations, listens on `config.PORT` |
| `server/config.js` | ~15 | `PORT=3000`, `DB_PATH=path.join(__dirname,'data','orders.db')`, `BUSINESS_PHONE` (digits-only, throws if not) |
| `server/db.js` | ~30 | Opens `better-sqlite3` connection, exports `prepare(sql)` and `transaction(fn)` helpers |
| `server/migrate.js` | ~40 | `migrate(db)` — checks `schema_version`, applies migrations idempotently |
| `server/routes/orders.js` | ~90 | `POST /api/orders` handler: parse → validate → idempotency check → tx insert → build response |
| `server/lib/validate.js` | ~40 | `validateOrderPayload(body)` returning `{ ok: true, value }` or `{ ok: false, errors: [...] }` |
| `server/lib/idempotency.js` | ~30 | `withIdempotency(key, fn)` — checks `Map`, runs `fn`, stores result, sweeps expired |
| `server/__tests__/orders.test.js` | ~150 | supertest happy path, 6 SCN-BE-* scenarios, idempotent replay |
| `server/__tests__/whatsapp.test.js` (PR 4) | ~80 | encoding edge cases, 20-item order |
| `server/vitest.config.js` | ~10 | environment: node, includes `__tests__/**/*.test.js` |

### 3.2 SQLite access pattern

`better-sqlite3` is synchronous, which is the entire point of using it. We expose two helpers:

```js
// server/db.js
const Database = require('better-sqlite3');
const path = require('path');
const config = require('./config');

function openDatabase(dbPath = config.DB_PATH) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

module.exports = { openDatabase };
```

Route code uses `db.prepare(sql)` directly — no extra wrapper layer. Transactions are written as `db.transaction(items => { ... })(args)`.

### 3.3 Schema migration

`server/migrate.js` runs at boot, before `app.listen`. It is idempotent.

```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name  TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  address        TEXT NOT NULL,
  notes          TEXT,
  subtotal       REAL NOT NULL,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  unit_price   REAL NOT NULL,
  quantity     INTEGER NOT NULL,
  line_total   REAL NOT NULL
);

INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (1, datetime('now'));
```

Future migrations would add a row to `schema_version` and apply forward; for an MVP, version 1 is the only one and the logic is "create if missing, record applied". Document the upgrade path in `migrate.js` as a comment block but do not implement it.

### 3.4 Validation

**Choice**: Hand-written validation in `server/lib/validate.js`.

```js
function validateOrderPayload(body) {
  const errors = [];
  const customer = body?.customer ?? {};
  if (typeof customer.name !== 'string' || customer.name.trim() === '') errors.push({ field: 'customer.name', message: 'required' });
  if (typeof customer.phone !== 'string' || customer.phone.trim() === '') errors.push({ field: 'customer.phone', message: 'required' });
  if (typeof customer.address !== 'string' || customer.address.trim() === '') errors.push({ field: 'customer.address', message: 'required' });
  if (!Array.isArray(body?.items) || body.items.length === 0) errors.push({ field: 'items', message: 'must be a non-empty array' });
  body?.items?.forEach((item, i) => {
    if (typeof item?.product_name !== 'string' || item.product_name === '') errors.push({ field: `items[${i}].product_name`, message: 'required' });
    if (typeof item?.unit_price !== 'number' || item.unit_price < 0) errors.push({ field: `items[${i}].unit_price`, message: 'must be a non-negative number' });
    if (typeof item?.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) errors.push({ field: `items[${i}].quantity`, message: 'must be a positive integer' });
  });
  if (typeof body?.subtotal !== 'number' || body.subtotal < 0) errors.push({ field: 'subtotal', message: 'must be a non-negative number' });
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
```

**Why not zod**: zod is ~15 KB gzipped and pulls in transitive deps. Five field checks don't justify it for an MVP. If validation grows (PRs after the initial 6), migrate then.

### 3.5 Error response shape

**400 (validation)**:
```json
{ "errors": [{ "field": "customer.name", "message": "required" }, ...] }
```

**500 (unexpected)**:
```json
{ "error": "Internal server error" }
```

The 500 case never echoes the message to the client (no SQL traces leak). Errors are logged with `console.error(err)` so the operator sees the stack.

### 3.6 Idempotency

**Header**: `Idempotency-Key`. Client generates via `crypto.randomUUID()`.

**Storage**: `Map<string, { statusCode: number, body: object, expiresAt: number }>` in `server/lib/idempotency.js`. The route:

1. If header present and key already in Map and not expired → return cached response.
2. Otherwise, run handler normally, store `{ statusCode, body, expiresAt = Date.now() + 86_400_000 }`.
3. Lazy sweep on every `withIdempotency` call: drop entries past `expiresAt`.

**Why in-memory**: matches MVP scope. Survives process lifetime (which is enough for the "double-tap submits twice in 200ms" case). When/if the server restarts mid-checkout, the worst case is a duplicate order — which is the same risk as today (no idempotency), and the spec's `Idempotency-Key` design lets us swap to SQLite without changing the route shape.

**24h TTL** is arbitrary but covers any realistic customer return window. Configurable later.

### 3.7 CORS / dev topology

**Choice**: Single port. Back-end serves the static files.

`server/index.js`:
```js
const path = require('path');
app.use('/api', require('./routes/orders'));
app.use(express.static(path.join(__dirname, '..')));
app.listen(config.PORT, () => console.log(`Burger King server on http://localhost:${config.PORT}`));
```

**Why single port**: avoids CORS configuration entirely, avoids `5173` vs `3000` confusion in the README, makes the README one command, makes the front-end code simpler (no `fetch` cross-origin flags, no CORS preflight). Cost: one `npm install` for what used to be a static project — already accepted.

### 3.8 Tests

Pattern: supertest boots the Express app in-process against an in-memory SQLite. A test helper:

```js
// server/__tests__/helpers.js
const { openDatabase } = require('../db');
const { migrate } = require('../migrate');
function makeApp() {
  const db = openDatabase(':memory:');
  migrate(db);
  return require('../index').createApp({ db });
}
```

Test cases (per spec SCN-BE-1..6):
- Happy path → 201, response contains `order_id` and `created_at`, DB has 1 order + N items
- Empty `customer.name` → 400 with `errors[].field === 'customer.name'`, no rows inserted
- Empty `items` array → 400 with `errors[].field === 'items'`
- Negative `quantity` → 400 referencing the item index
- SQL-injection string in `product_name` → 201, stored verbatim, `orders` table untouched
- Idempotency: replay same `Idempotency-Key` → returns cached response, single row in DB
- Schema auto-migration: drop tables, re-create app, schema present

## 4. Cart drawer UI (PR 2b)

### 4.1 Class naming

**Choice**: `.cart-drawer` and `.cart-scrim`. Do NOT reuse the existing `.drawer` and `.scrim`.

Rationale:
- The existing `.drawer` slides in from the **left** and is sized `min(85vw, 320px)`. The cart drawer slides in from the **right** and should be wider (~380–420px) to fit item rows comfortably.
- Reusing would force a media-query inversion or a direction override that breaks the existing mobile nav's expected behavior.
- Distinct class names make the cart drawer searchable in CSS, devtools, and code review.

The cart drawer reuses the `.btn--cart` trigger and the existing `body.overflow = 'hidden'` lock pattern.

### 4.2 Markup shape

```html
<dialog class="cart-drawer" id="cartDrawer" aria-label="Tu carrito">
  <header class="cart-drawer__head">
    <h2 class="cart-drawer__title">Tu carrito</h2>
    <button class="cart-drawer__close" id="cartDrawerClose" aria-label="Cerrar carrito">×</button>
  </header>
  <div class="cart-drawer__body" id="cartDrawerBody"></div>
  <footer class="cart-drawer__foot">
    <div class="cart-drawer__subtotal">
      <span>Subtotal</span>
      <strong id="cartDrawerSubtotal">$0</strong>
    </div>
    <button class="btn btn--primary cart-drawer__cta" id="cartDrawerCheckout" disabled>Ir a pagar</button>
  </footer>
</dialog>
```

`cart-drawer__body` is re-rendered on every cart change (see 4.4). The empty state lives inside that body — when `count() === 0` the body becomes the "Tu carrito está vacío" panel; the CTA is `disabled` either way.

### 4.3 Animation

CSS transition on the dialog itself is unreliable cross-browser (Chromium-based dialogs honor `::backdrop` but the slide-from-right pattern needs workarounds). Pattern:

```css
.cart-drawer {
  position: fixed;
  top: 0; right: 0;
  height: 100dvh;
  width: min(420px, 92vw);
  max-width: 100vw;
  border: 0;
  margin: 0;
  padding: 0;
  background: #fff;
  box-shadow: var(--shadow-md);
  transform: translateX(100%);
  transition: transform .25s ease, overlay .25s ease allow-discrete, display .25s ease allow-discrete;
}
.cart-drawer[open] { transform: translateX(0); }
.cart-drawer::backdrop { background: rgba(40,20,10,.45); }
@starting-style { .cart-drawer[open] { transform: translateX(100%); } }
```

The project's existing `prefers-reduced-motion: reduce` rule at line 605 of `styles.css` already forces `transition-duration: 0.001ms` — no extra rule needed for SCN-CD-6 / REQ-CD-6.

### 4.4 Focus trap — native `<dialog>`

**Choice**: Native `<dialog>` with `dialog.showModal()` / `dialog.close()`.

**Why**:
- Browser handles focus trap (Tab cycles inside, Shift+Tab cycles back).
- Browser handles ESC keypress → fires `cancel` event.
- Browser handles inertness of the rest of the page (no need to set `aria-hidden` on `<main>`).
- Zero dependencies.
- 2026 baseline browser support is universal for `showModal()`.

A hand-rolled focus trap is ~30 lines and has edge cases (form fields inside shadow DOM, dynamically added controls). Native `<dialog>` gets all of it for free.

**Fallback for older browsers**: not implemented. If Safari < 15.4 shows up in telemetry we revisit.

### 4.5 Render strategy

**Choice**: Re-render the entire `cart-drawer__body` on every cart change. ≤20 items is fine; the operations are O(n) innerHTML update.

```js
function renderCartDrawer() {
  const items = CartStore.getItems();
  if (items.length === 0) {
    cartDrawerBody.innerHTML = `<p class="cart-drawer__empty">Tu carrito está vacío</p>`;
    cartDrawerCheckout.disabled = true;
  } else {
    cartDrawerBody.innerHTML = items.map(item => `
      <article class="cart-row" data-id="${item.id}">
        <div class="cart-row__info">
          <h3 class="cart-row__name">${escapeHtml(item.name)}</h3>
          <span class="cart-row__price">$${item.unit_price}</span>
        </div>
        <div class="cart-row__qty">
          <button class="cart-row__btn" data-action="dec" aria-label="Restar uno">−</button>
          <span class="cart-row__qty-value">${item.quantity}</span>
          <button class="cart-row__btn" data-action="inc" aria-label="Sumar uno">+</button>
          <button class="cart-row__btn cart-row__btn--remove" data-action="remove" aria-label="Quitar del carrito">×</button>
        </div>
        <div class="cart-row__line-total">$${(item.unit_price * item.quantity).toFixed(0)}</div>
      </article>
    `).join('');
    cartDrawerCheckout.disabled = false;
  }
  cartDrawerSubtotal.textContent = `$${CartStore.subtotal().toFixed(0)}`;
}
```

Surgical updates are unnecessary at this scale and would complicate event delegation. Re-render wins.

## 5. Checkout flow (PR 3)

### 5.1 Modal vs page-section — modal

**Choice**: Full-screen `<dialog>` overlay.

Rationale:
- Checkout is a single-task interruption of browsing — modal semantics fit.
- The cart drawer is the immediate previous step; closing it cleanly and opening a fresh dialog is cleaner than turning the page into a wizard.
- Native `<dialog>` gives focus trap, ESC handling, backdrop — the same affordances as the cart drawer.
- Render strategy: keep the cart drawer DOM intact behind the modal; we re-open it after success or on close-without-submit.

The checkout modal lives in its own `<dialog id="checkoutModal">`, sibling to `<dialog id="cartDrawer">`. Opening one closes the other via `close` event handlers.

### 5.2 Form fields and validation

| Field | Required | Client validation |
|---|---|---|
| `name` | yes | trimmed length > 0 |
| `phone` | yes | matches `/^\+?\d{10,15}$/` (10–15 digits, optional `+` prefix) |
| `address` | yes | trimmed length > 0 |
| `notes` | no | no validation |

Phone regex `/^\+?\d{10,15}$/` accepts `5512345678`, `+5215512345678`, `525512345678`. It does not enforce a Mexican country code specifically — the spec only requires "phone matches a Mexican phone regex"; the broader 10–15 digit pattern is more permissive and covers Mexican mobile and landline without false negatives. Server-side validation is also permissive for the same reason — the business phone is what receives the order, and the customer-supplied phone is for callback.

Errors are surfaced inline next to each field:

```html
<input id="coName" name="name" required aria-invalid="true" aria-describedby="coName-err">
<p class="form-err" id="coName-err" hidden>Ingresa tu nombre</p>
```

`form-err` becomes visible (`hidden=false`) on submit if the field is invalid.

### 5.3 Submit state machine

States: `idle → submitting → success` or `idle → submitting → error`.

```js
async function submitOrder() {
  if (submitState !== 'idle') return;
  submitState = 'submitting';
  checkoutForm.setAttribute('aria-busy', 'true');
  submitBtn.disabled = true;
  try {
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(payload) });
    if (res.status === 201) {
      const body = await res.json();
      submitState = 'success';
      showSuccess(body);
    } else {
      submitState = 'error';
      const body = await res.json().catch(() => ({}));
      showError(body.errors ?? [{ message: 'No se pudo procesar el pedido' }]);
      submitBtn.disabled = false;
      checkoutForm.removeAttribute('aria-busy');
    }
  } catch (e) {
    submitState = 'error';
    showError([{ message: 'Sin conexión. Verifica tu red e inténtalo de nuevo.' }]);
    submitBtn.disabled = false;
    checkoutForm.removeAttribute('aria-busy');
  }
}
```

State is held in a closure variable; `aria-busy` is the single source of truth for assistive tech. The success view replaces the form children (not the dialog), so the dialog stays open.

### 5.4 Idempotency key on the client

`crypto.randomUUID()` is in all 2026 browsers. One key per submit attempt — a fresh key is generated each time the user clicks "Confirmar pedido" after an error. This means retries are allowed but accidental double-taps within the same submit state are blocked by the `submitState !== 'idle'` guard, so the in-memory guard handles the 200ms case while the `Idempotency-Key` header handles browser/network-level retries.

### 5.5 Draft persistence

```js
const DRAFT_KEY = 'burger_checkout_draft_v1';

function readDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) ?? {}; } catch { return {}; } }
function writeDraft(values) { localStorage.setItem(DRAFT_KEY, JSON.stringify(values)); }
function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

function mountCheckoutForm() {
  const draft = readDraft();
  coName.value = draft.name ?? '';
  coPhone.value = draft.phone ?? '';
  coAddress.value = draft.address ?? '';
  coNotes.value = draft.notes ?? '';
  for (const input of [coName, coPhone, coAddress, coNotes]) {
    input.addEventListener('input', () => writeDraft({ name: coName.value, phone: coPhone.value, address: coAddress.value, notes: coNotes.value }));
  }
}
```

On successful submit: `clearDraft()`. On modal close without submit: leave the draft alone — the customer may have been interrupted intentionally and we should not punish them.

## 6. WhatsApp link generation (PR 4)

### 6.1 Where the link is built

**Choice**: Server-side, in the order creation route, after the DB insert succeeds. Returned in the 201 response as `whatsapp_link`. The front-end renders it as `<a href="${response.whatsapp_link}">`.

`server/lib/whatsapp.js` exports `buildWaLink({ orderId, items, customer, subtotal, phone })`. Phone comes from `config.BUSINESS_PHONE`. The function is pure (no DB, no IO) and trivial to unit-test.

### 6.2 Message template (SCN-WA-2 verifiable)

```
Nuevo pedido #42
----------------
2 × WHOPPER® = $238
1 × Coca-Cola = $35
----------------
Subtotal: $273

Cliente: María Ñoño
Teléfono: 5512345678
Dirección: Av. Insurgentes 100, piso 3°
Notas: Sin cebolla en la Whopper
```

Encoded with `encodeURIComponent` (which already percent-encodes UTF-8 multibyte sequences correctly — `encodeURIComponent('María')` → `'Mar%C3%ADa'`). Double-encoding is prevented because we encode exactly once, on a freshly built string.

Final URL: `https://wa.me/5215512345678?text=<encoded>`.

### 6.3 Long-order handling

If `url.length > MAX_URL_LENGTH` (default `2000`), truncate the itemized list and append a summary line:

```
Nuevo pedido #42
----------------
5 × WHOPPER® = $595
4 × Big King = $516
3 × Coca-Cola = $105
2 × Papas a la Francesa = $98
1 × Onion Rings = $55
... y 5 artículos más ($423)
----------------
Subtotal: $1792

Cliente: ...
```

Algorithm:

```js
function buildWaLink({ orderId, items, customer, subtotal, phone }) {
  const MAX = 2000;
  const header = `Nuevo pedido #${orderId}\n----------------\n`;
  const customerBlock = `\n----------------\nSubtotal: $${subtotal}\n\nCliente: ${customer.name}\nTeléfono: ${customer.phone}\nDirección: ${customer.address}${customer.notes ? `\nNotas: ${customer.notes}` : ''}`;
  const urlBase = `https://wa.me/${phone}?text=`;
  const baseLen = urlBase.length + encodeURIComponent(header + customerBlock).length;

  const lines = items.map(i => `${i.quantity} × ${i.name} = $${i.unit_price * i.quantity}`);
  let body = header + lines.join('\n') + customerBlock;
  let url = urlBase + encodeURIComponent(body);

  if (url.length > MAX) {
    // Keep first 5 items, summarize the rest
    const kept = lines.slice(0, 5);
    const restCount = items.length - 5;
    const restTotal = items.slice(5).reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const summary = `... y ${restCount} artículos más ($${restTotal})`;
    body = header + kept.join('\n') + '\n' + summary + customerBlock;
    url = urlBase + encodeURIComponent(body);
  }
  return url;
}
```

Worst case is a 20-item order where the customer block is short — `header + 20 lines + customerBlock ≈ 1500 chars`, URL ≈ 1900 chars, under the cap. The truncation branch is mostly defensive.

### 6.4 Phone format validation at boot

`server/config.js`:

```js
const BUSINESS_PHONE = '5215512345678';
if (!/^\d{10,15}$/.test(BUSINESS_PHONE)) {
  throw new Error('BUSINESS_PHONE must be 10-15 digits, no + or spaces');
}
module.exports = { BUSINESS_PHONE, /* ... */ };
```

Failing fast at module load means a misconfigured deploy never serves a single bad request. Server exits non-zero on bad config — fine for an MVP.

### 6.5 Tests

Vitest cases for `buildWaLink`:
- Spanish characters in customer name and address survive round-trip (`decodeURIComponent` of the `text` param produces identical input).
- `+` not present in the URL.
- Spaces, dashes, parentheses stripped from phone if accidentally present (extra defensive test).
- 20-item order produces a valid URL containing all items (or the summary line).
- HTML in `product_name` is NOT escaped to entities — it should be URL-encoded as `%3C` etc., not `&lt;`.

## 7. Card-reveal class refactor (PR 5)

**Choice**: Option B — class-based reveal.

### 7.1 Why

- Zero HTML change.
- `.card:hover { transform: translateY(-4px); }` keeps working because both `.card` and `.card--revealed` are class-based rules, and `.card:hover` wins by specificity (`:hover` is more specific than `.card--revealed`).
- CSS becomes declarative; no JS animation logic remains in the reveal.

### 7.2 The change to `app.js`

Replace lines 87–104 (the IO block at the bottom of the IIFE):

**Before**:
```js
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

  cards.forEach((card) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(16px)';
    card.style.transition = 'opacity .55s ease, transform .55s ease';
    io.observe(card);
  });
}
```

**After**:
```js
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('card--revealed');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
  cards.forEach((card) => io.observe(card));
}
```

### 7.3 The change to `styles.css`

Replace the existing `.card` rules:

```css
.card {
  background: #fff;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity .55s ease, transform .55s ease, box-shadow .2s ease;
}
.card--revealed { opacity: 1; transform: translateY(0); }
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}
```

Specificity check:
- `.card` selector — 0,1,0
- `.card--revealed` — 0,1,0 (same as `.card`, but applied later → wins)
- `.card:hover` — 0,2,0 (`:hover` is a pseudo-class) → wins over both

When a card is revealed and the user hovers, `:hover` lifts it by `-4px`. When the user moves away, the card falls back to `.card--revealed`'s `translateY(0)`. No JS, no inline style.

### 7.4 Side effect: menu tab filter

PR 2a also touches `.card` style — line 116 of `app.js` sets `card.style.transform = 'translateY(0)'` when the tab filter activates a hidden card. This must also be removed in PR 5 (or earlier — whichever slice picks it up). The replacement is `card.classList.add('card--revealed')`. If a previously-hidden card has not yet been observed by the IO, the manual reveal is needed; if it has been observed, the class is already present. The class is idempotent — no guard needed.

### 7.5 PR 5 scope

This is the **only** `app.js` change PR 5 makes. The rest of the polish (empty cart copy, clear-cart confirmation, focus-visible, labels, aria-live) is additive HTML/CSS or a small styles.css patch.

## 8. Vitest setup (PR 1)

### 8.1 Config location

**Choice**: `server/vitest.config.js`. No top-level config in PR 1.

```js
// server/vitest.config.js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.js'],
    globals: false,
  },
});
```

If/when front-end CartStore tests land in PR 2a and need jsdom, add a top-level `vitest.config.js` then, with two named projects (`server` and `dom`). For now, server-only is enough.

### 8.2 Test command

In `server/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "node --watch index.js"
  }
}
```

PR 1 also adds dependencies: `express`, `better-sqlite3`, `vitest`, `supertest`. Dev: `supertest`.

### 8.3 Coverage

**Not configured**. No thresholds, no `--coverage` flag. The MVP does not need coverage gates; if/when it grows, add `@vitest/coverage-v8` later. Avoid over-engineering.

### 8.4 Environment pattern

For PR 1 tests: `environment: 'node'` (the default). For PR 2a CartStore tests, the test file declares its own environment via the docblock:

```js
// @vitest-environment jsdom
```

This requires `jsdom` as a devDependency, added in PR 2a. No config change needed.

## 9. 400-line budget forecast

Per-PR estimates (additions + deletions in the diff). Budget is **400** lines per PR.

| PR | Files | LOC est | Status | Notes |
|---|---|---|---|---|
| **1** Backend skeleton | `server/package.json` (25), `server/vitest.config.js` (10), `server/config.js` (15), `server/db.js` (30), `server/migrate.js` (40), `server/routes/orders.js` (90), `server/__tests__/orders.test.js` (150), `server/index.js` (40), `README.md` (+15) | **~415** | **MEDIUM** | Right at the line. Tests are deliberately verbose because of the 7 SCN-BE-* scenarios. If it slips over, drop the SQL-injection test to a one-liner and ship. |
| **2a** Cart state | `app.js` (+110), `index.html` (+20 inline `data-product-id` + `<button>` × 17), `styles.css` (+40), `tests/cart-store.test.js` (new, ~150) | **~320** | Safe | |
| **2b** Cart drawer | `app.js` (+170 drawer module), `index.html` (+40 dialog markup), `styles.css` (+110) | **~320** | Safe | |
| **3** Checkout | `app.js` (+200 state machine + form wiring), `index.html` (+60 modal markup), `styles.css` (+140), `server/routes/orders.js` (~10 patch for Idempotency-Key passthrough) | **~410** | **MEDIUM** | At the line. CSS for the modal (form layout, success/error states, focus rings) is the bulk. If it slips: drop the success-state styling to PR 5 and ship minimal "thank you" copy. |
| **4** WhatsApp | `server/lib/whatsapp.js` (new, ~80), `server/routes/orders.js` (+25 patch), `server/__tests__/whatsapp.test.js` (new, ~80), `app.js` (+30 link render), `index.html` (+10 anchor) | **~225** | Safe | |
| **5** Polish | `app.js` (+20 reveal refactor + form draft listener wiring + clear-cart confirm), `styles.css` (+60 empty state + focus-visible + reduced-motion parity), `index.html` (+30 labels + aria-live regions + labels) | **~180** | Safe | |

### 9.1 Sub-slicing recommendation

**PR 1 and PR 3 are the closest to the 400-line ceiling.** Neither needs sub-slicing if the implementer is disciplined:

- PR 1: keep validation hand-written (no zod), keep test cases scoped to spec scenarios only (no extra property-based tests), keep `migrate.js` minimal.
- PR 3: do not introduce a CSS framework; reuse existing tokens (`--bk-cream`, `--bk-orange`, etc.); use the same `<dialog>` pattern as PR 2b; keep the success state to one `<div>` and one paragraph.

If either genuinely exceeds 400, the recommended sub-slice is:
- PR 1 → split `server/__tests__/orders.test.js` from the rest into a PR 1.5. But this is a chained-after-chained scenario that adds merge overhead — not worth it for ~15 LOC.
- PR 3 → move success/error UI styling to PR 5 (CSS only, no behavior change). Worth it only if PR 3 hits ~450.

**No other PR needs sub-slicing.**

## 10. Naming and convention table

| Concern | Convention |
|---|---|
| CSS class for cart drawer | `.cart-drawer` (distinct from existing `.drawer`) |
| CSS class for cart drawer header | `.cart-drawer__head` |
| CSS class for cart drawer body | `.cart-drawer__body` |
| CSS class for cart drawer footer | `.cart-drawer__foot` |
| CSS class for cart drawer empty state | `.cart-drawer__empty` |
| CSS class for cart drawer item row | `.cart-row` |
| CSS class for cart drawer CTA | `.cart-drawer__cta` |
| CSS class for nav badge | `.cart-badge` |
| CSS class for "Add to cart" button | `.card__add` (matches existing `.card__price` BEM-ish) |
| CSS class for card revealed state | `.card--revealed` (new modifier) |
| CSS class for checkout modal | `.checkout-modal` |
| CSS class for checkout form errors | `.form-err` |
| localStorage keys | `burger_cart_v1`, `burger_checkout_draft_v1` |
| Product IDs | kebab-case slug from static `DATA_PRODUCTS` map (e.g. `whopper`, `big-king`, `coca-cola`) |
| CartStore singleton binding | Global inside the IIFE, no module export |
| Server env vars | None for MVP (business phone in `config.js`) |
| API route prefix | `/api` (orders at `/api/orders`) |
| HTTP success status | `201` for order creation |
| HTTP validation failure | `400` with `{ errors: [{ field, message }] }` |
| HTTP unexpected failure | `500` with `{ error: "Internal server error" }` |
| Idempotency header | `Idempotency-Key` (client-generated `crypto.randomUUID()`) |
| SQLite file | `server/data/orders.db` (auto-created, gitignored) |
| Schema version table | `schema_version` with version `1` |
| Vitest test file location | `server/__tests__/*.test.js` (under the module under test) |
| Front-end test file location | `tests/*.test.js` (top-level), when added in PR 2a |

**Deviations from existing project conventions**: none. The project uses `__` for elements and `--` for modifiers within a section (`top-bar__inner`, `btn--signup`, `card--hidden`); the new classes follow that. The proposal mentioned BEM but the project uses BEM-**ish**, and this design matches the project's actual usage.

## 11. Risk register

Pulled from the proposal (1–5) plus design-level additions (6–9).

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Cart state loss across tabs** | Medium | Medium | `storage` event listener reloads state on cross-tab change (REQ-CA-3). |
| 2 | **`.card:hover` / IO transform conflict** | High (already broken) | Low (visual polish) | PR 5 refactor to `.card--revealed` class — see Section 7. |
| 3 | **Race condition on "Confirmar pedido"** | Medium | High | Client: button disabled during in-flight + closure state machine. Server: `Idempotency-Key` header + 24h in-memory cache. |
| 4 | **Schema migration on fresh DB** | Low now | Medium later | `schema_version` table + idempotent CREATE IF NOT EXISTS on boot. Future migrations insert version 2, etc. |
| 5 | **Cart drawer accessibility** | Medium | Medium | Native `<dialog>` with `showModal()` — browser handles trap, ESC, inert. Plus PR 5 focus-visible + aria-live. |
| 6 | **In-memory idempotency map leaks** | Low | Low–Medium | Map entries carry `expiresAt`; lazy sweep on every `withIdempotency` call drops expired entries. Process restart loses all entries (acceptable — server restart is rare). |
| 7 | **Native `<dialog>` quirks in older browsers** | Low (2026 baseline) | Medium | No fallback implemented; document minimum browser versions in README. If telemetry shows usage below threshold, revisit. |
| 8 | **Long WhatsApp URL truncation** | Low | Low | 2000-char threshold + "...y N artículos más" fallback in `buildWaLink` — covered by `SCN-WA-4` test. |
| 9 | **Front-end bundle leak of business phone** | Low (mitigated by design) | High (privacy + security) | Phone stays in `server/config.js`, never imported into `app.js`. Front-end only sees the *constructed* `wa.me/` URL in the 201 response. Reviewer check: `grep -r "521" app.js index.html styles.css` must return no results in PR 4. |
| 10 | **`CartStore` subscriber leak** | Low | Low | `subscribe()` returns an unsubscribe function; the cart drawer module subscribes on mount and unsubscribes on close. No global store of subscribers. |

---

## File changes summary

| File | PR | Action | Notes |
|---|---|---|---|
| `server/package.json` | 1 | Create | express, better-sqlite3, vitest, supertest devDeps |
| `server/vitest.config.js` | 1 | Create | node env, __tests__ pattern |
| `server/index.js` | 1 | Create | Express factory + static mount |
| `server/config.js` | 1 | Create | PORT, DB_PATH, BUSINESS_PHONE |
| `server/db.js` | 1 | Create | better-sqlite3 wrapper |
| `server/migrate.js` | 1 | Create | schema_version + DDL |
| `server/routes/orders.js` | 1 | Create | POST /api/orders |
| `server/lib/validate.js` | 1 | Create | hand-written validator |
| `server/lib/idempotency.js` | 1 | Create | in-memory Map + TTL |
| `server/__tests__/orders.test.js` | 1 | Create | 7 SCN-BE-* scenarios |
| `server/.gitignore` | 1 | Create | ignores `server/data/*.db` |
| `README.md` | 1 | Modify | dev run command + port |
| `app.js` | 2a | Modify | +CartStore, +DATA_PRODUCTS, +badge, IO stays unchanged |
| `app.js` | 2b | Modify | +cart drawer module |
| `app.js` | 3 | Modify | +checkout modal module + form draft listeners |
| `app.js` | 4 | Modify | +whatsapp link render on success view |
| `app.js` | 5 | Modify | IO refactor to `.card--revealed` (only `app.js` change in PR 5) |
| `index.html` | 2a | Modify | +`<button class="card__add">` on each menu card, +`<span class="cart-badge">` in `.btn--cart` |
| `index.html` | 2b | Modify | +`<dialog class="cart-drawer">` |
| `index.html` | 3 | Modify | +`<dialog class="checkout-modal">` |
| `index.html` | 5 | Modify | +`<label>` elements, +`aria-live` regions |
| `styles.css` | 2a | Modify | +`.card__add`, +`.cart-badge` |
| `styles.css` | 2b | Modify | +`.cart-drawer`, +`.cart-row`, dialog animation |
| `styles.css` | 3 | Modify | +`.checkout-modal`, form layout, error/success states |
| `styles.css` | 5 | Modify | +`.card--revealed`, +`:focus-visible`, +empty-cart copy styles |
| `tests/cart-store.test.js` | 2a | Create | vitest, jsdom env per-file |

---

## Interfaces / Contracts

### CartStore (PR 2a)

```ts
interface CartStore {
  add(product: { id: string; name: string; unit_price: number; category: string }): void;
  remove(productId: string): void;
  setQty(productId: string, qty: number): void;   // qty <= 0 removes
  clear(): void;
  getItems(): Array<{ id: string; name: string; unit_price: number; category: string; quantity: number }>;
  subtotal(): number;
  count(): number;
  subscribe(fn: (items: ReturnType<CartStore['getItems']>) => void): () => void;
}
```

### POST /api/orders (PR 1, extended in PR 4)

Request:
```json
{
  "customer": { "name": "string", "phone": "string", "address": "string", "notes": "string?" },
  "items": [{ "product_name": "string", "unit_price": number, "quantity": int }],
  "subtotal": number
}
```

Headers: `Content-Type: application/json`, optional `Idempotency-Key: <uuid>`.

Response 201:
```json
{
  "order_id": 42,
  "created_at": "2026-06-30T15:42:00.000Z",
  "whatsapp_link": "https://wa.me/5215512345678?text=..."  // PR 4+
}
```

Response 400:
```json
{ "errors": [{ "field": "customer.name", "message": "required" }, ...] }
```

---

## Testing strategy

| Layer | What | How |
|---|---|---|
| Unit (server) | `validateOrderPayload`, `withIdempotency`, `buildWaLink` | vitest, no DB |
| Integration (server) | `POST /api/orders` happy + 7 SCN-BE-* scenarios + idempotent replay | vitest + supertest + `:memory:` SQLite |
| Unit (front-end) | `CartStore` add/remove/setQty/clear/getItems/subtotal/count/localStorage round-trip/storage-event sync | vitest with `// @vitest-environment jsdom` |
| Manual | Drawer open/close animations, checkout submit flow end-to-end, success-screen link click | browser, pre-merge |
| E2E | Not in MVP scope | — |

Coverage thresholds are not configured.

## Migration / Rollout

No data migration. Fresh DB on first boot. Static files remain backward-compatible — old `index.html` served from the back-end looks identical to old `index.html` served from `python3 -m http.server` until PR 2a lands.

Rollback per PR: revert the merge commit. PR 5's `.card--revealed` refactor is the only one that touches already-merged behavior outside the new feature (it changes `.card`'s default opacity to 0). Reverting PR 5 brings back the inline-style IO and the broken hover. That is acceptable — `.card:hover` has been broken since before cart-checkout started.

## Open questions

None blocking. The spec phase resolved the three proposal open questions. The design phase surfaced no new blockers.

---

## Next step

`sdd-tasks` — produce a per-PR task breakdown readable in 10 minutes and convertible into `sdd-apply` work units. Watch for PR 1 and PR 3 budget tightness; if `sdd-tasks` forecasts either over 400 lines, recommend sub-slicing per Section 9.1.