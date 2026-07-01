# cart-ui-2a — Spec

## Purpose

Establishes the cart state foundation: the cart exists as a real data structure, persists across reloads, can be mutated from any menu card, synchronises across tabs, and signals its size through the nav badge. No visual cart representation beyond the badge is added in this slice.

## Requirements

### REQ-CA-1: CartStore module manages cart state

The system SHALL provide a `CartStore` module with the following public interface:
- `add(product)` — adds a product `{ id, name, unit_price, category }` or increments its quantity by 1 if already present
- `remove(productId)` — removes the item with matching `id` entirely
- `setQty(productId, qty)` — sets the item's quantity to `qty`; if `qty` ≤ 0, removes the item
- `clear()` — empties the cart
- `getItems()` — returns a snapshot array of current items
- `subtotal()` — returns the numeric sum of `unit_price × quantity` for all items
- `count()` — returns the total number of individual units (sum of all quantities)

Rationale: a single module as the authoritative source prevents state drift between the nav badge, the future drawer, and the checkout flow.

### REQ-CA-2: Cart state persists across page reloads

`CartStore` MUST write its state to `localStorage` under the key `burger_cart_v1` after every mutation. On module initialisation it MUST read from that key and restore any previously saved items. Rationale: customers should not lose their cart on accidental refresh.

### REQ-CA-3: Tab synchronisation via storage events

`CartStore` MUST listen for the `storage` event on `window`. When a storage event targets key `burger_cart_v1`, the module MUST reload state from `localStorage` and trigger subscribers. Rationale: prevents divergent cart state when the customer has multiple tabs open (risk identified in the proposal).

### REQ-CA-4: Cart mutations notify UI subscribers reactively

Any `CartStore` mutator (`add`, `remove`, `setQty`, or `clear`) MUST notify registered UI subscribers so dependent UI, including the nav badge, updates without callers making manual DOM calls. Rationale: keeps state changes centralized and prevents caller-specific rendering drift.

### REQ-CA-5: Every menu card has an "Agregar al carrito" button

Each of the 17 existing menu cards MUST gain an "Agregar al carrito" button. Clicking it MUST call `CartStore.add(product)` where `product` is the card's `{ id, name, unit_price, category }`. Rationale: primary entry point for the ordering flow.

### REQ-CA-6: Nav cart badge reflects real item count

The demo cart counter (`$39`-per-click) MUST be replaced by a badge that displays `CartStore.count()`. The badge MUST update reactively whenever any `CartStore` mutation occurs. Rationale: replaces the placeholder with a meaningful signal to the customer.

## Scenarios

### SCN-CA-1: Add one item — badge shows 1

Given the cart is empty  
When the customer clicks "Agregar al carrito" on any menu card  
Then `CartStore.count()` returns `1`  
And the nav badge displays `1`

### SCN-CA-2: Adding the same item twice merges into qty 2

Given the cart contains one unit of "Whopper"  
When the customer clicks "Agregar al carrito" on the Whopper card again  
Then `CartStore.getItems()` returns one line item for "Whopper" with quantity `2`  
And the nav badge displays `2`

### SCN-CA-3: Cart survives page reload

Given the cart contains two items with a combined subtotal of $X  
When the customer reloads the page  
Then `CartStore.getItems()` returns the same two items  
And the nav badge still shows the correct count

### SCN-CA-4: Setting quantity to zero removes item

Given the cart contains one item with quantity 1  
When `CartStore.setQty(productId, 0)` is called for that item  
Then `CartStore.count()` returns `0`  
And the nav badge displays `0`

### SCN-CA-5: Tab sync — adding item in one tab reflects in another

Given the customer has two tabs open on the same page  
When the customer adds an item in Tab A  
Then Tab B's nav badge updates to reflect the new count without a page reload

## Out of scope

- Cart drawer UI (PR 2b)
- ± buttons inside drawer (PR 2b)
- "Ir a pagar" CTA (PR 2b)
- Empty cart state copy (PR 2b / PR 5 polish)
- Drawer animations (PR 2b)
- Drawer keyboard navigation (PR 2b)
- Customer form (PR 3)
- `POST /api/orders` call (PR 3)
- WhatsApp link (PR 4)
