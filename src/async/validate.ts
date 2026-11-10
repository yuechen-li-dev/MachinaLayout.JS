import { format as formatDiagnostics } from "../diagnostics/format";
import type { AsyncTask, AsyncTaskDiagnostic } from "./types";

function pushDiagnostic(
  diagnostics: AsyncTaskDiagnostic[],
  severity: AsyncTaskDiagnostic["severity"],
  code: string,
  message: string,
  path?: string,
): void {
  diagnostics.push({ severity, code, message, path });
}

export function validateAsyncTask<TEnv, TInput, TOutput, TError>(
  task: AsyncTask<TEnv, TInput, TOutput, TError>,
): AsyncTaskDiagnostic[] {
  const diagnostics: AsyncTaskDiagnostic[] = [];

  if (typeof task.id !== "string" || task.id.trim().length === 0) {
    pushDiagnostic(
      diagnostics,
      "error",
      "InvalidAsyncTaskId",
      "Async task id must be a non-empty string.",
      "id",
    );
  }

  if (typeof task.run !== "function") {
    pushDiagnostic(
      diagnostics,
      "error",
      "InvalidAsyncTaskRun",
      "Async task run must be a function.",
      "run",
    );
  }

  if (task.timeoutMs !== undefined && (!Number.isFinite(task.timeoutMs) || task.timeoutMs <= 0)) {
    pushDiagnostic(
      diagnostics,
      "error",
      "InvalidAsyncTaskTimeout",
      "Async task timeoutMs must be a positive finite number when provided.",
      "timeoutMs",
    );
  }

  if (task.description !== undefined && typeof task.description !== "string") {
    pushDiagnostic(
      diagnostics,
      "error",
      "InvalidAsyncTaskDescription",
      "Async task description must be a string when provided.",
      "description",
    );
  }

  return diagnostics;
}

export function formatAsyncTaskDiagnostics(diagnostics: readonly AsyncTaskDiagnostic[]): string {
  return formatDiagnostics(diagnostics, { style: "line", empty: "No async task diagnostics." });
}
