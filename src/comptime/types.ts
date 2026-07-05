export type Assert<TValue extends true> = TValue;

export type Extends<TValue, TExpected> = TValue extends TExpected ? true : false;

export type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;

export type Not<TValue extends boolean> = TValue extends true ? false : true;

export type And<TValues extends readonly boolean[]> = TValues extends readonly [
  infer THead extends boolean,
  ...infer TTail extends readonly boolean[],
]
  ? THead extends true
    ? And<TTail>
    : false
  : true;

export type Or<TValues extends readonly boolean[]> = TValues extends readonly [
  infer THead extends boolean,
  ...infer TTail extends readonly boolean[],
]
  ? THead extends true
    ? true
    : Or<TTail>
  : false;

export type ValueOf<TValue> = TValue[keyof TValue];

export type KeysOf<TValue> = keyof TValue;

export type TupleValues<TTuple extends readonly unknown[]> = TTuple[number];

export type DiscriminantValues<TUnion, TKey extends keyof TUnion> = TUnion[TKey];

export type KindValues<TUnion extends { kind: string | number | symbol }> = TUnion["kind"];
