# cart-checkout — Archive Report

**Change**: cart-checkout — real shopping cart + checkout + order persistence + WhatsApp handoff
**Archived**: 2026-06-30
**Verdict**: PASS (55/55 requirements, 28/28 scenarios, 38/38 vitest + 17/17 server tests)

---

## Quick path

1. The entire change has been promoted to the permanent spec set in `openspec/specs/`.
2. The original change folder was moved to `openspec/changes/archive/2026-06-30-cart-checkout/`.
3. This completes the SDD cycle for `cart-checkout`. No further phases required.

---

## What was delivered

| PR | Name | Scope | Status |
|----|------|-------|--------|
| 1 | Backend skeleton | Node + Express + SQLite, `POST /api/orders`, schema migration, vitest + supertest | ✅ Merged to `main` |
| 2a | Cart state foundation | CartStore (closure singleton), localStorage persistence, tab sync, 17 add-to-cart buttons, nav badge | ✅ Merged to `main` |
| 2b | Cart drawer UI | Native `<dialog>` slide-in drawer, ± quantity controls, subtotal footer, empty state, keyboard trap, reduced-motion | ✅ Merged to `main` |
| 3 | Checkout flow | Full-screen checkout modal, customer form (name/phone/address/notes), draft persistence, `POST /api/orders` wiring, success/error states | ✅ Merged to `main` |
| 4 | WhatsApp handoff | Server-side `buildWaLink()`, `whatsapp_link` in 201 response, success-screen CTA button | ✅ Merged to `main` (files restored from orphaned commits into PR 5) |
| 5 | Polish | Empty-cart copy, clear-cart confirmation, `aria-live` regions, `:focus-visible`, `<label>` elements, `.card--revealed` IO refactor | ✅ Merged to `main` |

## Final state

| Metric | Count |
|--------|-------|
| Requirements covered | 55 (across 6 specs) |
| Scenarios verified | 28 |
| Vitest tests passing | 38/38 (21 CartStore + 10 WhatsApp + 7 orders) |
| Server tests passing | 17/17 (10 WhatsApp + 7 orders) |
| Files modified | ~30 files across `server/`, `app.js`, `index.html`, `styles.css`, `tests/`, `README.md` |

## Acknowledged non-blocking issues

1. **PR 2b implicit globals**: `cartDrawer`, `cartDrawerClose`, `cartDrawerCheckout`, `cartDrawerBody`, `cartDrawerSubtotal` are assigned without `const` declarations in `app.js:289-393`. They work as implicit globals but pollute the global scope. Worth a future cleanup PR.

2. **Chain history mangled**: The PR 5 apply agent executed `git reset --soft HEAD~2` + `git rebase --abort`, orphaning 4 PR 4 commits. PR 4 file contents were recovered from reflog and bundled into the single PR 5 commit `2221223`. **Functional state is correct** — only the commit-per-PR boundaries were lost.

## Non-obvious decisions preserved

| Decision | Details |
|----------|---------|
| **IIFE constraint** | `app.js` uses a single IIFE with no ES modules. New front-end code must be added inside the existing IIFE or as additional IIFEs. Tests must redefine factories inline. |
| **`.card--revealed` fix** | The pre-existing `.card:hover` / IntersectionObserver inline-transform conflict was fixed by replacing `style.transform` with `classList.add('card--revealed')`. `.card:hover` specificity (0,2,0) now beats `.card--revealed` (0,1,0). |
| **`wa.me` deep-link model** | The business receives orders via a customer-initiated WhatsApp deep link (`wa.me/<phone>?text=<encoded>`), not server-push. No Meta API approval needed for MVP. |
| **Idempotency via header** | Double-submit protection uses `Idempotency-Key` header (client `crypto.randomUUID()`) + in-memory Map with 24h TTL. SQLite-backed persistence can be swapped in later without route changes. |
| **Single-port dev** | Server serves static files and API on one port (`:3000`), avoiding CORS configuration entirely. |
| **No zod** | Hand-written validation in `server/lib/validate.js` for MVP. ~15 KB zod dep avoided for 5 field checks. |

## Promoted permanent specs

| File | Source |
|------|--------|
| `openspec/specs/backend.md` | Per-change spec |
| `openspec/specs/cart-ui-2a.md` | Per-change spec |
| `openspec/specs/cart-ui-2b.md` | Per-change spec |
| `openspec/specs/checkout.md` | Per-change spec |
| `openspec/specs/whatsapp.md` | Per-change spec |
| `openspec/specs/polish.md` | Per-change spec |
| `openspec/specs/cart-checkout/design.md` | Per-change design |
| `openspec/specs/cart-checkout-decisions.md` | Per-change resolved decisions |

## Archived artifacts

All original planning artifacts moved to `openspec/changes/archive/2026-06-30-cart-checkout/`:
- `proposal.md`
- `design.md`
- `tasks.md` + `tasks/*.md`
- `specs/*.md` (including `_decisions.md`)
- `verify-report.md`

## SDD cycle complete

The `cart-checkout` change has been fully planned, implemented, verified, and archived. The project now has a permanent spec set reflecting the cart and checkout capabilities.

## Engram traceability

| Artifact | Engram obs ID | Topic key |
|----------|--------------|-----------|
| Init | #228 | `sdd-init/h-mvp-01` |
| Architecture decision | #226 | `architecture/cart-checkout` |
| Preflight | #227 | `sdd/session-preflight/cart-checkout` |
| Proposal | #231 | `sdd/cart-checkout/proposal` |
| Spec: backend | #232 | `sdd/cart-checkout/spec/backend` |
| Spec: cart-ui-2a | #238 | `sdd/cart-checkout/spec/cart-ui-2a` |
| Spec: cart-ui-2b | #239 | `sdd/cart-checkout/spec/cart-ui-2b` |
| Spec: checkout | #234 | `sdd/cart-checkout/spec/checkout` |
| Spec: whatsapp | #235 | `sdd/cart-checkout/spec/whatsapp` |
| Spec: polish | #236 | `sdd/cart-checkout/spec/polish` |
| Spec: decisions | #237 | `sdd/cart-checkout/spec/decisions` |
| Design | #243 | `sdd/cart-checkout/design` |
| Tasks | #244 | `sdd/cart-checkout/tasks` |
| Apply progress | #245 | `sdd/cart-checkout/apply-progress` |
| Verify report | #254 | `sdd/cart-checkout/verify-report` |
| Incident: mangled history | #253 | `incident/sdd-apply-terminal-pr-mangled-history` |
| Discovery: card hover/IO conflict | #225 | `discovery/card-hover-lift-conflicts-with-reveal-observer-inline-transform` |
| Discovery: IIFE blocks ES modules | #249 | `discovery/app-js-iife-blocks-module-imports` |
| Discovery: gitignore over-ignore | #246 | `discovery/sdd-init-gitignore-over-ignored-openspec-changes` |
| Discovery: delegate model cost | #251 | `discovery/general-delegate-uses-openrouter-fugu-ultra` |
| **This archive report** | _(current save)_ | `sdd/cart-checkout/archive-report` |
