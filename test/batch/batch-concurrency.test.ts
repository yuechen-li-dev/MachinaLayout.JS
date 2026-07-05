import { describe, expect, it } from "vitest";
import { matchKind } from "../../src/match";
import * as root from "../../src/index";
import {
  B,
  formatBatchDiagnostics,
  formatBatchTaskDescription,
  formatBatchTrace,
  type BatchTask,
} from "../../src/batch";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("batch authoring and results", () => {
  it("creates a task with visible inputs and returns a fresh object", () => {
    const inputs = [{ value: 1 }, { value: 2 }];
    const map = (input: { value: number }) => B.ok(input.value * 2);
    const input = {
      id: "double",
      inputs,
      map,
      concurrency: 2,
      description: "Double visible inputs.",
    };

    const created = B.task(input);

    expect(created).toEqual({
      kind: "batchTask",
      id: "double",
      inputs,
      map,
      concurrency: 2,
      description: "Double visible inputs.",
    });
    expect(created).not.toBe(input);
    expect(created.inputs).toBe(inputs);
    expect(created.map).toBe(map);
  });

  it("creates result helpers with expected discriminants", () => {
    expect(B.ok("ok")).toEqual({ kind: "ok", value: "ok" });
    expect(B.err({ code: "bad" })).toEqual({ kind: "err", error: { code: "bad" } });
    expect(B.cancel("user")).toEqual({ kind: "cancelled", reason: "user" });
  });
});

describe("batch runner", () => {
  it("processes inputs and preserves input order", async () => {
    const task = B.task({
      id: "double",
      inputs: [1, 2, 3],
      concurrency: 2,
      map: async (value: number) => B.ok(value * 2),
    });

    await expect(B.run(task)).resolves.toMatchObject({
      kind: "ok",
      values: [2, 4, 6],
      board: {
        status: "succeeded",
        inputCount: 3,
        concurrency: 2,
        startedCount: 3,
        completedCount: 3,
        failedCount: 0,
        activeCount: 0,
        scheduler: {
          kind: "promiseWorkQueue",
          workerCount: 2,
          nextIndex: 3,
          maxActiveCount: 2,
        },
      },
    });
  });

  it("keeps output order even when completions arrive out of order", async () => {
    const first = createDeferred<ReturnType<typeof B.ok<string>>>();
    const second = createDeferred<ReturnType<typeof B.ok<string>>>();
    const third = createDeferred<ReturnType<typeof B.ok<string>>>();
    const deferredByInput = new Map([
      [1, first],
      [2, second],
      [3, third],
    ]);

    const pending = B.run(
      B.task({
        id: "outOfOrder",
        inputs: [1, 2, 3],
        concurrency: 3,
        map: (value: number) => deferredByInput.get(value)?.promise ?? B.err("missing"),
      }),
    );

    await flushMicrotasks();
    third.resolve(B.ok("third"));
    second.resolve(B.ok("second"));
    first.resolve(B.ok("first"));

    await expect(pending).resolves.toMatchObject({
      kind: "ok",
      values: ["first", "second", "third"],
      board: {
        scheduler: {
          kind: "promiseWorkQueue",
          workerCount: 3,
          maxActiveCount: 3,
        },
      },
    });
  });

  it("uses a dynamic work queue so faster worker slots pull additional items", async () => {
    const deferreds = [0, 1, 2, 3].map(() => createDeferred<ReturnType<typeof B.ok<number>>>());
    let active = 0;
    let maxActive = 0;
    const started: number[] = [];

    const pending = B.run(
      B.task({
        id: "limited",
        inputs: [0, 1, 2, 3],
        concurrency: 2,
        map: async (value: number) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          started.push(value);
          const result = await deferreds[value]!.promise;
          active -= 1;
          return result;
        },
      }),
    );

    await flushMicrotasks();
    expect(started).toEqual([0, 1]);
    expect(maxActive).toBe(2);

    deferreds[1]!.resolve(B.ok(10));
    await flushMicrotasks();
    expect(started).toEqual([0, 1, 2]);
    expect(maxActive).toBe(2);

    deferreds[0]!.resolve(B.ok(0));
    await flushMicrotasks();
    expect(started).toEqual([0, 1, 2, 3]);
    expect(maxActive).toBe(2);

    deferreds[2]!.resolve(B.ok(20));
    deferreds[3]!.resolve(B.ok(30));
    const result = await pending;
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.values).toEqual([0, 10, 20, 30]);
      expect(result.board.scheduler).toEqual({
        kind: "promiseWorkQueue",
        workerCount: 2,
        nextIndex: 4,
        maxActiveCount: 2,
      });
    }
  });

  it("uses default concurrency when task and options omit it", async () => {
    const result = await B.run(
      B.task({
        id: "defaultConcurrency",
        inputs: [1],
        map: (value: number) => B.ok(value),
      }),
    );

    expect(result.board.concurrency).toBe(4);
  });

  it("lets run options override task concurrency", async () => {
    const result = await B.run(
      B.task({
        id: "overrideConcurrency",
        inputs: [1],
        concurrency: 1,
        map: (value: number) => B.ok(value),
      }),
      { concurrency: 3 },
    );

    expect(result.board.concurrency).toBe(3);
  });

  it("returns ok empty output for empty input", async () => {
    await expect(
      B.run(
        B.task({
          id: "empty",
          inputs: [] as number[],
          map: (value: number) => B.ok(value),
        }),
      ),
    ).resolves.toMatchObject({
      kind: "ok",
      values: [],
      board: {
        status: "succeeded",
        inputCount: 0,
        scheduler: {
          kind: "promiseWorkQueue",
          workerCount: 0,
          nextIndex: 0,
          maxActiveCount: 0,
        },
      },
    });
  });

  it("uses only one worker per input when concurrency exceeds input length", async () => {
    const result = await B.run(
      B.task({
        id: "moreConcurrencyThanInputs",
        inputs: [1, 2],
        concurrency: 10,
        map: (value: number) => B.ok(value * 10),
      }),
    );

    expect(result.kind).toBe("ok");
    expect(result.board.scheduler).toMatchObject({
      kind: "promiseWorkQueue",
      workerCount: 2,
      nextIndex: 2,
      maxActiveCount: 2,
    });
  });

  it("maps thrown mapper errors to err results with failedIndex", async () => {
    const result = await B.run(
      B.task<number, never, Error>({
        id: "throwing",
        inputs: [1, 2, 3],
        map: (value) => {
          if (value === 2) {
            throw new Error("boom");
          }
          return B.ok(value as never);
        },
      }),
    );

    expect(result.kind).toBe("err");
    if (result.kind === "err") {
      expect(result.failedIndex).toBe(1);
      expect(result.error).toBeInstanceOf(Error);
      expect("values" in result).toBe(false);
    }
  });

  it("maps B.err item results to err results and keeps diagnostic board outputs", async () => {
    const result = await B.run(
      B.task<number, string, { code: string }>({
        id: "itemErr",
        inputs: [1, 2, 3],
        concurrency: 1,
        map: (value) => (value === 2 ? B.err({ code: "blocked" }) : B.ok(`ok:${value}`)),
      }),
    );

    expect(result.kind).toBe("err");
    if (result.kind === "err") {
      expect(result.failedIndex).toBe(1);
      expect(result.error).toEqual({ code: "blocked" });
      expect(result.board.status).toBe("failed");
      expect(result.board.outputs).toEqual(["ok:1", undefined, undefined]);
      expect("values" in result).toBe(false);
    }
  });

  it("stops scheduling new items after failure", async () => {
    const deferreds = [0, 1].map(() => createDeferred<ReturnType<typeof B.ok<number>>>());
    const started: number[] = [];

    const pending = B.run(
      B.task<number, number, string>({
        id: "failStopsQueue",
        inputs: [0, 1, 2, 3, 4],
        concurrency: 2,
        map: (value) => {
          started.push(value);
          if (value === 1) {
            return B.err("bad");
          }

          return deferreds[value]?.promise ?? B.ok(value);
        },
      }),
    );

    await flushMicrotasks();
    expect(started).toEqual([0, 1]);
    deferreds[0]!.resolve(B.ok(0));

    const result = await pending;

    expect(result.kind).toBe("err");
    expect(started).toEqual([0, 1]);
    expect(result.board.scheduler?.maxActiveCount).toBeLessThanOrEqual(2);
    expect("values" in result).toBe(false);
  });

  it("does not let in-flight ignored cancellation overwrite the final err result", async () => {
    const slow = createDeferred<ReturnType<typeof B.ok<number>>>();
    const started: number[] = [];

    const pending = B.run(
      B.task<number, number, string>({
        id: "ignoredAbortAfterFailure",
        inputs: [0, 1, 2],
        concurrency: 2,
        map: (value) => {
          started.push(value);
          return value === 1 ? B.err("failed") : slow.promise;
        },
      }),
    );

    await flushMicrotasks();
    expect(started).toEqual([0, 1]);
    slow.resolve(B.ok(0));

    const result = await pending;

    expect(result.kind).toBe("err");
    expect(result.board.outputs).toEqual([undefined, undefined, undefined]);
    expect("values" in result).toBe(false);
  });

  it("cancels from an external AbortSignal and stops scheduling new items", async () => {
    const controller = new AbortController();
    const first = createDeferred<ReturnType<typeof B.ok<number>>>();
    const started: number[] = [];

    const pending = B.run(
      B.task({
        id: "cancelledBatch",
        inputs: [1, 2, 3],
        concurrency: 1,
        map: async (value: number, ctx) => {
          started.push(value);
          expect(ctx.signal).toBeInstanceOf(AbortSignal);
          return first.promise;
        },
      }),
      { signal: controller.signal },
    );

    await flushMicrotasks();
    expect(started).toEqual([1]);

    controller.abort("user");
    first.resolve(B.ok(1));
    const result = await pending;

    expect(result.kind).toBe("cancelled");
    if (result.kind === "cancelled") {
      expect(result.reason).toBe("user");
      expect(result.board.status).toBe("cancelled");
      expect(result.board.cancelReason).toBe("user");
      expect(result.board.scheduler).toMatchObject({
        kind: "promiseWorkQueue",
        workerCount: 1,
        nextIndex: 1,
        maxActiveCount: 1,
      });
      expect(started).toEqual([1]);
    }
  });

  it("avoids unhandled rejections from in-flight work after fail-fast", async () => {
    const slowReject = createDeferred<ReturnType<typeof B.ok<number>>>();
    const started: number[] = [];

    const pending = B.run(
      B.task<number, number, string>({
        id: "inFlightRejectAfterFailure",
        inputs: [0, 1, 2],
        concurrency: 2,
        map: (value) => {
          started.push(value);
          return value === 1 ? B.err("failed") : slowReject.promise;
        },
      }),
    );

    await flushMicrotasks();
    slowReject.reject(new Error("late rejection"));

    const result = await pending;

    expect(result.kind).toBe("err");
    expect(started).toEqual([0, 1]);
    expect(result.board.failedCount).toBe(1);
  });

  it("records success and failure traces", async () => {
    let now = 1000;
    const success = await B.run(
      B.task({
        id: "traceSuccess",
        inputs: [1],
        map: (value: number, ctx) => {
          ctx.trace({
            kind: "itemStarted",
            batchId: "ignored",
            at: 9999,
            index: ctx.index,
            message: `domain ${ctx.input}`,
          });
          return B.ok(value);
        },
      }),
      { now: () => now++ },
    );

    expect(success.board.trace.map((event) => event.kind)).toEqual([
      "created",
      "started",
      "workerStarted",
      "itemStarted",
      "itemStarted",
      "itemSucceeded",
      "queueDrained",
      "succeeded",
    ]);
    expect(formatBatchTrace(success.board.trace)).toContain("traceSuccess[0] itemSucceeded");

    const failure = await B.run(
      B.task({
        id: "traceFailure",
        inputs: [1],
        map: () => B.err("bad"),
      }),
      { now: () => now++ },
    );

    expect(failure.board.trace.map((event) => event.kind)).toEqual([
      "created",
      "started",
      "workerStarted",
      "itemStarted",
      "itemFailed",
      "queueDrained",
      "failed",
    ]);
  });

  it("matches BatchResult with matchKind", async () => {
    const result = await B.run(
      B.task({
        id: "matchBatch",
        inputs: [1, 2],
        map: (value: number) => B.ok(value * 2),
      }),
    );

    const message = matchKind(result, {
      ok: (value) => `Processed ${value.values.length}`,
      err: (value) => `Failed at ${value.failedIndex}`,
      cancelled: (value) => `Cancelled: ${value.reason ?? "unknown"}`,
    });

    expect(message).toBe("Processed 2");
  });
});

describe("batch validation, descriptions, typing, and exports", () => {
  it("validates invalid id, map, inputs, concurrency, and description", () => {
    const diagnostics = B.validate({
      kind: "batchTask",
      id: " ",
      inputs: "nope" as unknown as readonly number[],
      map: "nope" as unknown as BatchTask<number, number>["map"],
      concurrency: 0,
      description: 42 as unknown as string,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "InvalidBatchId",
      "InvalidBatchMap",
      "InvalidBatchInputs",
      "InvalidBatchConcurrency",
      "InvalidBatchDescription",
    ]);
    expect(formatBatchDiagnostics(diagnostics)).toContain("[error] InvalidBatchConcurrency");
  });

  it("describes tasks and formats descriptions", () => {
    const task = B.task({
      id: "describeMe",
      inputs: [1, 2],
      concurrency: 2,
      description: "Describe visible batch work.",
      map: (value: number) => B.ok(value),
    });

    expect(B.describe(task)).toEqual({
      kind: "batchTask",
      id: "describeMe",
      description: "Describe visible batch work.",
      inputCount: 2,
      concurrency: 2,
    });
    expect(formatBatchTaskDescription(B.describe(task))).toContain("Concurrency: 2");
  });

  it("infers output type, error type, and input context", async () => {
    const task = B.task({
      id: "typed",
      inputs: [{ value: 1 }],
      map: async (input: { value: number }, ctx) => {
        const index: number = ctx.index;
        const signal: AbortSignal = ctx.signal;
        void index;
        void signal;
        return input.value > 0 ? B.ok({ doubled: input.value * 2 }) : B.err({ code: "bad" });
      },
    });

    const result = await B.run(task);
    const typed:
      | {
          kind: "ok";
          values: readonly { doubled: number }[];
        }
      | {
          kind: "err";
          error: { code: string };
          failedIndex: number;
        }
      | {
          kind: "cancelled";
          reason?: string;
        } = result;

    // @ts-expect-error input value must be numeric
    const invalidInput: Parameters<typeof task.map>[0] = { value: "nope" };
    task.map(invalidInput, {
      index: 0,
      input: { value: 1 },
      batchId: task.id,
      signal: new AbortController().signal,
      trace: () => {},
    });

    expect(typed.kind).toBe("ok");
  });

  it("exports batch helpers only from the batch subpath", () => {
    expect(B.task).toBeTypeOf("function");
    expect(B.run).toBeTypeOf("function");
    expect(B.ok).toBeTypeOf("function");
    expect(B.err).toBeTypeOf("function");
    expect("B" in root).toBe(false);
  });
});
