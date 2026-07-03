# CODEX Product Page Sample

This sample demonstrates the `machinalayout/machina` authoring surface with a sparse luxury ecommerce product detail page shape.

It uses Machina stack helpers for the page shell: a wordmark row, desktop side navigation, a large media panel, and a purchase panel. The size selector is authored with the grid matrix helpers (`M.grid`, `M.gridRows`, `M.area`, `M.trackFixed`) so the sample exercises practical matrix composition rather than plain CSS placement.

The page also includes a light responsive variant with `M.when`: desktop renders navigation, media, and purchase controls side by side; smaller viewports collapse into a vertical flow. Product imagery is intentionally a local CSS-drawn placeholder, with no remote images or production ecommerce behavior.

Run locally:

```bash
npm install
npm run build
npm run dev
```
