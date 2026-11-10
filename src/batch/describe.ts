import { Text } from "../text/utilities";
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
  return Text.lines(
    `Batch task: ${description.id}`,
    `Inputs: ${description.inputCount}`,
    description.description && `Description: ${description.description}`,
    description.concurrency !== undefined && `Concurrency: ${description.concurrency}`,
  );
}
