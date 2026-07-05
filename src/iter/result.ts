import type { IterNext, IterStep } from "./types";

export function yieldValue<TCursor, TYield>(
  value: TYield,
  cursor: TCursor,
): IterStep<TCursor, TYield, never, never> {
  return {
    kind: "yield",
    value,
    cursor,
  };
}

export { yieldValue as yield };

export function done<TReturn>(value: TReturn): IterStep<never, never, TReturn, never> {
  return {
    kind: "done",
    value,
  };
}

export function fail<TError>(error: TError): IterStep<never, never, never, TError> {
  return {
    kind: "fail",
    error,
  };
}

export function yieldedNext<TYield>(value: TYield): IterNext<TYield, never, never> {
  return {
    kind: "yield",
    value,
    done: false,
  };
}

export function doneNext<TReturn>(value: TReturn): IterNext<never, TReturn, never> {
  return {
    kind: "done",
    value,
    done: true,
  };
}

export function failNext<TError>(error: TError): IterNext<never, never, TError> {
  return {
    kind: "fail",
    error,
    done: true,
  };
}
