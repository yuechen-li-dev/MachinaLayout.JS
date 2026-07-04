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

## Static dispatch lowering

M32d adds static dispatch, the general finite one-of-many static machine:

- author a finite dispatch table with `H.dispatch`
- lower each state to one radio input in a shared group
- lower each action to a `<label>` targeting the destination state's input
- emit one visible screen per state
- show the active screen with CSS `:checked` selectors
- ship no script tag and no JavaScript runtime behavior

```ts
import { H } from "machinalayout/static";

const planPicker = H.dispatch({
  id: "plan-picker",
  initial: "team-size",
  states: {
    "team-size": {
      title: "How many people are on your team?",
      body: "Pick the closest answer.",
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
      body: "Use the Starter plan.",
      actions: [{ id: "restart", label: "Start over", to: "team-size" }],
    },
    "pro-result": {
      title: "Pro",
      body: "Use the Pro plan.",
      actions: [{ id: "restart", label: "Start over", to: "team-size" }],
    },
    "enterprise-result": {
      title: "Enterprise",
      body: "Talk to sales.",
      actions: [{ id: "restart", label: "Start over", to: "team-size" }],
    },
  },
});
```

The lowered model is intentionally small: a radio group stores the current state,
and labels transition by selecting another radio input. Terminal states are
allowed. Cycles are allowed, including "start over" loops. Unreachable states are
reported as warnings because they may be useful while authoring, but they do not
break lowering.

Static dispatch can handle finite states, known transitions, public data,
read-only visual results, bounded decision trees, and no external effects. It
cannot handle private data, authorization, database writes, payments, secrets,
dynamic server-side decisions, unbounded computation, or multi-user consistency.
Do not use static dispatch as a security boundary or backend authority.

## Static HTTP action lowering

M32e adds static HTTP action lowering. Forms are the original REST client:
Machina can author public GET/POST intent in TypeScript and lower it into native
HTML links and forms.

- author forms with `H.httpAction`
- lower `GET` to `<form method="get" action="...">`
- lower `POST` to `<form method="post" action="...">`
- author links with `H.httpLink`, lowered to `<a href="...">`
- emit native HTML validation attributes such as `required`, `pattern`, `min`,
  `max`, `step`, and `autocomplete`
- represent hidden fields, including method override fields when that is an
  explicit server convention
- ship no script tag and no JavaScript runtime behavior

```ts
import { H } from "machinalayout/static";

const search = H.httpAction({
  id: "site-search",
  method: "GET",
  action: "/search",
  title: "Search",
  submitLabel: "Search",
  fields: [
    {
      id: "q",
      kind: "search",
      label: "Query",
      required: true,
      autocomplete: "off",
    },
  ],
});

const contact = H.httpAction({
  id: "contact-form",
  method: "POST",
  action: "/contact",
  title: "Contact",
  submitLabel: "Send",
  fields: [
    {
      id: "source",
      kind: "hidden",
      value: "machina-static",
    },
    {
      id: "email",
      kind: "email",
      label: "Email",
      required: true,
      autocomplete: "email",
    },
    {
      id: "message",
      kind: "textarea",
      label: "Message",
      required: true,
    },
  ],
});

const docs = H.httpLink({
  id: "docs-link",
  href: "/docs",
  label: "Read docs",
});
```

`method` defaults to `"GET"`, `target` defaults to `"self"`, and `submitLabel`
defaults to `"Submit"`. Field `name` defaults to the field `id`. Visible fields
must have labels. `select` and `radio` fields must provide options. Checkbox
fields use their `value`, or `"on"` when no value is supplied.

The boundary is intentionally narrow. HTML/CSS can submit HTTP requests, but it
cannot act like a full JavaScript REST client. M32e supports public GET links,
GET search/query forms, POST forms, native HTML validation attributes, and hidden
fields. It does not support PUT, PATCH, DELETE as native methods, custom request
headers, Authorization headers, JSON request bodies, `fetch`, XHR, client-side
JSON response handling, retry logic, streaming, SPA behavior, or CORS behavior
that depends on JavaScript.

Response handling is normal browser navigation and server responsibility. The
static artifact can submit the request; it does not parse the response, update
the UI dynamically, write to a database by itself, provide trusted
authorization, store secrets, process payments, or act as backend authority.
Password fields are allowed as HTML controls, but static HTML does not protect
secrets by itself; use server-side security and transport protections.

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

The current no-JS dispatch target is finite one-of-many state only. It does not
compile arbitrary TypeScript, execute actions, mutate data, fetch data, bind
backend authority, route pages, or add a JavaScript runtime. M32d actions only
mean "transition to this known state."

The current static HTTP target is native GET/POST forms and links only. It does
not add a JavaScript REST client, custom headers, JSON request bodies, response
parsing, auth, secrets, payments, or backend persistence.

DeusMachina may become a future source for richer static machines, but this
target does not integrate it. MachinaStyle may provide shared styling later, but
this target keeps CSS simple and independent.

Future static dispatch work may include DeusMachina source integration,
checkbox-backed multi-bit dispatch, hash/target state, and routing or static
site lowering.
