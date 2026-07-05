import type { BatchTask, BatchTaskDescription } from "./types";

export function describeBatchTask<TInput, TOutput, TError>(
  task: BatchTask<TInput, TOutput, TError>,
): BatchTaskDescription {
  return {
    kind: "batchTask",
    id: task.id,
    description: task.description,
    inputCount: Array.isArray(task.inputs) ? task.inputs.length : 0,
    concurrency: task.concurrency,
  };
}

export function formatBatchTaskDescription(description: BatchTaskDescription): string {
  const lines = [`Batch task: ${description.id}`, `Inputs: ${description.inputCount}`];

  if (description.description) {
    lines.push(`Description: ${description.description}`);
  }

  if (description.concurrency !== undefined) {
    lines.push(`Concurrency: ${description.concurrency}`);
  }

  return lines.join("\n");
}
