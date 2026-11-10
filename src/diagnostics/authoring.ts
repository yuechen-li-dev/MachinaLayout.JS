import { invariant } from "../kit";
import type {
  DiagnosticInput,
  DiagnosticResult,
  MachinaDiagnostic,
  MachinaDiagnosticSeverity,
} from "./types";

function assertNonEmptyField(value: string, fieldName: "code" | "message"): void {
  invariant(value.trim().length > 0, `Machina diagnostic ${fieldName} must be non-empty.`);
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

/**
 * Fill in `source` where missing. Lossless: module-specific fields (fix
 * hints, table cells, workflow steps) are kept.
 */
export function from<TDiagnostic extends MachinaDiagnostic>(
  diagnostics: readonly TDiagnostic[],
  defaults?: {
    source?: string;
  },
): TDiagnostic[] {
  return diagnostics.map((diagnostic) =>
    diagnostic.source !== undefined || defaults?.source === undefined
      ? diagnostic
      : { ...diagnostic, source: defaults.source },
  );
}

function joinPath(prefix: string, path: string | undefined): string {
  if (path === undefined || path === "") return prefix;
  if (prefix === "") return path;
  return path.startsWith("[") ? `${prefix}${path}` : `${prefix}.${path}`;
}

/**
 * Re-base diagnostics from a nested check under a parent path, moving `path`
 * and `fix.path` together: `D.within("orders[2]", diagnostics)` turns
 * `customerId` into `orders[2].customerId` (and `[0].x` into `orders[2][0].x`).
 */
export function within<TDiagnostic extends MachinaDiagnostic>(
  prefix: string,
  diagnostics: readonly TDiagnostic[],
): TDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    path: joinPath(prefix, diagnostic.path),
    ...(diagnostic.fix
      ? { fix: { ...diagnostic.fix, path: joinPath(prefix, diagnostic.fix.path) } }
      : {}),
  }));
}
