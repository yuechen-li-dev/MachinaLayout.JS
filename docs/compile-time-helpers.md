# Compile-Time Helpers

`machinalayout/comptime` adds a small compile-time helper toolkit for proving useful facts before JavaScript runs.

Core thesis:

> If a fact can be known before JavaScript runs, make TypeScript prove it.

Another framing:

> Compile time should not mean arbitrary wizardry first.
> Compile time should mean useful facts proven before runtime.

This module is intentionally narrow.

## What it is

- Compile-time assertions.
- Literal-preserving runtime helpers.
- Small type-level extraction helpers.
- A practical string helper for kebab-case class and key derivation.

## What it is not

- Not code generation.
- Not macros.
- Not a Babel or TypeScript transformer.
- Not source rewriting.
- Not AST analysis.
- Not arbitrary compile-time execution.
- Not runtime reflection of type-level results.

`"comptime"` is informal shorthand; this documentation uses "compile time."

## Import surface

```ts
import {
  CT,
  type Assert,
  type Equal,
  type Extends,
  type TupleValues,
  type KindValues,
  type KebabCase,
} from "machinalayout/comptime";
```

`machinalayout/comptime` exports:

- `CT.tuple`
- `CT.object`
- `CT.keys`
- `Assert`
- `Extends`
- `Equal`
- `Not`
- `And`
- `Or`
- `ValueOf`
- `KeysOf`
- `TupleValues`
- `DiscriminantValues`
- `KindValues`
- `KebabCase`
- `NonEmptyTuple`
- `IsNonEmptyTuple`

## Literal-preserving helpers

Use `CT` when you want runtime values to preserve literal information without reaching for `as const` everywhere.

```ts
import { CT, type TupleValues } from "machinalayout/comptime";

const modes = CT.tuple("desktop", "tablet", "phone");

type Mode = TupleValues<typeof modes>;
```

`CT.object(...)` preserves literal object shapes:

```ts
const command = CT.object({
  kind: "open",
  target: "settings",
});
```

`CT.keys(...)` returns string keys with a narrowed key type:

```ts
const keys = CT.keys({ header: 1, footer: 2 });
// Array<"header" | "footer">
```

## Compile-time assertions

These helpers keep tests and docs honest without adding runtime behavior:

```ts
type _modeCheck = Assert<
  Equal<TupleValues<typeof modes>, "desktop" | "tablet" | "phone">
>;
```

`Extends<TValue, TExpected>` is useful when checking assignability:

```ts
type _assignable = Assert<Extends<{ id: string }, { id: string }>>;
```

Boolean combinators stay simple:

- `Not<true>` becomes `false`
- `And<[true, true]>` becomes `true`
- `Or<[false, true]>` becomes `true`

## Union and literal extraction

Tuple and object helpers pair with extraction helpers:

```ts
type Mode = TupleValues<typeof modes>;
type Value = ValueOf<{ a: 1; b: 2 }>;
type Key = KeysOf<{ a: 1; b: 2 }>;
```

Discriminated unions are a common target:

```ts
type CanvasCommand =
  | { kind: "move"; dx: number; dy: number }
  | { kind: "erase"; id: string };

type CommandKind = KindValues<CanvasCommand>;
```

For a different discriminant key:

```ts
type ApiMessage =
  | { type: "ready"; payload: null }
  | { type: "error"; payload: string };

type MessageType = DiscriminantValues<ApiMessage, "type">;
```

## String helper

`KebabCase<T>` covers the common camel-case and Pascal-case cases:

```ts
type ClassName = KebabCase<"buttonPrimary">;
// "button-primary"
```

Examples:

- `KebabCase<"buttonPrimary">` -> `"button-primary"`
- `KebabCase<"ButtonPrimary">` -> `"button-primary"`
- `KebabCase<"button">` -> `"button"`

Acronym handling is intentionally simple in M34g.

## Tuple sanity helpers

`NonEmptyTuple<T>` narrows tuple shapes that must contain at least one item:

```ts
type AtLeastOne = NonEmptyTuple<[1, 2]>;
```

`IsNonEmptyTuple<T>` evaluates to `true` or `false` at compile time.

## Relationship to concepts

`machinalayout/concept` includes a few compile-time helpers for concept-oriented generic constraints.
`machinalayout/comptime` is the general compile-time helper toolkit.

Use `concept` when you want runtime concept records and validation.
Use `machinalayout/comptime` when you want useful facts proven before runtime.
