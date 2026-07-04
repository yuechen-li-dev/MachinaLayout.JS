import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createStaticHtmlArtifact,
  H,
  serializeStaticPageCss,
  serializeStaticPageHtml,
  validateStaticHttpAction,
  validateStaticHttpLink,
  validateStaticPage,
} from "../src/static";
import type { StaticHttpAction } from "../src/static";

function createHttpPage() {
  return H.staticPage({
    title: "Machina Static HTTP",
    body: [
      H.httpAction({
        id: "site-search",
        method: "GET",
        action: "/search",
        title: "Search",
        description:
          "This form submits a native browser GET request. The server response is normal page navigation.",
        submitLabel: "Search",
        fields: [
          {
            id: "q",
            kind: "search",
            label: "Query",
            placeholder: "machina static",
            required: true,
            autocomplete: "off",
          },
        ],
      }),
      H.httpAction({
        id: "contact-form",
        method: "POST",
        action: "/contact",
        title: "Contact",
        description:
          "This form submits a native browser POST request. Handling, persistence, and validation beyond HTML attributes belong to the server.",
        submitLabel: "Send",
        fields: [
          { id: "source", kind: "hidden", value: "machina-static" },
          { id: "email", kind: "email", label: "Email", required: true, autocomplete: "email" },
          {
            id: "message",
            kind: "textarea",
            label: "Message",
            required: true,
            placeholder: "What should the server receive?",
          },
        ],
      }),
      H.httpLink({
        id: "docs-link",
        href: "/docs",
        label: "Read docs",
      }),
    ],
  });
}

describe("static HTTP authoring", () => {
  it("creates HTTP actions with defaults and does not mutate input", () => {
    const input = {
      id: "search",
      action: "/search",
      fields: [{ id: "q", kind: "search" as const, label: "Query" }],
    };
    const action = H.httpAction(input);

    expect(action.kind).toBe("httpAction");
    expect(action.method).toBe("GET");
    expect(action.target).toBe("self");
    expect(action.submitLabel).toBe("Submit");
    expect(action.fields).not.toBe(input.fields);
    expect(action.fields[0]).not.toBe(input.fields[0]);
    expect(input.fields[0].label).toBe("Query");
  });

  it("accepts HTTP actions and links in pages", () => {
    const page = createHttpPage();

    expect(page.body.map((node) => node.kind)).toEqual(["httpAction", "httpAction", "httpLink"]);
    expect(validateStaticPage(page)).toEqual([]);
  });

  it("creates HTTP links", () => {
    const link = H.httpLink({ id: "docs", href: "/docs", label: "Docs", target: "blank" });

    expect(link).toEqual({
      kind: "httpLink",
      id: "docs",
      href: "/docs",
      label: "Docs",
      target: "blank",
    });
  });
});

describe("static HTTP validation", () => {
  it("reports invalid methods, actions, targets, ids, labels, options, ranges, and URLs", () => {
    const diagnostics = validateStaticHttpAction({
      kind: "httpAction",
      id: "bad id",
      method: "PUT",
      action: "javascript:alert(1)",
      target: "popup",
      submitLabel: "",
      fields: [
        { id: "bad field", kind: "text" },
        { id: "choice", kind: "select", label: "Choice" },
        { id: "mode", kind: "radio", label: "Mode" },
        { id: "count", kind: "number", label: "Count", min: 10, max: 2 },
        {
          id: "bad-option",
          kind: "select",
          label: "Bad option",
          options: [{ value: "", label: "" }],
        },
      ],
    } as unknown as StaticHttpAction);

    expect(diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "InvalidStaticId",
        "InvalidHttpMethod",
        "InvalidHttpTarget",
        "InvalidHttpAction",
        "InvalidHttpField",
        "MissingFieldLabel",
        "MissingFieldOptions",
        "InvalidFieldOption",
        "InvalidFieldRange",
        "UnsafeHttpUrl",
      ]),
    );

    expect(
      validateStaticHttpAction({
        kind: "httpAction",
        id: "empty-action",
        method: "GET",
        action: "",
        fields: [],
      }).map((entry) => entry.code),
    ).toContain("InvalidHttpAction");
  });

  it("allows hidden fields without labels and warns for raw HTML descriptions", () => {
    const diagnostics = validateStaticHttpAction({
      kind: "httpAction",
      id: "contact",
      method: "POST",
      action: "/contact",
      description: { kind: "html", html: "<strong>Trusted</strong>" },
      fields: [{ id: "source", kind: "hidden", value: "machina-static" }],
    });

    expect(diagnostics.map((entry) => entry.code)).toEqual(["UnsafeRawHtmlContent"]);
    expect(diagnostics[0]?.severity).toBe("warning");
  });

  it("validates HTTP links", () => {
    const diagnostics = validateStaticHttpLink({
      kind: "httpLink",
      id: "bad link",
      href: "javascript:alert(1)",
      label: "",
      target: "popup" as "self",
    });

    expect(diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "InvalidStaticId",
        "UnsafeHttpUrl",
        "InvalidHttpAction",
        "InvalidHttpTarget",
      ]),
    );
  });

  it("accepts valid GET and POST actions without diagnostics", () => {
    expect(
      validateStaticHttpAction({
        kind: "httpAction",
        id: "search",
        method: "GET",
        action: "/search",
        fields: [{ id: "q", kind: "search", label: "Query", required: true }],
      }),
    ).toEqual([]);
    expect(
      validateStaticHttpAction({
        kind: "httpAction",
        id: "contact",
        method: "POST",
        action: "https://example.com/contact",
        fields: [{ id: "message", kind: "textarea", label: "Message" }],
      }),
    ).toEqual([]);
  });
});

describe("static HTTP serialization", () => {
  it("serializes GET and POST forms, actions, fields, labels, and no scripts", () => {
    const html = serializeStaticPageHtml(createHttpPage());

    expect(html).toContain('class="machina-http-action" id="site-search"');
    expect(html).toContain('<form class="machina-http-action__form" method="get" action="/search"');
    expect(html).toContain(
      '<form class="machina-http-action__form" method="post" action="/contact"',
    );
    expect(html).toContain('id="site-search-q" name="q" type="search"');
    expect(html).toContain('for="site-search-q"');
    expect(html).toContain("required");
    expect(html).toContain('autocomplete="off"');
    expect(html).toContain(
      'type="hidden" id="contact-form-source" name="source" value="machina-static"',
    );
    expect(html).toContain('<textarea id="contact-form-message" name="message"');
    expect(html).not.toMatch(/<script\b|onclick|addEventListener/i);
  });

  it("serializes validation attributes, textarea content, select options, radio choices, checkbox, target, and escaping", () => {
    const page = H.staticPage({
      title: "HTTP <Safe>",
      body: [
        H.httpAction({
          id: "prefs",
          method: "POST",
          action: "/prefs?next=%2Fhome",
          target: "blank",
          submitLabel: "Save & Send",
          fields: [
            {
              id: "age",
              kind: "number",
              label: "Age",
              min: 1,
              max: 99,
              step: 1,
              pattern: "[0-9]+",
              autocomplete: "off",
            },
            { id: "bio", kind: "textarea", label: "Bio", value: "<hello & goodbye>" },
            {
              id: "tier",
              kind: "select",
              label: "Tier",
              value: "pro",
              options: [
                { value: "free", label: "Free" },
                { value: "pro", label: "Pro & Team" },
              ],
            },
            {
              id: "mode",
              kind: "radio",
              label: "Mode",
              name: "mode",
              value: "fast",
              options: [
                { value: "fast", label: "Fast" },
                { value: "safe", label: "Safe" },
              ],
            },
            { id: "agree", kind: "checkbox", label: "Agree", required: true },
          ],
        }),
        H.httpLink({
          id: "external-docs",
          href: "https://example.com/docs",
          label: "Docs",
          target: "blank",
        }),
      ],
    });
    const html = serializeStaticPageHtml(page);

    expect(html).toContain("<title>HTTP &lt;Safe&gt;</title>");
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="99"');
    expect(html).toContain('step="1"');
    expect(html).toContain('pattern="[0-9]+"');
    expect(html).toContain("&lt;hello &amp; goodbye&gt;");
    expect(html).toContain('<option value="pro" selected>Pro &amp; Team</option>');
    expect(html.match(/name="mode" type="radio"/g)?.length).toBe(2);
    expect(html).toContain('id="prefs-mode-fast" name="mode" type="radio" value="fast" checked');
    expect(html).toContain('type="checkbox" value="on" required');
    expect(html).toContain(
      '<a class="machina-http-link" id="external-docs" href="https://example.com/docs" target="_blank" rel="noopener noreferrer">Docs</a>',
    );
    expect(html).not.toContain("<hello");
  });

  it("emits HTTP CSS and artifact files", () => {
    const page = createHttpPage();
    const css = serializeStaticPageCss(page);
    const artifact = createStaticHtmlArtifact(page);

    expect(css).toContain(".machina-http-action");
    expect(css).toContain(".machina-http-action__form");
    expect(css).toContain(".machina-http-action__submit");
    expect(css).toContain(".machina-http-link");
    expect(css).not.toMatch(
      /addEventListener|onclick|<script|useEffect|React|react|fetch\(|XMLHttpRequest/,
    );
    expect(artifact.files[0]?.text).toContain("machina-http-action");
    expect(artifact.files[1]?.text).toContain(".machina-http-action");
  });
});

describe("static HTTP sample", () => {
  it("checks in generated output matching the serializer and contains no JavaScript", () => {
    const sampleRoot = join(process.cwd(), "samples", "static-http", "dist");
    const html = readFileSync(join(sampleRoot, "index.html"), "utf8");
    const css = readFileSync(join(sampleRoot, "generated.css"), "utf8");
    const page = createHttpPage();

    expect(html).toBe(serializeStaticPageHtml(page));
    expect(css).toBe(serializeStaticPageCss(page));
    expect(html).not.toMatch(/<script\b|onclick|addEventListener|fetch\(|XMLHttpRequest/i);
    expect(css).not.toMatch(
      /addEventListener|onclick|<script|useEffect|React|react|fetch\(|XMLHttpRequest/,
    );
  });
});
