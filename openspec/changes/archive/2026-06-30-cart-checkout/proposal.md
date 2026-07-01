# cart-checkout — Proposal

**What**: Real shopping cart + checkout + order persistence for clone-burgers.  
**Who it helps**: Customers browsing the Burger King México clone — today the cart button is a demo counter that does nothing.  
**Why now**: The page has 17 menu cards with prices, an empty cart icon, and no way to order. A real cart turns a static showcase into a functional ordering experience without breaking the existing design.

## Quick path

1. Customer taps "Agregar al carrito" on any menu card → cart drawer opens → item added.
2. Customer repeats across cards, adjusts quantities in drawer → taps "Ir a pagar".
3. Checkout review shows order summary + customer form (name, phone, address, notes) → "Confirmar pedido".
4. Order hits `POST /api/orders` → SQLite persists → success screen shows a WhatsApp deep link to the business phone.

## Scope

### In scope

| Area | What we build |
|------|---------------|
| Cart state | Add, remove, update quantity. Persisted to `localStorage`. Cart icon counter in nav (replaces demo counter). |
| Cart drawer | Side panel that slides in, lists items, shows total. "Ir a pagar" CTA. |
| "Add to cart" buttons | One button per existing menu card (17 cards across 5 categories). |
| Checkout screen | Review (items, subtotal), customer form (name, phone, address, notes), "Confirmar pedido". |
| Backend API | `POST /api/orders` — validates payload, inserts order + order_items into SQLite, returns order ID. |
| Database | SQLite. Two tables: `orders` (id, customer_name, phone, address, notes, subtotal, created_at) and `order_items` (id, order_id FK, product_name, unit_price, quantity, line_total). |
| Server skeleton | `package.json`, Express + SQLite + better-sqlite3, vitest, at least one smoke test on the order endpoint. |
| WhatsApp handoff | On order success: generate `wa.me/<business-phone>?text=<encoded-order-summary>` deep link. Customer presses Send. Phone number is a config constant (env var or `server/config.js`). |
| Testing | vitest configured. At least one integration test for `POST /api/orders` (happy path + validation rejection). |
| Cart icon SVG | Inline SVG cart icon in the main nav, same style as the existing icons. |

### Out of scope

- Payment processing (deferred — user explicit)
- Account/login, user authentication
- Real-time order tracking, push notifications to business
- Admin dashboard, order management UI
- Inventory management, stock tracking
- Multi-language support
- Email/SMS confirmation (WhatsApp deep link is the sole handoff channel)
- Responsive checkout beyond mobile-first (desktop is kept but not polished)

## Approach

### Architecture

```
┌─────────────┐    POST /api/orders     ┌──────────────┐
│  Browser    │ ──────────────────────▶ │  Express      │
│  (cart JS)  │ ◀── { orderId, url } ── │  server       │
│             │                          │  (server/)    │
└─────────────┘                          └────┬─────────┘
  localStorage                                 │
  cart state                                   ▼
                                        ┌──────────────┐
                                        │  SQLite       │
                                        │  (file)       │
                                        └──────────────┘
```

- **Front-end**: Vanilla JS modules extending existing `app.js` pattern (IIFE, `$` helpers). cart state in a CartStore object backed by `localStorage`.
- **Back-end**: Node + Express, one route file, `better-sqlite3` for sync SQLite access.
- **Handoff**: WhatsApp deep link generated server-side, returned in the order response. Customer clicks it → opens WhatsApp → they press Send. No server push.

### File layout sketch

```
server/
  index.js            — Express app factory + listen
  db.js               — SQLite open/migrate helper
  routes/orders.js    — POST /api/orders
  config.js            — business phone, port, db path

index.html             — extended: cart drawer markup, checkout modal/section
styles.css             — extended: cart drawer, checkout form, success styles
app.js                 — demo cart code REMOVED, replaced with CartStore + drawer + checkout
```

### Database schema (one sentence)

Two tables: `orders` stores customer info + subtotal + timestamp; `order_items` stores one row per product, FK to `orders.id`, with unit_price, qty, and line_total.

### API route shape (one sentence)

`POST /api/orders` accepts JSON body `{ customer: { name, phone, address, notes }, items: [{ name, unit_price, quantity }] }`, returns `{ orderId, whatsappLink }` on 201 or `{ errors }` on 422.

### UI flow (one sentence)

Cart icon in nav → tap → drawer slides in with item list + total → "Ir a pagar" → checkout review + form → "Confirmar pedido" → POST fires → success screen with wa.me link.

## PR slicing strategy

Delivery: **force-chained**, **stacked-to-main**, across **6 PR slices**. Each PR is independently mergeable to main and leaves the site working (no broken state).

| PR | Name | Scope | What it excludes | Why independently mergeable |
|----|------|-------|------------------|-----------------------------|
| 1 | **Backend skeleton + order endpoint** | `server/` directory, `package.json`, Express + SQLite + vitest, `POST /api/orders` with schema migration, smoke tests. Front-end unchanged. | No cart UI, no checkout screen, no WhatsApp link. | Server starts, endpoint works, tests pass. Site serves unchanged static files. Zero front-end risk. |
| 2a | **Cart state foundation** | Replace demo cart with CartStore (localStorage), reactive cart count badge in nav, storage sync, and "Agregar al carrito" buttons on all 17 menu cards. | No drawer UI, no quantity controls in drawer, no "Ir a pagar" CTA, no checkout form, no API call. | Cart state works locally with no server dependency and only exposes the nav badge as UI, so the site remains functional. |
| 2b | **Cart drawer UI** | Add the slide-in cart drawer with close button, item rows, ± quantity controls, subtotal footer, empty state, reduced-motion handling, keyboard trap, and an "Ir a pagar" stub CTA. | No checkout form, no backend POST, no WhatsApp link, no customer info capture. | Drawer behavior is layered on the already-merged CartStore foundation and remains front-end-only. |
| 3 | **Checkout flow** | Checkout review screen, customer form (name, phone, address, notes), wiring "Confirmar pedido" → POST /api/orders, success state. | No WhatsApp link yet — success screen shows order ID only. | Full order loop works: add items → review → submit → persisted. Validation errors surface to user. |
| 4 | **WhatsApp handoff** | Generate `wa.me/` link on order success, business phone config constant, success screen styling. | No additional channels, no server-side notification. | Handoff is a thin layer on top of working order flow. Isolated to one screen + one config value. |
| 5 | **Polish** | Empty-cart state, error states (network down, validation), accessibility pass on drawer and form, fix CSS hover/reveal conflict on cards. | No new features. | Each fix is isolated. Any can be dropped without breaking the flow. |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Cart state loss across tabs** — localStorage is not shared between tabs. Customer opens two tabs, adds items in one, other sees empty cart. | Medium | Medium — confusing UX | In PR 2a, listen for `storage` events to sync across tabs. Document this in the spec phase design. |
| **`.card:hover` / IntersectionObserver conflict** — CSS `.card:hover { transform: translateY(-4px); }` is overridden by the IO's inline `card.style.transform = 'translateY(0)'`. After IO fires, the hover lift stops working. | High — already broken today | Low — visual polish | Fix in PR 5. Options: (a) use a wrapper element for the IO transform instead of applying it directly to `.card`, (b) use CSS classes instead of inline styles for reveal. Spec phase should pick the approach. |
| **Race condition on "Confirmar pedido"** — user double-clicks, duplicate orders. | Medium | High — real money implications if this ever connects to payments | Debounce the submit button (disable on first click, re-enable on error). Back-end: add a client-generated idempotency key so double-submits can be detected. |
| **Schema migration on fresh DB** — N/A today (no existing data), but future changes to the schema need a migration strategy. | Low now, grows over time | Medium for maintainability | PR 1: use a `schema_version` table row + auto-migrate on server start. Future changes get a new version number. |
| **Accessibility of cart drawer** — drawer needs focus trap, aria-labels, keyboard navigation, screen-reader announcements for item changes. | Medium | Medium — excludes keyboard-only and screen-reader users | In PR 2b, add basic a11y (focus trap, role="dialog" on drawer, Escape to close). Full audit in PR 5. |

## Open questions

These are for the spec phase to resolve — no need to answer now.

1. **Business phone number**: config constant in `server/config.js` (committed), or `WHATSAPP_PHONE` env var (set at deploy)? Config file is simpler for a local MVP; env var is safer if the repo goes public.
2. **Quantity controls in cart drawer**: add/remove ± buttons with current quantity displayed, or just an "× remove" button and the customer re-adds to increase? ± buttons give finer control; remove-only is simpler JS and less UI clutter.
3. **Customer form draft persistence**: should the checkout form save its state to `localStorage` so it survives a page refresh or accidental back-navigation? Pro: less frustration. Con: stale drafts if the customer changes their mind. Implementation cost is low either way.

## Next step

`sdd-design` — the design phase can now run against the split PR 2a / PR 2b spec state.
