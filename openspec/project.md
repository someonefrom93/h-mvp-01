# clone-burgers — Project context

Static HTML/CSS/vanilla JS clone of the Burger King México homepage. No build step, no framework, no backend.

## Quick path

1. Serve `index.html` with any static server (`python3 -m http.server 5173` or `npx serve .`).
2. The page is a single `index.html` with sections: top-bar, main-nav, rewards, hero, promos, menu, cta-strip, footer.
3. All imagery is inline SVG. Palette is in `styles.css` `:root` block.

## Stack

| Layer     | Detail                                      |
| --------- | ------------------------------------------- |
| Markup    | Vanilla HTML5, Spanish (`lang="es"`)        |
| Styling   | Vanilla CSS with CSS custom properties      |
| Scripting | Vanilla JS (IIFE, strict mode, ~167 lines)  |
| Backend   | None (Node + Express + SQLite planned)      |
| Testing   | None configured                             |
| Build     | No build step, no bundler, no npm           |

## Conventions

- **CSS**: BEM-like naming (`top-bar__inner`, `btn--signup`), CSS variables in `:root` for palette.
- **JS**: IIFE wrapper, `$` / `$$` helpers for querySelector/querySelectorAll, no framework.
- **HTML**: Semantic sections with `aria-label`, mobile-first drawer navigation.
- **No comments** in source unless structural separators (`/* ===== */`).

## Upcoming: cart-checkout

A follow-up change will introduce:
- Node + Express backend serving the static front-end and an API
- SQLite database for cart/pricing data
- `wa.me/` WhatsApp deep-link handoff for order completion
- This is NOT yet bootstrapped. The `sdd-new` / `sdd-ff` cycle will handle it.

## Palette

```
Cream (page bg):   #FAF4E6
Brand orange:      #F5821F   (primary CTA)
Brown (brand):     #502314   (headlines, dark UI)
Deal red:          #E43D2E   (hero button, promos)
Accent green:      #0E8A4A   (illustrations)
```

## Checklist

- [ ] cart-checkout change bootstrapped via `sdd-ff` or `sdd-new`
- [ ] Test runner configured (vitest or jest for front-end, perhaps supertest for backend)
- [ ] `package.json` initialized with scripts for dev, test, coverage

## Next step

Run `sdd-ff cart-checkout` or `sdd-new` from the orchestrator to begin the cart-checkout cycle.
