# Explicit iterators

`machinalayout/iter` adds a small explicit iterator-machine surface for cases where sequence state matters.

Yield hides the cursor.
MachinaIter exposes the cursor.

A generator is a state machine with a secret program counter.
MachinaIter makes the program counter data.

Native generators and `for...of` are still fine for simple local loops. Reach for `machinalayout/iter` when iteration needs visible state, inspectable progress, traceable transitions, or tests that assert cursor movement directly.

Good fits:

- export pipelines
- static artifact generation
- pagination
- command replay
- validation diagnostics
- timeline or frame generation
- batch transforms
- LLM tool workflows

## What it exports

Import from the subpath:

```ts
import { I } from "machinalayout/iter";
```

`machinalayout/iter` exports:

- `IterMachine`
- `IterStep`
- `IterNext`
- `IterController`
- `IterBoard`
- `IterStatus`
- `IterSnapshot`
- `IterCollectOptions`
- `IterCollectResult`
- `IterDiagnostic`
- `IterMachineDescription`
- `IterTraceEvent`
- `I.machine`
- `I.yield`
- `I.done`
- `I.fail`
- `I.createController`
- `I.next`
- `I.collect`
- `I.reset`
- `I.describe`
- `I.validate`
- `formatIterMachineDescription`
- `formatIterDiagnostics`
- `formatIterTraceEvent`
- `formatIterTrace`

The controller surface is synchronous and explicit:

- `next()` advances one visible step
- `collect()` repeatedly advances with max-step protection
- `reset()` restores the machine to idle with a chosen cursor
- `getBoard()` exposes visible cursor, yield count, last yield, terminal value or error, and trace
- `getSnapshot()` exposes `statePath` plus the board

## Counter example

```ts
import { I } from "machinalayout/iter";

const counter = I.machine({
  id: "counter",
  env: { max: 3 },
  initial: { value: 1 },
  step: (env, cursor: { value: number }) => {
    if (cursor.value > env.max) {
      return I.done("complete");
    }

    return I.yield(cursor.value, {
      value: cursor.value + 1,
    });
  },
});

const controller = I.createController(counter);

controller.next();
// { kind: "yield", value: 1, done: false }

controller.getBoard();
// {
//   machineId: "counter",
//   status: "yielded",
//   cursor: { value: 2 },
//   yieldCount: 1,
//   lastYield: 1,
//   trace: [...]
// }
```

The cursor is never hidden. Tests can assert it directly, and diagnostics can display it without reverse-engineering a generator frame.

## Pagination-ish cursor example

```ts
import { I } from "machinalayout/iter";

const pages = I.machine({
  id: "pages",
  env: {
    responses: [
      { items: ["a", "b"], nextPage: 2 },
      { items: ["c"], nextPage: undefined },
    ],
  },
  initial: { page: 1 },
  step: (env, cursor: { page: number }) => {
    const response = env.responses[cursor.page - 1];
    if (!response) {
      return I.done({ count: 0 });
    }

    if (response.nextPage === undefined) {
      return I.done({ count: response.items.length });
    }

    return I.yield(response.items, {
      page: response.nextPage,
    });
  },
});
```

This style keeps the cursor visible as plain data, which is useful when the current page token is part of the observable workflow.

## Static artifact generator example

```ts
import { I } from "machinalayout/iter";

const files = I.machine({
  id: "staticFiles",
  env: {
    artifacts,
  },
  initial: { index: 0 },
  step: (env, cursor: { index: number }) => {
    if (cursor.index >= env.artifacts.length) {
      return I.done({ count: env.artifacts.length });
    }

    return I.yield(env.artifacts[cursor.index], {
      index: cursor.index + 1,
    });
  },
});
```

This is often easier to inspect than a generator because the export position is part of the board:

- current cursor
- number of yielded artifacts
- last yielded artifact
- terminal value or error
- full trace of created, started, yielded, done, failed, and reset events

## `matchKind` works cleanly

`IterNext` and `IterStep` are discriminated unions, so `machinalayout/match` works naturally:

```ts
import { I } from "machinalayout/iter";
import { matchKind } from "machinalayout/match";

const controller = I.createController(counter);

const text = matchKind(controller.next(), {
  yield: (result) => `yielded ${result.value}`,
  done: (result) => `done ${result.value}`,
  fail: (result) => `failed ${String(result.error)}`,
});
```

## Validation and description

Like `machinalayout/capture` and `machinalayout/async`, iterator machines can be described and validated without serializing env values:

```ts
const description = I.describe(counter);
const diagnostics = I.validate(counter);
```

Descriptions expose:

- `kind`
- `id`
- optional `description`
- `envKeys`
- `hasStep`

Validation currently checks:

- non-empty id
- step is a function
- description is a string when present

## Safety against accidental infinite loops

`collect()` defaults to `maxSteps: 10_000`. That means an accidentally non-terminating machine yields a stable limit result instead of hanging forever:

```ts
const result = controller.collect();
// { kind: "limit", values: [...], maxSteps: 10000 }
```

That default keeps the blade narrow and practical for diagnostics, artifact generation, and scripted workflows without growing into a general stream framework.

See also: [`samples/toolkit-pipeline`](../samples/toolkit-pipeline) and the [Machina toolkit dogfood report](machina-toolkit-dogfood-report.md) for a batch-processing sample that uses iterator machines in a backend-style pipeline.
