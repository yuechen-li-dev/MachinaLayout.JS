# Everyday ergonomics

Small helpers for the TypeScript patterns that are noisy everywhere: discriminated unions, option defaults, guard clauses, multi-line text, and table column options. Each one was adopted across this repository's own code before shipping; see the [review report](ergonomics-claudefood-report.md) for the measurements.

## `V.variants`: declare a discriminated union once

```ts
import { T } from "machinalayout/concept";
import { V } from "machinalayout/variants";

const Shape = V.variants("Shape", {
  circle: { r: T.number({ min: 0 }) },
  rect: { w: T.number(), h: T.number(), label: T.optional(T.string()) },
  empty: {},
});
type Shape = V.Infer<typeof Shape>;
// | { kind: "circle"; r: number }
// | { kind: "rect"; w: number; h: number; label?: string }
// | { kind: "empty" }

Shape.make.circle({ r: 2 });            // typed constructor; adds `kind`
Shape.make.empty();                      // payload optional when there are no required fields
shapes.filter(Shape.is.circle);          // type guards
Shape.match(shape, {                     // exhaustive (add `_` for a default arm)
  circle: ({ r }) => Math.PI * r * r,
  rect: ({ w, h }) => w * h,
  empty: () => 0,
});
Shape.validate(untrusted);               // discriminant-routed diagnostics with fixes
Shape.accepts(untrusted);                // type guard for untrusted input
Shape.parse(untrusted);                  // or throw ConceptError
T.concept({ id: "Scene", fields: { shapes: T.array(Shape.constraint) } }); // composes, with exact types
```

- `{ key: "type" }` changes the discriminant, and `{ closed: true }` rejects unknown keys in every variant.
- Constructors live under `make` so that a variant named `match` or `parse` can't collide with the API.
- `V.Of<typeof Shape, "circle">` is one variant's type.
- Payloads are concept fields, so this is for concrete data. Unions over generic type parameters (`IterStep<TCursor, …>`) stay plain TypeScript.

## `machinalayout/kit`

```ts
import { invariant, must, withDefaults } from "machinalayout/kit";
```

- **`withDefaults(options, defaults)`** fills defaults, and an explicit `undefined` never overwrites one. `{ ...defaults, ...options }` gets this wrong: `{ includeRoutes: undefined }` silently turns a default-`true` option off. That bug existed twice in this repository. Only keys present in `defaults` are returned.
- **`must(value, message, code?)`** returns `value` narrowed to non-null, or throws `MachinaInvariantError`. `0`, `""` and `false` are values; only `null`/`undefined` throw.
- **`invariant(condition, message, code?)`** asserts and narrows like `if`. The message may be a function, to avoid building strings on the happy path.

Keep throwing your own error classes where callers catch them by type or code (for example `MachinaLayoutError`). `must`/`invariant` are for guard clauses whose only job is to stop.

## `Text.lines` / `Text.list` / `Text.block`

```ts
import { Text } from "machinalayout/text";

return Text.lines(
  `Concept: ${c.id}`,
  c.description && `Description: ${c.description}`,           // omitted when falsy
  Text.list("Fields:", fields, { empty: "Fields: none" }),     // header + "- item" lines
  Text.block("Requires:", formatConceptDescription(required)), // header + indented body
  Text.blank,                                                   // an intentional empty line
);
```

- `false`, `null`, `undefined` and `""` are omitted. `""` is omitted on purpose, because `cond && text` yields `""` for empty strings. Use `Text.blank` for a real blank line.
- Nested arrays flatten, and multi-line strings are split, so indentation applies to every line.
- **Not for data serializers.** In CSV or Markdown table rows, an empty line can be meaningful data. Keep `join("\n")` there.

## `resolveColumnNames`: conventional column options

Table-authoring APIs accept `{ labelColumn?: "title" }`-style options, where key `label` defaults to the column `"label"`. Declare the keys once and derive both the resolver and its type:

```ts
import { type ColumnNames, resolveColumnNames } from "machinalayout/table";

const fieldColumnKeys = ["field", "label", "control"] as const;
type ResolvedFieldColumns = ColumnNames<(typeof fieldColumnKeys)[number]>;

function resolveColumns(options: FieldsFromTableOptions | undefined): ResolvedFieldColumns {
  return resolveColumnNames(options, fieldColumnKeys);
}
```

Options that don't follow the `<key>Column` convention stay explicit next to the spread.
