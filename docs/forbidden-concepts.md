# Forbidden Concepts (M0/M1 Guardrails)

These concepts are forbidden in core M0/M1 unless a future milestone deliberately revisits them.

## Flexbox negotiation features

Forbidden: `flex-basis`, `flex-shrink`, `flex-grow` triangle, `align-content`, `align-self`, `space-around`, `space-evenly`, stretch defaults, baseline alignment.

Why: this would reintroduce hidden layout negotiation and makes layout harder to reason about from records.

## Margin-driven placement

Forbidden: auto margins, per-child margins, margin collapse.

Why: margins introduce implicit inter-node coupling and hidden offsets that are not explicit in row geometry.

## Stack wrapping and implicit sizing behavior

Forbidden: wrap on `Stack`, percent units, implicit stretch behaviors.

Why: this belongs in a future separate primitive, not Stack.

## DOM/CSS-driven geometry authority

Forbidden: DOM measurement in core layout, selector-based layout, descendant selector semantics, CSS classes as layout inputs.

Why: renderer-dependent inputs break deterministic resolution and move authority away from typed records.

## Authoring model drift

Forbidden: nested JSX as canonical authoring, recursive `children` on `LayoutNode`.

Why: Machina’s contract is flat record authoring; tree shape is derived output.

## Out-of-scope platform concerns in core

Forbidden: routing inside layout core, state management inside layout core.

Why: layout core should stay a geometry engine, not an application framework.

## Ordering and layering misuse

Forbidden: global z-index solver, z-based layout ordering.

Why: z is sibling-local paint metadata; geometry and order resolution must remain independent.

## Silent correctness masking

Forbidden: silent clamping.

Why: silent repair hides authoring mistakes and weakens determinism guarantees.
