# Machina Static

`machinalayout/static` is a proof-of-concept compiler target for small finite UI
machines that can run in the browser without JavaScript.

The source model is TypeScript data. The lowered artifact is static HTML and CSS.
The browser selector engine is the runtime target.

M32a starts with tabs:

- author tabs with `H.tabs`
- lower state to radio inputs
- connect labels with `for`
- emit panels as static HTML
- switch panels with CSS `:checked` selectors
- ship no script tag and no JavaScript runtime behavior

```ts
import { H, createStaticHtmlArtifact } from "machinalayout/static";

const tabs = H.tabs({
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

const page = H.staticPage({
  title: "Machina Static Tabs",
  body: [tabs],
});

const artifact = createStaticHtmlArtifact(page);
```

String content is escaped during HTML serialization. Raw HTML content must be
explicit:

```ts
content: { kind: "html", html: "<strong>Trusted HTML only</strong>" }
```

Raw HTML is inserted as-is and validation emits an `UnsafeRawHtmlContent`
warning. Treat it as trusted, pre-sanitized content.

## Boundaries

Machina Static is not arbitrary TypeScript-to-CSS compilation. It does not
compile programs into CSS, add event handlers, perform data fetching, bind to
DeusMachina, or replace dynamic applications. It lowers a bounded finite UI
machine into ordinary browser-native controls and selectors.

DeusMachina may become a future source for richer static machines, but M32a does
not integrate it. MachinaStyle may provide shared styling later, but this first
target keeps CSS simple and independent.
