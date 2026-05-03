# Breathed with Daniel

Static single-page app: a **breathing cycle on a ring**, customizable **inhale / hold / exhale** segments, **presets**, **session timer**, and **shareable URLs** (no backend).

**Live (typical GitHub Pages layout):** [`https://butterflygroup.github.io/breath4me.github.io/`](https://butterflygroup.github.io/breath4me.github.io/)

### Deployment checklist (canonical and social previews)

Whenever the published URL or path changes:

- Update **`index.html`** **`<link rel="canonical">`** to the canonical page URL you want indexed.
- Set Open Graph **`og:url`** (and **`og:image`**) to **absolute HTTPS** URLs under that same deployment (not `localhost`). The **`og:image`** path must match **`og-image.png`** on your host.

### PWA / offline

On first load over HTTPS, **`sw.js`** installs and precaches listed static assets (`index.html`, CSS, JS, manifest, icons, **`og-image.png`**). Repeat visits can open with core UI available offline once cached. **`Install`** / **Add to Home Screen** depends on browser and OS; not every environment surfaces the install affordance—treat caching as resilience, not a guarantee of offline timer accuracy.

Bump **`CACHE_VERSION`** in **`sw.js`** after you ship changes to **`app.js`**, **`patterns.js`**, **`styles.css`**, **`index.html`**, or **`og-image.png`** so returning visitors refresh precached assets.

---

## Run locally

Because the app uses **`import` / ES modules**, open it over **http(s)** (not `file://`):

```bash
npx serve . --listen 4173
```

Then visit `http://127.0.0.1:4173`.

---

## How sharing works

When you edit the pattern (or load a preset), the URL’s **`?q=`** query contains **JSON** with your segments and optional **`d`** (Pattern Details / recipient note) and **`t`** (title). That string is **sanitized and length-capped** (`SHARE_NOTE_MAX_LEN` and related limits in **`app.js`**). Very long notes make URLs long; some environments cap URL length—if **Copy link** fails, shorten Pattern Details (the app logs a **console warning** when the share URL is unusually long).

Built-in presets live in **`patterns.js`** (`PATTERN_TEMPLATES`). To add one: append an object with **`id`**, **`label`**, **`segments`**, and optionally **`shareNote`** (see existing entries).

**Reset pattern** restores the **default rhythm** and also clears Pattern title and Pattern Details (and **`t`** / **`d`** in the serialized URL payload).

---

## Service worker cache

See **PWA / offline** above. **`CACHE_VERSION`** lives inside **`sw.js`**.

---

## Tests

Uses Playwright (**Node.js ≥ 18.19** recommended for the test runner) + `serve` on port 4173 (`playwright.config.cjs`):

```bash
npm ci
npm run test:e2e
```

Syntax-only (no install):

```bash
node --check app.js && node --check patterns.js && node --check sw.js
```

### Optional manual accessibility smoke

Periodically Tab through visible controls from the top (templates, main playback actions, Pattern builder inputs). Confirm a visible focus ring (**`:focus-visible`**) lands on interactive elements before release. Reduced motion (**`prefers-reduced-motion: reduce`**) is handled in **`app.js`** for animation-related behavior—spot-check visuals if you touch motion-heavy code paths.

---

## License

There is **no `LICENSE` file** in this repository yet; add one (MIT, Apache-2.0, or another you choose) before or when you publish broadly so reuse terms are explicit.
