# MachinaStyle Dogfood Report

M31c dogfooded MachinaStyle in `samples/style-dogfood`, a tiny React/Vite control-panel page whose CSS is generated from `src/style.ts` and checked in as `src/generated.css`.

## M31d Follow-Through

M31d addressed several of the ergonomics issues called out below:

- `S.token(group, key)` now provides typed-ish token references without breaking existing string refs.
- `S.classes(sheet)` now gives React code an aligned class-name map.
- `createMachinaStyleArtifact(sheet)` now standardizes the `style.ts -> generated.css` generation path.
- `text.font` now expands font tokens into multiple declarations instead of pretending a structured font token is a single CSS variable.

## What Worked Well

- `S.style` was clear for concrete base records such as panels, buttons, badges, and swatches.
- `S.layer` plus `S.compose` made variants easy to audit. `buttonPrimary`, `buttonDanger`, `buttonGhost`, `buttonCompactPrimary`, and `cardElevated` all read as ordered layer stacks rather than hidden cascade behavior.
- `S.unset` was useful immediately. The ghost button removes `surface.fill` from the base button, and the generated `.buttonGhost` class has no `background` declaration.
- `S.set` made intent explicit in danger and warning layers, especially where plain values and slot values appear side by side.
- Validation and serialization failures are direct enough for sample tests. A deliberately invalid diagnostic probe reports `InvalidOpacity` and `NegativeRadius`.
- Generated CSS is readable. It is sorted, deterministic, and simple to diff against `serializeMachinaStyleSheet(sheet)`.

## What Felt Awkward

- Token references are stringly typed. Misspelling `color.warningSurface` would be caught by validation, but only after authoring; TypeScript cannot guide the string.
- Class names are hand-written in both `style.ts` and `App.tsx`. The sample is small, but renaming a class still requires manual coordination.
- `S.inherit` is semantically useful but visually quiet. In `compactLayer`, `radius: S.inherit()` documents intent, but omitting the field would produce the same CSS.
- `S.with` is convenient for concrete copy/update, but it does not express removal. That boundary is good, but users need to learn when to switch from `S.with` to `S.compose`.
- The current font token lowering is awkward for actual text use: font tokens emit `--font-ui-family`, `--font-ui-size`, etc., while a `font.ui` reference lowers like a single variable. The sample used explicit font-family strings instead.

## What Was Missing

- Pseudo states were the first visible limitation for a button sample. Hover, focus-visible, active, and disabled selectors would make the page feel more complete.
- Responsive/media rules were noticeable for the card matrix. The sample stayed blocky because MachinaStyle has no media-layer shape yet.
- A small class-name helper would reduce drift between generated sheet keys and React `className` strings.
- A style artifact generator helper would be nicer than each sample writing its own file script.
- The semantic groups were enough for the dogfood surface, but common CSS like `cursor`, `flex-direction`, `grid-template-columns`, and `outline` came up quickly.

## What Should Be M31d

- Add typed token references, or a helper such as `S.token("color", "primary")`, so TypeScript can participate before validation.
- Add class-name helpers that preserve deterministic sheet keys while giving React code a typed `classes.buttonPrimary` surface.
- Add pseudo-state layers for common component states, starting with `hover`, `focusVisible`, `active`, and explicit disabled styling.
- Add a small first-party CSS artifact generator helper so samples and apps can standardize `style.ts -> generated.css`.
- Fix or clarify font token reference lowering before encouraging `font.ui` usage in examples.

## What Should Wait

- Responsive/media layers should wait until pseudo-state and token-reference ergonomics settle.
- Raw CSS escape hatches should wait. This sample was awkward in places, but not blocked.
- Runtime CSS injection, theme providers, and CSS-in-JS behavior should remain out of scope.
- MachinaCanvas style replacement should wait. This dogfood sample is enough pressure for the authoring API without disturbing the app.
- Full style variants can wait until class-name helpers and pseudo-state layers establish the smaller building blocks.
