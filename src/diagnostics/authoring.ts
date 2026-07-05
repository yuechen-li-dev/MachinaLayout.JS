import type {
  CompatibleDiagnostic,
  DiagnosticInput,
  DiagnosticResult,
  MachinaDiagnostic,
  MachinaDiagnosticSeverity,
} from "./types";

function assertNonEmptyField(value: string, fieldName: "code" | "message"): void {
  if (value.trim().length === 0) {
    throw new Error(`Machina diagnostic ${fieldName} must be non-empty.`);
  }
}

function createDiagnostic(
  severity: MachinaDiagnosticSeverity,
  input: DiagnosticInput,
): MachinaDiagnostic {
  assertNonEmptyField(input.code, "code");
  assertNonEmptyField(input.message, "message");

  return {
    severity,
    code: input.code,
    message: input.message,
    path: input.path,
    source: input.source,
    details: input.details ? [...input.details] : undefined,
  };
}

export function error(input: DiagnosticInput): MachinaDiagnostic {
  return createDiagnostic("error", input);
}

export function warning(input: DiagnosticInput): MachinaDiagnostic {
  return createDiagnostic("warning", input);
}

export function info(input: DiagnosticInput): MachinaDiagnostic {
  return createDiagnostic("info", input);
}

export function ok<TValue>(
  value: TValue,
  diagnostics: readonly MachinaDiagnostic[] = [],
): DiagnosticResult<TValue> {
  return {
    kind: "ok",
    value,
    diagnostics: [...diagnostics],
  };
}

export function err(diagnostics: readonly MachinaDiagnostic[]): DiagnosticResult<never> {
  return {
    kind: "err",
    diagnostics: [...diagnostics],
  };
}

export function from(
  diagnostics: readonly CompatibleDiagnostic[],
  defaults?: {
    source?: string;
  },
): MachinaDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    severity: diagnostic.severity,
    code: diagnostic.code,
    message: diagnostic.message,
    path: diagnostic.path,
    source: diagnostic.source ?? defaults?.source,
    details: diagnostic.details ? [...diagnostic.details] : undefined,
  }));
}
