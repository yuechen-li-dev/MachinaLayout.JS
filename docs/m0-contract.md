# M0 Contract

## Purpose

M0 defines a deterministic, framework-independent rectangle resolution pipeline with a narrow, explicit scope.

## Architecture pipeline

`LayoutRow[]`
→ `compileLayoutRows`
→ `LayoutDocument`
→ `resolveLayoutDocument`
→ `ResolvedLayoutDocument`
→ optional `toResolvedTree`
→ renderer adapter

## Core model

- **Flat rows** are the canonical input model.
- **Indexed documents** (`nodes`, `children`, `rootId`) are the compiled representation.
- **Flat resolved output** is the canonical resolved geometry model.
- **Derived tree** is for rendering/debugging convenience, not authoring.

## Supported primitives

- `AbsoluteFrame`
- `AnchorFrame`
- `FixedFrame`
- `StackArrange`

## Supported metadata

- `slot`
- `debugLabel`
- `z`

## Adapter boundary

- The React adapter renders resolved rectangles as absolutely positioned wrappers.
- Slots are rendered via a slot registry (`views`).
- Coordinates are normalized to root-local space for embedding.
- Containment/content-visibility are adapter-level policy knobs.

## Sample

The Control Room sample (`samples/control-room`) demonstrates the M0 contract in a runnable app.

## Non-goals

- routing
- state framework
- full design system
- CSS replacement
- flexbox clone
- grid clone
