# Machina Concepts

`machinalayout/concept` adds a small runtime utility surface for named capability constraints and template records.

This is inspired by C++ concepts/templates, but M34e is not compile-time metaprogramming, code generation, a schema compiler, or a validation framework clone.

## What it is

- Concepts are named capability contracts.
- Concepts are composable.
- Concepts produce readable diagnostics for humans and LLMs.
- Templates declare a required concept for runtime inputs.
- Compile-time helpers name useful generic shapes without pretending to derive them.

## What it is not

- Not C++ template metaprogramming.
- Not code generation.
- Not a Babel or TypeScript transform.
- Not a recursive schema language.
- Not a Zod clone.
- Not nested-object validation beyond basic `object`/`array` kind checks in M34e.

## Import surface

```ts
import {
  T,
  ConceptError,
  formatConceptDescription,
  formatConceptDiagnostics,
  formatTemplateDescription,
} from "machinalayout/concept";
```

`machinalayout/concept` exports:

- `T.concept`
- `T.compose`
- `T.validate`
- `T.assert`
- `T.describe`
- `T.template`
- `T.runTemplate`
- `T.describeTemplate`
- field helpers like `T.string()`, `T.number()`, `T.fn()`, and `T.optional(...)`
- type helpers like `T.HasField`, `T.OptionalField`, `T.HasId`, `T.HasKind`, `T.And`, `T.All`, `T.ConceptType`, `T.Extends`, `T.Equal`, `T.Assert`, and `T.Satisfies`

## Named capability constraints

```ts
import { T } from "machinalayout/concept";

const HasId = T.concept({
  id: "HasId",
  fields: {
    id: T.string(),
  },
});

const Positioned = T.concept({
  id: "Positioned",
  fields: {
    x: T.number(),
    y: T.number(),
  },
});

const Sized = T.concept({
  id: "Sized",
  fields: {
    width: T.number(),
    height: T.number(),
  },
});

const RectLike = T.compose({
  id: "RectLike",
  concepts: [Positioned, Sized],
  fields: {
    id: T.optional(T.string()),
  },
});
```

Concepts are inspectable:

```ts
const description = T.describe(RectLike);
console.log(formatConceptDescription(description));
```

Example output:

```txt
Concept: RectLike
Composed from:
- Positioned
- Sized
Fields:
- x: number
- y: number
- width: number
- height: number
- id: string?
```

## Runtime diagnostics

```ts
const diagnostics = T.validate(RectLike, {
  x: 10,
  y: 20,
  width: 200,
});
```

This returns diagnostics such as:

- `MissingConceptField`
- `InvalidConceptFieldType`
- `InvalidConceptLiteral`

If you want a throwing path:

```ts
T.assert(RectLike, {
  x: 10,
  y: 20,
  width: 200,
  height: 100,
});
```

Invalid inputs throw `ConceptError` with the concept id and collected diagnostics.

## Compile-time concept helpers

Runtime concepts validate unknown values and produce diagnostics.
Type helpers express generic constraints at compile time.

If you want the general compile-time helper toolkit, use `machinalayout/comptime`.
`machinalayout/concept` keeps a concept-oriented subset for ergonomics around concept constraints.

M34f intentionally does not derive TypeScript types from runtime concept objects.
Pair runtime concepts and type aliases by naming convention for now.

```ts
import { T } from "machinalayout/concept";

export const PositionedConcept = T.concept({
  id: "Positioned",
  fields: {
    x: T.number(),
    y: T.number(),
  },
});

export type Positioned = T.All<[T.HasField<"x", number>, T.HasField<"y", number>]>;

export const SizedConcept = T.concept({
  id: "Sized",
  fields: {
    width: T.number(),
    height: T.number(),
  },
});

export type Sized = T.All<[T.HasField<"width", number>, T.HasField<"height", number>]>;

export type RectLike = T.All<[Positioned, Sized]>;

export function centerOf<TValue extends RectLike>(rect: TValue) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}
```

Useful helpers stay intentionally boring:

- `T.HasField<"x", number>` names a required field shape.
- `T.OptionalField<"name", string>` names an optional field shape.
- `T.HasId` and `T.HasKind<"image">` cover common discriminant-style constraints.
- `T.And<A, B>` and `T.All<[A, B, C]>` compose shapes.
- `T.ConceptType<{ ... }>` names a useful object shape directly.
- `T.Extends`, `T.Equal`, and `T.Assert` support compile-time tests and docs.
- `T.Satisfies<TValue, TConcept>` is a small compatibility helper, not a validation system.

M34f does not attempt automatic runtime-concept-to-TypeScript-type derivation.
That would be a later metaprogramming/typegen feature.

## Template records

Templates are small runtime records that declare a concept requirement.

```ts
const renderRect = T.template({
  id: "renderRect",
  requires: RectLike,
  run: (rect: { x: number; y: number; width: number; height: number }) =>
    `${rect.x},${rect.y} ${rect.width}x${rect.height}`,
});

const text = T.runTemplate(renderRect, {
  x: 10,
  y: 20,
  width: 200,
  height: 100,
});
```

Templates are also inspectable:

```ts
const description = T.describeTemplate(renderRect);
console.log(formatTemplateDescription(description));
```

## Honest boundary

M34e concepts are runtime authoring and diagnostics tools first.

- They do not derive perfect compile-time types from runtime objects.
- They do not validate nested schemas recursively.
- They do not instantiate generic template graphs.
- They do not replace TypeScript generics.

The blade stays narrow: named capability constraints and template records.

See also: [`samples/toolkit-pipeline`](../samples/toolkit-pipeline) and the [Machina toolkit dogfood report](machina-toolkit-dogfood-report.md) for a runtime-validation sample that pairs concepts with policy diagnostics, iterator traversal, and async enrichment.
