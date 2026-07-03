export type EnumKey = string | number;

export type EnumCaseMap<TKey extends EnumKey, TResult> = {
  readonly [K in TKey]: () => TResult;
};

export type EnumValueMap<TKey extends EnumKey, TValue> = {
  readonly [K in TKey]: TValue;
};
