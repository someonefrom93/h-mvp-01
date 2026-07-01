# checkout — Spec

## Purpose

Wires the "Ir a pagar" CTA to a checkout view — an inline modal/section — showing the order summary, a customer form, and a "Confirmar pedido" button that posts to `POST /api/orders`. On success the view transitions to a success state showing the order ID. On failure it surfaces an inline error without losing the cart. Form inputs are persisted to `localStorage` on change so accidental navigation does not wipe the customer's details.

## Requirements

### REQ-CO-1: "Ir a pagar" opens the checkout view

Tapping "Ir a pagar" in the cart drawer MUST open a checkout view — implemented as a full-screen modal overlay — displaying an order summary (item list and subtotal from `CartStore`) and a customer form. The drawer MUST close when the checkout view opens. Rationale: simpler than a separate page; avoids a routing layer that does not yet exist.

### REQ-CO-2: Customer form collects required fields with client-side validation

The checkout form MUST collect: name (required), phone (required), address (required), notes (optional). "Confirmar pedido" MUST NOT submit if name, phone, or address are empty. On a blocked submission the form MUST display an inline error adjacent to each invalid field. No navigation occurs on a blocked submission. Rationale: prevents wasteful API calls and gives the customer an actionable error.

### REQ-CO-3: Checkout form state persists to localStorage on input

The form MUST write its current field values to `localStorage` under the key `burger_checkout_draft_v1` on every `input` event. On mount the form MUST read that key and pre-fill any previously stored values. Rationale: customers filling out a long address should not lose their input on accidental navigation. Stale drafts are acceptable — the customer can clear fields manually.

### REQ-CO-4: Confirmar pedido submits to POST /api/orders

When the form is valid and the button is clicked, the system MUST send `POST /api/orders` with `{ customer: { name, phone, address, notes }, items: CartStore.getItems().map(...), subtotal: CartStore.subtotal() }`. The "Confirmar pedido" button MUST be disabled for the duration of the in-flight request. Rationale: prevents duplicate orders (double-submit race condition identified in the proposal).

### REQ-CO-5: Success state shows order ID

On a 201 response the checkout view MUST transition to a success state displaying the `order_id` returned by the server and a "Ver pedido" placeholder button. `CartStore.clear()` MUST be called. The `burger_checkout_draft_v1` localStorage key MUST be removed. Rationale: confirms the order was placed and resets state cleanly.

### REQ-CO-6: Error state surfaces inline without losing the cart

On any non-201 response (4xx, 5xx) or a network failure, the checkout view MUST display an inline error message near the form. The "Confirmar pedido" button MUST be re-enabled. The cart MUST remain intact. The customer MUST not be navigated away. Rationale: recoverable errors should not strand the customer.

## Scenarios

### SCN-CO-1: Happy path — valid form → success state with order ID

Given the cart has at least one item  
And the customer fills in name, phone, and address  
When the customer clicks "Confirmar pedido"  
Then a single `POST /api/orders` is sent  
And on 201 the view shows a success state containing the `order_id`  
And the cart badge resets to 0  
And the `burger_checkout_draft_v1` key is removed from localStorage

### SCN-CO-2: Empty name field blocks submission

Given the checkout view is open with the form visible  
When the customer leaves the name field empty and clicks "Confirmar pedido"  
Then no POST request is sent  
And an inline error is displayed adjacent to the name field

### SCN-CO-3: Network failure — error shown, cart preserved

Given the device has no network connectivity  
When the customer clicks "Confirmar pedido" with a valid form  
Then the checkout view shows an inline error message  
And "Confirmar pedido" becomes re-enabled  
And `CartStore.getItems()` still returns the same items as before the attempt

### SCN-CO-4: Double-tap submit sends only one POST

Given the checkout view is open with a valid form  
When the customer taps "Confirmar pedido" twice in rapid succession  
Then only one `POST /api/orders` request is sent  
And the button is disabled after the first tap and remains disabled until a response arrives

### SCN-CO-5: Form draft restored after page reload

Given the customer has partially filled in the checkout form (name and phone entered, address empty)  
When the customer reloads the page and opens the checkout view  
Then the name and phone fields are pre-filled with the previously entered values  
And the address field is empty

### SCN-CO-6: Checkout view closes without submitting, cart survives

Given the checkout view is open  
When the customer closes it (Escape or a close button)  
Then the cart remains intact  
And the nav badge still reflects the current item count

## Out of scope

- WhatsApp "Enviar pedido" button on the success screen (PR 4)
- Success screen polish and aria-live announcements (PR 5)
- Payment processing of any kind
- Order history
