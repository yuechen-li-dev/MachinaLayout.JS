import type { BatchItemResult } from "./types";

export function ok<TOutput>(value: TOutput): BatchItemResult<TOutput, never> {
  return {
    kind: "ok",
    value,
  };
}

export function err<TError>(error: TError): BatchItemResult<never, TError> {
  return {
    kind: "err",
    error,
  };
}
