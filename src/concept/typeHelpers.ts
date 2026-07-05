export declare namespace ConceptTypeHelpers {
  export type HasField<TKey extends PropertyKey, TValue> = {
    readonly [K in TKey]: TValue;
  };

  export type OptionalField<TKey extends PropertyKey, TValue> = {
    readonly [K in TKey]?: TValue;
  };

  export type HasId<TId = string> = HasField<"id", TId>;

  export type HasKind<TKind = string> = HasField<"kind", TKind>;

  export type And<TLeft, TRight> = TLeft & TRight;

  export type All<TItems extends readonly unknown[]> = TItems extends readonly [
    infer THead,
    ...infer TTail,
  ]
    ? THead & All<TTail>
    : unknown;

  export type ConceptType<TShape extends object> = TShape;

  export type Extends<TValue, TExpected> = TValue extends TExpected ? true : false;

  export type Equal<TLeft, TRight> =
    (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;

  export type Assert<TValue extends true> = TValue;

  export type Satisfies<TValue, TConcept> = TValue extends TConcept ? TValue : never;
}

export type HasField<TKey extends PropertyKey, TValue> = ConceptTypeHelpers.HasField<TKey, TValue>;

export type OptionalField<TKey extends PropertyKey, TValue> = ConceptTypeHelpers.OptionalField<
  TKey,
  TValue
>;

export type HasId<TId = string> = ConceptTypeHelpers.HasId<TId>;

export type HasKind<TKind = string> = ConceptTypeHelpers.HasKind<TKind>;

export type And<TLeft, TRight> = ConceptTypeHelpers.And<TLeft, TRight>;

export type All<TItems extends readonly unknown[]> = ConceptTypeHelpers.All<TItems>;

export type ConceptType<TShape extends object> = ConceptTypeHelpers.ConceptType<TShape>;

export type Extends<TValue, TExpected> = ConceptTypeHelpers.Extends<TValue, TExpected>;

export type Equal<TLeft, TRight> = ConceptTypeHelpers.Equal<TLeft, TRight>;

export type Assert<TValue extends true> = ConceptTypeHelpers.Assert<TValue>;

export type Satisfies<TValue, TConcept> = ConceptTypeHelpers.Satisfies<TValue, TConcept>;
