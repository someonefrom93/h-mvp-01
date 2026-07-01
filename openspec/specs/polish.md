# polish — Spec

## Purpose

Elevates the cart-checkout flow from functional to solid: proper empty-cart messaging, a clear-cart confirmation guard, `prefers-reduced-motion` support on the drawer animation, visible focus indicators on all interactive elements, associated `<label>` elements on all form fields, screen-reader announcements for dynamic regions, and the fix for the pre-existing `.card:hover` / IntersectionObserver transform conflict.

## Requirements

### REQ-PO-1: Empty cart drawer shows helpful copy

When `CartStore.count()` is 0 and the drawer is open, the drawer MUST display the message "Tu carrito está vacío" along with a brief supporting message encouraging the customer to browse the menu. The "Ir a pagar" CTA MUST be hidden or disabled in this state. Rationale: empty state prevents user confusion and sets expectations.

### REQ-PO-2: Clear-cart requires confirmation

The drawer MUST provide a "Vaciar carrito" control. Activating it when the cart has one or more items MUST trigger a confirmation prompt before calling `CartStore.clear()`. Rationale: accidental clears are frustrating and irreversible.

### REQ-PO-3: Drawer slide animation respects prefers-reduced-motion

The drawer's slide-in transition MUST be disabled (zero duration or omitted entirely) when the `prefers-reduced-motion: reduce` media query is active. Rationale: motion can cause discomfort for users with vestibular disorders; this extends existing reduced-motion support in the project.

### REQ-PO-4: All interactive elements have visible focus indicators

Every focusable element in the cart drawer, checkout form, and success/error states MUST have a visible `:focus-visible` outline that meets WCAG 2.1 AA contrast requirements against the element's background. Rationale: keyboard-only users need a clear focus indicator to navigate.

### REQ-PO-5: Checkout form fields have associated label elements

Every form input in the checkout view MUST be accompanied by a `<label>` element whose `for` attribute matches the input's `id`. Placeholder text MUST NOT be the only label for any field. Rationale: screen readers and autofill tools rely on programmatic labels.

### REQ-PO-6: Success state is announced via aria-live polite

The success state container MUST carry `aria-live="polite"` so that assistive technology announces its appearance without interrupting ongoing speech. Rationale: keyboard and screen-reader users completing checkout need confirmation the order went through.

### REQ-PO-7: Error state is announced via aria-live assertive

The inline error container in the checkout view MUST carry `aria-live="assertive"` so that assistive technology immediately announces error messages. Rationale: errors need to interrupt to be actionable.

### REQ-PO-8: Fix .card:hover / IntersectionObserver transform conflict

The IntersectionObserver reveal MUST be refactored to apply its reveal transform via a CSS class (`card--revealed`) rather than via `element.style.transform` inline. Once a card receives the `card--revealed` class, the `.card:hover` rule (CSS class-based) MUST be able to layer a lift transform on top without being overridden by an inline style. Rationale: inline styles beat class-based rules in the cascade, permanently breaking the hover lift after cards are revealed (discovery #225). The chosen approach is the class-based method.

## Scenarios

### SCN-PO-1: Empty cart shows "Tu carrito está vacío"

Given the cart is empty  
When the customer opens the cart drawer  
Then the text "Tu carrito está vacío" is displayed  
And the "Ir a pagar" button is not visible or is disabled

### SCN-PO-2: Clear-cart confirmation guards against accidental clear

Given the cart contains at least one item  
When the customer activates the "Vaciar carrito" control  
Then a confirmation prompt is shown asking the customer to confirm  
And the cart is cleared only if the customer confirms  
And the cart remains unchanged if the customer cancels

### SCN-PO-3: prefers-reduced-motion disables drawer slide

Given the system or browser has `prefers-reduced-motion: reduce` active  
When the cart drawer is opened  
Then the drawer appears without a slide or fade transition  
And no motion-based animation runs during open or close

### SCN-PO-4: VoiceOver (macOS) reads success state on appearance

Given macOS VoiceOver is active  
And the customer has just submitted a valid order  
When the success state renders  
Then VoiceOver announces the success content without the customer navigating to it manually

### SCN-PO-5: Keyboard-only full flow completes without mouse

Given the customer is using keyboard only (no mouse or touch)  
When the customer adds an item, opens the drawer, navigates to "Ir a pagar", fills the checkout form, and activates "Confirmar pedido"  
Then every step is reachable via Tab / Shift+Tab  
And the flow completes successfully without requiring any pointer interaction

### SCN-PO-6: Card hover-lift works after reveal

Given the IntersectionObserver has fired and a menu card has the `card--revealed` class  
When the customer hovers over the card  
Then the card lifts (the hover transform is applied visually)  
And the lift is not suppressed by an inline `style.transform`

### SCN-PO-7: Form error announced immediately by screen reader

Given NVDA or VoiceOver is active  
And the checkout form shows an inline validation error  
When the error message appears in the `aria-live="assertive"` region  
Then the screen reader announces the error without the customer navigating to the error text

## Out of scope

- Payment processing
- Account system or login
- Any features not already delivered in PRs 1–4
- Full WCAG 2.1 AA audit beyond the items listed above
- Desktop-specific layout polish
