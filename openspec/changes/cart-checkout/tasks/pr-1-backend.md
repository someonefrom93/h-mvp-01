# PR 1 — Backend skeleton

## Scope

Drops a `server/` directory with Node + Express + SQLite. The server starts on port 3000, serves the existing static front-end, and exposes `POST /api/orders` with full validation, schema migration, idempotency, and an integration test suite. No front-end files are touched.

**Does NOT include**: cart UI, checkout UI, WhatsApp link, any front-end changes.

## Estimated lines

| Concern | Est. lines |
| --- | --- |
| new code (excluding tests) | 310 |
| new tests | 150 |
| modifications to existing files | 15 (README.md) |
| **TOTAL** | **~475** |
| Budget verdict | TIGHT — over by ~75 lines. Trim verbosity in `orders.test.js` if needed (see below). |

**Lines that could move to a follow-up PR**: The SQL-injection test case (`SCN-BE-5`) can be a single `it` assertion rather than a verbose step-by-step. If PR 1 still exceeds 400 after that, move `server/lib/idempotency.js` to a PR 1.5 (server-only, no test changes needed).

## File-by-file change list

| File | Action | ~Lines | Purpose |
| --- | --- | --- | --- |
| `server/package.json` | create | 25 | Backend manifest, scripts (dev/start/test), express + better-sqlite3 + vitest deps |
| `server/vitest.config.js` | create | 10 | Vitest node environment, includes `__tests__/**/*.test.js` |
| `server/config.js` | create | 15 | PORT=3000, DB_PATH, BUSINESS_PHONE (digits-only, validated at boot) |
| `server/db.js` | create | 30 | Opens better-sqlite3, WAL mode, foreign_keys ON, exports `openDatabase` |
| `server/migrate.js` | create | 40 | `migrate(db)` — idempotent schema_version check + orders/order_items DDL |
| `server/routes/orders.js` | create | 90 | POST /api/orders: parse → validate → idempotency → tx insert → 201 response |
| `server/lib/validate.js` | create | 40 | `validateOrderPayload(body)` returning `{ ok, value }` or `{ ok: false, errors }` |
| `server/lib/idempotency.js` | create | 30 | `withIdempotency(key, fn)` — in-memory Map, 24h TTL, lazy sweep |
| `server/__tests__/orders.test.js` | create | 150 | supertest integration: SCN-BE-1 (happy), SCN-BE-2..4 (validation), SCN-BE-5 (injection), SCN-BE-6 (migration); idempotent replay |
| `server/__tests__/helpers.js` | create | 20 | `makeApp()` helper: in-memory DB, migrate, createApp — shared across tests |
| `server/index.js` | create | 40 | Express app factory: static mount, /api mount, DB open, migrate on boot, listen |
| `server/.gitignore` | create | 5 | Ignores `server/data/*.db` |
| `README.md` | modify | 15 | Add `npm --prefix server run dev` + `npm --prefix server test` instructions |

## Implementation order

1. **chore(server): scaffold server directory and package.json** — `mkdir server server/routes server/lib server/__tests__`, `npm init -y --prefix server`, install express, better-sqlite3, vitest, supertest. Commit: `chore(server): scaffold server directory with deps`.

2. **feat(server): add config.js with PORT, DB_PATH, BUSINESS_PHONE** — Validate BUSINESS_PHONE with `/^\d{10,15}$/`, throw descriptive error on bad format. Commit: `feat(server): add config with PORT, DB_PATH, BUSINESS_PHONE`.

3. **feat(server): add db.js with better-sqlite3 wrapper** — WAL mode, foreign_keys ON, exports `openDatabase`. Commit: `feat(server): add better-sqlite3 db wrapper`.

4. **feat(server): add schema migration** — `migrate.js` creates `schema_version`, `orders`, `order_items` tables idempotently. Commit: `feat(server): add sqlite schema migration`.

5. **feat(server): add hand-written validate.js** — validate customer.name/phone/address required, items non-empty array, item.product_name/unit_price/quantity checks, subtotal check. Commit: `feat(server): add hand-written order payload validator`.

6. **feat(server): add idempotency.js** — `withIdempotency(key, fn)` using Map + 24h TTL, lazy sweep on call. Commit: `feat(server): add idempotency key store with 24h TTL`.

7. **feat(server): add orders route POST /api/orders** — Parse JSON, call validate, check Idempotency-Key, transaction insert orders + order_items rows, return 201 `{ order_id, created_at }` or 400 `{ errors }`. Commit: `feat(server): add POST /api/orders endpoint`.

8. **feat(server): add index.js Express app factory** — Mount `/api` routes, serve `../` as static, open DB, run migrate, listen on PORT. Commit: `feat(server): add Express app factory serving static and API`.

9. **test(server): add vitest config and test helpers** — `server/vitest.config.js`, `server/__tests__/helpers.js` with `makeApp()`. Commit: `test(server): add vitest config and test helpers`.

10. **test(server): add orders integration tests** — SCN-BE-1..6 scenarios plus idempotent replay. Commit: `test(server): add orders integration tests for SCN-BE-1..6`.

11. **chore(readme): add server run commands** — Document `npm --prefix server run dev` and `npm --prefix server test`. Commit: `chore(readme): document server dev and test commands`.

## Acceptance criteria

- [ ] REQ-BE-1: POST /api/orders accepts valid payload and returns 201 with `{ order_id, created_at }`
- [ ] REQ-BE-2: returns 400 with `{ errors }` on missing customer.name, missing customer.phone, missing customer.address, empty items array, non-positive quantity, missing/invalid subtotal
- [ ] REQ-BE-3: schema migration runs on boot; orders and order_items tables exist after fresh start
- [ ] REQ-BE-4: parameterized queries used throughout — SQL injection in product_name stored literally
- [ ] REQ-BE-5: at least one integration test for happy path and one for validation rejection
- [ ] `npm --prefix server test` passes with zero failures
- [ ] `npm --prefix server run dev` starts the server and serves the existing static page at http://localhost:3000
- [ ] Business phone is digits-only in `server/config.js` — server throws at boot if invalid

## Test plan

**File**: `server/__tests__/orders.test.js`

| Test case | Covers |
| --- | --- |
| `POST /api/orders — valid payload → 201 + order in DB` | SCN-BE-1, REQ-BE-1 |
| `POST /api/orders — missing customer.name → 400` | SCN-BE-2, REQ-BE-2 |
| `POST /api/orders — empty items array → 400` | SCN-BE-3, REQ-BE-2 |
| `POST /api/orders — negative quantity → 400` | SCN-BE-4, REQ-BE-2 |
| `POST /api/orders — SQL injection in product_name → 201, literal string stored` | SCN-BE-5, REQ-BE-4 |
| `server starts with no DB → tables created` | SCN-BE-6, REQ-BE-3 |
| `same Idempotency-Key replay → cached 201, single DB row` | idempotency |

## Risk & rollback

- **Risk**: PR introduces Node dependency (`express`, `better-sqlite3`) to a previously static project. The `server/data/` directory is gitignored so `orders.db` won't enter the repo.
- **Rollback**: `git revert <merge-commit>` removes the entire `server/` directory. Static front-end continues to work from the old URL. No data loss since no orders exist in production yet.

## Out of scope reminder

- Cart UI (PR 2a, PR 2b)
- Checkout flow (PR 3)
- WhatsApp link generation (PR 4)
- Any changes to `index.html`, `styles.css`, `app.js`
