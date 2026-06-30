# PR 4 — WhatsApp handoff

## Scope

Generates the `wa.me/<phone>?text=<encoded>` deep link server-side in `server/lib/whatsapp.js` after order creation. The 201 response gains a `whatsapp_link` field. The success screen in the front-end renders an `<a target="_blank" rel="noopener noreferrer">Enviar pedido por WhatsApp</a>` linking to that URL. The business phone is a committed constant in `server/config.js`.

**Does NOT include**: any additional communication channels, push notifications, polish of the success screen (aria-live, focus-visible).

## Estimated lines

| Concern | Est. lines |
| --- | --- |
| new code (excluding tests) | 135 |
| new tests | 80 |
| modifications to existing files | 35 (server/routes/orders.js ~25, app.js ~30, index.html ~10) |
| **TOTAL** | **~225** |
| Budget verdict | OK — 175-line buffer within the 400-line budget |

## File-by-file change list

| File | Action | ~Lines | Purpose |
| --- | --- | --- | --- |
| `server/lib/whatsapp.js` | create | 80 | `buildWaLink({ orderId, items, customer, subtotal, phone })` — pure function, builds order text, truncates at 2000 chars if needed, returns `https://wa.me/<phone>?text=<encoded>` |
| `server/lib/whatsapp.test.js` | create | 80 | Vitest unit tests: Spanish chars survive encoding, no `+` in URL, 20-item order, HTML in product_name encoded not entity-ized, truncation |
| `server/routes/orders.js` | modify | 25 | Import `buildWaLink`, call after tx insert succeeds, add `whatsapp_link` to 201 response body |
| `app.js` | modify | 30 | In `showSuccess(body)`: read `body.whatsapp_link`, render `<a class="btn btn--whatsapp" href="${link}" target="_blank" rel="noopener noreferrer">Enviar pedido por WhatsApp</a>` in the success div |
| `index.html` | modify | 10 | No structural change; `btn--whatsapp` class added to existing button styles or inline style; a11y `rel="noopener noreferrer"` on the anchor |
| `styles.css` | modify | 0 | No changes (btn--whatsapp uses existing brand-green or brand-orange tokens) |

## Implementation order

1. **feat(whatsapp): add server/lib/whatsapp.js** — Implement `buildWaLink({ orderId, items, customer, subtotal, phone })`: build order text header, itemized lines (`${qty} × ${name} = $${line_total}`), subtotal, customer block; `encodeURIComponent` once; truncate with "...y N artículos más" if URL > 2000 chars; return `https://wa.me/${phone}?text=...`. Commit: `feat(whatsapp): add buildWaLink server-side function`.

2. **test(whatsapp): add whatsapp.js unit tests** — `server/__tests__/whatsapp.test.js`: Spanish chars round-trip, phone digits-only in URL, no double-encoding, 20-item order fits, HTML chars encoded as `%3C` not `&lt;`, truncation fallback triggers at >2000 chars. Commit: `test(whatsapp): add buildWaLink unit tests`.

3. **feat(whatsapp): wire buildWaLink into POST /api/orders response** — In `server/routes/orders.js`: import `buildWaLink`, call with `{ orderId, items, customer, subtotal, phone: config.BUSINESS_PHONE }`, append `whatsapp_link` to 201 response object. Commit: `feat(whatsapp): return whatsapp_link in POST /api/orders 201 response`.

4. **feat(whatsapp): render WhatsApp CTA in success screen** — In `app.js` `showSuccess(body)`: read `body.whatsapp_link`, inject anchor into the success div: `<a href="${link}" target="_blank" rel="noopener noreferrer" class="btn btn--whatsapp">Enviar pedido por WhatsApp</a>`. Commit: `feat(whatsapp): render WhatsApp CTA on success screen`.

5. **review(whatsapp): verify no phone leak to front-end** — Before marking PR ready: `grep -rn "521" app.js index.html styles.css` — must return zero results. Phone lives only in `server/config.js` and the generated wa.me URL returned from the API.

## Acceptance criteria

- [ ] REQ-WA-1: POST /api/orders 201 response includes `whatsapp_link: "https://wa.me/<digits>?text=..."`
- [ ] REQ-WA-2: Business phone is defined as digits-only constant in `server/config.js`; no `+`, no spaces, no dashes
- [ ] REQ-WA-3: Message body contains order header, itemized list (qty × name = $line_total), subtotal, customer name/phone/address/notes
- [ ] REQ-WA-4: Success screen renders `<a href="${whatsapp_link}" target="_blank" rel="noopener noreferrer">Enviar pedido por WhatsApp</a>`
- [ ] REQ-WA-5: Spanish characters (á, é, ñ, ü, ¡, ¿) survive encoding round-trip; no `%25` double-encoding in URL
- [ ] `vitest run` passes on `server/__tests__/whatsapp.test.js`
- [ ] `grep -rn "521" app.js index.html styles.css` returns zero results (no phone leak)

## Test plan

**File**: `server/__tests__/whatsapp.test.js`

| Test case | Covers |
| --- | --- |
| `buildWaLink — Spanish chars in name/address survive encodeURIComponent round-trip` | REQ-WA-5, SCN-WA-3 |
| `buildWaLink — no '+' in generated URL` | SCN-WA-2 |
| `buildWaLink — spaces/dashes in phone arg stripped` | defensive |
| `buildWaLink — 20-item order → valid URL with all items or summary line` | REQ-WA-4, SCN-WA-4 |
| `buildWaLink — HTML in product_name encoded as %3C not &lt;` | defensive |
| `buildWaLink — URL > 2000 chars → truncation with "...y N artículos más"` | SCN-WA-4 |
| `buildWaLink — output URL starts with https://wa.me/<digits>?text=` | REQ-WA-1, SCN-WA-1 |

## Risk & rollback

- **Risk**: Business phone is a committed constant in `server/config.js`. The phone is not sensitive (it's the public WhatsApp business number), but it is visible in the committed JS if the repo goes public. This was explicitly accepted in Decision 1 from `_decisions.md`.
- **Rollback**: `git revert <merge-commit>` removes `server/lib/whatsapp.js`, its test file, the `whatsapp_link` from the response, and the WhatsApp CTA from the success screen. Orders continue to be created without the WhatsApp link — PR 3 success screen still shows the order ID.

## Out of scope reminder

- Push notifications to business (Meta Cloud API, Twilio, etc.)
- Email/SMS confirmation
- aria-live on success screen (PR 5)
- focus-visible polish (PR 5)
- Empty-cart clear confirmation (PR 5)
