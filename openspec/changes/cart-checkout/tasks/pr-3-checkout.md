# PR 3 — Checkout flow

## Scope

Wires the "Ir a pagar" stub to a full-screen `<dialog class="checkout-modal">`: order summary, customer form (name/phone/address/notes), draft-persisted to `burger_checkout_draft_v1`, "Confirmar pedido" button that POSTs to `POST /api/orders` with `Idempotency-Key` header, success/error states. On success: `CartStore.clear()`, draft cleared, order ID shown. The WhatsApp link is NOT yet shown (PR 4).

**Does NOT include**: WhatsApp link rendering, success screen aria-live polish.

## Estimated lines

| Concern | Est. lines |
| --- | --- |
| new code (excluding tests) | 260 |
| new tests | 0 |
| modifications to existing files | 200 (app.js ~200, index.html ~60, styles.css ~140) |
| **TOTAL** | **~410** |
| Budget verdict | TIGHT — at the budget ceiling. If over, defer success/error CSS to PR 5 (no behavior change). |

**Lines that could move to PR 5**: Success state styling (`div.checkout-success`), error message styling (`.checkout-error`), focus ring polish for form fields. These are pure CSS with no behavior change.

## File-by-file change list

| File | Action | ~Lines | Purpose |
| --- | --- | --- | --- |
| `index.html` | modify | 60 | `<dialog id="checkoutModal" class="checkout-modal">`: order summary section (items list + subtotal), `<form id="checkoutForm">` with coName/coPhone/coAddress/coNotes inputs + labels, submit button, success div (initially hidden), error container |
| `styles.css` | modify | 140 | `.checkout-modal` (full-screen overlay), `.checkout-summary` (item rows), `.checkout-form` (field layout, labels), `.form-err` (red inline error, initially `hidden`), `.checkout-success` (success state div), `.checkout-error` (error message container), focus-visible rings, button states |
| `app.js` | modify | 200 | `initCheckout()`: open/close handlers, `renderCheckoutSummary()` (items + subtotal), `readDraft()`/`writeDraft()`/`clearDraft()` for `burger_checkout_draft_v1`, `mountCheckoutForm()` (pre-fill from draft, `input` listeners write draft), `submitOrder()` state machine (idle→submitting→success|error), `showSuccess(body)` (display order_id, hide form), `showError(errors)` (inline errors, aria-live), "Ir a pagar" click → `openCheckout()`, checkout close → re-open cart drawer |
| `server/routes/orders.js` | modify | 10 | Minor: ensure `Idempotency-Key` header is read and passed through the idempotency middleware (already wired in PR 1, but verify the header name casing is consistent) |

## Implementation order

1. **feat(checkout): add checkout modal HTML markup** — `<dialog id="checkoutModal" class="checkout-modal">`: `.checkout-summary` (item list + subtotal, rendered dynamically), `<form id="checkoutForm">` with fields: name (required), phone (required), address (required), notes (optional), each with associated `<label for>`. Submit button "Confirmar pedido". Hidden success div and error container. Commit: `feat(checkout): add checkout modal markup with form and summary`.

2. **style(checkout): add checkout modal CSS** — Full-screen dialog, summary scroll area, form field layout with stacked labels+inputs, `.form-err` hidden by default, `.checkout-success` hidden initially, error container. Focus-visible rings on all focusable elements. Commit: `style(checkout): add checkout modal CSS layout and form styles`.

3. **feat(checkout): implement draft persistence** — `readDraft()`/`writeDraft(values)`/`clearDraft()` for `burger_checkout_draft_v1`. `mountCheckoutForm()` reads draft on open, wires `input` event on all four fields to `writeDraft`. `clearDraft()` called on successful submit. Commit: `feat(checkout): implement checkout form draft persistence to localStorage`.

4. **feat(checkout): implement renderCheckoutSummary()** — On checkout open: read CartStore items, render item rows (name, qty, line total) and subtotal into `.checkout-summary`. Commit: `feat(checkout): render order summary in checkout modal`.

5. **feat(checkout): implement checkout open/close** — `openCheckout()`: close cart drawer (PR 2b), call `checkoutModal.showModal()`, run `mountCheckoutForm()`. `closeCheckout()`: call `checkoutModal.close()`. Wire "Ir a pagar" button in drawer to `openCheckout()`. ESC from checkout → `closeCheckout()` → re-open cart drawer. Commit: `feat(checkout): implement checkout modal open/close with drawer integration`.

6. **feat(checkout): implement submitOrder state machine** — Client-side validation before POST (name/phone/address trimmed, phone regex `/^\+?\d{10,15}$/`). On valid submit: set `submitState='submitting'`, `checkoutForm.setAttribute('aria-busy', 'true')`, disable button, `fetch('/api/orders', { method:'POST', headers:{'Content-Type':'application/json','Idempotency-Key': crypto.randomUUID()}, body: JSON.stringify(payload) })`. Handle 201 → `showSuccess(data)`, non-201 → `showError(data.errors)`, network error → `showError([{message:'Sin conexión...'}] )`. Commit: `feat(checkout): implement submitOrder state machine with fetch and error handling`.

7. **feat(checkout): implement showSuccess and showError** — `showSuccess(body)`: hide form, show success div with order_id text, `CartStore.clear()`, `clearDraft()`. `showError(errors)`: show error container, set `aria-live` region, re-enable button, remove `aria-busy`. Commit: `feat(checkout): implement success and error states`.

8. **fix(checkout): wire Ir a pagar to openCheckout** — In the PR 2b "Ir a pagar" click handler, replace the stub with `openCheckout()`. Commit: `fix(checkout): wire Ir a pagar CTA to openCheckout`.

## Acceptance criteria

- [ ] REQ-CO-1: "Ir a pagar" opens checkout modal with order summary from CartStore; cart drawer closes
- [ ] REQ-CO-2: Form validates name/phone/address before submit; inline errors shown adjacent to invalid fields; no POST sent on validation failure
- [ ] REQ-CO-3: Form draft persisted to `burger_checkout_draft_v1` on every input; pre-filled on modal open
- [ ] REQ-CO-4: "Confirmar pedido" sends POST /api/orders with correct payload; button disabled during request
- [ ] REQ-CO-5: 201 response → success state shows order_id; CartStore.clear(); draft key removed
- [ ] REQ-CO-6: Non-201 or network failure → inline error shown; button re-enabled; cart intact
- [ ] REQ-CO-7: Cart drawer re-opens when checkout is closed without submitting
- [ ] Double-tap "Confirmar pedido" → only one POST sent (button disabled after first click)

## Test plan

**File**: No new test files. Integration is covered by the manual test checklist and the existing PR 1 supertest suite. Form validation tested manually.

| Check | Covers |
| --- | --- |
| Leave name empty → click submit → no POST, inline error | REQ-CO-2 |
| Valid form → 201 → success state shows order_id | REQ-CO-5 |
| Network failure → inline error shown, cart unchanged | REQ-CO-6 |
| Double-click submit → only one POST in network tab | REQ-CO-4, SCN-CO-4 |
| Reload page → reopen checkout → form pre-filled | REQ-CO-3, SCN-CO-5 |
| Close checkout → cart drawer reappears | SCN-CO-6 |

## Risk & rollback

- **Risk**: Modifies both `app.js` and `styles.css` in ways that interact with PR 2b's drawer. The "Ir a pagar" wiring change is in the drawer module from PR 2b. If PR 2b drawer module is not yet applied, the checkout module wires to a placeholder button that will be replaced by PR 2b's "Ir a pagar" — the sequence (PR 2b before PR 3) protects this.
- **Rollback**: `git revert <merge-commit>` removes the checkout modal markup, CSS, and `app.js` checkout module. CartStore and drawer from PRs 2a/2b are unaffected.

## Out of scope reminder

- WhatsApp link (PR 4)
- aria-live on success/error regions (PR 5)
- focus-visible polish (PR 5)
- Empty-cart clear confirmation (PR 5)
