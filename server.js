// Shirt Sign Generator
// Paste a Shopify product URL -> get an 8.5x11 PDF with one page per color/style
// (photo + title + SKU prefix, size stripped).
//
// Run locally:   npm install   then   node server.js   -> open http://localhost:3000
//
// How it works: every Shopify product page has a JSON twin at <product-url>.js
// We fetch that (server-side, so no browser CORS problem), group the variants by
// SKU prefix, and render the pages to PDF with headless Chrome (Puppeteer).

const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- helpers ----------

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Turn any product URL into its .js JSON endpoint.
function productJsonUrl(input) {
  const u = new URL(input.trim());
  const m = u.pathname.match(/\/products\/[^/?#]+/);
  if (!m) throw new Error("That doesn't look like a product URL (no /products/<handle> in it).");
  return `${u.origin}${m[0]}.js`;
}

// "SS02-S" -> "SS02"  (drop the final dash-segment, which is the size)
function skuPrefix(sku) {
  if (!sku) return "";
  return sku.replace(/-[^-]+$/, "") || sku;
}

// Which option is the color/style? Prefer an option literally named that; else option 1.
function colorOptionIndex(options) {
  const names = (options || []).map((o) => (typeof o === "string" ? o : o && o.name) || "");
  const idx = names.findIndex((n) => /colou?r|style|finish/i.test(n));
  return idx === -1 ? 0 : idx;
}

function normalizeImg(src) {
  if (!src) return "";
  if (src.startsWith("//")) return "https:" + src;
  return src.replace(/^http:\/\//, "https://");
}

async function fetchProduct(input) {
  const url = productJsonUrl(input);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Could not read product data (HTTP ${res.status}). Is the link a public Shopify product?`);
  return res.json(); // the .js endpoint returns the product object directly
}

// Collapse variants down to one entry per SKU prefix.
function buildGroups(product) {
  const ci = colorOptionIndex(product.options);
  const optKey = "option" + (ci + 1);
  const seen = new Map();
  for (const v of product.variants || []) {
    const prefix = skuPrefix(v.sku);
    if (!prefix || seen.has(prefix)) continue;
    const img =
      (v.featured_image && v.featured_image.src) ||
      (product.images && product.images[0]) ||
      product.featured_image ||
      "";
    seen.set(prefix, { sku: prefix, color: v[optKey] || "", img: normalizeImg(img) });
  }
  return [...seen.values()];
}

const PAGE_CSS = `
  @page { size: 8.5in 11in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color:#14181f; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page { width:8.5in; height:11in; padding:0.6in; display:flex; flex-direction:column; align-items:center; text-align:center; page-break-after:always; }
  .page:last-child { page-break-after:auto; }
  .photo { flex:1 1 auto; width:100%; display:flex; align-items:center; justify-content:center; min-height:0; border:1px solid #e3e6ea; border-radius:10px; padding:0.3in; background:#fff; }
  .photo img { max-width:100%; max-height:100%; object-fit:contain; }
  .title { margin:0.34in 0 0.05in; font-size:30px; font-weight:700; line-height:1.18; letter-spacing:-0.01em; max-width:6.6in; }
  .variant { font-size:20px; font-weight:600; color:#5b626c; letter-spacing:0.04em; text-transform:uppercase; }
  .sku-wrap { margin-top:0.34in; width:100%; border-top:3px solid #14181f; padding-top:0.22in; }
  .sku-label { font-size:15px; font-weight:600; letter-spacing:0.32em; color:#5b626c; text-transform:uppercase; }
  .sku { font-size:96px; font-weight:800; letter-spacing:0.04em; line-height:1; margin-top:0.06in; }
`;

function pageHtml(title, g) {
  const variant = g.color ? `<div class="variant">${escapeHtml(g.color)}</div>` : "";
  return `<div class="page">
    <div class="photo"><img src="${escapeHtml(g.img)}" alt=""></div>
    <div class="title">${escapeHtml(title)}</div>
    ${variant}
    <div class="sku-wrap"><div class="sku-label">SKU</div><div class="sku">${escapeHtml(g.sku)}</div></div>
  </div>`;
}

function docHtml(title, groups) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE_CSS}</style></head>
  <body>${groups.map((g) => pageHtml(title, g)).join("")}</body></html>`;
}

// ---------- routes ----------

app.get("/", (_req, res) => {
  res.send(`<!doctype html><html><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shirt Sign Generator</title>
  <style>
    body{font-family:system-ui,Arial,sans-serif;max-width:640px;margin:8vh auto;padding:0 20px;color:#14181f}
    h1{font-size:24px;margin-bottom:6px}
    p{color:#5b626c;line-height:1.5}
    form{display:flex;gap:8px;margin-top:20px}
    input{flex:1;padding:12px 14px;border:1px solid #ccd2d9;border-radius:8px;font-size:15px}
    button{padding:12px 18px;border:0;border-radius:8px;background:#14181f;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  </style></head><body>
    <h1>Shirt Sign Generator</h1>
    <p>Paste a Shopify product link. You'll get a print-ready 8.5&times;11 PDF with one page per color/style (photo, title, and SKU).</p>
    <form action="/generate" method="get" target="_blank">
      <input name="url" placeholder="https://yourstore.com/products/..." required>
      <button type="submit">Make PDF</button>
    </form>
  </body></html>`);
});

app.get("/generate", async (req, res) => {
  try {
    const product = await fetchProduct(req.query.url);
    const groups = buildGroups(product);
    if (!groups.length) throw new Error("No variants with SKUs were found on that product.");

    const html = docHtml(product.title, groups);

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="signs.pdf"');
      res.send(pdf);
    } finally {
      await browser.close();
    }
  } catch (e) {
    res.status(400).send("Error: " + e.message);
  }
});

app.listen(PORT, () => console.log(`Shirt Sign Generator running on http://localhost:${PORT}`));
