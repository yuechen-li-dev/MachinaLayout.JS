export type MachinaDiagnosticSeverity = "error" | "warning" | "info";

/** Machine-applicable repair hint (`add`/`remove`/`rename`/`replace` at a path). */
export type DiagnosticFix =
  | { readonly op: "add"; readonly path: string; readonly expected: string }
  | { readonly op: "remove"; readonly path: string }
  | { readonly op: "rename"; readonly path: string; readonly to: string }
  | { readonly op: "replace"; readonly path: string; readonly expected: string };

/**
 * The one diagnostic shape. Every module's diagnostic type is
 * `DiagnosticOf<ModuleExtras, ModuleCodes>`, so diagnostics from any modules
 * combine with `D.collect` and format with `D.format` without adapters.
 */
export type MachinaDiagnostic = {
  readonly severity: MachinaDiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  /** Where: a value path, file, table cell, or `line:column`. */
  readonly path?: string;
  /** Which module or check produced it (`concept`, `table`, …). */
  readonly source?: string;
  /** Extra lines (context, diff hunks, related values). */
  readonly details?: readonly string[];
  readonly fix?: DiagnosticFix;
};

type Simplify<TValue> = { [K in keyof TValue]: TValue[K] } & {};

/** A module's diagnostic: the shared shape plus module-specific fields and a narrowed code. */
export type DiagnosticOf<
  TExtra extends object = Record<never, never>,
  TCode extends string = string,
> = Simplify<Omit<MachinaDiagnostic, "code"> & { readonly code: TCode } & TExtra>;

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

/** @deprecated Every module diagnostic is now a `MachinaDiagnostic`; use that. */
export type CompatibleDiagnostic = MachinaDiagnostic;

export type DiagnosticInput = {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly source?: string;
  readonly details?: readonly string[];
};
