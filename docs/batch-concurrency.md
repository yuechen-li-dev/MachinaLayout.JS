# Batch Concurrency

`machinalayout/batch` exposes ordered async batch mapping with explicit concurrency, cancellation,
progress board state, and trace.

```txt
Promise.all hides the scheduler.
MachinaBatch exposes the scheduler.
```

M34n uses a Promise-backed scheduler. It limits how many async mappers are active at once, but it
does not provide CPU parallelism, Web Workers, Node `worker_threads`, work stealing, retries, or
workflow orchestration. Worker and work-stealing backends are future work.

## Model

A batch is:

```txt
map + join + ordering + failure semantics
```

`B.run` maps one input to one item result. On success, output order always matches input order, even
when items complete out of order.

```ts
import { B } from "machinalayout/batch";

const task = B.task({
  id: "double",
  inputs: [1, 2, 3],
  concurrency: 2,
  map: async (value: number) => B.ok(value * 2),
});

const result = await B.run(task);

if (result.kind === "ok") {
  const values: readonly number[] = result.values;
}
```

`options.concurrency` overrides `task.concurrency`; if neither is provided, the default is `4`.
Concurrency must be a positive finite integer.

## Fail Fast

M34n implements fail-fast batch semantics. If a mapper throws, rejects, or returns `B.err`, the batch
fails. New items are not scheduled, the internal `AbortSignal` is aborted, and the final result does
not expose successful values as a completed output.

```ts
const task = B.task({
  id: "fail-fast",
  inputs: ["a", "b", "c"],
  concurrency: 1,
  map: (value: string) => (value === "b" ? B.err({ code: "blocked" }) : B.ok(value)),
});

const result = await B.run(task);

if (result.kind === "err") {
  result.failedIndex; // 1
  result.board.outputs; // diagnostic partial state, not successful output
}
```

The board may include partial `outputs` for diagnostics. Treat those as progress/debug state, not as
the successful joined output of the batch.

## Cancellation

Pass an external `AbortSignal` to cancel a run. Cancellation stops scheduling new items and aborts
the internal signal exposed to each mapper.

```ts
const controller = new AbortController();

const pending = B.run(task, {
  signal: controller.signal,
});

controller.abort("user");
const result = await pending;
```

## Matching Results

Batch results are discriminated by `kind`, so they work with `machinalayout/match`.

```ts
import { matchKind } from "machinalayout/match";

const message = matchKind(result, {
  ok: (value) => `Processed ${value.values.length}`,
  err: (value) => `Failed at ${value.failedIndex}`,
  cancelled: (value) => `Cancelled: ${value.reason ?? "unknown"}`,
});
```

## Toolkit Pipeline

[`samples/toolkit-pipeline`](../samples/toolkit-pipeline) uses `I.machine` for raw record traversal
and `B.task` plus `B.run` for concurrent enrichment of valid orders. Its checked-in report includes
batch status, input count, concurrency, completed count, trace count, and result kind.
