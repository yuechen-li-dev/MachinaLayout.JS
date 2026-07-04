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
import { S, serializeMachinaStyleSheet, validateMachinaStyleSheet } from "machinalayout/style";
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
});
```

Numeric `space` and `radius` token values lower to `px`. Token names lower to stable custom-property names such as `--color-on-primary` and `--radius-lg`.

## Style Records

Style records are semantic-ish structs, not 1:1 CSS property mirrors:

- `box` covers presentation around size, spacing, display, alignment, and overflow.
- `surface` covers fill, radius, and opacity.
- `text` covers readable text properties.
- `border` covers border color, width, and style.
- `effect` covers visual effects such as shadows.

For example, `surface.fill` lowers to `background`, `surface.radius` lowers to `border-radius`, `box.paddingX` lowers to left/right padding, and `text.weight: "semibold"` lowers to `font-weight: 600`.

## Immutable Updates

`S.with` mirrors C# record-style copy/update ergonomics. It deep-merges by style group, returns a fresh record, and leaves the base and patch untouched. Undefined patch fields are ignored in M31a; delete semantics can come later.

```ts
import { S, serializeMachinaStyleSheet } from "machinalayout/style";

const baseButton = S.style({
  box: {
    paddingX: "space.md",
    paddingY: "space.sm",
  },
  surface: {
    radius: "radius.md",
  },
  text: {
    weight: "semibold",
  },
});

const primaryButton = S.with(baseButton, {
  surface: {
    fill: "color.primary",
  },
  text: {
    color: "color.onPrimary",
  },
});

export const sheet = S.sheet({
  tokens: S.tokens({
    color: {
      primary: "#7c5cff",
      onPrimary: "#ffffff",
    },
    space: {
      sm: 8,
      md: 16,
    },
    radius: {
      md: 12,
    },
  }),
  classes: {
    primaryButton,
  },
});

export const css = serializeMachinaStyleSheet(sheet);
```

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

```ts
const baseButton = S.style({
  box: {
    paddingX: "space.md",
    paddingY: "space.sm",
  },
  surface: {
    fill: "color.panel",
    radius: "radius.md",
  },
  text: {
    color: "color.text",
    weight: "semibold",
  },
});

const primaryLayer = S.layer({
  surface: {
    fill: "color.primary",
  },
  text: {
    color: "color.onPrimary",
  },
});

const ghostLayer = S.layer({
  surface: {
    fill: S.unset(),
  },
  border: {
    color: "color.primary",
    width: 1,
  },
});

const primaryButton = S.compose(baseButton, primaryLayer);
const ghostButton = S.compose(baseButton, ghostLayer);

export const sheet = S.sheet({
  tokens,
  classes: {
    primaryButton,
    ghostButton,
  },
});
```

Sheets are concrete. If an unresolved slot reaches `S.sheet` validation, it is reported as `UnresolvedStyleSlot`; serialization also rejects unresolved slots with a stable error. Compose layer stacks before serializing.

## Validation

Use `validateMachinaStyleSheet(sheet)` to check common authoring mistakes:

- empty or whitespace-containing class names
- opacity outside `0..1`
- negative numeric radius, border width, space token, or radius token values
- token references such as `color.primary` that do not exist in the sheet tokens

`formatMachinaStyleDiagnostics(diagnostics)` returns a compact human-readable report.

Serialization does not block on diagnostics. That keeps lowering deterministic and lets tools decide whether diagnostics are fatal.

## M31a Scope

M31a deliberately does not support arbitrary selector nesting, pseudo selectors, media queries, keyframes, runtime style injection, theme providers, or raw CSS escape hatches.

Future phases can add variants, pseudo states, responsive/media rules, MachinaCanvas dogfood, and TSX export integration without turning CSS back into the source language.
