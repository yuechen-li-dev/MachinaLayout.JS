import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticHtmlArtifact, H } from "../../../dist/static/index.js";

export const timeline = H.timeline({
  id: "launch-sequence",
  title: "Machina Static Lowering",
  durationMs: 12000,
  loop: true,
  steps: [
    {
      id: "source",
      label: "TypeScript Source",
      body: "Author finite UI intent in TypeScript.",
      accent: "#4f8cff",
    },
    {
      id: "mir",
      label: "Static MIR",
      body: "Normalize static interaction into a compiler-friendly shape.",
      accent: "#8b5cf6",
    },
    {
      id: "artifact",
      label: "HTML/CSS Artifact",
      body: "Lower into browser-native selectors, counters, variables, and keyframes.",
      accent: "#f97316",
    },
    {
      id: "browser",
      label: "Browser Runtime",
      body: "The browser runs it with no JavaScript.",
      accent: "#22c55e",
    },
  ],
});

export const page = H.staticPage({
  title: "Machina Static Timeline",
  body: [timeline],
});

const artifact = createStaticHtmlArtifact(page);
const sampleRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(sampleRoot, "dist");

mkdirSync(distRoot, { recursive: true });
for (const file of artifact.files) {
  writeFileSync(join(distRoot, file.path), file.text);
}
