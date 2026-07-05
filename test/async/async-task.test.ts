import { describe, expect, it, vi } from "vitest";
import { matchKind } from "../../src/match";
import * as root from "../../src/index";
import {
  A,
  formatAsyncTaskDescription,
  formatAsyncTaskDiagnostics,
  formatAsyncTaskTrace,
  type AsyncTask,
} from "../../src/async";

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

describe("async task authoring", () => {
  it("creates an async task with visible env and returns a fresh object", () => {
    const env = { prefix: "item" };
    const run = async (_env: typeof env, input: string) => A.ok(`${env.prefix}:${input}`);
    const input = {
      id: "labelItem",
      env,
      run,
      description: "Label an item asynchronously.",
      timeoutMs: 250,
    };

    const created = A.task(input);

    expect(created).toEqual({
      kind: "asyncTask",
      id: "labelItem",
      env,
      run,
      description: "Label an item asynchronously.",
      timeoutMs: 250,
    });
    expect(created).not.toBe(input);
    expect(created.env).toBe(env);
    expect(created.run).toBe(run);
  });

  it("creates result helpers with expected discriminants", () => {
    expect(A.ok("ok")).toEqual({ kind: "ok", value: "ok" });
    expect(A.err({ code: 500 })).toEqual({ kind: "err", error: { code: 500 } });
    expect(A.cancelled("stop")).toEqual({ kind: "cancelled", reason: "stop" });
    expect(A.timeout(42)).toEqual({ kind: "timeout", timeoutMs: 42 });
  });

  it("runs a task once with A.run and returns ok", async () => {
    const task = A.task({
      id: "uppercase",
      env: {},
      run: async (_env, input: string) => A.ok(input.toUpperCase()),
    });

    await expect(A.run(task, "machina")).resolves.toEqual({
      kind: "ok",
      value: "MACHINA",
    });
  });

  it("runs a task once with A.run and returns err", async () => {
    const task = A.task({
      id: "rejectWord",
      env: {},
      run: async () => A.err({ kind: "blocked" as const }),
    });

    await expect(A.run(task, "ignored")).resolves.toEqual({
      kind: "err",
      error: { kind: "blocked" },
    });
  });
});

describe("async task controller lifecycle", () => {
  it("starts idle and exposes an initial snapshot", () => {
    const controller = A.createController(
      A.task({
        id: "noop",
        env: {},
        run: async () => A.ok("done"),
      }),
      { now: () => 1000 },
    );

    expect(controller.getBoard()).toEqual({
      taskId: "noop",
      status: "idle",
      runId: 0,
      trace: [
        {
          kind: "created",
          taskId: "noop",
          runId: 0,
          at: 1000,
        },
      ],
    });
    expect(controller.getSnapshot().statePath).toEqual(["idle"]);
  });

  it("transitions from running to succeeded and records board facts", async () => {
    let now = 1000;
    const deferred = createDeferred<ReturnType<typeof A.ok<{ name: string }>>>();
    const controller = A.createController(
      A.task({
        id: "loadUser",
        env: {},
        run: async (_env, _input: { id: string }, ctx) => {
          expect(ctx.runId).toBe(1);
          expect(ctx.startedAt).toBe(1000);
          expect(ctx.signal).toBeInstanceOf(AbortSignal);
          expect(ctx.now).toBeTypeOf("function");
          return deferred.promise;
        },
      }),
      { now: () => now },
    );

    const pending = controller.start({ id: "42" });
    expect(controller.getSnapshot().statePath).toEqual(["running"]);
    expect(controller.getBoard()).toEqual({
      taskId: "loadUser",
      status: "running",
      runId: 1,
      input: { id: "42" },
      startedAt: 1000,
      signal: controller.getBoard().signal,
      trace: [
        { kind: "created", taskId: "loadUser", runId: 0, at: 1000 },
        { kind: "started", taskId: "loadUser", runId: 1, at: 1000 },
      ],
    });

    now = 1250;
    deferred.resolve(A.ok({ name: "Ada" }));
    await expect(pending).resolves.toEqual({
      kind: "ok",
      value: { name: "Ada" },
    });

    expect(controller.getSnapshot().statePath).toEqual(["succeeded"]);
    expect(controller.getBoard()).toEqual({
      taskId: "loadUser",
      status: "succeeded",
      runId: 1,
      input: { id: "42" },
      result: { name: "Ada" },
      startedAt: 1000,
      finishedAt: 1250,
      trace: [
        { kind: "created", taskId: "loadUser", runId: 0, at: 1000 },
        { kind: "started", taskId: "loadUser", runId: 1, at: 1000 },
        { kind: "resolved", taskId: "loadUser", runId: 1, at: 1250 },
      ],
    });
  });

  it("maps rejected promises to failed results", async () => {
    let now = 1000;
    const controller = A.createController(
      A.task<object, string, never, Error>({
        id: "explode",
        env: {},
        run: async () => {
          throw new Error("boom");
        },
      }),
      { now: () => now },
    );

    now = 1111;
    await expect(controller.start("x")).resolves.toMatchObject({
      kind: "err",
      error: expect.objectContaining({ message: "boom" }),
    });
    expect(controller.getSnapshot().statePath).toEqual(["failed"]);
    expect(controller.getBoard().error).toBeInstanceOf(Error);
  });

  it("cancels a running task, aborts the signal, and preserves the reason", async () => {
    let now = 1000;
    const deferred = createDeferred<ReturnType<typeof A.ok<string>>>();
    let signal!: AbortSignal;
    const controller = A.createController(
      A.task({
        id: "listen",
        env: {},
        run: async (_env, _input: string, ctx) => {
          signal = ctx.signal;
          return deferred.promise;
        },
      }),
      { now: () => now },
    );

    const pending = controller.start("hello");
    await flushMicrotasks();
    expect(signal.aborted).toBe(false);

    now = 1100;
    controller.cancel("user");
    await expect(pending).resolves.toEqual({
      kind: "cancelled",
      reason: "user",
    });
    expect(signal.aborted).toBe(true);
    expect(controller.getSnapshot().statePath).toEqual(["cancelled"]);
    expect(controller.getBoard()).toEqual({
      taskId: "listen",
      status: "cancelled",
      runId: 1,
      input: "hello",
      cancelReason: "user",
      startedAt: 1000,
      finishedAt: 1100,
      trace: [
        { kind: "created", taskId: "listen", runId: 0, at: 1000 },
        { kind: "started", taskId: "listen", runId: 1, at: 1000 },
        { kind: "cancelled", taskId: "listen", runId: 1, at: 1100, message: "user" },
      ],
    });
  });

  it("times out a running task and transitions to timedOut", async () => {
    vi.useFakeTimers();
    try {
      let now = 1000;
      const deferred = createDeferred<ReturnType<typeof A.ok<string>>>();
      let signal!: AbortSignal;
      const controller = A.createController(
        A.task({
          id: "slow",
          env: {},
          timeoutMs: 25,
          run: async (_env, _input: string, ctx) => {
            signal = ctx.signal;
            return deferred.promise;
          },
        }),
        { now: () => now },
      );

      const pending = controller.start("wait");
      await flushMicrotasks();
      now = 1025;
      await vi.advanceTimersByTimeAsync(25);

      await expect(pending).resolves.toEqual({
        kind: "timeout",
        timeoutMs: 25,
      });
      expect(signal.aborted).toBe(true);
      expect(controller.getSnapshot().statePath).toEqual(["timedOut"]);
      expect(controller.getBoard().timeoutMs).toBe(25);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels the previous run as restarted when a second run starts", async () => {
    const first = createDeferred<ReturnType<typeof A.ok<string>>>();
    const second = createDeferred<ReturnType<typeof A.ok<string>>>();
    let calls = 0;
    const controller = A.createController(
      A.task({
        id: "restartable",
        env: {},
        run: async () => {
          calls += 1;
          return calls === 1 ? first.promise : second.promise;
        },
      }),
      { now: () => 1000 + calls * 100 },
    );

    const pendingFirst = controller.start("a");
    const pendingSecond = controller.start("b");

    await expect(pendingFirst).resolves.toEqual({
      kind: "cancelled",
      reason: "restarted",
    });

    second.resolve(A.ok("second"));
    await expect(pendingSecond).resolves.toEqual({
      kind: "ok",
      value: "second",
    });
    expect(controller.getBoard().input).toBe("b");
    expect(controller.getBoard().result).toBe("second");
  });

  it("ignores stale completion from an older run and traces it", async () => {
    let now = 1000;
    const first = createDeferred<ReturnType<typeof A.ok<string>>>();
    const second = createDeferred<ReturnType<typeof A.ok<string>>>();
    let calls = 0;
    const controller = A.createController(
      A.task({
        id: "stale",
        env: {},
        run: async () => {
          calls += 1;
          return calls === 1 ? first.promise : second.promise;
        },
      }),
      { now: () => now },
    );

    const pendingFirst = controller.start("a");
    now = 1010;
    const pendingSecond = controller.start("b");
    await expect(pendingFirst).resolves.toEqual({
      kind: "cancelled",
      reason: "restarted",
    });

    now = 1020;
    first.resolve(A.ok("old"));
    await flushMicrotasks();

    now = 1030;
    second.resolve(A.ok("new"));
    await expect(pendingSecond).resolves.toEqual({
      kind: "ok",
      value: "new",
    });

    expect(controller.getBoard().result).toBe("new");
    expect(controller.getBoard().trace).toContainEqual({
      kind: "staleCompletionIgnored",
      taskId: "stale",
      runId: 1,
      at: 1020,
      message: "Completion arrived after the run was no longer current.",
    });
  });

  it("supports task-authored domain trace events without reusing lifecycle kinds", async () => {
    const now = 1000;
    const controller = A.createController(
      A.task({
        id: "traceable",
        env: {},
        run: async (_env, input: string, ctx) => {
          ctx.trace({
            kind: "domain",
            taskId: "ignored",
            runId: 999,
            at: now + 5,
            message: `validated input ${input}`,
          });
          return A.ok(input.toUpperCase());
        },
      }),
      { now: () => now },
    );

    await expect(controller.start("ada")).resolves.toEqual({
      kind: "ok",
      value: "ADA",
    });
    expect(controller.getBoard().trace).toContainEqual({
      kind: "domain",
      taskId: "traceable",
      runId: 1,
      at: 1005,
      message: "validated input ada",
    });
  });

  it("returns no-op cancel outside the running state", () => {
    const controller = A.createController(
      A.task({
        id: "noopCancel",
        env: {},
        run: async () => A.ok("done"),
      }),
      { now: () => 1000 },
    );

    controller.cancel("ignored");

    expect(controller.getBoard().trace).toEqual([
      {
        kind: "created",
        taskId: "noopCancel",
        runId: 0,
        at: 1000,
      },
    ]);
  });

  it("matches AsyncTaskResult with matchKind", async () => {
    const task = A.task({
      id: "loadUser",
      env: {},
      run: async () => A.ok({ id: "42", name: "Ada" }),
    });
    const result = await A.run(task, {});

    const message = matchKind(result, {
      ok: (value) => value.value.name,
      err: (value) => `Error: ${String(value.error)}`,
      cancelled: (value) => `Cancelled: ${value.reason ?? "no reason"}`,
      timeout: (value) => `Timed out after ${value.timeoutMs}ms`,
    });

    expect(message).toBe("Ada");
  });
});

describe("async task description, validation, typing, and exports", () => {
  it("describes async tasks without serializing env values", () => {
    const task = A.task({
      id: "loadProfile",
      env: { baseUrl: "/api", token: "secret" },
      timeoutMs: 500,
      description: "Load a user profile.",
      run: async () => A.ok("ok"),
    });

    expect(A.describe(task)).toEqual({
      kind: "asyncTask",
      id: "loadProfile",
      description: "Load a user profile.",
      envKeys: ["baseUrl", "token"],
      hasRun: true,
      timeoutMs: 500,
    });
    expect(formatAsyncTaskDescription(A.describe(task))).toContain("Timeout: 500ms");
  });

  it("validates invalid id, run, timeout, and description", () => {
    const diagnostics = A.validate({
      kind: "asyncTask",
      id: " ",
      env: {},
      run: "nope" as unknown as AsyncTask<object, string, string, string>["run"],
      timeoutMs: 0,
      description: 42 as unknown as string,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "InvalidAsyncTaskId",
      "InvalidAsyncTaskRun",
      "InvalidAsyncTaskTimeout",
      "InvalidAsyncTaskDescription",
    ]);
    expect(formatAsyncTaskDiagnostics(diagnostics)).toContain("[error] InvalidAsyncTaskTimeout");
  });

  it("formats traces readably", () => {
    const formatted = formatAsyncTaskTrace([
      {
        kind: "domain",
        taskId: "fetchUser",
        runId: 3,
        at: 1500,
        message: "computed risk score",
      },
    ]);

    expect(formatted).toContain("fetchUser#3 domain @ 1500");
  });

  it("infers input, output, error, and context signal types", async () => {
    const loadUser = A.task({
      id: "loadUser",
      env: { baseUrl: "/api" },
      run: async (env, input: { id: string }, ctx) => {
        const url: string = `${env.baseUrl}/users/${input.id}`;
        const signal: AbortSignal = ctx.signal;
        void url;
        void signal;
        return A.err({ kind: "http" as const, status: 404 });
      },
    });

    const result = await A.run(loadUser, { id: "42" });
    const typed:
      | { kind: "ok"; value: { id: string; name: string } }
      | { kind: "err"; error: { kind: "http"; status: number } }
      | { kind: "cancelled"; reason?: string }
      | { kind: "timeout"; timeoutMs: number } = result;

    // @ts-expect-error input must include id
    A.run(loadUser, {});

    expect(typed.kind).toBe("err");
  });

  it("exports async helpers only from the async subpath", () => {
    expect(A.task).toBeTypeOf("function");
    expect(A.run).toBeTypeOf("function");
    expect(A.createController).toBeTypeOf("function");
    expect("A" in root).toBe(false);
  });
});
