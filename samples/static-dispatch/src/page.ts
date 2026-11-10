import { CT } from "machinalayout/comptime";
import { must } from "machinalayout/kit";
import { createStaticHtmlArtifact, H } from "machinalayout/static";

export const planPicker = H.dispatch({
  id: "plan-picker",
  initial: "team-size",
  states: {
    "team-size": {
      title: "How many people are on your team?",
      body: "Pick the closest answer. This plan picker is no-JS dispatch lowering.",
      actions: [
        {
          id: "solo",
          label: "Just me",
          to: "starter-result",
        },
        {
          id: "team",
          label: "2-10 people",
          to: "pro-result",
        },
        {
          id: "enterprise",
          label: "More than 10",
          to: "enterprise-result",
        },
      ],
    },
    "starter-result": {
      title: "Starter",
      body: "Use the Starter plan. The transition happened through a radio input and CSS.",
      actions: [
        {
          id: "restart",
          label: "Start over",
          to: "team-size",
        },
      ],
    },
    "pro-result": {
      title: "Pro",
      body: "Use the Pro plan. Labels target state inputs; there is no JavaScript file.",
      actions: [
        {
          id: "restart",
          label: "Start over",
          to: "team-size",
        },
      ],
    },
    "enterprise-result": {
      title: "Enterprise",
      body: "Talk to sales. This result is public, read-only UI state.",
      actions: [
        {
          id: "restart",
          label: "Start over",
          to: "team-size",
        },
      ],
    },
  },
});

export const page = H.staticPage({
  title: "Machina Static Dispatch",
  body: [planPicker],
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
