export type EnumKey = string | number;

export type EnumCaseMap<TKey extends EnumKey, TResult> = {
  readonly [K in TKey]: () => TResult;
};
export type EnumCaseMapWithDefault<TKey extends EnumKey, TResult> = Partial<
  EnumCaseMap<TKey, TResult>
> & {
  readonly _: (value: TKey) => TResult;
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
export type DiscriminatedCaseMapWithDefault<
  TUnion extends Record<TKey, MatchDiscriminant>,
  TKey extends keyof TUnion,
  TResult,
> = Partial<DiscriminatedCaseMap<TUnion, TKey, TResult>> & {
  readonly _: (value: TUnion) => TResult;
};

export type KindCaseMap<TUnion extends { kind: MatchDiscriminant }, TResult> = DiscriminatedCaseMap<
  TUnion,
  "kind",
  TResult
>;
export type KindCaseMapWithDefault<
  TUnion extends { kind: MatchDiscriminant },
  TResult,
> = DiscriminatedCaseMapWithDefault<TUnion, "kind", TResult>;

export type MatchCaseResult<TCases> = TCases[keyof TCases] extends (
  ...args: never[]
) => infer TResult
  ? TResult
  : never;
