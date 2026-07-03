import type { EnumCaseMap, EnumKey } from "./types";

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
): TResult {
  if (cases === null || typeof cases !== "object") {
    throw new MatchEnumError("InvalidEnumCases", "matchEnum cases must be an object.");
  }

  if (!Object.keys(cases).includes(String(value))) {
    throw new MatchEnumError("MissingEnumCase", `Missing enum case for ${String(value)}.`);
  }

  const handler = cases[value];
  if (typeof handler !== "function") {
    throw new MatchEnumError(
      "InvalidEnumCases",
      `Enum case for ${String(value)} must be a function.`,
    );
  }

  return handler();
}
