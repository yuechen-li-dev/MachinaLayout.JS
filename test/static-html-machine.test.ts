import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createStaticHtmlArtifact,
  formatStaticMachineDiagnostics,
  H,
  serializeStaticPageCss,
  serializeStaticPageHtml,
  validateStaticPage,
  validateStaticTabs,
} from "../src/static";
import type { StaticTabsItem } from "../src/static";

const sampleItems: StaticTabsItem[] = [
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
];

function createSamplePage() {
  return H.staticPage({
    title: "Machina Static Tabs",
    body: [
      H.tabs({
        id: "product-tabs",
        initial: "overview",
        tabs: sampleItems,
      }),
    ],
  });
}

describe("static HTML machine authoring", () => {
  it("creates tabs and does not mutate input", () => {
    const input = {
      id: "product-tabs",
      initial: "overview",
      tabs: sampleItems,
    };
    const tabs = H.tabs(input);

    expect(tabs.kind).toBe("tabs");
    expect(tabs.tabs).not.toBe(input.tabs);
    expect(tabs.tabs[0]).not.toBe(input.tabs[0]);
    expect(input.tabs[0].label).toBe("Overview");
  });

  it("reports duplicate tab ids, missing initial, and invalid ids", () => {
    const diagnostics = validateStaticTabs({
      kind: "tabs",
      id: "bad id",
      initial: "missing",
      tabs: [
        { id: "dupe", label: "One", content: "One" },
        { id: "dupe", label: "Two", content: "Two" },
        { id: "2bad", label: "", content: "Bad" },
      ],
    });

    expect(diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "InvalidStaticId",
        "DuplicateStaticId",
        "MissingInitialState",
        "EmptyLabel",
      ]),
    );
  });

  it("warns for explicit raw HTML content", () => {
    const page = H.staticPage({
      title: "Raw HTML",
      body: [
        H.tabs({
          id: "raw-tabs",
          initial: "raw",
          tabs: [
            { id: "raw", label: "Raw", content: { kind: "html", html: "<strong>OK</strong>" } },
          ],
        }),
      ],
    });

    expect(validateStaticPage(page).map((entry) => entry.code)).toContain("UnsafeRawHtmlContent");
    expect(serializeStaticPageHtml(page)).toContain("<strong>OK</strong>");
  });
});

describe("static HTML machine serialization", () => {
  it("emits a complete static HTML document with radio inputs, labels, panels, and no script", () => {
    const html = serializeStaticPageHtml(createSamplePage());

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain('<link rel="stylesheet" href="generated.css" />');
    expect(html).toContain('type="radio"');
    expect(html).toContain('id="product-tabs-overview" checked');
    expect(html).toContain('for="product-tabs-overview"');
    expect(html).toContain("machina-tabs__panel machina-tabs__panel--overview");
    expect(html).not.toMatch(/<script\b/i);
  });

  it("escapes string content, labels, title, and attributes", () => {
    const page = H.staticPage({
      title: "A <B>",
      body: [
        H.tabs({
          id: "safe-tabs",
          initial: "first",
          tabs: [{ id: "first", label: "One & Two", content: "<img src=x onerror=alert(1)>" }],
        }),
      ],
    });
    const html = serializeStaticPageHtml(page);

    expect(html).toContain("<title>A &lt;B&gt;</title>");
    expect(html).toContain("One &amp; Two");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
  });

  it("emits :checked CSS selectors for every tab and no JavaScript behavior", () => {
    const css = serializeStaticPageCss(createSamplePage());

    expect(css).toContain(".machina-tabs__panel {\n  display: none;");
    expect(css).toContain(":checked");
    expect(css).toContain("#product-tabs-overview:checked");
    expect(css).toContain("#product-tabs-features:checked");
    expect(css).toContain("#product-tabs-export:checked");
    expect(css).toContain('label[for="product-tabs-overview"]');
    expect(css).not.toMatch(/addEventListener|onclick|<script|useEffect|React|react/);
  });

  it("creates stable artifact files and readable diagnostics", () => {
    const artifact = createStaticHtmlArtifact(createSamplePage());
    const diagnostics = validateStaticTabs({
      kind: "tabs",
      id: "x",
      initial: "missing",
      tabs: [],
    });
    const formatted = formatStaticMachineDiagnostics(diagnostics);

    expect(artifact.files.map((file) => file.path)).toEqual(["index.html", "generated.css"]);
    expect(artifact.files[0].contentType).toBe("text/html; charset=utf-8");
    expect(artifact.files[1].contentType).toBe("text/css; charset=utf-8");
    expect(formatted).toContain("[error] EmptyTabs");
    expect(formatted).toContain("MissingInitialState");
  });
});

describe("static tabs sample", () => {
  it("checks in generated output matching the serializer", () => {
    const sampleRoot = join(process.cwd(), "samples", "static-tabs", "dist");
    const html = readFileSync(join(sampleRoot, "index.html"), "utf8");
    const css = readFileSync(join(sampleRoot, "generated.css"), "utf8");
    const page = createSamplePage();

    expect(html).toBe(serializeStaticPageHtml(page));
    expect(css).toBe(serializeStaticPageCss(page));
    expect(html).not.toMatch(/<script\b/i);
    expect(css).not.toMatch(/addEventListener|onclick|<script|useEffect|React|react/);
  });
});
