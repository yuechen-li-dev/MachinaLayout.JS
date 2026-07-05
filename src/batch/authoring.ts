import { describeBatchTask } from "./describe";
import { err, ok } from "./result";
import { run } from "./run";
import type { BatchCancelResult, BatchItemContext, BatchItemResult, BatchTask } from "./types";
import { validateBatchTask } from "./validate";

function assertTaskId(id: string): void {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error("Batch task id must be a non-empty string.");
  }
}

function assertInputs(inputs: unknown): asserts inputs is readonly unknown[] {
  if (!Array.isArray(inputs)) {
    throw new Error("Batch task inputs must be an array.");
  }
}

function assertMap(map: unknown): asserts map is (...args: readonly unknown[]) => unknown {
  if (typeof map !== "function") {
    throw new Error("Batch task map must be a function.");
  }
}

function assertConcurrency(concurrency: number | undefined): void {
  if (concurrency === undefined) {
    return;
  }

  if (!Number.isFinite(concurrency) || !Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error("Batch task concurrency must be a positive finite integer.");
  }
}

function assertDescription(description: string | undefined): void {
  if (description !== undefined && typeof description !== "string") {
    throw new Error("Batch task description must be a string.");
  }
}

export function task<TInput, TOutput, TError = unknown>(input: {
  id: string;
  inputs: readonly TInput[];
  map: (
    input: TInput,
    context: BatchItemContext<TInput>,
  ) => Promise<BatchItemResult<TOutput, TError>> | BatchItemResult<TOutput, TError>;
  concurrency?: number;
  description?: string;
}): BatchTask<TInput, TOutput, TError> {
  assertTaskId(input.id);
  assertInputs(input.inputs);
  assertMap(input.map);
  assertConcurrency(input.concurrency);
  assertDescription(input.description);

  return {
    kind: "batchTask",
    id: input.id,
    inputs: input.inputs,
    map: input.map,
    concurrency: input.concurrency,
    description: input.description,
  };
}

export function cancel(reason?: string): BatchCancelResult {
  return {
    kind: "cancelled",
    reason,
  };
}

export const B = {
  task,
  run,
  ok,
  err,
  cancel,
  validate: validateBatchTask,
  describe: describeBatchTask,
} as const;
