# Exhaustive match helpers

MachinaLayout exposes small helpers at `machinalayout/match` for exhaustive matching over finite case sets. The intended use is TypeScript string-literal unions, discriminated payload unions, UI modes, command kinds, node kinds, screen tags, and other frontend cases where exhaustiveness matters.

This is a library substitute for common `if` and `switch` chains. It is not language syntax, structural pattern matching, destructuring match, algebraic data type matching, or Copeland.

## `matchEnum`

Use `matchEnum` when each enum case should run a handler.

```ts
import { matchEnum } from "machinalayout/match";

type Mode = "collapsed" | "nonInteractiveOverlay" | "interactivePanel";

const label = matchEnum<Mode, string>(mode, {
  collapsed: () => "Collapsed",
  nonInteractiveOverlay: () => "Overlay",
  interactivePanel: () => "Panel",
});
```

When the value type is a literal union, TypeScript requires every key:

```ts
matchEnum<Mode, string>(mode, {
  collapsed: () => "Collapsed",
  nonInteractiveOverlay: () => "Overlay",
  // interactivePanel missing => TypeScript error
});
```

At runtime, a missing case throws `MatchEnumError` with `code: "MissingEnumCase"`. Handler errors are not swallowed.

## Payload union matching

Use `matchKind` for `{ kind: ... }` payload unions where the handler needs the narrowed payload.

```ts
import { matchKind } from "machinalayout/match";

type Result =
  | { kind: "ok"; value: number }
  | { kind: "err"; message: string };

const text = matchKind(result, {
  ok: (result) => `value ${result.value}`,
  err: (result) => `error ${result.message}`,
});
```

Adding a new union member requires adding a new handler. The cases are exhaustive over the discriminant values in the union.

## `matchDiscriminated`

Use `matchDiscriminated` when the discriminator key is something other than `kind`, such as `type`.

```ts
import { matchDiscriminated } from "machinalayout/match";

type Event =
  | { type: "click"; x: number; y: number }
  | { type: "submit"; formId: string };

const output = matchDiscriminated(event, "type", {
  click: (event) => `${event.x},${event.y}`,
  submit: (event) => event.formId,
});
```

At runtime, unchecked JavaScript or external data can still carry an unknown discriminant. In that case `matchKind` and `matchDiscriminated` throw `MatchUnionError`, which includes the discriminant key, the received discriminant value, and the available cases.

## `enumTable`

Use `enumTable` when each enum case maps to a value.

```ts
import { enumTable } from "machinalayout/match";

type Mode = "collapsed" | "nonInteractiveOverlay" | "interactivePanel";
type Behavior = {
  visible: boolean;
  pointerEvents: "none" | "auto";
};

const behaviorByMode = enumTable<Mode, Behavior>({
  collapsed: {
    visible: false,
    pointerEvents: "none",
  },
  nonInteractiveOverlay: {
    visible: true,
    pointerEvents: "none",
  },
  interactivePanel: {
    visible: true,
    pointerEvents: "auto",
  },
});

const behavior = behaviorByMode[mode];
```

`enumTable` returns a shallow copy of the table. Treat the returned table values as immutable application data.

## `assertNever`

Use `assertNever` for traditional `switch` statements.

```ts
import { assertNever } from "machinalayout/match";

switch (mode) {
  case "collapsed":
    return "Collapsed";
  case "nonInteractiveOverlay":
    return "Overlay";
  case "interactivePanel":
    return "Panel";
  default:
    return assertNever(mode);
}
```

## TypeScript limitation

Exhaustiveness depends on the value type being a literal union, not plain `string`.

```ts
declare const mode: string;

matchEnum(mode, {
  collapsed: () => "Collapsed",
});
```

In that example, TypeScript sees `mode` as any string, so it cannot know the finite set of required cases. The same applies to discriminated unions whose discriminant is widened to `string`. Prefer explicit union types for enum-like and tagged-union application concepts.
