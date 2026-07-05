import type { BatchDiagnostic, BatchTask } from "./types";

function pushDiagnostic(
  diagnostics: BatchDiagnostic[],
  severity: BatchDiagnostic["severity"],
  code: string,
  message: string,
  path?: string,
): void {
  diagnostics.push({ severity, code, message, path });
}

export function isValidBatchConcurrency(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

export function validateBatchTask<TInput, TOutput, TError>(
  task: BatchTask<TInput, TOutput, TError>,
): BatchDiagnostic[] {
  const diagnostics: BatchDiagnostic[] = [];

  if (typeof task.id !== "string" || task.id.trim().length === 0) {
    pushDiagnostic(
      diagnostics,
      "error",
      "InvalidBatchId",
      "Batch task id must be a non-empty string.",
      "id",
    );
  }

  if (typeof task.map !== "function") {
    pushDiagnostic(
      diagnostics,
      "error",
      "InvalidBatchMap",
      "Batch task map must be a function.",
      "map",
    );
  }

  if (!Array.isArray(task.inputs)) {
    pushDiagnostic(
      diagnostics,
      "error",
      "InvalidBatchInputs",
      "Batch task inputs must be an array.",
      "inputs",
    );
  }

  if (task.concurrency !== undefined && !isValidBatchConcurrency(task.concurrency)) {
    pushDiagnostic(
      diagnostics,
      "error",
      "InvalidBatchConcurrency",
      "Batch task concurrency must be a positive finite integer when provided.",
      "concurrency",
    );
  }

  if (task.description !== undefined && typeof task.description !== "string") {
    pushDiagnostic(
      diagnostics,
      "error",
      "InvalidBatchDescription",
      "Batch task description must be a string when provided.",
      "description",
    );
  }

  return diagnostics;
}

export function formatBatchDiagnostics(diagnostics: readonly BatchDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return "No batch diagnostics.";
  }

  return diagnostics
    .map((diagnostic) => {
      const path = diagnostic.path ? ` at ${diagnostic.path}` : "";
      return `[${diagnostic.severity}] ${diagnostic.code}${path}: ${diagnostic.message}`;
    })
    .join("\n");
}
