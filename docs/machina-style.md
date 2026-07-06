# MachinaStyle

MachinaStyle is a typed authoring surface for style intent. It is not a CSS-in-JS runtime, not styled-components, and not a cascade abstraction.

```txt
style.ts
  -> typed style records / MachinaStyle IR
  -> deterministic CSS text
```

MachinaLayout decides where boxes go. MachinaStyle decides how boxes look. CSS is the browser lowering target.

## Import

```ts
import {
  createMachinaStyleArtifact,
  S,
  serializeMachinaStyleSheet,
  validateMachinaStyleSheet,
} from "machinalayout/style";
```

## Tokens

`S.tokens` defines typed design tokens for color, spacing, radius, font, and shadow values. Tokens lower to CSS custom properties on `:root`.

```ts
const tokens = S.tokens({
  color: {
    page: "#0b0d12",
    panel: "#151821",
    text: "#f8fafc",
    primary: "#7c5cff",
    onPrimary: "#ffffff",
  },
  space: {
    sm: 8,
    md: 16,
    lg: 24,
  },
  radius: {
    md: 12,
    lg: 20,
  },
  font: {
    ui: {
      family: "Inter, system-ui, sans-serif",
      size: 14,
      lineHeight: 1.45,
      weight: "medium",
    },
  },
});
```

Numeric `space` and `radius` token values lower to `px`. Token names lower to stable custom-property names such as `--color-on-primary` and `--radius-lg`.

### Token References

String token references such as `"color.primary"` still work for backward compatibility, but M31d adds a safer helper:

```ts
const t = S.token;

const panel = S.style({
  surface: {
    fill: t("color", "primary"),
    radius: t("radius", "md"),
  },
  box: {
    paddingX: t("space", "md"),
  },
  text: {
    color: t("color", "onPrimary"),
  },
});
```

`S.token(group, key)` returns a `MachinaTokenReference` object:

```ts
type MachinaTokenGroup = "color" | "space" | "radius" | "font" | "shadow";

type MachinaTokenReference = {
  kind: "token";
  group: MachinaTokenGroup;
  key: string;
};
```

Both `"color.primary"` and `S.token("color", "primary")` lower to `var(--color-primary)`. Validation covers both forms.

## Tabular Style Sheets

Tabular style sheets are an authoring surface for MachinaStyle. They do not replace the existing style records or CSS lowering pipeline.

```txt
style.ts is a Tabular Style Sheet.
CSS is the target, not the source language.
```

Author style as tables. Validate by cell. Lower through MachinaStyle. Emit CSS at the boundary.

Token tables model `token x theme -> value`:

```ts
const tokens = Table.defineWithSchema({
  id: "themeTokens",
  schema: S.tokenTableSchema(["light", "dark"]),
  columns: {
    token: ["background", "foreground", "primary"],
    light: ["oklch(1 0 0)", "oklch(0.145 0 0)", "oklch(0.205 0 0)"],
    dark: ["oklch(0.145 0 0)", "oklch(0.985 0 0)", "oklch(0.922 0 0)"],
    description: [undefined, undefined, undefined],
  },
});
```

Rule tables use long-form `selector | property | value` rows:

```ts
const rules = Table.defineWithSchema({
  id: "bookingRules",
  schema: S.ruleTableSchema(),
  columns: {
    selector: [".scheduling-booking-header", ".scheduling-booking-header"],
    property: ["height", "padding"],
    value: ["100%", "0 24px"],
    state: [undefined, undefined],
    breakpoint: [undefined, undefined],
    description: [undefined, undefined],
  },
});
```

Lower the authored tables into the existing serializer path:

```ts
const sheet = S.sheetFromTables({
  id: "bookingStyles",
  tokens,
  rules,
});

const css = serializeMachinaStyleSheet(sheet);
```

Token themes lower to CSS custom-property blocks. The default theme becomes `:root`, and additional named themes lower to class selectors such as `.dark`. Rule rows are grouped by selector before serialization, and optional `state` / known `desktop` / `tablet` / `phone` breakpoints reuse MachinaStyle's existing `data-state` and responsive media-query conventions.

M35m does not add a CSS parser, selector engine, cascade simulator, or second style engine.

## Style Records

Style records are semantic-ish structs, not 1:1 CSS property mirrors:

- `box` covers presentation around size, spacing, display, alignment, and overflow.
- `surface` covers fill, radius, and opacity.
- `text` covers readable text properties.
- `border` covers border color, width, and style.
- `effect` covers visual effects such as shadows.

For example, `surface.fill` lowers to `background`, `surface.radius` lowers to `border-radius`, `box.paddingX` lowers to left/right padding, and `text.weight: "semibold"` lowers to `font-weight: 600`.

## Immutable Updates

`S.with` mirrors C# record-style copy/update ergonomics. It deep-merges by style group, returns a fresh record, and leaves the base and patch untouched. Undefined patch fields are ignored.

## Explicit Style Layers

CSS cascade is implicit composition. MachinaStyle uses explicit ordered record composition.

MachinaStyle does not use null as an inherit sentinel. Inheritance and removal are explicit slot operations:

- `S.set(value)` means this layer provides a concrete value.
- `S.inherit()` means this layer intentionally takes the value from lower layers.
- `S.unset()` means this layer intentionally removes the value from the composed result.

`S.style(...)` is for concrete style records. Plain values are accepted and existing M31a authoring remains valid.

`S.layer(...)` is for partial style-layer authoring. Fields may be plain values, `S.set(value)`, `S.inherit()`, or `S.unset()`.

`S.over(top, base)` composes one layer over another and returns a concrete `MachinaStyleRecord`. `S.compose(...layers)` composes in order, so later layers go over earlier layers.

`S.with(base, patch)` remains the ergonomic copy/update helper for concrete records. Use `S.over` or `S.compose` when you want explicit layer composition with set/inherit/unset semantics.

Sheets are concrete. If an unresolved slot reaches `S.sheet` validation, it is reported as `UnresolvedStyleSlot`; serialization also rejects unresolved slots with a stable error. Compose layer stacks before serializing.

## Font Tokens

Font tokens are structured tokens. They emit separate CSS variables:

```css
--font-ui-family: Inter, system-ui, sans-serif;
--font-ui-size: 14px;
--font-ui-line-height: 1.45;
--font-ui-weight: 500;
```

When `text.font` references a font token, MachinaStyle expands it into multiple declarations:

```ts
const label = S.style({
  text: {
    font: S.token("font", "ui"),
    size: 16,
  },
});
```

```css
font-family: var(--font-ui-family);
font-size: var(--font-ui-size);
line-height: var(--font-ui-line-height);
font-weight: var(--font-ui-weight);
font-size: 16px;
```

Expansion happens first, and explicit `text.family`, `text.size`, `text.lineHeight`, `text.weight`, and `text.letterSpacing` declarations come after it so local overrides win.

## Class Helpers

Use `S.classes(sheet)` to derive a typed-ish class-name map from sheet keys:

```ts
export const sheet = S.sheet({
  tokens,
  classes: {
    page,
    buttonPrimary,
  },
});

export const classes = S.classes(sheet);
```

```tsx
<button className={classes.buttonPrimary}>Launch</button>
```

Stateful styles also participate in the helper, so `sheet.stateful.button = S.stateful("button", ...)` produces `classes.button === "button"`.

The helper returns the exact class names used during serialization, which keeps React `className` usage aligned with `style.ts`.

## Stateful Styles

MachinaStyle models actual component states first, not CSS pseudo-states first.

```txt
CSS has pseudo-states because CSS has no real state machine.

Machina has DeusMachina.

So MachinaStyle styles actual component states,
then lowers them to CSS selectors/data attributes.
```

`S.stateful(className, { base, states })` defines a concrete base record plus named state layers:

```ts
const button = S.stateful("button", {
  base: S.style({
    surface: { fill: S.token("color", "primary") },
    text: { color: S.token("color", "onPrimary") },
  }),
  states: {
    hover: S.layer({
      surface: { fill: S.token("color", "primaryHover") },
    }),
    pressed: S.layer({
      surface: { fill: S.token("color", "primaryPressed") },
    }),
    disabled: S.layer({
      surface: { opacity: 0.48 },
    }),
  },
});
```

Use `S.resolveState(stateful, stateName)` to compose a concrete record for a named state. `S.resolveStates(stateful)` resolves every named state deterministically.

When a sheet includes `stateful`, MachinaStyle lowers those states to `data-state` selectors:

```ts
const sheet = S.sheet({
  tokens,
  classes: {
    page,
  },
  stateful: {
    button,
  },
});
```

```css
.button {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.button[data-state~="hover"] {
  background: var(--color-primary-hover);
}

.button[data-state~="pressed"] {
  background: var(--color-primary-pressed);
}

.button[data-state~="disabled"] {
  opacity: 0.48;
}
```

That makes runtime ownership explicit:

- DeusMachina decides what state a component is in.
- MachinaStyle decides what style applies to that state.
- CSS lowering expresses those states through selectors.

`S.dataState(...states)` is a small helper for building a validated `data-state` string:

```tsx
<button className={classes.button} data-state={S.dataState("hover", "selected")}>
  Launch
</button>
```

M31e does not add Deus binding yet. It only creates the style representation and CSS lowering that Deus can drive later.

`S.unset()` is not supported inside state layers yet. Base classes remain active underneath state selectors, so CSS cannot remove a base declaration safely without property-specific reset semantics. Validation reports `UnsupportedStateUnset` if a state layer uses `S.unset()`.

## Responsive Style Variants

MachinaStyle responsive variants are layout modes, not literal devices:

- `desktop` means wide workspace mode.
- `tablet` means medium stacked mode.
- `phone` means narrow single-column mode.

CSS media queries are the lowering artifact. Authors choose the mode; they do not author arbitrary breakpoints or media-query logic.

```ts
const hero = S.responsive("hero", {
  base: S.style({
    box: { paddingX: S.token("space", "lg") },
    text: { font: S.token("font", "body") },
  }),
  variants: {
    desktop: S.layer({
      box: { paddingX: S.token("space", "xl") },
      text: { font: S.token("font", "display") },
    }),
    tablet: S.layer({
      box: { paddingX: S.token("space", "lg") },
      text: { font: S.token("font", "title") },
    }),
    phone: S.layer({
      box: { paddingX: S.token("space", "md") },
      text: { font: S.token("font", "body") },
    }),
  },
});
```

Add responsive tables to the `responsive` sheet section:

```ts
const sheet = S.sheet({
  tokens,
  classes: {
    page,
  },
  responsive: {
    hero,
  },
});

const classes = S.classes(sheet);
// classes.hero === "hero"
```

`S.resolveResponsive(hero, "desktop")` returns `base` composed with the desktop layer. `S.resolveResponsiveVariants(hero)` returns resolved `desktop`, `tablet`, and `phone` records. Missing variants inherit the base style.

Serialization emits the base class and then present variants in deterministic `desktop`, `tablet`, `phone` order:

```css
.hero {
  padding-left: var(--space-lg);
  padding-right: var(--space-lg);
}

@media (min-width: 1024px) {
  .hero {
    padding-left: var(--space-xl);
    padding-right: var(--space-xl);
  }
}

@media (min-width: 640px) and (max-width: 1023px) {
  .hero {
    padding-left: var(--space-lg);
    padding-right: var(--space-lg);
  }
}

@media (max-width: 639px) {
  .hero {
    padding-left: var(--space-md);
    padding-right: var(--space-md);
  }
}
```

`S.unset()` is not supported inside responsive layers yet. Base declarations remain active inside media queries, so CSS cannot remove them safely without reset semantics. Validation reports `UnsupportedResponsiveUnset`.

There is no runtime `matchMedia`, no viewport hook, and no container-query support in this milestone. A future composition order can be `base -> responsive variant -> actual state`, but M31f keeps `responsive` and `stateful` tables independent.

## Artifact Generation

MachinaStyle does not write files itself, but it can produce a standard artifact object:

```ts
const artifact = createMachinaStyleArtifact(sheet);
// { path: "generated.css", css: "..." }
```

That keeps generation scripts boring:

```ts
await writeFile(`src/${artifact.path}`, artifact.css, "utf8");
```

`assertMachinaStyleArtifactText(sheet, cssText)` is also available for sync tests.

## Dogfood Sample

`samples/style-dogfood` is a small React/Vite control-panel sample that uses `machinalayout/style` as its authoring surface:

```txt
samples/style-dogfood/src/style.ts
  -> S.token(...)
  -> S.classes(sheet)
  -> createMachinaStyleArtifact(sheet)
  -> samples/style-dogfood/src/generated.css
```

The sample demonstrates tokens, semantic style records, `S.with`, explicit layers, `S.compose`, `S.set`, `S.inherit`, `S.unset`, stateful style tables, responsive style variants, validation diagnostics, class helpers, artifact generation, structured font-token lowering, and deterministic CSS serialization without runtime CSS injection.

See the M31c friction report at [`docs/machina-style-dogfood-report.md`](machina-style-dogfood-report.md) for concrete recommendations from using MachinaStyle in the sample.

## Validation

Use `validateMachinaStyleSheet(sheet)` to check common authoring mistakes:

- empty or whitespace-containing class names
- opacity outside `0..1`
- negative numeric radius, border width, space token, or radius token values
- unknown token references from either string refs or `MachinaTokenReference` objects
- invalid `text.font` references that do not point at the `font` token group

`formatMachinaStyleDiagnostics(diagnostics)` returns a compact human-readable report.

Serialization does not block on diagnostics. That keeps lowering deterministic and lets tools decide whether diagnostics are fatal.

## Scope

MachinaStyle deliberately does not support arbitrary selector nesting, CSS pseudo-selector authoring, media queries, keyframes, runtime style injection, theme providers, or raw CSS escape hatches.

Future phases can add richer state lowering, responsive/state composition, MachinaCanvas dogfood, and TSX export integration without turning CSS back into the source language.
