import type { DiscriminatedCaseMap, KindCaseMap, MatchDiscriminant } from "./types";

export class MatchUnionError extends Error {
  readonly discriminantKey: string;
  readonly discriminantValue: unknown;
  readonly availableCases: readonly string[];

  constructor(
    discriminantKey: string,
    discriminantValue: unknown,
    availableCases: readonly string[],
  ) {
    super(
      `No handler for discriminant ${discriminantKey}=${String(
        discriminantValue,
      )}. Available cases: ${availableCases.join(", ")}.`,
    );
    this.name = "MatchUnionError";
    this.discriminantKey = discriminantKey;
    this.discriminantValue = discriminantValue;
    this.availableCases = availableCases;
  }
}

function isMatchDiscriminant(value: unknown): value is MatchDiscriminant {
  return typeof value === "string" || typeof value === "number" || typeof value === "symbol";
}

function availableCaseNames(cases: object): readonly string[] {
  return Reflect.ownKeys(cases).map((key) => String(key));
}

export function matchDiscriminated<
  TUnion extends Record<TKey, MatchDiscriminant>,
  TKey extends keyof TUnion,
  TResult,
>(
  value: TUnion,
  discriminantKey: TKey,
  cases: DiscriminatedCaseMap<TUnion, TKey, TResult>,
): TResult {
  const caseNames = availableCaseNames(cases);
  const discriminantValue = value[discriminantKey];
  if (!isMatchDiscriminant(discriminantValue)) {
    throw new MatchUnionError(String(discriminantKey), discriminantValue, caseNames);
  }

  const handler = cases[discriminantValue as keyof typeof cases];
  if (typeof handler !== "function") {
    throw new MatchUnionError(String(discriminantKey), discriminantValue, caseNames);
  }

  return handler(value as never);
}

export function matchKind<TUnion extends { kind: MatchDiscriminant }, TResult>(
  value: TUnion,
  cases: KindCaseMap<TUnion, TResult>,
): TResult {
  return matchDiscriminated(value, "kind", cases);
}
