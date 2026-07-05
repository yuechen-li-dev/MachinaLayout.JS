import { describe, expect, it, vi } from "vitest";
import {
  C,
  formatCaptureDiagnostics,
  formatCaptureTaskDescription,
  type CaptureTask,
  rebindCaptureTask,
  validateCaptureTask,
} from "../../src/capture";
import * as root from "../../src/index";

describe("capture task authoring", () => {
  it("creates a task with explicit env and returns a fresh object", () => {
    const env = { factor: 2 };
    const run = (taskEnv: typeof env, value: number) => taskEnv.factor * value;
    const input = {
      id: "double",
      env,
      run,
      description: "Multiply values by a captured factor.",
    };

    const created = C.task(input);

    expect(created).toEqual({
      kind: "task",
      id: "double",
      env,
      run,
      description: "Multiply values by a captured factor.",
    });
    expect(created).not.toBe(input);
    expect(created.env).toBe(env);
    expect(created.run).toBe(run);
  });

  it("runs by passing env and input to the visible-env function", () => {
    const spy = vi.fn((env: { prefix: string }, value: string) => `${env.prefix}:${value}`);
    const captureTask = C.task({
      id: "prefix",
      env: { prefix: "cmd" },
      run: spy,
    });

    expect(C.run(captureTask, "deploy")).toBe("cmd:deploy");
    expect(spy).toHaveBeenCalledWith(captureTask.env, "deploy");
  });

  it("shallow-merges env by copy without mutating the original task or env", () => {
    const env = {
      theme: { name: "light" },
      dispatch: "dispatch-a",
      locale: "en-US",
    };
    const captureTask = C.task({
      id: "renderCard",
      env,
      run: (taskEnv, label: string) => `${taskEnv.locale}:${taskEnv.dispatch}:${label}`,
      description: "Render a card with explicit dependencies.",
    });

    const updated = C.withEnv(captureTask, {
      dispatch: "dispatch-b",
      theme: { name: "dark" },
    });

    expect(updated).not.toBe(captureTask);
    expect(updated.env).toEqual({
      theme: { name: "dark" },
      dispatch: "dispatch-b",
      locale: "en-US",
    });
    expect(updated.id).toBe(captureTask.id);
    expect(updated.run).toBe(captureTask.run);
    expect(updated.description).toBe(captureTask.description);
    expect(captureTask.env).toBe(env);
    expect(captureTask.env).toEqual({
      theme: { name: "light" },
      dispatch: "dispatch-a",
      locale: "en-US",
    });
  });

  it("rebinds a task with a new id while preserving run", () => {
    const run = vi.fn((env: { locale: string }, cents: number) => `${env.locale}:${cents}`);
    const captureTask = C.task({
      id: "formatMoney",
      env: { locale: "en-US" },
      run,
    });

    const rebound = C.rebind(captureTask, {
      id: "formatMoneyFr",
      envPatch: { locale: "fr-FR" },
    });

    expect(rebound).not.toBe(captureTask);
    expect(rebound.id).toBe("formatMoneyFr");
    expect(rebound.run).toBe(captureTask.run);
    expect(C.run(rebound, 1200)).toBe("fr-FR:1200");
    expect(run).toHaveBeenCalledWith({ locale: "fr-FR" }, 1200);
  });

  it("rebinds a task with a new description", () => {
    const captureTask = C.task({
      id: "formatMoney",
      description: "Format money for the primary locale.",
      env: { locale: "en-US" },
      run: (env, cents: number) => `${env.locale}:${cents}`,
    });

    const rebound = C.rebind(captureTask, {
      description: "Format money for French report output.",
    });

    expect(rebound.description).toBe("Format money for French report output.");
    expect(rebound.id).toBe("formatMoney");
  });

  it("rebind can replace env entirely", () => {
    const captureTask = C.task({
      id: "formatMoney",
      env: { locale: "en-US", currency: "USD" },
      run: (env, cents: number) => `${env.locale}:${env.currency}:${cents}`,
    });

    const rebound = C.rebind(captureTask, {
      env: { locale: "fr-FR", currency: "EUR" },
    });

    expect(rebound.env).toEqual({
      locale: "fr-FR",
      currency: "EUR",
    });
    expect(captureTask.env).toEqual({
      locale: "en-US",
      currency: "USD",
    });
  });

  it("rebind can patch env without mutating the original task env", () => {
    const originalEnv = { locale: "en-US", currency: "USD" };
    const captureTask = C.task({
      id: "formatMoney",
      env: originalEnv,
      run: (env, cents: number) => `${env.locale}:${env.currency}:${cents}`,
    });

    const rebound = C.rebind(captureTask, {
      envPatch: { locale: "fr-FR" },
    });

    expect(rebound.env).toEqual({
      locale: "fr-FR",
      currency: "USD",
    });
    expect(rebound.env).not.toBe(originalEnv);
    expect(captureTask.env).toBe(originalEnv);
    expect(captureTask.env).toEqual({
      locale: "en-US",
      currency: "USD",
    });
  });

  it("rebind rejects env and envPatch together", () => {
    const captureTask = C.task({
      id: "formatMoney",
      env: { locale: "en-US", currency: "USD" },
      run: (env, cents: number) => `${env.locale}:${env.currency}:${cents}`,
    });

    expect(() =>
      C.rebind(captureTask, {
        env: { locale: "fr-FR", currency: "EUR" },
        envPatch: { locale: "de-DE" },
      }),
    ).toThrowError("Capture task rebind cannot accept both env and envPatch.");
  });

  it("rebind description output shows the new id", () => {
    const rebound = C.rebind(
      C.task({
        id: "formatMoney",
        description: "Format money for the primary locale.",
        env: { locale: "en-US", currency: "USD" },
        run: (env, cents: number) => `${env.locale}:${env.currency}:${cents}`,
      }),
      {
        id: "formatMoneyFr",
        description: "Format money for French report output.",
        envPatch: { locale: "fr-FR" },
      },
    );

    const text = formatCaptureTaskDescription(C.describe(rebound));

    expect(text).toContain("Task: formatMoneyFr");
    expect(text).toContain("Description: Format money for French report output.");
  });

  it("maps inputs through the task runner", () => {
    const formatter = C.task({
      id: "formatMeasurement",
      env: { unitSystem: "metric" as const },
      run: (env, value: number) => `${value}-${env.unitSystem}`,
    });

    expect(C.map(formatter, [1, 2, 3])).toEqual(["1-metric", "2-metric", "3-metric"]);
  });

  it("describes tasks using id, description, env keys, and run presence", () => {
    const command = C.task({
      id: "selectObject",
      env: {
        dispatch: (action: { kind: "select"; id: string }) => action,
        currentUser: { id: "u-1" },
      },
      description: "Dispatch object selection commands.",
      run: (env, objectId: string) => env.dispatch({ kind: "select", id: objectId }),
    });

    expect(C.describe(command)).toEqual({
      kind: "task",
      id: "selectObject",
      description: "Dispatch object selection commands.",
      envKeys: ["dispatch", "currentUser"],
      hasRun: true,
    });
  });

  it("formats capture descriptions without leaking env values", () => {
    const text = formatCaptureTaskDescription({
      kind: "task",
      id: "renderButton",
      description: "Render a button with explicit dependencies.",
      envKeys: ["theme", "dispatch", "currentUser"],
      hasRun: true,
    });

    expect(text).toContain("Task: renderButton");
    expect(text).toContain("Description: Render a button with explicit dependencies.");
    expect(text).toContain("Environment keys:");
    expect(text).toContain("- theme");
    expect(text).toContain("- dispatch");
    expect(text).toContain("- currentUser");
  });
});

describe("capture task validation", () => {
  it("accepts a valid task", () => {
    const captureTask = C.task({
      id: "validateUser",
      env: { locale: "en-US" },
      description: "Validate user-visible form data.",
      run: (env, input: string) => input.length > env.locale.length,
    });

    expect(validateCaptureTask(captureTask)).toEqual([]);
    expect(C.validate(captureTask)).toEqual([]);
  });

  it("reports invalid id", () => {
    const diagnostics = validateCaptureTask({
      kind: "task",
      id: " ",
      env: undefined,
      run: () => true,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("InvalidCaptureId");
  });

  it("reports invalid run", () => {
    const diagnostics = validateCaptureTask({
      kind: "task",
      id: "broken",
      env: {},
      run: "nope" as unknown as CaptureTask<object, string, string>["run"],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("InvalidCaptureRun");
  });

  it("reports invalid description", () => {
    const diagnostics = validateCaptureTask({
      kind: "task",
      id: "broken-description",
      env: {},
      run: () => true,
      description: 42 as unknown as string,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("InvalidCaptureDescription");
  });

  it("formats diagnostics readably", () => {
    const formatted = formatCaptureDiagnostics([
      {
        severity: "error",
        code: "InvalidCaptureId",
        message: "Capture task id must be a non-empty string.",
        path: "id",
      },
      {
        severity: "warning",
        code: "SuspiciousCaptureEnvKey",
        message: "Capture task environment contains an empty-string key.",
        path: "env.",
      },
    ]);

    expect(formatted).toContain("[error] InvalidCaptureId at id");
    expect(formatted).toContain("[warning] SuspiciousCaptureEnvKey at env.");
  });
});

describe("capture task typing and exports", () => {
  it("infers env, input, output, and env update types", () => {
    const formatPrice = C.task({
      id: "formatPrice",
      env: {
        currency: "USD",
        locale: "en-US",
      },
      run: (env, cents: number) =>
        new Intl.NumberFormat(env.locale, {
          style: "currency",
          currency: env.currency,
        }).format(cents / 100),
    });

    const text: string = C.run(formatPrice, 1299);
    const updated = C.withEnv(formatPrice, { locale: "fr-FR" });
    const rebound = C.rebind(formatPrice, {
      id: "formatPriceFr",
      envPatch: { locale: "fr-FR" },
    });
    const locale: string = updated.env.locale;
    const currency: string = updated.env.currency;
    const reboundId: string = rebound.id;

    const handler = C.task({
      id: "selectObject",
      env: {
        dispatch: (action: { kind: "select"; id: string }) => action.id,
      },
      run: (env, objectId: string) => env.dispatch({ kind: "select", id: objectId }),
    });

    const handlerResult: string = C.run(handler, "object-1");

    // @ts-expect-error input must be number
    C.run(formatPrice, "1299");
    // @ts-expect-error withEnv patch must match Partial<TEnv>
    C.withEnv(formatPrice, { missing: true });
    // @ts-expect-error rebind envPatch must match Partial<TEnv>
    C.rebind(formatPrice, { envPatch: { missing: true } });

    expect(text).toContain("$");
    expect(locale).toBe("fr-FR");
    expect(currency).toBe("USD");
    expect(reboundId).toBe("formatPriceFr");
    expect(handlerResult).toBe("object-1");
  });

  it("exports the capture namespace only from the capture subpath", () => {
    expect(C.task).toBeTypeOf("function");
    expect(C.run).toBeTypeOf("function");
    expect(C.withEnv).toBeTypeOf("function");
    expect(C.rebind).toBeTypeOf("function");
    expect(C.map).toBeTypeOf("function");
    expect(C.describe).toBeTypeOf("function");
    expect(C.validate).toBeTypeOf("function");
    expect(rebindCaptureTask).toBeTypeOf("function");
    expect("C" in root).toBe(false);
  });
});
