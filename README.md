# Shirt Sign Generator

Paste a Shopify product link → get a print-ready **8.5×11 PDF** with one page per
color/style: product photo on top, title in the middle, SKU (size stripped) at the bottom.

## How it works
Every Shopify product page has a JSON twin at `<product-url>.js`. The app fetches that
server-side (so there's no browser cross-origin problem), groups the variants by SKU
prefix (`SS02-S` → `SS02`), pulls each color's name and photo straight from the store's
own variant data, and renders the pages to PDF with headless Chrome.

## Run it on your computer (fastest)
1. Install [Node.js](https://nodejs.org) 18 or newer.
2. In this folder:
   ```
   npm install
   npm start
   ```
   (`npm install` downloads a copy of Chrome the first time — give it a minute.)
3. Open http://localhost:3000, paste a product link, click **Make PDF**.
4. The PDF opens in a new tab — print it or save it. That's it.

This alone already gives you "paste link → printable PDF" without paying for hosting.

## Put it online (so anyone can use it from a browser)
The only deployment snag with headless Chrome is the server needing Chrome's system
libraries. The included `Dockerfile` solves that by starting from an image that already
has Chrome. Hosts that run a Dockerfile on a free/cheap tier include **Render**,
**Railway**, and **Fly.io**:

- **Render**: New → Web Service → connect this repo → Runtime: Docker → deploy.
- **Railway / Fly.io**: similar — point them at the Dockerfile.

(Plain serverless platforms like Vercel are awkward for Puppeteer. If you specifically
want serverless, swap Puppeteer for the `pdf-lib` library, which draws the PDF directly
with no Chrome — a bit more layout code, but it deploys anywhere. Ask and I'll write that version.)

## Tweaking the look
All the design lives in the `PAGE_CSS` string in `server.js` — fonts, spacing, the giant
SKU, the divider line, whether the color name shows. Edit and restart.

## Limitations / notes
- Works for **Shopify** stores (the `.js` endpoint). Non-Shopify sites would need a
  different fetch/scrape step.
- Assumes the SKU is `PREFIX-SIZE`, i.e. the size is the last dash-segment. If your SKUs
  are formatted differently, adjust `skuPrefix()`.
- It picks the option named "Color"/"Style" automatically; if a product names it
  something unusual, it falls back to the first option.
