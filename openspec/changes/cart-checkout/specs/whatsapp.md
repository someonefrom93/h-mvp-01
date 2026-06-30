# whatsapp — Spec

## Purpose

After a successful order, the success screen gains an "Enviar pedido por WhatsApp" button — a standard anchor tag linking to a `wa.me/` deep link with a pre-filled order summary. The customer opens WhatsApp and presses Send; the business receives the full order without any server-side push. The business phone number comes from the server's `config.js`, which the front-end reads from the 201 response.

## Requirements

### REQ-WA-1: POST /api/orders response includes a whatsapp_link field

The server MUST include a `whatsapp_link` field in the 201 response body. The value MUST be a fully formed URL in the format `https://wa.me/<digits>?text=<URL-encoded-text>` where `<digits>` is the business phone from `server/config.js` (country code + number, no `+`, no spaces, no dashes). Rationale: keeps phone configuration in one server-side location; the front-end never hardcodes the number.

### REQ-WA-2: Business phone is stored in server/config.js as a single constant

The business phone MUST be defined as a single exported constant in `server/config.js`. It MUST be a digits-only string (e.g., `"5215512345678"`). Rationale: a committed config file is appropriate for an MVP where the repo is private and simplicity matters more than deploy-time overrides; an env var can replace it later without changing the spec shape. The `server/config.js` constant is the single source of truth — the phone appears nowhere else.

### REQ-WA-3: WhatsApp message body contains full order details

The URL-encoded text MUST include, in order:
1. A business-readable order header (e.g., "Nuevo pedido #\<order_id\>")
2. An itemised list: one line per item in the format `<qty> × <product_name> = $<line_total>`
3. Subtotal line
4. Customer name, phone, address, and notes (if present)

Rationale: the business must be able to act on the message without referring to any other system.

### REQ-WA-4: Success screen renders an anchor CTA linking to the whatsapp_link

The success state MUST render an `<a>` element with:
- `href` set to the `whatsapp_link` value from the 201 response
- `target="_blank"`
- `rel="noopener noreferrer"`
- Visible label "Enviar pedido por WhatsApp"

Rationale: standard safe cross-origin link; opens WhatsApp without navigating away.

### REQ-WA-5: URL encoding handles Spanish characters correctly

The `text` query parameter MUST be UTF-8 percent-encoded (via `encodeURIComponent` or equivalent). Characters such as `á`, `é`, `ñ`, `ü`, `¡`, `¿` MUST survive encoding and decode correctly when WhatsApp displays the message. Double-encoding (encoding an already-encoded string) MUST NOT occur. Rationale: customer names and addresses regularly contain Spanish diacritics.

## Scenarios

### SCN-WA-1: Successful order → WhatsApp CTA appears with correct link

Given a successful 201 response has been received  
When the success state is displayed  
Then an `<a>` element is visible with `href` starting with `https://wa.me/`  
And the `href` contains the business phone as digits only (no `+`, no spaces)  
And the `href` contains a `text` query parameter with the encoded order summary

### SCN-WA-2: Business phone renders digits-only in the wa.me URL

Given `server/config.js` defines the phone as `"5215512345678"`  
When the 201 response is processed  
Then the `whatsapp_link` href is `https://wa.me/5215512345678?text=...`  
And the href contains no `+`, no spaces, and no dashes in the phone segment

### SCN-WA-3: Spanish characters survive encoding

Given a customer whose name is "María Ñoño" and address is "Av. Insurgentes 100, piso 3°"  
When the order is successfully submitted  
Then the decoded `text` parameter in the WhatsApp link contains "María Ñoño" and the full address verbatim  
And the URL is not double-encoded (i.e., `%25` does not appear in the href)

### SCN-WA-4: Large order (20 items) produces a valid link

Given an order with 20 distinct line items  
When the 201 response is received  
Then the `whatsapp_link` URL is a syntactically valid URL  
And decoding the `text` parameter contains all 20 line items

## Out of scope

- Server-initiated WhatsApp messages (Meta Cloud API, Twilio, or similar)
- Push notifications to the business
- Any additional communication channels (email, SMS)
- Delivery or order tracking
- Polish and accessibility improvements to the success screen (PR 5)
