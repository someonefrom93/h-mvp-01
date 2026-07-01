# cart-ui-2b — Spec

## Purpose

Adds the visible cart drawer UI on top of the cart state foundation from `cart-ui-2a`: a slide-in panel with close button, item rows, quantity controls, subtotal footer, empty state, and an "Ir a pagar" stub CTA. Checkout wiring, customer info capture, backend submission, and WhatsApp handoff remain deferred.

## Requirements

Note: Cart storage, mutations, menu-card add buttons, and nav badge behavior are defined in `cart-ui-2a`; this file governs drawer rendering and interaction only.

### REQ-CD-1: Cart drawer shell opens, closes, and displays cart summary areas

The cart drawer MUST slide in from the right when the cart nav icon is tapped or when a cart item is added. It MUST include a close button, an item list area, a subtotal footer, and an "Ir a pagar" CTA button. The drawer MUST close when the close button is clicked or the Escape key is pressed. Rationale: provides complete cart review before the customer proceeds to checkout.

### REQ-CD-2: Cart drawer item rows expose quantity controls and removal

Each item row MUST show the product name, decrease (`−`) and increase (`+`) quantity buttons, current quantity, line total (`unit_price × quantity`), and an explicit remove (`×`) button. Quantity controls MUST call the cart state foundation from `cart-ui-2a`; decrementing from quantity 1 removes the item. Rationale: reflects the resolved decision to use ± controls while keeping explicit removal.

### REQ-CD-3: "Ir a pagar" CTA is a keyboard-focusable no-op stub

The "Ir a pagar" CTA MUST exist visually and MUST be reachable by keyboard focus. In this slice it MUST NOT navigate, submit, or call the backend. Rationale: reserves the checkout entry point while checkout wiring remains PR 3.

### REQ-CD-4: Cart drawer is keyboard navigable

The drawer MUST behave as a modal dialog: when open it MUST trap focus within itself; Tab MUST cycle through all focusable controls; Escape MUST close the drawer; closing MUST return focus to the element that opened it. Rationale: minimum keyboard accessibility required before checkout is introduced.

### REQ-CD-5: Empty cart state is visible and helpful

When `CartStore.count()` is 0 and the drawer is open, the drawer MUST display an empty-cart state with helpful copy, including "Tu carrito está vacío" or equivalent. The "Ir a pagar" CTA MUST be hidden or disabled in this state. Rationale: empty state prevents user confusion and sets expectations.

### REQ-CD-6: Drawer slide animation respects reduced-motion preference

The drawer's slide-in transition MUST be disabled (zero duration or omitted entirely) when the `prefers-reduced-motion: reduce` media query is active. Rationale: motion can cause discomfort for users with vestibular disorders.

## Scenarios

### SCN-CD-1: Add one item — drawer opens and shows item row

Given the cart is empty and the drawer is closed  
When the customer clicks "Agregar al carrito" on any menu card  
Then the cart drawer opens  
And the drawer shows that item with quantity 1 and the correct line total

### SCN-CD-2: Quantity control decrements to zero removes item

Given the cart contains one item with quantity 1  
When the customer clicks the "−" quantity button for that item  
Then the item is removed from the cart  
And the drawer reflects the empty state

### SCN-CD-3: Removing the last item shows empty state

Given the cart contains exactly one item  
When the customer clicks the remove button on that item in the drawer  
Then `CartStore.count()` returns 0  
And the drawer shows the empty-cart state  
And the nav badge displays `0`

### SCN-CD-4: Keyboard navigation — Escape closes the drawer

Given the cart drawer is open  
When the customer presses the Escape key  
Then the drawer closes  
And focus returns to the element that opened the drawer

### SCN-CD-5: Tab key cycles focus within the open drawer

Given the cart drawer is open with at least two focusable controls  
When the customer presses Tab repeatedly  
Then focus cycles through all focusable controls within the drawer without escaping to the page behind it

### SCN-CD-6: prefers-reduced-motion disables drawer slide

Given the system or browser has `prefers-reduced-motion: reduce` active  
When the cart drawer is opened  
Then the drawer appears without a slide or fade transition  
And no motion-based animation runs during open or close

## Out of scope

- CartStore storage and public mutator contract (PR 2a)
- Menu-card "Agregar al carrito" buttons (PR 2a)
- Nav badge state foundation (PR 2a)
- Checkout form (PR 3)
- Backend `POST /api/orders` call (PR 3)
- WhatsApp link (PR 4)
- Customer info capture
