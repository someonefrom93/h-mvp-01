# Burgers — Front-end Clone

Static HTML/CSS/JS implementation of the [Burger King México homepage](#) layout from the reference screenshot.
**No build step, no framework, no dependencies beyond a browser.**

> All imagery is built from inline SVG. No real BK assets are bundled, so the project is safe to fork and adapt.

---

## File structure

```
.
├── index.html      # Markup — every section is a clearly-labelled <section>
├── styles.css      # All styling, with CSS variables at the top for the BK palette
├── app.js          # Tiny vanilla JS: mobile drawer, language pill, smooth scroll, cart increment, scroll-reveal
└── README.md       # You are here
```

---

## Run it locally

### With the backend API (recommended for order flow development)

```bash
# Install server dependencies
npm --prefix server install

# Start the server (serves static files + POST /api/orders on port 3000)
npm --prefix server run dev

# Run tests
npm --prefix server test
```

### Static-only (legacy)

Any static server works. Two zero-install options:

### Option A — Python (already on most systems)

```bash
cd /path/to/this/folder
python3 -m http.server 5173
# open http://localhost:5173
```

### Option B — Node (if you have it)

```bash
npx serve .
# or: npx http-server -p 5173
```

> Opening `index.html` straight from disk (`file://`) works too, but a server is nicer because Google Fonts will load cleanly and the cart demo click is smoother.

---

## Where to make changes

| You want to…                       | Edit this file         | What to look for                                                                  |
| ---------------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| Change brand colors                | `styles.css`           | `:root` block at the very top (`--bk-orange`, `--bk-red`, `--bk-brown`, etc.)     |
| Edit copy / add sections           | `index.html`           | Sections are `top-bar`, `main-nav`, `rewards`, `hero`, `promos`, `cta-strip`, `footer` |
| Replace a promo card image         | `index.html`           | Each card has a `<div class="card__media">` containing an SVG — swap in an `<img>` |
| Add/remove promo cards             | `index.html`           | Duplicate a `.card` block inside `.promos__grid`                                  |
| Wire up the cart                   | `app.js`               | Search for `// Tiny cart counter helper`                                          |
| Add a new page section / nav link  | `index.html` + `styles.css` | Add a new `<section>` and a matching `<li>` in `.main-nav__links`              |

---

## Palette reference

```
Cream (page bg):   #FAF4E6
Brand orange:      #F5821F   ← primary CTA color
Brown (brand):     #502314   ← headlines, dark UI
Deal red:          #E43D2E   ← hero button, promotional strips
Accent green:      #0E8A4A   ← used inside illustrations
```

---

## Notes

- All imagery is **inline SVG** so you can recolor anything via CSS classes or by editing the SVG `fill` values directly.
- The page is fully responsive: 4-column desktop → 2-column tablet → single-column mobile (drawer replaces the top nav).
- The "Anota y gana" scoring-game logic is intentionally out of scope here — the page is the marketing shell around it.
- Spanish (`es`) is the default. The `<html lang>` and most copy reflect the Mexican market as in the screenshot.
