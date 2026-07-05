export type MachinaDiagnosticSeverity = "error" | "warning" | "info";

export type MachinaDiagnostic = {
  readonly severity: MachinaDiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly source?: string;
  readonly details?: readonly string[];
};

export type DiagnosticResult<TValue> =
  | {
      readonly kind: "ok";
      readonly value: TValue;
      readonly diagnostics: readonly MachinaDiagnostic[];
    }
  | {
      readonly kind: "err";
      readonly diagnostics: readonly MachinaDiagnostic[];
    };

export type CompatibleDiagnostic = {
  readonly severity: MachinaDiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly source?: string;
  readonly details?: readonly string[];
};

export type DiagnosticInput = {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly source?: string;
  readonly details?: readonly string[];
};
