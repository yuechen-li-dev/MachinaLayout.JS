import type {
  Brand,
  ConceptDefinition,
  ConceptFieldConstraint,
  ConceptFields,
  Phantom,
} from "./types";

type Simplify<TValue> = { [K in keyof TValue]: TValue[K] } & {};

type PhantomOf<TConstraint, TDefault> =
  TConstraint extends Phantom<infer TValue>
    ? unknown extends TValue
      ? TDefault
      : TValue
    : TDefault;

type OptionalKeys<TFields extends ConceptFields> = {
  [K in keyof TFields]: TFields[K] extends { readonly optional: true } ? K : never;
}[keyof TFields];

type RequiredKeys<TFields extends ConceptFields> = Exclude<keyof TFields, OptionalKeys<TFields>>;

/** TypeScript type of the values accepted by one field constraint. */
export type InferConstraint<TConstraint> = [ConceptFieldConstraint] extends [TConstraint]
  ? unknown // the wide, un-narrowed constraint type: stop instead of recursing forever
  : InferNarrow<TConstraint>;

type InferNarrow<TConstraint> =
  TConstraint extends ConceptDefinition<infer TFields>
    ? InferFields<TFields>
    : TConstraint extends { readonly kind: "string"; readonly brand: infer TBrand extends string }
      ? string & Brand<TBrand>
      : TConstraint extends { readonly kind: "string" }
        ? string
        : TConstraint extends {
              readonly kind: "number";
              readonly brand: infer TBrand extends string;
            }
          ? number & Brand<TBrand>
          : TConstraint extends { readonly kind: "number" }
            ? number
            : TConstraint extends { readonly kind: "boolean" }
              ? boolean
              : TConstraint extends { readonly kind: "function" }
                ? PhantomOf<TConstraint, (...args: never[]) => unknown>
                : TConstraint extends {
                      readonly kind: "object";
                      readonly shape: infer TShape extends ConceptDefinition;
                    }
                  ? InferConstraint<TShape>
                  : TConstraint extends { readonly kind: "object" }
                    ? Record<string, unknown>
                    : TConstraint extends {
                          readonly kind: "array";
                          readonly element: infer TElement extends ConceptFieldConstraint;
                        }
                      ? InferConstraint<TElement>[]
                      : TConstraint extends { readonly kind: "array" }
                        ? unknown[]
                        : TConstraint extends {
                              readonly kind: "literal";
                              readonly value: infer TValue;
                            }
                          ? TValue
                          : TConstraint extends {
                                readonly kind: "enum";
                                readonly values: readonly (infer TValue)[];
                              }
                            ? TValue
                            : TConstraint extends {
                                  readonly kind: "union";
                                  readonly options: readonly (infer TOption)[];
                                }
                              ? InferConstraint<TOption>
                              : TConstraint extends { readonly kind: "custom" }
                                ? PhantomOf<TConstraint, unknown>
                                : unknown;

export type InferFields<TFields extends ConceptFields> = string extends keyof TFields
  ? Record<string, unknown> // un-narrowed ConceptDefinition
  : InferKnownFields<TFields>;

type InferKnownFields<TFields extends ConceptFields> = Simplify<
  { -readonly [K in RequiredKeys<TFields>]: InferConstraint<TFields[K]> } & {
    -readonly [K in OptionalKeys<TFields>]?: InferConstraint<TFields[K]>;
  }
>;

/** TypeScript type of the values a concept accepts: `type Rect = Infer<typeof RectLike>`. */
export type Infer<TConcept> = InferConcept<TConcept>;

/** Same as `Infer`; distinct name so bundled `.d.ts` namespaces cannot self-reference. */
export type InferConcept<TConcept> = InferConstraint<TConcept>;

type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? true : false;

type MismatchOf<TInferred, TType> = {
  readonly conceptDoesNotMatchType: {
    readonly missingInConcept: Exclude<keyof TType, keyof TInferred>;
    readonly extraInConcept: Exclude<keyof TInferred, keyof TType>;
    readonly differingFields: {
      readonly [K in keyof TType & keyof TInferred as Equal<TType[K], TInferred[K]> extends true
        ? never
        : K]: { readonly type: TType[K]; readonly concept: TInferred[K] };
    };
  };
};

/**
 * Short, structured explanation of why a concept and a hand-written type
 * disagree. Surfaces in the compiler error from `T.implements<Type>()(concept)`.
 */
export type ConceptMismatch<TConcept, TType> = MismatchOf<Infer<TConcept>, TType>;

type DifferingKeys<TInferred, TType> = {
  [K in keyof TType & keyof TInferred]: Equal<TType[K], TInferred[K]> extends true ? never : K;
}[keyof TType & keyof TInferred];

/**
 * The mismatch encoded as property names, because TypeScript prints missing
 * property names in full ("missing the following properties: 'missing in
 * concept: height', 'differs: x'") while it truncates large type bodies.
 */
export type ConceptMismatchKeys<TConcept, TType> =
  | `missing in concept: ${Exclude<keyof TType, keyof Infer<TConcept>> & string}`
  | `extra in concept: ${Exclude<keyof Infer<TConcept>, keyof TType> & string}`
  | `differs: ${DifferingKeys<Infer<TConcept>, TType> & string}`;

/** `true` when the concept's inferred type is exactly `TType`. */
export type ConceptMatches<TConcept, TType> = Equal<Infer<TConcept>, TType>;
