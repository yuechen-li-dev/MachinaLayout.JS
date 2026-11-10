import type { DiagnosticOf } from "../diagnostics/types";
export type CaptureTask<TEnv, TInput, TOutput> = {
  readonly kind: "task";
  readonly id: string;
  readonly env: TEnv;
  readonly run: (env: TEnv, input: TInput) => TOutput;
  readonly description?: string;
};

export type CaptureHandler<TEnv, TInput, TOutput> = CaptureTask<TEnv, TInput, TOutput>;

export type CaptureSelector<TEnv, TInput, TOutput> = CaptureTask<TEnv, TInput, TOutput>;

export type CaptureFormatter<TEnv, TInput, TOutput> = CaptureTask<TEnv, TInput, TOutput>;

export type CaptureTaskDescription = {
  kind: "task";
  id: string;
  description?: string;
  envKeys: readonly string[];
  hasRun: boolean;
};

export type CaptureDiagnostic = DiagnosticOf<{ readonly severity: "error" | "warning" }>;
