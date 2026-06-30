# PR 2a — Cart state foundation

## Scope

Replaces the demo `$0.00` cart counter with a real `CartStore` singleton backed by `localStorage`. Provides reactive nav badge, 17 "Agregar al carrito" buttons wired to the store, and tab synchronisation via `storage` events. No drawer UI, no checkout, no API calls.

**Does NOT include**: cart drawer markup, checkout form, POST /api/orders call, WhatsApp link.

## Estimated lines

| Concern | Est. lines |
| --- | --- |
| new code (excluding tests) | 130 |
| new tests | 150 |
| modifications to existing files | 60 (app.js ~110, index.html ~20, styles.css ~40) |
| **TOTAL** | **~340** |
| Budget verdict | OK — 60-line buffer within the 400-line budget |

## File-by-file change list

| File | Action | ~Lines | Purpose |
| --- | --- | --- | --- |
| `app.js` | modify | 110 | Append CartStore closure singleton, DATA_PRODUCTS map (17 entries), nav badge subscribe, `storage` event listener, 17 `data-product-id` attribute reads, "Agregar al carrito" button handlers |
| `index.html` | modify | 20 | Add `data-product-id="<id>"` to each of the 17 menu cards; add `<span class="cart-badge">` inside `.btn--cart`; add 17 `<button class="card__add">` inside each `.card__actions` |
| `styles.css` | modify | 40 | Add `.card__add` (positioning, brand-orange styling), `.cart-badge` (badge shape, hidden when count=0) |
| `tests/cart-store.test.js` | create | 150 | Vitest unit tests with `// @vitest-environment jsdom`; memoryStorage stub; covers all REQ-CA-* scenarios |
| `server/` | no changes | — | Not introduced until PR 1 (PR 2a is front-end only and works against a static server) |

## Implementation order

1. **feat(cart): add DATA_PRODUCTS static map** — 17-entry array at top of IIFE with id/name/unit_price/category. Commit: `feat(cart): add DATA_PRODUCTS static map for 17 menu items`.

2. **feat(cart): add CartStore closure singleton** — `createCartStore({ storage, bus })` factory with add/remove/setQty/clear/getItems/subtotal/count/subscribe, localStorage load/save, storage event listener, subscriber Set. Commit: `feat(cart): add CartStore singleton with localStorage persistence`.

3. **feat(cart): add nav badge reactive subscription** — On DOMContentLoaded, query `.cart-badge`, subscribe CartStore to update badge textContent; show/hide based on count. Commit: `feat(cart): wire CartStore to nav badge`.

4. **feat(cart): add "Agregar al carrito" buttons on all 17 menu cards** — For each `.card[data-product-id]`, create `.card__add` button; on click call `CartStore.add(DATA_PRODUCTS.find(p => p.id === card.dataset.productId))`. Commit: `feat(cart): add add-to-cart buttons to all 17 menu cards`.

5. **feat(cart): remove demo cart counter code** — Remove the `$39`-per-click demo counter logic from the IIFE (keep the `$` selector helpers). Commit: `feat(cart): remove demo cart counter`.

6. **style(cart): add .card__add and .cart-badge CSS** — `.card__add` as brand-orange button; `.cart-badge` as small badge, `display:none` when count is 0. Commit: `style(cart): add card__add and cart-badge styles`.

7. **test(cart): add CartStore unit tests with jsdom** — `tests/cart-store.test.js`: memoryStorage stub, all CartStore methods tested, localStorage round-trip, storage event triggers reload, multiple subscribers fire. Commit: `test(cart): add CartStore unit tests with jsdom`.

## Acceptance criteria

- [ ] REQ-CA-1: CartStore.add merges quantity when same product added twice; remove/setQty/clear/getItems/subtotal/count all work correctly
- [ ] REQ-CA-2: Cart state survives page reload via localStorage key `burger_cart_v1`
- [ ] REQ-CA-3: Adding item in Tab A updates Tab B's nav badge via `storage` event
- [ ] REQ-CA-4: All CartStore mutations emit to subscribers; nav badge updates reactively
- [ ] REQ-CA-5: All 17 menu cards have an "Agregar al carrito" button that calls CartStore.add with the correct product
- [ ] REQ-CA-6: Nav badge shows CartStore.count(); replaces demo counter entirely
- [ ] `vitest run tests/cart-store.test.js` passes

## Test plan

**File**: `tests/cart-store.test.js`

| Test case | Covers |
| --- | --- |
| `CartStore.add — new product → item added with qty 1` | REQ-CA-1 |
| `CartStore.add — same product twice → quantity merged to 2` | REQ-CA-1, SCN-CA-2 |
| `CartStore.remove → item gone from getItems()` | REQ-CA-1 |
| `CartStore.setQty(id, 0) → item removed` | REQ-CA-1, SCN-CA-4 |
| `CartStore.setQty(id, -1) → item removed` | REQ-CA-1 |
| `CartStore.clear → getItems returns []` | REQ-CA-1 |
| `CartStore.subtotal() → correct sum of unit_price × quantity` | REQ-CA-1 |
| `CartStore.count() → correct total units` | REQ-CA-1 |
| `CartStore — localStorage round-trip after add/remove` | REQ-CA-2, SCN-CA-3 |
| `CartStore — storage event from another tab → subscribers fire` | REQ-CA-3, SCN-CA-5 |
| `CartStore — multiple subscribers all fire on mutation` | REQ-CA-4 |

## Risk & rollback

- **Risk**: Modifies `app.js` (existing ~167-line IIFE). The append adds ~110 lines inside the IIFE — no existing behavior is broken unless variable names collide. The demo counter removal is isolated to its own commit.
- **Rollback**: `git revert <merge-commit>` restores the original `app.js` and the demo counter. The 17 `data-product-id` attributes added to `index.html` and the CSS added to `styles.css` are also reverted.

## Out of scope reminder

- Cart drawer UI (PR 2b)
- Checkout form (PR 3)
- POST /api/orders (PR 3)
- WhatsApp link (PR 4)
- Empty-cart state copy (PR 5)
- `.card--revealed` class refactor (PR 5)
