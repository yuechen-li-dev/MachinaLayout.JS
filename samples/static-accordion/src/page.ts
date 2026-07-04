import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticHtmlArtifact, H } from "../../../dist/static/index.js";

export const faq = H.accordion({
  id: "faq",
  allowMultiple: true,
  items: [
    {
      id: "what-is-machina",
      label: "What is Machina?",
      content: "Machina lowers typed UI intent into browser artifacts.",
      defaultOpen: true,
    },
    {
      id: "does-it-use-js",
      label: "Does this use JavaScript?",
      content: "No. This accordion is powered by checkbox state and CSS selectors.",
    },
    {
      id: "is-this-cursed",
      label: "Is this cursed?",
      content: "Yes, but intentionally.",
    },
  ],
});

export const page = H.staticPage({
  title: "Machina Static Accordion",
  body: [faq],
});

const artifact = createStaticHtmlArtifact(page);
const sampleRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(sampleRoot, "dist");

mkdirSync(distRoot, { recursive: true });
for (const file of artifact.files) {
  writeFileSync(join(distRoot, file.path), file.text);
}
