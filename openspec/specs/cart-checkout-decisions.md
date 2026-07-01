# Open Questions — Resolved Decisions

These three open questions were raised in the proposal and are resolved here for the spec and design phases.

---

## Decision 1: Business phone source

**Question**: Config constant in `server/config.js` (committed), or `WHATSAPP_PHONE` env var (set at deploy)?

**Resolution**: `server/config.js` committed constant.

**Rationale**: This is an MVP where the repository is private and the business phone is not a secret — it's already public via the WhatsApp number the business advertises. A committed constant eliminates deployment friction (no `.env` file to provision, no risk of the server starting with an undefined phone). The wa.me URL is generated server-side so the number never appears in the front-end bundle. When/if the repository goes public or the number needs rotation without a redeploy, migrating to an env var is a one-line change in `server/config.js` plus a corresponding update in any deploy script. The spec for PR 4 (REQ-WA-2) reflects this choice.

---

## Decision 2: Quantity controls in cart drawer

**Question**: ± buttons with current quantity displayed, or remove-only (× button)?

**Resolution**: ± buttons with current quantity displayed.

**Rationale**: Customers browsing a burger menu expect to order 2 Whoppers + 3 fries without adding and removing repeatedly. ± controls (− qty + button) are a widely understood pattern in food-ordering apps and reduce friction for the most common action (adjusting quantity upward or downward by one). The JS complexity is low: `setQty(id, current + 1)` and `setQty(id, current - 1)` with a guard that removes the item when qty reaches 0. The remove button is kept as a distinct affordance so "remove this item entirely" is a single deliberate tap rather than repeated decrements. The cart-ui-2b spec (REQ-CD-2 and SCN-CD-2) reflects this choice.

---

## Decision 3: Checkout form draft persistence

**Question**: Persist form state to `localStorage` on `input`, restore on mount — or don't?

**Resolution**: Persist to `localStorage` under key `burger_checkout_draft_v1` on every `input` event; restore on mount; clear on successful order submission.

**Rationale**: The customer form asks for name, phone, and address. Address fields in particular require typing effort. A back-navigation or accidental refresh mid-checkout destroys that effort with no recovery. The persistence cost is trivial (four string values in localStorage, written on input), and the risk of stale drafts is minimal — the customer can clear the fields, and on successful order the draft is explicitly removed. This produces strictly better UX than the alternative with nearly zero implementation overhead. The checkout spec (REQ-CO-3, SCN-CO-5) reflects this choice.
