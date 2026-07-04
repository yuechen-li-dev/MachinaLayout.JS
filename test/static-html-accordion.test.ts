import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createStaticHtmlArtifact,
  H,
  serializeStaticPageCss,
  serializeStaticPageHtml,
  validateStaticAccordion,
  validateStaticPage,
} from "../src/static";
import type { StaticAccordionItem } from "../src/static";

const faqItems: StaticAccordionItem[] = [
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
];

function createAccordionPage() {
  return H.staticPage({
    title: "Machina Static Accordion",
    body: [
      H.accordion({
        id: "faq",
        items: faqItems,
      }),
    ],
  });
}

describe("static accordion authoring", () => {
  it("creates accordions, defaults allowMultiple to true, and does not mutate input", () => {
    const input = {
      id: "faq",
      items: faqItems,
    };
    const accordion = H.accordion(input);

    expect(accordion.kind).toBe("accordion");
    expect(accordion.allowMultiple).toBe(true);
    expect(accordion.items).not.toBe(input.items);
    expect(accordion.items[0]).not.toBe(input.items[0]);
    expect(input.items[0].label).toBe("What is Machina?");
  });

  it("reports empty accordions, duplicate item ids, empty labels, and invalid ids", () => {
    const diagnostics = validateStaticAccordion({
      kind: "accordion",
      id: "bad id",
      allowMultiple: true,
      items: [
        { id: "dupe", label: "One", content: "One" },
        { id: "dupe", label: "Two", content: "Two" },
        { id: "2bad", label: "", content: "Bad" },
      ],
    });

    expect(diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["InvalidStaticId", "DuplicateStaticId", "EmptyLabel"]),
    );

    expect(
      validateStaticAccordion({
        kind: "accordion",
        id: "empty",
        allowMultiple: true,
        items: [],
      }).map((entry) => entry.code),
    ).toContain("EmptyAccordion");
  });

  it("reports multiple defaultOpen items in single-open radio mode", () => {
    const diagnostics = validateStaticAccordion({
      kind: "accordion",
      id: "faq",
      allowMultiple: false,
      items: [
        { id: "one", label: "One", content: "One", defaultOpen: true },
        { id: "two", label: "Two", content: "Two", defaultOpen: true },
      ],
    });

    expect(diagnostics.map((entry) => entry.code)).toContain("MultipleDefaultOpenItems");
  });

  it("reports duplicate generated input ids across a static page", () => {
    const diagnostics = validateStaticPage({
      kind: "page",
      title: "Duplicate Generated IDs",
      body: [
        {
          kind: "tabs",
          id: "shared",
          initial: "one",
          tabs: [{ id: "one", label: "One", content: "One" }],
        },
        {
          kind: "accordion",
          id: "shared",
          allowMultiple: true,
          items: [{ id: "one", label: "One", content: "One" }],
        },
      ],
    });

    expect(diagnostics.map((entry) => entry.code)).toContain("DuplicateStaticId");
    expect(diagnostics.map((entry) => entry.message).join("\n")).toContain(
      'Duplicate generated input id "shared-one" across static page.',
    );
  });

  it("warns for explicit raw HTML content", () => {
    const accordion = {
      kind: "accordion" as const,
      id: "raw-faq",
      allowMultiple: true,
      items: [
        {
          id: "raw",
          label: "Raw",
          content: { kind: "html" as const, html: "<strong>Trusted</strong>" },
        },
      ],
    };

    expect(validateStaticAccordion(accordion).map((entry) => entry.code)).toContain(
      "UnsafeRawHtmlContent",
    );
    expect(serializeStaticPageHtml(H.staticPage({ title: "Raw", body: [accordion] }))).toContain(
      "<strong>Trusted</strong>",
    );
  });
});

describe("static accordion serialization", () => {
  it("emits checkbox inputs, labels, panels, default checked state, and no JavaScript", () => {
    const html = serializeStaticPageHtml(createAccordionPage());

    expect(html).toContain('class="machina-accordion" id="faq"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('id="faq-what-is-machina" checked');
    expect(html).toContain('for="faq-what-is-machina"');
    expect(html).toContain('class="machina-accordion__panel"');
    expect(html).not.toMatch(/<script\b|onclick|addEventListener/i);
  });

  it("escapes string content and labels", () => {
    const page = H.staticPage({
      title: "Safe Accordion",
      body: [
        H.accordion({
          id: "safe-faq",
          items: [
            {
              id: "first",
              label: "One & Two",
              content: "<img src=x onerror=alert(1)>",
            },
          ],
        }),
      ],
    });
    const html = serializeStaticPageHtml(page);

    expect(html).toContain("One &amp; Two");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
  });

  it("emits radio inputs for single-open mode and checks the first item by default", () => {
    const html = serializeStaticPageHtml(
      H.staticPage({
        title: "Single Open",
        body: [
          H.accordion({
            id: "single",
            allowMultiple: false,
            items: [
              { id: "one", label: "One", content: "One" },
              { id: "two", label: "Two", content: "Two" },
            ],
          }),
        ],
      }),
    );

    expect(html).toContain('type="radio"');
    expect(html).toContain('name="single-state" checked');
    expect(html).toContain('id="single-one" name="single-state" checked');
    expect(html).toContain('id="single-two" name="single-state"');
  });

  it("emits accordion CSS classes, :checked selectors, hidden panels, and no JavaScript", () => {
    const css = serializeStaticPageCss(createAccordionPage());

    expect(css).toContain(".machina-accordion");
    expect(css).toContain(".machina-accordion__panel {\n  display: none;");
    expect(css).toContain(".machina-accordion__input:checked ~ .machina-accordion__panel");
    expect(css).toContain("display: block;");
    expect(css).not.toMatch(/addEventListener|onclick|<script|useEffect|React|react/);
  });

  it("creates artifact files containing accordion HTML and CSS", () => {
    const artifact = createStaticHtmlArtifact(createAccordionPage());

    expect(artifact.files.map((file) => file.path)).toEqual(["index.html", "generated.css"]);
    expect(artifact.files[0].text).toContain("machina-accordion");
    expect(artifact.files[1].text).toContain("machina-accordion__input:checked");
    expect(validateStaticPage(createAccordionPage()).map((entry) => entry.code)).toEqual([]);
  });
});

describe("static accordion sample", () => {
  it("checks in generated output matching the serializer and contains no JavaScript", () => {
    const sampleRoot = join(process.cwd(), "samples", "static-accordion", "dist");
    const html = readFileSync(join(sampleRoot, "index.html"), "utf8");
    const css = readFileSync(join(sampleRoot, "generated.css"), "utf8");
    const page = createAccordionPage();

    expect(html).toBe(serializeStaticPageHtml(page));
    expect(css).toBe(serializeStaticPageCss(page));
    expect(html).not.toMatch(/<script\b|onclick|addEventListener/i);
    expect(css).not.toMatch(/addEventListener|onclick|<script|useEffect|React|react/);
  });
});
