# backend — Spec

## Purpose

Introduces the Node + Express server that will host both the existing static front-end and the new order API. After this PR lands, `POST /api/orders` accepts a structured order payload, validates it, persists two SQLite tables, and returns the new order ID. The rest of the site continues to work unchanged.

## Requirements

### REQ-BE-1: Order endpoint accepts valid payload and persists an order

The server SHALL expose `POST /api/orders` accepting `Content-Type: application/json` with body `{ customer: { name, phone, address, notes }, items: [{ product_name, unit_price, quantity }], subtotal }`. On success it MUST insert one row into `orders` and one row per item into `order_items`, then respond with HTTP 201 and body `{ order_id, created_at }`. Rationale: establishes the data contract that all later PRs depend on.

### REQ-BE-2: Validation rejects malformed payloads

The server MUST return HTTP 400 with a JSON body `{ errors: [...] }` when any of the following are true: `customer.name` is absent or empty; `customer.phone` is absent or empty; `customer.address` is absent or empty; `items` is absent, not an array, or empty; any item has `quantity` ≤ 0 or non-numeric; `subtotal` is absent or non-numeric. Rationale: prevents garbage data reaching the database and surfaces validation problems to callers before any UI exists.

### REQ-BE-3: SQLite schema auto-migrates on server boot

The server MUST create the `orders` and `order_items` tables if they do not exist, using the following schema:
- `orders(id INTEGER PK, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, address TEXT NOT NULL, notes TEXT, subtotal REAL NOT NULL, created_at TEXT NOT NULL)`
- `order_items(id INTEGER PK, order_id INTEGER NOT NULL REFERENCES orders(id), product_name TEXT NOT NULL, unit_price REAL NOT NULL, quantity INTEGER NOT NULL, line_total REAL NOT NULL)`

Migration MUST run before the server begins accepting requests. Rationale: zero-config setup for any new environment.

### REQ-BE-4: User input is stored as literal text (no injection)

The server SHALL treat all string fields (`product_name`, `customer_name`, etc.) as opaque text. Values MUST be bound as parameterized query values, never interpolated into SQL strings. Rationale: SQLite injection prevention; also ensures special characters survive storage and retrieval intact.

### REQ-BE-5: Smoke test covers happy path and validation rejection

The test suite MUST include at least one integration test asserting a valid payload returns 201 with an `order_id`, and at least one test asserting an invalid payload (missing `customer.name`) returns 400. Tests MUST run with `vitest`. Rationale: CI gate so the endpoint never regresses silently.

## Scenarios

### SCN-BE-1: Happy path — valid order persisted

Given the server is running and the SQLite database is empty  
When a client sends `POST /api/orders` with a valid `customer` object, a non-empty `items` array (each item has `product_name`, positive `unit_price`, positive `quantity`), and a numeric `subtotal`  
Then the server responds 201 with `{ order_id: <integer>, created_at: <ISO-8601 string> }` and the database contains one `orders` row and one `order_items` row per item

### SCN-BE-2: Missing customer name → 400

Given the server is running  
When a client sends `POST /api/orders` with `customer.name` set to `""` (empty string)  
Then the server responds 400 with `{ errors: [...] }` containing an entry referencing `customer.name`  
And no rows are inserted into `orders` or `order_items`

### SCN-BE-3: Empty items array → 400

Given the server is running  
When a client sends `POST /api/orders` with `items: []`  
Then the server responds 400 with `{ errors: [...] }` containing an entry referencing `items`

### SCN-BE-4: Negative quantity → 400

Given the server is running  
When a client sends `POST /api/orders` with one item where `quantity` is `-1`  
Then the server responds 400 with `{ errors: [...] }` containing an entry referencing item quantity

### SCN-BE-5: SQL injection attempt stored safely

Given the server is running  
When a client sends `POST /api/orders` with `product_name: "Whopper'; DROP TABLE orders; --"` and otherwise valid data  
Then the server responds 201 and the `order_items` table contains a row with `product_name` equal to the literal string `Whopper'; DROP TABLE orders; --`  
And the `orders` table is unmodified by the injection attempt

### SCN-BE-6: Schema auto-migration on first boot

Given no database file exists  
When the server process starts  
Then both `orders` and `order_items` tables are created before the first request is handled  
And a subsequent valid `POST /api/orders` succeeds with 201

## Out of scope

- Cart state, cart drawer, checkout form (PR 2a, PR 2b, and PR 3)
- WhatsApp link generation (PR 4)
- Returning a `whatsapp_link` in the response (added in PR 4)
- Payment processing of any kind
- Authentication or session management
- Order history or read endpoints (`GET /api/orders`)
- Front-end changes to `index.html`, `styles.css`, or `app.js`
