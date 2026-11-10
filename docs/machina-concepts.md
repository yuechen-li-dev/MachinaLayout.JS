# Machina Concepts

`machinalayout/concept` adds a small runtime utility surface for named capability constraints, concept source records, and template records.

In 0.6.0, concept tables are source records inside the typed table authoring and derivation substrate. They are not Zod clones, and they lower into semantic concept records that downstream surfaces can project.

This is inspired by C++ concepts/templates, but M34e is not compile-time metaprogramming, code generation, a schema compiler, or a validation framework clone.

Machina concepts are source records for meaning, validation, diagnostics, and projection hints. They are not only validators.

## What it is

- Concepts are named capability contracts.
- Concepts are composable.
- Concepts produce readable diagnostics for humans and LLMs.
- Concept tables author flat concept source records.
- Templates declare a required concept for runtime inputs.
- Concepts are the single source of truth for a shape: `T.Infer<typeof C>` derives the TypeScript type.
- Templates take their input type from their required concept; overloads dispatch on concept refinement.

## What it is not

- Not C++ template metaprogramming.
- Not code generation.
- Not a Babel or TypeScript transform.
- Not a recursive schema language: nesting is by referencing other named concepts, never self-reference.
- Not a Zod clone.
- Not a form renderer or form state framework.
- Not a parser: no coercion, transforms, defaults, or silent repair. Values are accepted or diagnosed.

## Import surface

```ts
import {
  T,
  ConceptError,
  conceptTableSchema,
  conceptsFromTable,
  validateConceptTable,
  describeConcepts,
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
- `T.conceptTableSchema`
- `T.conceptsFromTable`
- `T.validateConceptTable`
- `T.describeConcepts`
- field helpers like `T.string()`, `T.number()`, `T.fn()`, and `T.optional(...)`
- type helpers like `T.HasField`, `T.OptionalField`, `T.HasId`, `T.HasKind`, `T.And`, `T.All`, `T.ConceptType`, `T.Extends`, `T.Equal`, `T.Assert`, and `T.Satisfies`

## Concept tables

M35k adds a narrow source-layer bridge: author concept rows as a Machina table, validate them by cell, and lower them into explicit `ConceptRecord[]`.

Core thesis:

- Concepts are source.
- Tables organize concepts.
- Templates project concepts.
- Layouts place projections.
- Renderers lower projections.

A validation schema is a concept with most of its brain removed. Zod-like validation-only schemas are degenerate concepts: they describe type constraints, but concept records can also carry labels, diagnostics, editability hints, layout-facing metadata, and future projection inputs.

M35k intentionally stops at concept records:

- it does not render forms
- it does not project layouts
- it does not generate Zod or JSON Schema
- it does not recurse into nested concept trees

Use `T.conceptTableSchema()` when you want schema-authored tables:

```ts
import { T } from "machinalayout/concept";
import { Table } from "machinalayout/table";

const providerConcepts = Table.defineWithSchema({
  id: "providerConcepts",
  schema: T.conceptTableSchema(),
  columns: {
    concept: ["displayName", "slug", "timeZoneId", "contactEmail", "description"],
    type: ["string", "string", "string", "string", "string"],
    label: [
      "Provider name",
      "Public slug",
      "Timezone",
      "Contact email",
      "Short public description",
    ],
    required: [true, true, true, false, false],
    description: [
      undefined,
      "Public URL-safe identifier.",
      undefined,
      undefined,
      undefined,
    ],
    diagnosticLabel: [
      "provider name",
      "provider slug",
      "timezone",
      "contact email",
      "description",
    ],
    controlHint: ["input", "input", "input", "input", "textarea"],
    valuePath: [
      "draft.provider.displayName",
      "draft.provider.slug",
      "draft.provider.timeZoneId",
      "draft.provider.contactEmail",
      "draft.provider.description",
    ],
    changeKey: ["displayName", "slug", "timeZoneId", "contactEmail", "description"],
    enumValues: [undefined, undefined, undefined, undefined, undefined],
    literalValue: [undefined, undefined, undefined, undefined, undefined],
    placeholder: [undefined, undefined, undefined, undefined, undefined],
    testId: [
      "setup-provider-name",
      "setup-provider-slug",
      "setup-provider-timezone",
      "setup-provider-email",
      "setup-provider-description",
    ],
  },
});

const concepts = T.conceptsFromTable(providerConcepts);
```

Each row lowers to an explicit concept source record:

```ts
concepts[0];
// {
//   kind: "conceptRecord",
//   concept: "displayName",
//   type: "string",
//   label: "Provider name",
//   required: true,
//   diagnosticLabel: "provider name",
//   controlHint: "input",
//   valuePath: "draft.provider.displayName",
//   changeKey: "displayName",
//   testId: "setup-provider-name",
// }
```

Validation is cell-shaped and non-throwing when you ask for diagnostics explicitly:

```ts
const diagnostics = T.validateConceptTable(providerConcepts);
const description = T.describeConcepts(concepts, providerConcepts.id);
```

Example diagnostic:

```txt
error InvalidConceptType at providerConcepts.type[3]
  Concept type must be one of string, number, boolean, enum, literal, unknown.
```

Enum and literal concepts use narrow source-only metadata:

- enum rows must provide `enumValues`
- literal rows must provide `literalValue`
- non-enum rows must not provide `enumValues`
- non-literal rows must not provide `literalValue`

Form projection is intentionally deferred. M35k only lowers tables into `ConceptRecord[]`. A later milestone can project those records into form fields, layout hints, API docs, or other downstream authoring surfaces once the mapping is clearer.

## Projecting concepts into form fields

M35l adds a narrow projection bridge in `machinalayout/form`.

Concept-to-form projection does not manage form state. It maps concept records into field records using caller-supplied values and projection options.

The dependency direction stays one-way:

- `machinalayout/concept` defines source records
- `machinalayout/form` projects those records into `FormFieldRecord[]`
- rendering and state stay app-owned

Example:

```ts
import { T } from "machinalayout/concept";
import { Form } from "machinalayout/form";

const concepts = T.conceptsFromTable(providerConcepts);

const fields = Form.fieldsFromConcepts(concepts, {
  values: {
    displayName: draft.provider.displayName,
    slug: draft.provider.slug,
    timeZoneId: draft.provider.timeZoneId,
    contactEmail: draft.provider.contactEmail,
    description: draft.provider.description,
  },
  disabled: () => !onProviderFieldChange || !entities.provider,
  inputIdPrefix: "setup-provider",
  testIdPrefix: "setup-provider",
});
```

This keeps concept records semantic:

- concepts describe meaning
- form fields describe editing
- projection connects them without turning Machina into a form framework

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

## Typed concepts (M36)

A concept is the one declaration of a shape. Its TypeScript type is derived, not paired by naming convention.

```ts
import { T } from "machinalayout/concept";

const Px = T.concept({ id: "Px", fields: { unit: T.literal("px"), value: T.number() } });
const Ui = T.concept({ id: "Ui", fields: { unit: T.literal("ui"), value: T.number() } });
const UiLength = T.union(T.number(), Px, Ui);

const AbsoluteFrame = T.implements<import("machinalayout").AbsoluteFrame>()(
  T.concept({
    id: "AbsoluteFrame",
    closed: true, // unknown keys are errors, with did-you-mean
    fields: {
      kind: T.literal("absolute"),
      x: T.number({ finite: true }),
      y: T.number({ finite: true }),
      width: T.number({ finite: true, min: 0 }),
      height: T.number({ finite: true, min: 0 }),
    },
  }),
);

type Frame = T.Infer<typeof AbsoluteFrame>; // exactly AbsoluteFrame
```

Constraint builders:

- `T.string({ nonEmpty, brand })`, `T.number({ finite, int, min, max, allowNaN, brand })`, `T.boolean()`
- `T.literal(v)`, `T.oneOf(a, b, c)`, `T.union(...constraints)`
- `T.object()` / `T.object(Concept)` or a concept directly as a field; `T.array()` / `T.array(element, { minLength })`
- `T.fn<Signature>()` (runtime checks `typeof`, the signature is compile-time only)
- `T.custom(name, guard, { example })` escape hatch; the guard's type is inferred
- `T.optional(constraint)`

Numbers reject `NaN` by default. Brands (`brand: "px"`) are compile-time only: `number & Brand<"px">` is not assignable to `number & Brand<"ui">`.

`T.implements<Type>()(concept)` is a drift guard for code that keeps a hand-written type. A mismatch is a compile error ending in e.g. `"differs: x", "missing in concept: height"`.

`T.compose` throws `ConflictingConceptField` when sources disagree, unless the field is overridden in `fields`. It records `fieldOrigins`, so diagnostics can say which concept a field came from.

## Diagnostics with fixes

Validation recurses through nested concepts, arrays (`columns[1].size`), and unions. Every diagnostic carries `path`, `expected`, `received`, origin `concept`, and a machine-applicable `fix` (`add` / `remove` / `rename` / `replace`).

```text
[error] MissingConceptField at frame.height: missing required number(finite, >=0); found 'heigth' — did you mean 'height'? [fix: rename frame.heigth → height]
[error] UnknownConceptField at arrange.paddingX: unknown key on closed StackArrange; did you mean 'padding'? [fix: rename arrange.paddingX → padding]
[error] InvalidConceptDiscriminant at frame.kind: "anchr" is not one of "root" | "absolute" | "anchor" | …; did you mean "anchor"? [fix: set frame.kind to "anchor"]
```

Unions whose object branches have literal fields are routed by those discriminants, so only the matching branch's errors are reported. On open concepts, an unknown key close to an absent optional field is a `SuspiciousConceptField` warning.

`T.is(C, value)` is a type guard and `T.assert(C, value)` an assertion function. Both narrow to `T.Infer<typeof C>`.

## Templates, overloads, registry

```ts
const label = T.template({ id: "rectLabel", requires: Rect, run: (r) => `${r.width}x${r.height}` });
// `r` is inferred from Rect; a run function expecting a narrower type is a compile error.

const describeShape = T.overload("describeShape", [pointLabel, rectLabel, squareLabel]);
describeShape.call(value); // most specific matching template wins
describeShape.resolve(untrusted); // { ok, template, run } | { ok: false, code, diagnostics }
```

"More specific" means structural refinement (every value of A satisfies B), computed from the constraints rather than from declaration order or `composedFrom`. If two incomparable templates both match, the result is `AmbiguousOverload`; nothing is ever chosen silently. Overload sets where a template can never be chosen throw `DuplicateOverload`.

`T.registry().register(...)` answers `capabilities(value)` (what accepts this value, most specific first) and `accepting(Concept)` (what is statically guaranteed to accept every value of a concept).

## Fixtures and explanations

- `T.example(C)` returns a deterministic minimal valid value, self-checked against the validator.
- `T.counterexamples(C)` returns one single-mutation invalid value per field and failure mode, each verified to produce its `expectedCode` at its `path`.
- `T.explain(C)` gives the fields with origins, an example, and the rejected failure modes as plain text for LLM or human readers.

## Legacy compile-time helpers

`T.HasField`, `T.OptionalField`, `T.HasId`, `T.HasKind`, `T.And`, `T.All`, `T.ConceptType`, `T.Extends`, `T.Equal`, `T.Assert`, and `T.Satisfies` remain for compatibility. Prefer `T.Infer` plus plain TypeScript: these are aliases for `{ [K]: V }`, `&`, and the identity. For general type-level testing, use `machinalayout/comptime`.

## Honest boundary

- Inference covers every built-in constraint. `T.custom` and `T.fn` signatures are compile-time promises the runtime cannot check.
- Refinement is structural and conservative: open concepts ignore extra keys the way TypeScript object types do. Custom constraints only refine when they are the same guard.
- Overloads dispatch at runtime by validating each candidate, so cost is O(templates × validation). Use them for authoring and tooling boundaries, not hot loops.
- No recursion (self-referential concepts), no coercion, no defaults.

See also: [`samples/toolkit-pipeline`](../samples/toolkit-pipeline), which derives `ValidOrder` from its concept. Its old hand-written type had drifted to `status: string`. Also see the [Machina toolkit dogfood report](machina-toolkit-dogfood-report.md).
