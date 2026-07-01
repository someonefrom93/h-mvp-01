# PR 2b — Cart drawer UI

## Scope

Adds a right-side slide-in cart drawer (`<dialog class="cart-drawer">`) with close button, item rows, ± quantity controls, explicit × remove, subtotal footer, empty state, reduced-motion handling, keyboard trap (native `<dialog>`), and an "Ir a pagar" stub CTA. Built on top of PR 2a's CartStore. No checkout form, no API call.

**Does NOT include**: checkout form, POST /api/orders, WhatsApp link.

## Estimated lines

| Concern | Est. lines |
| --- | --- |
| new code (excluding tests) | 220 |
| new tests | 0 |
| modifications to existing files | 210 (app.js ~170, index.html ~40, styles.css ~110) |
| **TOTAL** | **~320** |
| Budget verdict | OK — 80-line buffer within the 400-line budget |

## File-by-file change list

| File | Action | ~Lines | Purpose |
| --- | --- | --- | --- |
| `index.html` | modify | 40 | Add `<dialog class="cart-drawer" id="cartDrawer">` with header, body (empty initially), footer (subtotal + CTA); add `id="cartDrawerClose"` close button |
| `styles.css` | modify | 110 | `.cart-drawer` (fixed right, 420px, slide-in via CSS transition), `.cart-drawer__head/__body/__foot`, `.cart-row` (flex row: info + qty + line-total), `.cart-row__qty` (± buttons), `.cart-row__btn--remove` (×), `.cart-drawer__subtotal`, `.cart-drawer__cta`, `.cart-drawer__empty`; `@starting-style` and `prefers-reduced-motion` zero-duration fallback |
| `app.js` | modify | 170 | `initCartDrawer()`: get dialog/elements by ID, `renderCartDrawer()` (full re-render of body), `openCartDrawer()` (calls `dialog.showModal()`), `closeCartDrawer()` (calls `dialog.close()`), `handleCartDrawerClicks()` (event delegation on body for ±/remove), "Ir a pagar" click → stub (logs or opens checkout placeholder), subscribe CartStore to `renderCartDrawer`, ESC key closes drawer, add button click → open drawer, body overflow lock |

## Implementation order

1. **feat(drawer): add cart drawer HTML markup** — `<dialog id="cartDrawer" class="cart-drawer" aria-label="Tu carrito">` with header (h2 + close button), empty body div, footer (subtotal + "Ir a pagar" button). Commit: `feat(drawer): add cart drawer dialog markup`.

2. **style(drawer): add cart drawer CSS** — Position fixed right, 420px wide, `transform: translateX(100%)` → `translateX(0)` on `[open]`, backdrop, `.cart-row` flex layout, `.cart-row__qty` button sizing, `.cart-drawer__empty` empty state, `@starting-style` for entry animation, `prefers-reduced-motion` → `transition-duration: 0.001ms`. Commit: `style(drawer): add cart drawer CSS slide-in and layout`.

3. **feat(drawer): implement renderCartDrawer()** — Read CartStore items, full re-render of `cartDrawerBody` innerHTML with `.cart-row` per item (name, unit_price, ± buttons, qty, line-total, × remove), empty state paragraph when count=0, enable/disable CTA. Commit: `feat(drawer): implement renderCartDrawer with full re-render strategy`.

4. **feat(drawer): implement openCartDrawer/closeCartDrawer** — `openCartDrawer()` calls `cartDrawer.showModal()`, locks body overflow; `closeCartDrawer()` calls `cartDrawer.close()`, unlocks body. Wire close button to `closeCartDrawer`. Commit: `feat(drawer): implement open/close with dialog.showModal() and body lock`.

5. **feat(drawer): implement ± and remove controls** — Event delegation on `cartDrawerBody` for `data-action="inc"`, `"dec"`, `"remove"`. ± call `CartStore.setQty(id, current ± 1)`; remove calls `CartStore.remove(id)`. After mutation, `renderCartDrawer()` re-renders. Commit: `feat(drawer): implement quantity controls and remove in cart drawer`.

6. **feat(drawer): wire add-to-cart button to open drawer** — In the add-to-cart click handler from PR 2a (or here if PR 2a already wired it to just `CartStore.add`), add `openCartDrawer()` call after `CartStore.add`. Commit: `feat(drawer): open drawer after adding item`.

7. **feat(drawer): subscribe drawer to CartStore mutations** — On drawer open (or on module init), subscribe `renderCartDrawer` to CartStore; on drawer close, unsubscribe to prevent leaks. Commit: `feat(drawer): subscribe drawer to CartStore for reactive updates`.

8. **feat(drawer): add "Ir a pagar" stub** — Button logs a `console.info('[PR2b] checkout stub — PR 3 will wire this')` or opens a placeholder. No navigation, no API call. Commit: `feat(drawer): add Ir a pagar stub CTA`.

9. **test(drawer): no new test files** — Native `<dialog>` focus trap, ESC, and backdrop are browser-provided; surgical DOM tests not warranted for an MVP. Manual verification checklist covers the keyboard/aria behavior.

## Acceptance criteria

- [ ] REQ-CD-1: Drawer slides in from right on add-to-cart or cart icon click; close button and Escape close it
- [ ] REQ-CD-2: Each item row has − / + / × buttons that call CartStore.setQty/remove; decrementing from qty 1 removes the item
- [ ] REQ-CD-3: "Ir a pagar" button is keyboard-focusable and visually present; clicking it logs a stub message
- [ ] REQ-CD-4: Native `<dialog>` focus trap works (Tab cycles inside); Shift+Tab cycles back; ESC closes
- [ ] REQ-CD-5: Empty cart → drawer body shows "Tu carrito está vacío"; CTA disabled/hidden
- [ ] REQ-CD-6: `prefers-reduced-motion: reduce` → drawer appears instantly with no slide animation
- [ ] Drawer re-renders correctly when CartStore changes via another tab (storage event from PR 2a)

## Test plan

**File**: No new test files. Native `<dialog>` behavior is browser-verified. Manual test checklist for reviewer:

| Check | Covers |
| --- | --- |
| Open drawer → Tab cycles only within drawer | REQ-CD-4 |
| Press Escape → drawer closes | REQ-CD-4 |
| Empty cart → "Tu carrito está vacío" | REQ-CD-5 |
| Click − on qty=1 → item removed | REQ-CD-2 |
| prefers-reduced-motion active → no slide | REQ-CD-6 |
| "Ir a pagar" stub button is focusable | REQ-CD-3 |

## Risk & rollback

- **Risk**: Adds `<dialog>` element to `index.html` and CSS class `.cart-drawer` to `styles.css`. The existing left-side mobile nav `.drawer` uses different classes and animation direction — no conflict.
- **Rollback**: `git revert <merge-commit>` removes the dialog markup, CSS, and app.js drawer module. CartStore from PR 2a is unaffected.

## Out of scope reminder

- Checkout form (PR 3)
- POST /api/orders wiring (PR 3)
- WhatsApp link (PR 4)
- Empty-cart "Vaciar carrito" confirmation (PR 5)
- aria-live regions (PR 5)
- focus-visible indicators (PR 5)
