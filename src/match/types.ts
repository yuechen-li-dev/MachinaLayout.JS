export type EnumKey = string | number;

export type EnumCaseMap<TKey extends EnumKey, TResult> = {
  readonly [K in TKey]: () => TResult;
};

export type EnumValueMap<TKey extends EnumKey, TValue> = {
  readonly [K in TKey]: TValue;
};

export type MatchDiscriminant = string | number | symbol;

export type ExtractDiscriminated<
  TUnion,
  TKey extends keyof TUnion,
  TValue extends MatchDiscriminant,
> = Extract<TUnion, { [K in TKey]: TValue }>;

export type DiscriminatedCaseMap<
  TUnion extends Record<TKey, MatchDiscriminant>,
  TKey extends keyof TUnion,
  TResult,
> = {
  readonly [K in Extract<TUnion[TKey], MatchDiscriminant>]: (
    value: ExtractDiscriminated<TUnion, TKey, K>,
  ) => TResult;
};

export type KindCaseMap<TUnion extends { kind: MatchDiscriminant }, TResult> = DiscriminatedCaseMap<
  TUnion,
  "kind",
  TResult
>;
