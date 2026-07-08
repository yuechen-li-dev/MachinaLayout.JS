import type { EnumCaseMap, EnumCaseMapWithDefault, EnumKey, MatchCaseResult } from "./types";

export type MatchEnumErrorCode = "MissingEnumCase" | "InvalidEnumCases";

export class MatchEnumError extends Error {
  readonly code: MatchEnumErrorCode;

  constructor(code: MatchEnumErrorCode, message: string) {
    super(message);
    this.name = "MatchEnumError";
    this.code = code;
  }
}

export function matchEnum<TKey extends EnumKey, TResult>(
  value: TKey,
  cases: EnumCaseMap<TKey, TResult>,
): TResult;
export function matchEnum<TKey extends EnumKey, TResult>(
  value: TKey,
  cases: EnumCaseMapWithDefault<TKey, TResult>,
): TResult;
export function matchEnum<
  TKey extends EnumKey,
  TCases extends EnumCaseMapWithDefault<TKey, unknown>,
>(value: TKey, cases: TCases): MatchCaseResult<TCases>;
export function matchEnum<TKey extends EnumKey>(
  value: TKey,
  cases: EnumCaseMap<TKey, unknown> | EnumCaseMapWithDefault<TKey, unknown>,
): unknown {
  if (cases === null || typeof cases !== "object") {
    throw new MatchEnumError("InvalidEnumCases", "matchEnum cases must be an object.");
  }

  if (!Object.keys(cases).includes(String(value)) && !Object.keys(cases).includes("_")) {
    throw new MatchEnumError("MissingEnumCase", `Missing enum case for ${String(value)}.`);
  }

  const handler = cases[value] ?? ("_" in cases ? cases._ : undefined);
  if (typeof handler !== "function") {
    throw new MatchEnumError(
      "InvalidEnumCases",
      `Enum case for ${String(value)} must be a function.`,
    );
  }

  return handler(value as never);
}
