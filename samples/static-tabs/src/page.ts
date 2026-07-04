import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticHtmlArtifact, H } from "../../../dist/static/index.js";

export const tabs = H.tabs({
  id: "product-tabs",
  initial: "overview",
  tabs: [
    {
      id: "overview",
      label: "Overview",
      content: "Machina compiles typed UI intent into browser artifacts.",
    },
    {
      id: "features",
      label: "Features",
      content: "Rows, styles, state tables, and lowering targets.",
    },
    {
      id: "export",
      label: "Export",
      content: "Lower to HTML, CSS, TSX, SVG, or PNG.",
    },
  ],
});

export const page = H.staticPage({
  title: "Machina Static Tabs",
  body: [tabs],
});

const artifact = createStaticHtmlArtifact(page);
const sampleRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(sampleRoot, "dist");

mkdirSync(distRoot, { recursive: true });
for (const file of artifact.files) {
  writeFileSync(join(distRoot, file.path), file.text);
}
