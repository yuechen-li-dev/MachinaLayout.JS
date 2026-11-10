import { invariant } from "../kit";
import { createController, run, runAsyncTaskSnapshot } from "./controller";
import { describeAsyncTask } from "./describe";
import { cancelled, err, ok, timeout } from "./result";
import type { AsyncTask, AsyncTaskContext, AsyncTaskResult } from "./types";
import { validateAsyncTask } from "./validate";

function assertTaskId(id: string): void {
  invariant(id.trim().length > 0, "Async task id must be non-empty.");
}

function assertTaskRun(
  run: unknown,
): asserts run is (...args: readonly unknown[]) => Promise<unknown> {
  invariant(typeof run === "function", "Async task run must be a function.");
}

function assertTimeout(timeoutMs: number | undefined): void {
  if (timeoutMs === undefined) {
    return;
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Async task timeoutMs must be a positive finite number.");
  }
}

export function task<TEnv, TInput, TOutput, TError = unknown>(input: {
  id: string;
  env: TEnv;
  run: (
    env: TEnv,
    input: TInput,
    ctx: AsyncTaskContext,
  ) => Promise<AsyncTaskResult<TOutput, TError>>;
  description?: string;
  timeoutMs?: number;
}): AsyncTask<TEnv, TInput, TOutput, TError> {
  assertTaskId(input.id);
  assertTaskRun(input.run);
  assertTimeout(input.timeoutMs);

  return {
    kind: "asyncTask",
    id: input.id,
    env: input.env,
    run: input.run,
    description: input.description,
    timeoutMs: input.timeoutMs,
  };
}

export const A = {
  task,
  ok,
  err,
  cancelled,
  timeout,
  createController,
  run,
  runSnapshot: runAsyncTaskSnapshot,
  describe: describeAsyncTask,
  validate: validateAsyncTask,
} as const;
