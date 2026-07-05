import { describeCaptureTask } from "./describe";
import { validateCaptureTask } from "./validate";
import type { CaptureTask } from "./types";

function assertTaskId(id: string): void {
  if (id.trim().length === 0) {
    throw new Error("Capture task id must be non-empty.");
  }
}

function assertTaskRun(run: unknown): asserts run is (...args: readonly unknown[]) => unknown {
  if (typeof run !== "function") {
    throw new Error("Capture task run must be a function.");
  }
}

function assertTaskDescription(description: string | undefined): void {
  if (description !== undefined && typeof description !== "string") {
    throw new Error(
      "InvalidCaptureDescription: Capture task description must be a string when provided.",
    );
  }
}

function assertRebindInput<TEnv>(input: {
  id?: string;
  description?: string;
  env?: TEnv;
  envPatch?: Partial<TEnv>;
}): void {
  if (input.id !== undefined && input.id.trim().length === 0) {
    throw new Error("InvalidCaptureId: Capture task id must be a non-empty string.");
  }

  assertTaskDescription(input.description);

  if (input.env !== undefined && input.envPatch !== undefined) {
    throw new Error("Capture task rebind cannot accept both env and envPatch.");
  }
}

export function task<TEnv, TInput, TOutput>(input: {
  id: string;
  env: TEnv;
  run: (env: TEnv, input: TInput) => TOutput;
  description?: string;
}): CaptureTask<TEnv, TInput, TOutput> {
  assertTaskId(input.id);
  assertTaskRun(input.run);
  return {
    kind: "task",
    id: input.id,
    env: input.env,
    run: input.run,
    description: input.description,
  };
}

export function run<TEnv, TInput, TOutput>(
  captureTask: CaptureTask<TEnv, TInput, TOutput>,
  input: TInput,
): TOutput {
  return captureTask.run(captureTask.env, input);
}

export function withEnv<TEnv extends object, TInput, TOutput>(
  captureTask: CaptureTask<TEnv, TInput, TOutput>,
  patch: Partial<TEnv>,
): CaptureTask<TEnv, TInput, TOutput> {
  return {
    kind: "task",
    id: captureTask.id,
    env: { ...captureTask.env, ...patch },
    run: captureTask.run,
    description: captureTask.description,
  };
}

export function rebind<TEnv extends object, TInput, TOutput>(
  captureTask: CaptureTask<TEnv, TInput, TOutput>,
  input: {
    id?: string;
    description?: string;
    env?: TEnv;
    envPatch?: Partial<TEnv>;
  },
): CaptureTask<TEnv, TInput, TOutput> {
  assertRebindInput(input);

  const env =
    input.env !== undefined
      ? input.env
      : input.envPatch !== undefined
        ? { ...captureTask.env, ...input.envPatch }
        : captureTask.env;

  return {
    kind: "task",
    id: input.id ?? captureTask.id,
    env,
    run: captureTask.run,
    description: input.description ?? captureTask.description,
  };
}

export const rebindCaptureTask = rebind;

export function map<TEnv, TInput, TOutput>(
  captureTask: CaptureTask<TEnv, TInput, TOutput>,
  inputs: readonly TInput[],
): TOutput[] {
  return inputs.map((input) => run(captureTask, input));
}

export const C = {
  task,
  run,
  withEnv,
  rebind,
  map,
  describe: describeCaptureTask,
  validate: validateCaptureTask,
} as const;
