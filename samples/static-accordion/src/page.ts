import { CT } from "machinalayout/comptime";
import { must } from "machinalayout/kit";
import { createStaticHtmlArtifact, H } from "machinalayout/static";

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

const fileText = (path: string) =>
  must(
    createStaticHtmlArtifact(page).files.find((file) => file.path === path),
    `static artifact has no ${path}`,
  ).text;

/** Everything this sample generates. `src/build.ts` writes it; the tests check it. */
export const artifacts = CT.artifacts({
  outDir: "dist",
  artifacts: [
    CT.text("index.html", () => fileText("index.html")),
    CT.text("generated.css", () => fileText("generated.css")),
  ],
});
