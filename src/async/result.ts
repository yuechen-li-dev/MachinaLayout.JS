import type { AsyncTaskResult } from "./types";

export function ok<TOutput>(value: TOutput): AsyncTaskResult<TOutput, never> {
  return {
    kind: "ok",
    value,
  };
}

export function err<TError>(error: TError): AsyncTaskResult<never, TError> {
  return {
    kind: "err",
    error,
  };
}

export function cancelled(reason?: string): AsyncTaskResult<never, never> {
  return {
    kind: "cancelled",
    reason,
  };
}

export function timeout(timeoutMs: number): AsyncTaskResult<never, never> {
  return {
    kind: "timeout",
    timeoutMs,
  };
}
