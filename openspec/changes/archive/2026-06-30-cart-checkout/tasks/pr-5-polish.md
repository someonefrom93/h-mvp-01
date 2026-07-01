# PR 5 — Polish

## Scope

Fixes the pre-existing `.card:hover` / IntersectionObserver transform conflict discovered during design. Also adds: empty-cart "Tu carrito está vacío" copy + "Vaciar carrito" with confirmation guard, `aria-live` on success/error regions, visible `:focus-visible` rings on all interactive elements, associated `<label>` elements on checkout form fields, and reduced-motion parity for the drawer.

**Does NOT include**: any new features, payment processing, account system, or changes to already-working behavior beyond what's listed.

## Estimated lines

| Concern | Est. lines |
| --- | --- |
| new code (excluding tests) | 55 |
| new tests | 0 |
| modifications to existing files | 110 (app.js ~20, index.html ~30, styles.css ~60) |
| **TOTAL** | **~165** |
| Budget verdict | OK — 235-line buffer; this is the lightest PR. |

## File-by-file change list

| File | Action | ~Lines | Purpose |
| --- | --- | --- | --- |
| `app.js` | modify | 20 | Refactor IO block: replace `card.style.opacity / .style.transform` inline styles with `entry.target.classList.add('card--revealed')`. Also wire "Vaciar carrito" click → `confirm('¿Vaciar el carrito?')` → `CartStore.clear()` if confirmed. |
| `styles.css` | modify | 60 | Add `.card--revealed { opacity: 1; transform: translateY(0); }`; ensure `.card:hover` specificity (`:hover` pseudo-class) beats `.card--revealed` for lift. Add `:focus-visible` rings on `.cart-row__btn`, `.btn--primary`, form inputs. Add `.cart-drawer__empty-title` and `.cart-drawer__empty-body` for enhanced empty state. Add `prefers-reduced-motion` zero-duration on `.checkout-modal` (parity with drawer). |
| `index.html` | modify | 30 | Add `aria-live="polite"` to success state container. Add `aria-live="assertive"` to error container. Ensure all form `<input>` elements have explicit `<label for="...">` (some may already exist from PR 3 — audit and fill gaps). Add `id` attributes to success/error containers if missing. Add `role="status"` to success container for screen-reader announcement. |

## Implementation order

1. **fix(cards): refactor IntersectionObserver to use .card--revealed class** — Replace lines 87–104 in `app.js`: `entry.target.classList.add('card--revealed')` instead of `entry.target.style.opacity / .style.transform`. Remove initial inline `opacity: 0; transform: translateY(16px)` from JS; move those to `.card { ... }` CSS as defaults. Commit: `fix(cards): refactor IO to use .card--revealed class instead of inline styles`.

2. **style(cards): add .card--revealed CSS rule** — Add `.card--revealed { opacity: 1; transform: translateY(0); }`. Ensure existing `.card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }` is still present and wins specificity over `.card--revealed`. Commit: `style(cards): add .card--revealed rule preserving hover lift specificity`.

3. **feat(drawer): add "Vaciar carrito" with confirmation** — In `app.js` cart drawer module: add "Vaciar carrito" button (in footer or empty-state area), on click show `confirm('¿Vaciar el carrito?')`, if true call `CartStore.clear()`. Commit: `feat(drawer): add Vaciar carrito with confirmation guard`.

4. **a11y(checkout): add aria-live to success and error regions** — In `index.html` checkout modal: add `aria-live="polite"` and `role="status"` to success container; add `aria-live="assertive"` to error container. Ensure these containers have `id` attributes. Commit: `a11y(checkout): add aria-live regions to success and error states`.

5. **a11y(checkout): add explicit labels to all form fields** — Audit all `<input>` elements in checkout form; ensure each has `<label for="inputId">` — not placeholder-only. Add missing labels. Commit: `a11y(checkout): add explicit labels to all checkout form fields`.

6. **style(focus): add :focus-visible rings** — In `styles.css`: add `:focus-visible` rules for `.cart-row__btn`, `.btn`, `input[type=text]`, `input[type=tel]`, `textarea`, `button`. Use `outline: 2px solid var(--brand-orange)` or similar high-contrast against the background. Commit: `style(focus): add :focus-visible rings for keyboard navigation`.

7. **style(drawer): add enhanced empty-cart copy** — In `index.html`: add `.cart-drawer__empty-title` ("Tu carrito está vacío") and `.cart-drawer__empty-body` (encouraging copy). In `styles.css`: style these elements. "Ir a pagar" CTA hidden/disabled when empty (may already be wired in PR 2b — verify). Commit: `style(drawer): add empty-cart copy and CTA hide on empty`.

8. **style(checkout): add prefers-reduced-motion to checkout modal** — Add `transition-duration: 0.001ms` for `.checkout-modal` under `@media (prefers-reduced-motion: reduce)`. Commit: `style(checkout): add reduced-motion support to checkout modal`.

## Acceptance criteria

- [ ] REQ-PO-1: Empty drawer shows "Tu carrito está vacío" with supporting copy; "Ir a pagar" disabled/hidden
- [ ] REQ-PO-2: "Vaciar carrito" triggers `confirm()` before `CartStore.clear()`; cancel keeps cart intact
- [ ] REQ-PO-3: Drawer slide animation disabled when `prefers-reduced-motion: reduce`
- [ ] REQ-PO-4: All interactive elements in drawer, checkout form, success/error states have visible `:focus-visible` outline
- [ ] REQ-PO-5: Every `<input>` in checkout form has an associated `<label for="...">` — not placeholder-only
- [ ] REQ-PO-6: Success state container has `aria-live="polite"` and `role="status"`
- [ ] REQ-PO-7: Error container has `aria-live="assertive"`
- [ ] REQ-PO-8: Card hover-lift works after IO fires — `.card:hover` transform applies over `.card--revealed` without being overridden by inline `style.transform`
- [ ] Card hover-lift works in the browser after page scroll triggers IO reveal

## Test plan

**File**: No new test files. Manual verification checklist:

| Check | Covers |
| --- | --- |
| Scroll page until cards are revealed → hover a revealed card → card lifts | REQ-PO-8, SCN-PO-6 |
| Open empty cart drawer → "Tu carrito está vacío" shown, CTA hidden | REQ-PO-1 |
| Click "Vaciar carrito" → confirm dialog → cancel → cart unchanged | REQ-PO-2 |
| `prefers-reduced-motion: reduce` active → open drawer → no slide animation | REQ-PO-3 |
| Tab through checkout form → visible focus ring on every field | REQ-PO-4 |
| Inspect checkout HTML → every input has `<label for>` | REQ-PO-5 |
| Submit invalid form → screen reader announces error immediately | REQ-PO-7, SCN-PO-7 |
| Submit valid form → screen reader announces success | REQ-PO-6, SCN-PO-4 |

## Risk & rollback

- **Risk**: The `.card--revealed` refactor changes the default state of `.card` elements from opacity 1 (current) to opacity 0 until IO fires. For cards already in the viewport on page load, IO fires immediately — the transition is imperceptible. No existing behavior is broken; the hover was already broken before this PR.
- **Rollback**: `git revert <merge-commit>` restores inline-style IO and the broken hover. The other polish changes (empty-cart, aria-live, labels, focus-visible) are reverted. No functional behavior is lost.

## Out of scope reminder

- Payment processing
- Account system
- Any new features beyond the polish items listed above
