import type { CaptureDiagnostic, CaptureTask } from "./types";

function pushDiagnostic(
  diagnostics: CaptureDiagnostic[],
  severity: CaptureDiagnostic["severity"],
  code: string,
  message: string,
  path?: string,
): void {
  diagnostics.push({ severity, code, message, path });
}

export function validateCaptureTask<TEnv, TInput, TOutput>(
  task: CaptureTask<TEnv, TInput, TOutput>,
): CaptureDiagnostic[] {
  const diagnostics: CaptureDiagnostic[] = [];

  if (typeof task.id !== "string" || task.id.trim().length === 0) {
    pushDiagnostic(
      diagnostics,
      "error",
      "InvalidCaptureId",
      "Capture task id must be a non-empty string.",
      "id",
    );
  }

  if (typeof task.run !== "function") {
    pushDiagnostic(
      diagnostics,
      "error",
      "InvalidCaptureRun",
      "Capture task run must be a function.",
      "run",
    );
  }

  if (task.description !== undefined && typeof task.description !== "string") {
    pushDiagnostic(
      diagnostics,
      "error",
      "InvalidCaptureDescription",
      "Capture task description must be a string when provided.",
      "description",
    );
  }

  if ((typeof task.env === "object" && task.env !== null) || typeof task.env === "function") {
    for (const key of Object.keys(task.env)) {
      if (key.trim().length === 0) {
        pushDiagnostic(
          diagnostics,
          "warning",
          "SuspiciousCaptureEnvKey",
          "Capture task environment contains an empty-string key.",
          `env.${key}`,
        );
      }
    }
  }

  return diagnostics;
}

export function formatCaptureDiagnostics(diagnostics: readonly CaptureDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return "No capture diagnostics.";
  }
  return diagnostics
    .map((diagnostic) => {
      const path = diagnostic.path ? ` at ${diagnostic.path}` : "";
      return `[${diagnostic.severity}] ${diagnostic.code}${path}: ${diagnostic.message}`;
    })
    .join("\n");
}
