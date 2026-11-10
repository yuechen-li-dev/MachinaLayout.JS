import { CT } from "machinalayout/comptime";
import { createStaticHtmlArtifact, H } from "machinalayout/static";

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

const fileText = (path: string) => {
  const file = createStaticHtmlArtifact(page).files.find((candidate) => candidate.path === path);
  if (!file) throw new Error(`static artifact has no ${path}`);
  return file.text;
};

/** Everything this sample generates. `src/build.ts` writes it; the tests check it. */
export const artifacts = CT.artifacts({
  outDir: "dist",
  artifacts: [
    CT.text("index.html", () => fileText("index.html")),
    CT.text("generated.css", () => fileText("generated.css")),
  ],
});
