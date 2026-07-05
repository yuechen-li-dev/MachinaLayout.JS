# Deus async tasks

`machinalayout/async` adds a small explicit async task layer backed by a visible DeusMachina lifecycle.

```txt
async/await hides time.
DeusMachina makes time visible.
```

Or:

```txt
A Promise is a state machine wearing a trench coat.
```

## Why

Raw `Promise` and `async`/`await` are still the substrate.

This module exists for cases where you want the async work to keep its normal Promise ergonomics while also exposing:

- status
- input
- result
- error
- run id
- timestamps
- cancellation signal
- trace

The lifecycle is explicit:

```txt
idle
  -> running
  -> succeeded
  -> failed
  -> cancelled
  -> timedOut
```

DeusMachina backs the lifecycle transitions. `machinalayout/async` does not expose the whole machine API, but it is a real machine-backed controller rather than a loose collection of booleans.

## API

`machinalayout/async` exports:

- `AsyncTask`
- `AsyncTaskContext`
- `AsyncTaskResult`
- `AsyncTaskStatus`
- `AsyncTaskBoard`
- `AsyncTaskSnapshot`
- `AsyncTaskController`
- `AsyncTaskControllerOptions`
- `AsyncTaskDiagnostic`
- `AsyncTaskDescription`
- `AsyncTaskTraceEvent`
- `A.task`
- `A.ok`
- `A.err`
- `A.cancelled`
- `A.timeout`
- `A.createController`
- `A.run`
- `A.describe`
- `A.validate`
- `describeAsyncTask`
- `formatAsyncTaskDescription`
- `validateAsyncTask`
- `formatAsyncTaskDiagnostics`
- `formatAsyncTaskTraceEvent`
- `formatAsyncTaskTrace`

## Task shape

```ts
import { A } from "machinalayout/async";

const formatName = A.task({
  id: "formatName",
  env: { prefix: "User" },
  run: async (env, input: { name: string }) => A.ok(`${env.prefix}: ${input.name}`),
});
```

An async task keeps the same visible-env idea as `machinalayout/capture`, but the runner also receives a lifecycle-aware context:

```ts
type AsyncTaskContext = {
  signal: AbortSignal;
  runId: number;
  startedAt: number;
  now: () => number;
  trace: (event: AsyncTaskTraceEvent) => void;
};
```

## Result union

Results are a discriminated union, so `matchKind` works cleanly:

```ts
import { A } from "machinalayout/async";
import { matchKind } from "machinalayout/match";

const result = await A.run(loadUser, { id: "42" });

const message = matchKind(result, {
  ok: (result) => result.value.name,
  err: (result) => `Error: ${result.error.kind}`,
  cancelled: (result) => `Cancelled: ${result.reason ?? "no reason"}`,
  timeout: (result) => `Timed out after ${result.timeoutMs}ms`,
});
```

## Simple example

```ts
import { A } from "machinalayout/async";

const uppercase = A.task({
  id: "uppercase",
  env: {},
  run: async (_env, input: string) => A.ok(input.toUpperCase()),
});

const result = await A.run(uppercase, "machina");
```

## Fetch-like example

```ts
import { A } from "machinalayout/async";

const loadUser = A.task({
  id: "loadUser",
  env: { baseUrl: "/api" },
  timeoutMs: 5_000,
  run: async (env, input: { id: string }, ctx) => {
    const response = await fetch(`${env.baseUrl}/users/${input.id}`, {
      signal: ctx.signal,
    });

    if (!response.ok) {
      return A.err({ kind: "http", status: response.status });
    }

    return A.ok(await response.json());
  },
});
```

## Controller lifecycle

Use a controller when you want to inspect the lifecycle directly:

```ts
import { A } from "machinalayout/async";

const controller = A.createController(loadUser);

const pending = controller.start({ id: "42" });
const running = controller.getSnapshot();

controller.cancel("navigated away");
const result = await pending;
const finalBoard = controller.getBoard();
```

The controller:

- starts in `idle`
- transitions to `running`
- settles into `succeeded`, `failed`, `cancelled`, or `timedOut`
- exposes `getSnapshot()` and `getBoard()`
- passes `AbortSignal` through `ctx.signal`
- protects against stale completions from older runs

Starting a new run cancels the previous running one with reason `"restarted"`.

## Boundaries

This module does not:

- build a workflow engine
- build a task graph
- add query caching
- add retry policies
- add parallel orchestration
- add React hooks
- add Suspense integration
- replace raw Promises

It is a narrow explicit async task primitive: one task, one visible lifecycle, one inspectable board.

## Trace ownership

The controller owns lifecycle trace events:

- `created`
- `started`
- `resolved`
- `failed`
- `cancelled`
- `timedOut`
- `staleCompletionIgnored`

Task-authored trace events should add domain detail instead of repeating lifecycle state. Use `kind: "domain"` for task-authored notes such as:

- `validated input`
- `computed risk score`
- `prepared persistence payload`
- `received fake persistence response`

Avoid task-authored duplicates like `started`, `resolved`, or `failed` when the controller already records those lifecycle events.

See also: [`samples/toolkit-pipeline`](../samples/toolkit-pipeline) and the [Machina toolkit dogfood report](machina-toolkit-dogfood-report.md) for a backend-style sample that uses async tasks with iterator and concept diagnostics.
