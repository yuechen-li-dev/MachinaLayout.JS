# MachinaDispatch Runtime Guide (D1)

## Purpose

MachinaDispatch is a tiny, pure table-driven event dispatcher for single-field state transitions:

`state + event + dispatch tables -> next state`

Import from the subpath:

```ts
import { defineDispatchTables, dispatchEvent } from "machinalayout/dispatch";
```

## Thesis

MachinaDispatch is not a router, store, middleware layer, or async framework. It only maps event strings to deterministic state updates through columnar tables.

## Dispatch tables

```ts
type AppState = { route: "home" | "settings"; cartCount: number; newOnly: boolean; selectedProduct: string };

const tables = defineDispatchTables<AppState>({
  set: {
    events: ["nav.home", "nav.settings"],
    fields: ["route", "route"],
    values: ["home", "settings"],
  },
  toggle: {
    events: ["filter.new"],
    fields: ["newOnly"],
  },
  increment: {
    events: ["cart.add"],
    fields: ["cartCount"],
    by: [1],
  },
  setSuffix: {
    prefixes: ["product.inspect."],
    fields: ["selectedProduct"],
    allowedSuffixes: [["p1", "p2"]],
  },
});
```

## Operation semantics

Matching order is fixed: `set -> toggle -> increment -> setSuffix -> incrementSuffix`.

- First matching group wins.
- Within each group, first matching row wins.
- No match returns the same state object.

## Error model

Errors throw `MachinaDispatchError` with stable codes:

- `InvalidDispatchTable`
- `InvalidDispatchField`
- `InvalidDispatchValue`
- `InvalidDispatchEvent`

## Immutability

- Never mutates input state or tables.
- Identity-equal updates return the original state reference.
- Changed updates return a shallow copy with one changed field.

## Routing as state assignment

```ts
const next = dispatchEvent({ route: "home" }, "nav.settings", tables);
```

This is state assignment, not URL parsing/history/router trees.

## Composition with MachinaLayout

```ts
const nextState = dispatchEvent(state, event, tables);
const rows = rowsByRoute[nextState.route];
const layout = resolveLayoutRows(rows, rootRect);
```

Dispatch and layout remain decoupled.

## Non-goals

No hooks, composables, browser history, URL parsing, router trees, middleware, subscriptions, async actions/loaders, or global state runtime.
