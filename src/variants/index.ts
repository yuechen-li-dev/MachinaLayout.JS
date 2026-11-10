import { T } from "../concept/authoring";
import type { InferFields } from "../concept/infer";
import {
  type ConceptDefinition,
  type ConceptDiagnostic,
  ConceptError,
  type ConceptFieldConstraint,
  type ConceptFields,
} from "../concept/types";
import { validateConstraintValue } from "../concept/validate";
import { matchDiscriminated } from "../match/matchDiscriminated";
import type { DiscriminatedCaseMap, DiscriminatedCaseMapWithDefault } from "../match/types";

type Simplify<TValue> = { [K in keyof TValue]: TValue[K] } & {};

/** Variant name → payload fields (concept constraints). */
export type VariantSpec = { readonly [variant: string]: ConceptFields };

export type VariantOf<
  TSpec extends VariantSpec,
  TName extends keyof TSpec & string,
  TKey extends string,
> = Simplify<{ [K in TKey]: TName } & InferFields<TSpec[TName]>>;

export type VariantUnion<TSpec extends VariantSpec, TKey extends string> = {
  [TName in keyof TSpec & string]: VariantOf<TSpec, TName, TKey>;
}[keyof TSpec & string];

type PayloadArgs<TFields extends ConceptFields> =
  {} extends InferFields<TFields>
    ? [payload?: InferFields<TFields>]
    : [payload: InferFields<TFields>];

export type Variants<TSpec extends VariantSpec, TKey extends string> = {
  readonly kind: "variants";
  readonly id: string;
  readonly key: TKey;
  readonly names: readonly (keyof TSpec & string)[];
  /** Typed constructors: `Shape.make.circle({ r: 2 })` → `{ kind: "circle", r: 2 }`. */
  readonly make: {
    readonly [TName in keyof TSpec & string]: (
      ...args: PayloadArgs<TSpec[TName]>
    ) => VariantOf<TSpec, TName, TKey>;
  };
  /** Type guards on already-typed values: `Shape.is.rect(shape)`. */
  readonly is: {
    readonly [TName in keyof TSpec & string]: (
      value: VariantUnion<TSpec, TKey>,
    ) => value is Extract<VariantUnion<TSpec, TKey>, VariantOf<TSpec, TName, TKey>>;
  };
  /** Exhaustive match (add `_` for a default arm). */
  readonly match: {
    <TResult>(
      value: VariantUnion<TSpec, TKey>,
      cases: DiscriminatedCaseMap<VariantUnion<TSpec, TKey>, TKey, TResult>,
    ): TResult;
    <TResult>(
      value: VariantUnion<TSpec, TKey>,
      cases: DiscriminatedCaseMapWithDefault<VariantUnion<TSpec, TKey>, TKey, TResult>,
    ): TResult;
  };
  /** Runtime check for untrusted input (discriminant-routed, fix-hint diagnostics). */
  readonly validate: (value: unknown) => ConceptDiagnostic[];
  /** Type guard for untrusted input. */
  readonly accepts: (value: unknown) => value is VariantUnion<TSpec, TKey>;
  /** Parse untrusted input or throw `ConceptError` with diagnostics. */
  readonly parse: (value: unknown) => VariantUnion<TSpec, TKey>;
  /** One concept per variant (`Shape.concepts.circle`), including the discriminant literal. */
  readonly concepts: {
    readonly [TName in keyof TSpec & string]: ConceptDefinition<
      { readonly [K in TKey]: { readonly kind: "literal"; readonly value: TName } } & TSpec[TName]
    >;
  };
  /** The whole union as a concept constraint — usable as a field in other concepts. */
  readonly constraint: {
    readonly kind: "union";
    readonly options: readonly ConceptDefinition[];
  };
};

/**
 * Declare a discriminated union once and get its type, constructors, guards,
 * exhaustive match, and runtime validation:
 *
 * ```ts
 * const Shape = V.variants("Shape", {
 *   circle: { r: T.number({ min: 0 }) },
 *   rect: { w: T.number(), h: T.number() },
 * });
 * type Shape = V.Infer<typeof Shape>;
 * ```
 *
 * Payloads are concept fields, so this is for concrete data. Unions over
 * generic type parameters stay plain TypeScript.
 */
export function variants<const TSpec extends VariantSpec, const TKey extends string = "kind">(
  id: string,
  spec: TSpec,
  options: { readonly key?: TKey; readonly closed?: boolean } = {},
): Variants<TSpec, TKey> {
  const key = (options.key ?? "kind") as TKey;
  const names = Object.keys(spec) as (keyof TSpec & string)[];
  if (names.length === 0) {
    throw new Error(`Variants '${id}' needs at least one variant.`);
  }
  for (const name of names) {
    if (key in spec[name]) {
      throw new Error(
        `Variant '${id}.${name}' declares field '${key}', which is the discriminant; remove it.`,
      );
    }
  }

  const concepts = Object.fromEntries(
    names.map((name) => [
      name,
      T.concept({
        id: `${id}.${name}`,
        fields: { [key]: T.literal(name), ...spec[name] } as ConceptFields,
        ...(options.closed ? { closed: true } : {}),
      }),
    ]),
  ) as unknown as Variants<TSpec, TKey>["concepts"];

  const constraint = {
    kind: "union" as const,
    options: names.map((name) => concepts[name] as ConceptDefinition),
  };

  const validate = (value: unknown) =>
    validateConstraintValue(constraint as ConceptFieldConstraint, value);
  const accepts = (value: unknown): value is VariantUnion<TSpec, TKey> =>
    !validate(value).some((diagnostic) => diagnostic.severity === "error");

  const make = Object.fromEntries(
    names.map((name) => [
      name,
      (payload?: object) => ({ [key]: name, ...(payload ?? {}), [key]: name }),
    ]),
  ) as unknown as Variants<TSpec, TKey>["make"];

  const is = Object.fromEntries(
    names.map((name) => [name, (value: Record<string, unknown>) => value?.[key] === name]),
  ) as unknown as Variants<TSpec, TKey>["is"];

  return {
    kind: "variants",
    id,
    key,
    names,
    make,
    is,
    match: ((value: VariantUnion<TSpec, TKey>, cases: never) =>
      matchDiscriminated(value as Record<TKey, string>, key, cases)) as Variants<
      TSpec,
      TKey
    >["match"],
    validate,
    accepts,
    parse: (value) => {
      const diagnostics = validate(value);
      if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        throw new ConceptError(
          id,
          diagnostics,
          `Value is not a valid ${id}: ${diagnostics
            .filter((diagnostic) => diagnostic.severity === "error")
            .map((diagnostic) => `${diagnostic.path || "<root>"} ${diagnostic.message}`)
            .join("; ")}`,
        );
      }
      return value as VariantUnion<TSpec, TKey>;
    },
    concepts,
    constraint,
  };
}

/** `type Shape = V.Infer<typeof Shape>`. */
export type InferVariants<TVariants> =
  TVariants extends Variants<infer TSpec, infer TKey> ? VariantUnion<TSpec, TKey> : never;

/** One variant's type: `V.Of<typeof Shape, "circle">`. */
export type InferVariant<TVariants, TName extends string> =
  TVariants extends Variants<infer TSpec, infer TKey>
    ? Extract<VariantUnion<TSpec, TKey>, { readonly [K in TKey]: TName }>
    : never;

export const V = { variants } as const;

export declare namespace V {
  export type Infer<TVariants> = InferVariants<TVariants>;
  export type Of<TVariants, TName extends string> = InferVariant<TVariants, TName>;
}
