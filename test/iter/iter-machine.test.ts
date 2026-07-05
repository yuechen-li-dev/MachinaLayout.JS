import { describe, expect, it } from "vitest";
import { matchKind } from "../../src/match";
import * as root from "../../src/index";
import {
  formatIterDiagnostics,
  formatIterMachineDescription,
  formatIterTrace,
  type IterMachine,
  I,
} from "../../src/iter";

describe("iter machine authoring and results", () => {
  it("creates a machine with visible env and returns a fresh object", () => {
    const env = { max: 2 };
    const step = (taskEnv: typeof env, cursor: { value: number }) =>
      taskEnv.max < cursor.value
        ? I.done("done")
        : I.yield(cursor.value, { value: cursor.value + 1 });
    const input = {
      id: "counter",
      env,
      initial: { value: 1 },
      step,
      description: "Count upward with a visible cursor.",
    };

    const created = I.machine(input);

    expect(created).toEqual({
      kind: "iterMachine",
      id: "counter",
      env,
      initial: { value: 1 },
      step,
      description: "Count upward with a visible cursor.",
    });
    expect(created).not.toBe(input);
    expect(created.env).toBe(env);
    expect(created.step).toBe(step);
  });

  it("creates yield, done, and fail step helpers", () => {
    expect(I.yield("a", { index: 1 })).toEqual({
      kind: "yield",
      value: "a",
      cursor: { index: 1 },
    });
    expect(I.done("complete")).toEqual({
      kind: "done",
      value: "complete",
    });
    expect(I.fail({ code: "bad" })).toEqual({
      kind: "fail",
      error: { code: "bad" },
    });
  });
});

describe("iter controller lifecycle", () => {
  function createCounter() {
    return I.machine({
      id: "counter",
      env: { max: 3 },
      initial: { value: 1 },
      description: "Yield values until the cursor passes max.",
      step: (env, cursor: { value: number }) => {
        if (cursor.value > env.max) {
          return I.done("complete");
        }

        return I.yield(cursor.value, {
          value: cursor.value + 1,
        });
      },
    });
  }

  it("starts idle with the initial cursor and created trace", () => {
    const controller = I.createController(createCounter());

    expect(controller.getBoard()).toEqual({
      machineId: "counter",
      status: "idle",
      cursor: { value: 1 },
      yieldCount: 0,
      trace: [
        {
          kind: "created",
          machineId: "counter",
          iteration: 0,
          cursor: { value: 1 },
        },
      ],
    });
    expect(controller.getSnapshot().statePath).toEqual(["idle"]);
  });

  it("next yields values and updates cursor, yieldCount, and lastYield", () => {
    const controller = I.createController(createCounter());

    expect(controller.next()).toEqual({
      kind: "yield",
      value: 1,
      done: false,
    });
    expect(controller.getSnapshot().statePath).toEqual(["yielded"]);
    expect(controller.getBoard()).toEqual({
      machineId: "counter",
      status: "yielded",
      cursor: { value: 2 },
      yieldCount: 1,
      lastYield: 1,
      trace: [
        {
          kind: "created",
          machineId: "counter",
          iteration: 0,
          cursor: { value: 1 },
        },
        {
          kind: "started",
          machineId: "counter",
          iteration: 1,
          cursor: { value: 1 },
        },
        {
          kind: "yielded",
          machineId: "counter",
          iteration: 1,
          cursor: { value: 2 },
          yielded: 1,
        },
      ],
    });
  });

  it("repeated next calls reach done and return a stable terminal result", () => {
    const controller = I.createController(createCounter());

    expect(controller.next().kind).toBe("yield");
    expect(controller.next().kind).toBe("yield");
    expect(controller.next().kind).toBe("yield");

    const done = controller.next();
    expect(done).toEqual({
      kind: "done",
      value: "complete",
      done: true,
    });
    expect(controller.next()).toBe(done);
    expect(controller.getSnapshot().statePath).toEqual(["done"]);
    expect(controller.getBoard()).toMatchObject({
      machineId: "counter",
      status: "done",
      cursor: { value: 4 },
      yieldCount: 3,
      lastYield: 3,
      returnValue: "complete",
    });
  });

  it("supports explicit fail results", () => {
    const controller = I.createController(
      I.machine({
        id: "failing",
        env: {},
        initial: { index: 0 },
        step: () => I.fail({ code: "blocked" as const }),
      }),
    );

    expect(controller.next()).toEqual({
      kind: "fail",
      error: { code: "blocked" },
      done: true,
    });
    expect(controller.getSnapshot().statePath).toEqual(["failed"]);
    expect(controller.getBoard()).toMatchObject({
      status: "failed",
      error: { code: "blocked" },
    });
  });

  it("maps thrown step errors to fail results", () => {
    const controller = I.createController(
      I.machine<object, { index: number }, never, never, Error>({
        id: "throwing",
        env: {},
        initial: { index: 0 },
        step: () => {
          throw new Error("boom");
        },
      }),
    );

    const result = controller.next();
    expect(result.kind).toBe("fail");
    if (result.kind !== "fail") {
      expect.unreachable("expected thrown step to fail");
    }
    expect(result.done).toBe(true);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe("boom");
    expect(controller.getSnapshot().statePath).toEqual(["failed"]);
  });

  it("reset returns to idle and restores the initial cursor", () => {
    const controller = I.createController(createCounter());

    controller.next();
    controller.next();
    controller.reset();

    expect(controller.getSnapshot().statePath).toEqual(["idle"]);
    expect(controller.getBoard()).toEqual({
      machineId: "counter",
      status: "idle",
      cursor: { value: 1 },
      yieldCount: 0,
      trace: [
        {
          kind: "created",
          machineId: "counter",
          iteration: 0,
          cursor: { value: 1 },
        },
        {
          kind: "started",
          machineId: "counter",
          iteration: 1,
          cursor: { value: 1 },
        },
        {
          kind: "yielded",
          machineId: "counter",
          iteration: 1,
          cursor: { value: 2 },
          yielded: 1,
        },
        {
          kind: "started",
          machineId: "counter",
          iteration: 2,
          cursor: { value: 2 },
        },
        {
          kind: "yielded",
          machineId: "counter",
          iteration: 2,
          cursor: { value: 3 },
          yielded: 2,
        },
        {
          kind: "reset",
          machineId: "counter",
          iteration: 0,
          cursor: { value: 1 },
        },
      ],
    });
  });

  it("reset accepts a custom cursor", () => {
    const controller = I.createController(createCounter());

    controller.next();
    I.reset(controller, { value: 3 });

    expect(controller.getBoard().cursor).toEqual({ value: 3 });
    expect(controller.getBoard().status).toBe("idle");
  });

  it("collect returns all yielded values on done", () => {
    const controller = I.createController(createCounter());

    expect(controller.collect()).toEqual({
      kind: "done",
      values: [1, 2, 3],
      value: "complete",
    });
  });

  it("collect returns fail with yielded values", () => {
    const controller = I.createController(
      I.machine({
        id: "yieldThenFail",
        env: {},
        initial: { index: 0 },
        step: (_env, cursor: { index: number }) => {
          if (cursor.index === 0) {
            return I.yield("first", { index: 1 });
          }

          return I.fail("stopped");
        },
      }),
    );

    expect(I.collect(controller)).toEqual({
      kind: "fail",
      values: ["first"],
      error: "stopped",
    });
  });

  it("collect returns limit when maxSteps is reached", () => {
    const controller = I.createController(
      I.machine({
        id: "infinite",
        env: {},
        initial: { index: 0 },
        step: (_env, cursor: { index: number }) =>
          I.yield(cursor.index, { index: cursor.index + 1 }),
      }),
    );

    expect(controller.collect({ maxSteps: 3 })).toEqual({
      kind: "limit",
      values: [0, 1, 2],
      maxSteps: 3,
    });
  });

  it("default collect maxSteps prevents infinite loops", () => {
    const controller = I.createController(
      I.machine({
        id: "infinite-default",
        env: {},
        initial: { index: 0 },
        step: (_env, cursor: { index: number }) =>
          I.yield(cursor.index, { index: cursor.index + 1 }),
      }),
    );

    const result = controller.collect();
    expect(result.kind).toBe("limit");
    if (result.kind !== "limit") {
      throw new Error("expected infinite machine to hit the default limit");
    }
    expect(result.maxSteps).toBe(10_000);
    expect(result.values).toHaveLength(10_000);
  });

  it("supports task-authored trace events", () => {
    const controller = I.createController(
      I.machine<object, { index: number }, never, string>({
        id: "traceable",
        env: {},
        initial: { index: 0 },
        step: (_env, cursor: { index: number }, ctx) => {
          ctx.trace({
            kind: "started",
            machineId: "ignored",
            iteration: 999,
            message: "inside step",
            cursor,
          });
          return I.done("ok");
        },
      }),
    );

    controller.next();

    expect(controller.getBoard().trace).toContainEqual({
      kind: "started",
      machineId: "traceable",
      iteration: 999,
      message: "inside step",
      cursor: { index: 0 },
    });
  });

  it("snapshot includes statePath and board", () => {
    const controller = I.createController(createCounter());

    controller.next();

    expect(controller.getSnapshot()).toEqual({
      statePath: ["yielded"],
      board: controller.getBoard(),
    });
  });
});

describe("iter description, validation, typing, and exports", () => {
  it("describes iter machines using env keys without serializing values", () => {
    const machine = I.machine({
      id: "artifacts",
      env: { artifacts: ["a", "b"], secret: "hidden" },
      initial: { index: 0 },
      description: "Yield static artifacts one by one.",
      step: (env, cursor: { index: number }) => {
        if (cursor.index >= env.artifacts.length) {
          return I.done({ count: env.artifacts.length });
        }

        return I.yield(env.artifacts[cursor.index], { index: cursor.index + 1 });
      },
    });

    expect(I.describe(machine)).toEqual({
      kind: "iterMachine",
      id: "artifacts",
      description: "Yield static artifacts one by one.",
      envKeys: ["artifacts", "secret"],
      hasStep: true,
    });
    expect(formatIterMachineDescription(I.describe(machine))).toContain("Iter machine: artifacts");
  });

  it("validates invalid id, step, and description", () => {
    const diagnostics = I.validate({
      kind: "iterMachine",
      id: " ",
      env: {},
      initial: undefined,
      step: "nope" as unknown as IterMachine<object, undefined, string>["step"],
      description: 42 as unknown as string,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "InvalidIterMachineId",
      "InvalidIterMachineStep",
      "InvalidIterMachineDescription",
    ]);
    expect(formatIterDiagnostics(diagnostics)).toContain("[error] InvalidIterMachineStep");
  });

  it("formats traces readably", () => {
    const formatted = formatIterTrace([
      {
        kind: "yielded",
        machineId: "files",
        iteration: 2,
        yielded: "page-2",
        cursor: { page: 3 },
      },
    ]);

    expect(formatted).toContain("files#2 yielded");
  });

  it("matches IterNext and IterStep with matchKind", () => {
    const machine = createTypedCounter();
    const controller = I.createController(machine);

    const yielded = matchKind(controller.next(), {
      yield: (result) => `yielded ${result.value}`,
      done: (result) => `done ${result.value}`,
      fail: (result) => `failed ${String(result.error)}`,
    });

    const step = matchKind(
      machine.step(
        machine.env,
        { value: 4 },
        {
          iteration: 1,
          trace: () => {},
        },
      ),
      {
        yield: (result) => `yielded ${result.value}`,
        done: (result) => `done ${result.value}`,
        fail: (result) => `failed ${String(result.error)}`,
      },
    );

    expect(yielded).toBe("yielded 1");
    expect(step).toBe("done complete");
  });

  it("infers yielded value, return value, env, and cursor types", () => {
    const counter = createTypedCounter();
    const controller = I.createController(counter);
    const first = controller.next();
    const envMax: number = counter.env.max;

    if (first.kind === "yield") {
      const yielded: number = first.value;
      expect(yielded).toBe(1);
    } else {
      expect.unreachable("expected first step to yield");
    }

    const rerouted = I.machine({
      id: "rerouted",
      env: { max: 1 },
      initial: { value: 1 },
      step: (env, cursor: { value: number }) => {
        if (cursor.value > env.max) {
          return I.done("complete");
        }

        return I.yield(cursor.value, { value: cursor.value + 1 });
      },
    });
    const description = rerouted.description;
    const cursor: { value: number } = counter.initial;
    void envMax;
    void description;
    void cursor;

    // @ts-expect-error reset cursor must match the machine cursor
    controller.reset({ count: 2 });
  });

  it("exports iter helpers only from the iter subpath", () => {
    expect(I.machine).toBeTypeOf("function");
    expect(I.createController).toBeTypeOf("function");
    expect("I" in root).toBe(false);
  });
});

function createTypedCounter() {
  return I.machine({
    id: "typedCounter",
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
}
