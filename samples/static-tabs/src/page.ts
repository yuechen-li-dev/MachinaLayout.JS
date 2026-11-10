import { CT } from "machinalayout/comptime";
import { createStaticHtmlArtifact, H } from "machinalayout/static";

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
