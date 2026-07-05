export type NonEmptyTuple<TValue extends readonly unknown[]> = TValue extends readonly [
  unknown,
  ...unknown[],
]
  ? TValue
  : never;

export type IsNonEmptyTuple<TValue extends readonly unknown[]> = TValue extends readonly [
  unknown,
  ...unknown[],
]
  ? true
  : false;
