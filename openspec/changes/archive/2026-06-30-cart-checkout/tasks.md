# cart-checkout — Task Index

## Merge order (stacked-to-main)

1. **PR 1 — Backend skeleton** (lands first; everything else depends on the API)
2. **PR 2a — Cart state foundation**
3. **PR 2b — Cart drawer UI**
4. **PR 3 — Checkout flow**
5. **PR 4 — WhatsApp handoff**
6. **PR 5 — Polish**

Each PR merges directly to main. No feature branch accumulation.

## Cross-PR concerns

### New runtime dependencies

| Dep | Used in PRs | Notes |
| --- | --- | --- |
| express | 1, 3, 4 | server only |
| better-sqlite3 | 1, 4 | server only, native module |
| vitest | 1 (devDep) | server tests |
| supertest | 1 (devDep) | HTTP integration tests |
| jsdom | 2a (devDep) | CartStore localStorage tests |

### New scripts in `server/package.json`

| Script | Command | Used in PR |
| --- | --- | --- |
| `dev` | `node --watch server/index.js` | 1 |
| `start` | `node server/index.js` | 1 |
| `test` | `vitest run` | 1 |

### CSS classes added across PRs

| Class | Added in PR | Purpose |
| --- | --- | --- |
| `.card__add` | 2a | "Agregar al carrito" button on menu cards |
| `.cart-badge` | 2a | Nav cart count badge |
| `.cart-drawer` | 2b | Slide-in cart drawer dialog |
| `.cart-drawer__head` | 2b | Drawer header |
| `.cart-drawer__body` | 2b | Drawer item list area |
| `.cart-drawer__foot` | 2b | Drawer footer with subtotal + CTA |
| `.cart-drawer__empty` | 2b | Empty state message |
| `.cart-row` | 2b | Cart item row (info + qty + total) |
| `.cart-row__btn` | 2b | ±/remove quantity buttons |
| `.cart-row__btn--remove` | 2b | × remove button |
| `.cart-drawer__subtotal` | 2b | Subtotal display |
| `.cart-drawer__cta` | 2b | "Ir a pagar" button |
| `.checkout-modal` | 3 | Full-screen checkout dialog |
| `.checkout-summary` | 3 | Order summary in checkout |
| `.checkout-form` | 3 | Checkout form |
| `.form-err` | 3 | Inline form error message |
| `.checkout-success` | 3 | Success state (initially hidden) |
| `.checkout-error` | 3 | Error message container |
| `.btn--whatsapp` | 4 | WhatsApp CTA button |
| `.card--revealed` | 5 | IO reveal state — replaces inline transform |
| `:focus-visible` rings | 5 | Keyboard focus indicators (applied broadly) |

### Front-end localStorage keys

| Key | PR | Purpose |
| --- | --- | --- |
| `burger_cart_v1` | 2a | Cart items array |
| `burger_checkout_draft_v1` | 3 | Checkout form draft (name/phone/address/notes) |

### Server config constants

| Constant | PR | Notes |
| --- | --- | --- |
| `PORT` | 1 | Default `3000` |
| `DB_PATH` | 1 | `server/data/orders.db` |
| `BUSINESS_PHONE` | 1 | Digits-only string, validated at boot, used in PR 4 |

## Review workload forecast

| PR | Est. lines | Verdict | Notes |
| --- | --- | --- | --- |
| 1 | ~475 | TIGHT | Over by ~75. Trim verbosity in SCN-BE-5 test. Move idempotency.js tests to follow-up if needed. |
| 2a | ~340 | OK | 60-line buffer. Clean front-end-only scope. |
| 2b | ~320 | OK | 80-line buffer. Native `<dialog>` handles a11y for free. |
| 3 | ~410 | TIGHT | At ceiling. Defer success/error CSS to PR 5 if it slips. |
| 4 | ~225 | OK | 175-line buffer. Isolated server + one front-end render change. |
| 5 | ~165 | OK | 235-line buffer. Lightest PR — mostly CSS and aria attributes. |

**Chained PRs recommended**: Yes — locked by preflight `pr_strategy: force-chained`

**400-line budget risk**: Medium — PRs 1 and 3 are TIGHT. All other PRs are safe.

**Decision needed before apply**: No — force-chained with stacked-to-main is the locked preflight strategy. If PR 1 genuinely exceeds 400 after implementation discipline, implement the trim options listed in PR 1's task file before raising an exception.

## Notes for the apply phase

- **Commit style**: Conventional commits per the work-unit-commits skill. Each numbered implementation step is a separate commit. Squash at PR merge, not during apply.
- **PR 2a test environment**: CartStore tests use `// @vitest-environment jsdom` docblock — no vitest.config.js change needed in PR 2a; jsdom is added as a devDependency.
- **No `server/package.json` creation in apply**: PR 1's apply phase creates `server/package.json` and runs `npm install`. Do not pre-create it.
- **Business phone**: Set a placeholder value in `server/config.js` for PR 1 (e.g. `'5215512345678'`). The real value is not yet known — PR 4 will use whatever is committed.
- **Phone leak check**: Run `grep -rn "521" app.js index.html styles.css` as part of PR 4's verification. Zero results required.
- **Tab sync**: PR 2a's `storage` event listener enables cross-tab cart sync — ensure it is tested manually (open two tabs, add in one, badge updates in the other).
- **`.card--revealed` in PR 5**: This is the only `app.js` change in PR 5. All other PR 5 changes are HTML attributes and CSS. The IO refactor must be verified: scroll to reveal cards, then hover — the lift must work.

## Next recommended

Run `sdd-apply` starting with **PR 1 — Backend skeleton**.
