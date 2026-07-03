# Exhaustive enum matching

MachinaLayout exposes small helpers at `machinalayout/match` for exhaustive matching over finite enum-like values. The intended use is TypeScript string-literal unions, such as UI modes, Deus event or mode helpers, debug overlay behavior, Atlas section kinds, screen tags, and text variants.

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

In that example, TypeScript sees `mode` as any string, so it cannot know the finite set of required cases. Prefer explicit union types for enum-like application concepts.
