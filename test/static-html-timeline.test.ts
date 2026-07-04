import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createStaticHtmlArtifact,
  H,
  serializeStaticPageCss,
  serializeStaticPageHtml,
  validateStaticPage,
  validateStaticTimeline,
} from "../src/static";
import type { StaticTimelineStep } from "../src/static";

const timelineSteps: StaticTimelineStep[] = [
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
];

function createTimelinePage() {
  return H.staticPage({
    title: "Machina Static Timeline",
    body: [
      H.timeline({
        id: "launch-sequence",
        title: "Machina Static Lowering",
        durationMs: 12000,
        loop: true,
        steps: timelineSteps,
      }),
    ],
  });
}

describe("static timeline authoring", () => {
  it("creates timelines with defaults and does not mutate input", () => {
    const input = {
      id: "launch-sequence",
      steps: timelineSteps,
    };
    const timeline = H.timeline(input);

    expect(timeline.kind).toBe("timeline");
    expect(timeline.durationMs).toBe(8000);
    expect(timeline.loop).toBe(true);
    expect(timeline.steps).not.toBe(input.steps);
    expect(timeline.steps[0]).not.toBe(input.steps[0]);
    expect(timeline.steps[0]?.accent).toBe("#4f8cff");
    expect(input.steps[0]?.label).toBe("TypeScript Source");
  });

  it("accepts timeline nodes in pages", () => {
    const page = createTimelinePage();

    expect(page.body[0]?.kind).toBe("timeline");
    expect(validateStaticPage(page)).toEqual([]);
  });
});

describe("static timeline validation", () => {
  it("reports empty timelines, invalid duration, invalid ids, duplicate steps, and empty labels", () => {
    const diagnostics = validateStaticTimeline({
      kind: "timeline",
      id: "bad id",
      durationMs: 0,
      loop: true,
      steps: [
        { id: "dupe", label: "One", body: "One" },
        { id: "dupe", label: "Two", body: "Two" },
        { id: "2bad", label: "", body: "Bad" },
      ],
    });

    expect(diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "InvalidStaticId",
        "InvalidTimelineDuration",
        "DuplicateStaticId",
        "EmptyLabel",
      ]),
    );

    expect(
      validateStaticTimeline({
        kind: "timeline",
        id: "empty",
        durationMs: 1000,
        loop: true,
        steps: [],
      }).map((entry) => entry.code),
    ).toContain("EmptyTimeline");
  });

  it("warns for raw HTML body and invalid accent values", () => {
    const diagnostics = validateStaticTimeline({
      kind: "timeline",
      id: "raw-timeline",
      durationMs: 1000,
      loop: false,
      steps: [
        {
          id: "raw",
          label: "Raw",
          body: { kind: "html", html: "<strong>Trusted</strong>" },
          accent: "",
        },
      ],
    });

    expect(diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["UnsafeRawHtmlContent", "InvalidTimelineAccent"]),
    );
  });
});

describe("static timeline serialization", () => {
  it("emits semantic timeline HTML with ordered steps, custom properties, and no JavaScript hooks", () => {
    const html = serializeStaticPageHtml(createTimelinePage());

    expect(html).toContain('class="machina-timeline"');
    expect(html).toContain('id="launch-sequence"');
    expect(html).toContain('<ol class="machina-timeline__steps">');
    expect(html).toContain("TypeScript Source");
    expect(html).toContain("Author finite UI intent in TypeScript.");
    expect(html).toContain("--timeline-duration: 12000ms");
    expect(html).toContain("--timeline-step-count: 4");
    expect(html).toContain("--timeline-iteration-count: infinite");
    expect(html).toContain("--step-index: 0");
    expect(html).toContain("--step-accent: #4f8cff");
    expect(html).not.toMatch(/<script\b|onclick|addEventListener/i);
    expect(html).not.toMatch(/>1\.<|>2\.<|>3\.<|>4\.</);
  });

  it("emits one-shot iteration count when loop is false", () => {
    const html = serializeStaticPageHtml(
      H.staticPage({
        title: "One Shot",
        body: [
          H.timeline({
            id: "one-shot",
            loop: false,
            steps: [{ id: "only", label: "Only", body: "Once" }],
          }),
        ],
      }),
    );

    expect(html).toContain("--timeline-iteration-count: 1");
  });

  it("escapes string content, labels, title, and unsafe fallback accent output", () => {
    const page = H.staticPage({
      title: "A <B>",
      body: [
        H.timeline({
          id: "safe-timeline",
          steps: [
            {
              id: "first",
              label: "One & Two",
              body: "<img src=x onerror=alert(1)>",
              accent: "red; color: hotpink",
            },
          ],
        }),
      ],
    });
    const html = serializeStaticPageHtml(page);

    expect(html).toContain("<title>A &lt;B&gt;</title>");
    expect(html).toContain("One &amp; Two");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("--step-accent: var(--machina-static-accent)");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("color: hotpink");
  });

  it("emits CSS counters, custom properties, keyframes, and reduced-motion fallback", () => {
    const css = serializeStaticPageCss(createTimelinePage());

    expect(css).toContain("counter-reset: machina-timeline-step");
    expect(css).toContain("counter-increment: machina-timeline-step");
    expect(css).toContain("content: counter(machina-timeline-step)");
    expect(css).toContain("@keyframes machina-timeline-progress");
    expect(css).toContain("@keyframes machina-timeline-step-pulse");
    expect(css).toContain("animation-duration: var(--timeline-duration)");
    expect(css).toContain("animation-iteration-count: var(--timeline-iteration-count)");
    expect(css).toContain("--timeline-step-count");
    expect(css).toContain("--step-index");
    expect(css).toContain("--step-accent");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).not.toMatch(/addEventListener|onclick|<script|useEffect|React|react/);
  });

  it("creates artifact files containing timeline HTML and CSS", () => {
    const artifact = createStaticHtmlArtifact(createTimelinePage());

    expect(artifact.files.map((file) => file.path)).toEqual(["index.html", "generated.css"]);
    expect(artifact.files[0]?.text).toContain("machina-timeline");
    expect(artifact.files[1]?.text).toContain("@keyframes machina-timeline-progress");
    expect(artifact.files[0]?.text).not.toMatch(/<script\b/i);
  });
});

describe("static timeline sample", () => {
  it("checks in generated output matching the serializer and contains no JavaScript", () => {
    const sampleRoot = join(process.cwd(), "samples", "static-timeline", "dist");
    const html = readFileSync(join(sampleRoot, "index.html"), "utf8");
    const css = readFileSync(join(sampleRoot, "generated.css"), "utf8");
    const page = createTimelinePage();

    expect(html).toBe(serializeStaticPageHtml(page));
    expect(css).toBe(serializeStaticPageCss(page));
    expect(html).not.toMatch(/<script\b|onclick|addEventListener/i);
    expect(css).not.toMatch(/addEventListener|onclick|<script|useEffect|React|react/);
  });
});
