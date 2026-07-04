# Machina Static

`machinalayout/static` is a proof-of-concept compiler target for small finite UI
machines that can run in the browser without JavaScript.

The source model is TypeScript data. The lowered artifact is static HTML and CSS.
The browser selector engine is the runtime target.

M32a starts with tabs, the one-of-many static machine:

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

M32b adds accordion/disclosure, the many-independent-booleans static machine:

- author accordions with `H.accordion`
- lower expansion state to checkbox inputs
- connect labels with `for`
- emit panels as static HTML
- show open panels with CSS `:checked` selectors
- ship no script tag and no JavaScript runtime behavior

```ts
import { H } from "machinalayout/static";

const faq = H.accordion({
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
```

`allowMultiple` defaults to `true`, which uses checkboxes and lets each item open
or close independently. `allowMultiple: false` uses a radio group and keeps one
item open; if no item has `defaultOpen: true`, the first item is serialized as
checked because radio groups do not naturally return to all-closed state after a
choice is made.

M32c adds timeline/stepper lowering, the time-based static machine:

- author timelines with `H.timeline`
- lower steps to semantic HTML and an ordered list
- generate step numbers with CSS counters
- carry duration, step count, step index, iteration count, and accent values as
  CSS custom properties
- use CSS keyframes and animation as the browser-native clock
- include a `prefers-reduced-motion` fallback
- ship no script tag and no JavaScript runtime behavior

```ts
import { H } from "machinalayout/static";

const timeline = H.timeline({
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
```

`durationMs` defaults to `8000`, and `loop` defaults to `true`. `loop: false`
emits the same animation with an iteration count of `1`. Step labels and string
bodies are escaped; step numbers are not serialized as text, because the lowered
CSS uses `counter-reset`, `counter-increment`, and `content: counter(...)`.

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
machine into ordinary browser-native controls, selectors, counters, custom
properties, and keyframes.

The current no-JS accordion is functional, but it does not synchronize dynamic
`aria-expanded` state because there is no JavaScript runtime. It also does not
provide arbitrary state-machine lowering.

The current no-JS timeline is intentionally not a carousel or animation
framework. It does not provide pause/play, manual selection, carousel controls,
synchronization with form state, event handling, or an arbitrary animation DSL.
CSS animation is used only as a clock for visual progression, CSS counters are
used only as generated labels, and CSS custom properties are compiler-emitted
constants.

DeusMachina may become a future source for richer static machines, but this
target does not integrate it. MachinaStyle may provide shared styling later, but
this target keeps CSS simple and independent.
