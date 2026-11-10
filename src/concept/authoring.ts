import { describeConcept, describeTemplate, explainConcept } from "./describe";
import { counterexamples, example } from "./fixtures";
import type * as InferTypes from "./infer";
import type { ConceptMatches, ConceptMismatchKeys } from "./infer";
import { overload } from "./overload";
import { registry } from "./registry";
import {
  conceptFields,
  constraintsEquivalent,
  describeConstraintType,
  isConceptDefinition,
} from "./structure";
import { conceptFromTable, conceptTableSchema, validateConceptTable } from "./table";
import { runTemplate, template } from "./template";
import {
  type ConceptDefinition,
  ConceptError,
  type ConceptFieldConstraint,
  type ConceptFields,
  type CustomConstraint,
  type FieldMeta,
  type FunctionConstraint,
} from "./types";
import { acceptsValue, assertConceptValue, isConceptValue, validateConceptValue } from "./validate";

function assertConceptId(id: string): void {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error("Concept id must be non-empty.");
  }
}

type Simplify<TValue> = { [K in keyof TValue]: TValue[K] } & {};

type StringOptions = FieldMeta & {
  readonly nonEmpty?: boolean;
  readonly brand?: string;
};

type NumberOptions = FieldMeta & {
  readonly finite?: boolean;
  readonly int?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly allowNaN?: boolean;
  readonly brand?: string;
};

type Primitive = string | number | boolean;

type EmptyFields = Record<never, never>;

export function string(): { readonly kind: "string" };
export function string<const TOptions extends StringOptions>(
  options: TOptions,
): Simplify<{ readonly kind: "string" } & TOptions>;
export function string(options?: StringOptions) {
  return { kind: "string" as const, ...options };
}

/**
 * Numbers reject NaN by default (pass `allowNaN: true` to opt out).
 * `finite`, `int`, `min`, `max` add refinements TypeScript cannot express.
 */
export function number(): { readonly kind: "number" };
export function number<const TOptions extends NumberOptions>(
  options: TOptions,
): Simplify<{ readonly kind: "number" } & TOptions>;
export function number(options?: NumberOptions) {
  return { kind: "number" as const, ...options };
}

export function boolean() {
  return { kind: "boolean" as const };
}

/** Any present value; only absence is an error. Infers `unknown`. */
export function unknown() {
  return { kind: "unknown" as const };
}

type WithMeta<TConstraint extends ConceptFieldConstraint> = TConstraint extends ConceptDefinition
  ? { readonly kind: "object"; readonly shape: TConstraint }
  : TConstraint;

/**
 * Attach presentation metadata (label, placeholder, controlHint, …) to any
 * constraint. Metadata never affects validation, inference, or refinement.
 */
export function meta<const TConstraint extends ConceptFieldConstraint>(
  constraint: TConstraint,
  fieldMeta: FieldMeta,
): WithMeta<TConstraint> {
  if (isConceptDefinition(constraint)) {
    return { kind: "object", shape: constraint, ...fieldMeta } as WithMeta<TConstraint>;
  }
  return { ...constraint, ...fieldMeta } as WithMeta<TConstraint>;
}

/**
 * Runtime can only check `typeof value === "function"`; the signature is a
 * compile-time promise: `T.fn<(rect: Rect) => void>()`.
 */
export function fn<TFn = (...args: never[]) => unknown>(): FunctionConstraint<TFn> {
  return { kind: "function" } as FunctionConstraint<TFn>;
}

export function object(): { readonly kind: "object" };
export function object<const TShape extends ConceptDefinition>(
  shape: TShape,
): { readonly kind: "object"; readonly shape: TShape };
export function object(shape?: ConceptDefinition) {
  return shape ? { kind: "object" as const, shape } : { kind: "object" as const };
}

export function array(): { readonly kind: "array" };
export function array<const TElement extends ConceptFieldConstraint>(
  element: TElement,
  options?: { readonly minLength?: number },
): { readonly kind: "array"; readonly element: TElement; readonly minLength?: number };
export function array(element?: ConceptFieldConstraint, options?: { readonly minLength?: number }) {
  if (!element) {
    return { kind: "array" as const };
  }
  return options?.minLength !== undefined
    ? { kind: "array" as const, element, minLength: options.minLength }
    : { kind: "array" as const, element };
}

export function literal<const TValue extends Primitive>(value: TValue) {
  return { kind: "literal" as const, value };
}

/** `T.oneOf("start", "center", "end")` → `"start" | "center" | "end"`. */
export function oneOf<const TValues extends readonly Primitive[]>(...values: TValues) {
  return { kind: "enum" as const, values };
}

/** `T.union(T.number(), Px, Ui)`; object branches with literal fields get discriminant routing. */
export function union<const TOptions extends readonly ConceptFieldConstraint[]>(
  ...options: TOptions
) {
  return { kind: "union" as const, options };
}

/** Escape hatch for checks the built-in kinds cannot express; the guard's type is inferred. */
export function custom<TValue>(
  name: string,
  check: (value: unknown) => value is TValue,
  options?: { readonly example?: TValue; readonly description?: string },
): CustomConstraint<TValue> {
  return { kind: "custom", name, check, ...options } as CustomConstraint<TValue>;
}

type Optionalized<TConstraint extends ConceptFieldConstraint> =
  TConstraint extends ConceptDefinition
    ? { readonly kind: "object"; readonly shape: TConstraint; readonly optional: true }
    : Simplify<TConstraint & { readonly optional: true }>;

export function optional<const TConstraint extends ConceptFieldConstraint>(
  constraint: TConstraint,
): Optionalized<TConstraint> {
  if (isConceptDefinition(constraint)) {
    return { kind: "object", shape: constraint, optional: true } as Optionalized<TConstraint>;
  }
  return { ...constraint, optional: true } as Optionalized<TConstraint>;
}

export function fields<const TFields extends ConceptFields>(input: TFields): TFields {
  return { ...input };
}

export function concept<const TFields extends ConceptFields = EmptyFields>(input: {
  id: string;
  description?: string;
  fields?: TFields;
  /** Reject unknown keys (with did-you-mean). Use for authored records, not wire payloads. */
  closed?: boolean;
}): ConceptDefinition<TFields> {
  assertConceptId(input.id);
  return {
    kind: "concept",
    id: input.id,
    description: input.description,
    fields: { ...(input.fields ?? {}) } as TFields,
    ...(input.closed ? { closed: true } : {}),
  };
}

type MergeConceptFields<TConcepts extends readonly ConceptDefinition[]> =
  TConcepts extends readonly [
    infer THead extends ConceptDefinition,
    ...infer TTail extends readonly ConceptDefinition[],
  ]
    ? THead["fields"] & MergeConceptFields<TTail>
    : TConcepts extends readonly []
      ? EmptyFields
      : ConceptFields;

/**
 * Merge concepts into a new one. Throws `ConceptError` (ConflictingConceptField)
 * when two sources disagree on a field instead of silently letting the last win.
 */
export function compose<
  const TConcepts extends readonly ConceptDefinition[],
  const TFields extends ConceptFields = EmptyFields,
>(input: {
  id: string;
  description?: string;
  concepts: TConcepts;
  fields?: TFields;
  closed?: boolean;
}): ConceptDefinition<Simplify<MergeConceptFields<TConcepts> & TFields>> {
  assertConceptId(input.id);

  const merged: Record<string, ConceptFieldConstraint> = {};
  const origins: Record<string, string> = {};
  const conflicts: string[] = [];
  const overrides: ConceptFields = input.fields ?? {};

  for (const source of input.concepts) {
    for (const [fieldName, constraint] of Object.entries(source.fields)) {
      if (fieldName in overrides) {
        continue; // explicit local override resolves any source disagreement
      }
      const origin = source.fieldOrigins?.[fieldName] ?? source.id;
      const previous = merged[fieldName];
      if (previous === undefined) {
        merged[fieldName] = constraint;
        origins[fieldName] = origin;
      } else if (!constraintsEquivalent(previous, constraint, acceptsValue)) {
        conflicts.push(
          `Field '${fieldName}' conflicts between '${origins[fieldName]}' (${describeConstraintType(previous)}) and '${origin}' (${describeConstraintType(constraint)}); override it in \`fields\` to pick one.`,
        );
      }
    }
  }
  for (const [fieldName, constraint] of Object.entries(overrides)) {
    merged[fieldName] = constraint;
    origins[fieldName] = input.id;
  }

  if (conflicts.length > 0) {
    throw new ConceptError(
      input.id,
      conflicts.map((message) => ({
        severity: "error" as const,
        code: "ConflictingConceptField",
        message,
      })),
      `Concept '${input.id}' composition failed.\n${conflicts.join("\n")}`,
    );
  }

  return {
    kind: "concept",
    id: input.id,
    description: input.description,
    fields: merged as Simplify<MergeConceptFields<TConcepts> & TFields>,
    composedFrom: [...input.concepts],
    fieldOrigins: origins,
    ...(input.closed ? { closed: true } : {}),
  };
}

/**
 * Compile-time drift guard between a hand-written type and a concept:
 * `export const Row = T.implements<LayoutRow>()(T.concept({...}))`.
 * A mismatch is a compiler error that names missing/extra/differing fields.
 */
export function implementsType<TType>() {
  return <const TConcept extends ConceptDefinition>(
    concept: TConcept &
      (ConceptMatches<TConcept, TType> extends true
        ? unknown
        : { readonly [K in ConceptMismatchKeys<TConcept, TType>]: K }),
  ): TConcept => concept;
}

const toolkit = {
  concept,
  compose,
  validate: validateConceptValue,
  assert: assertConceptValue,
  is: isConceptValue,
  accepts: acceptsValue,
  implements: implementsType,
  describe: describeConcept,
  explain: explainConcept,
  template,
  runTemplate,
  describeTemplate,
  overload,
  registry,
  fieldsOf: conceptFields,
  example,
  counterexamples,
  fields,
  string,
  number,
  boolean,
  unknown,
  meta,
  fn,
  function: fn,
  object,
  array,
  literal,
  oneOf,
  union,
  custom,
  optional,
  conceptTableSchema,
  conceptFromTable,
  validateConceptTable,
} as const;

/** Explicitly annotated so `T.assert(...)` works as an assertion function. */
export type ConceptToolkit = Omit<typeof toolkit, "assert"> & {
  readonly assert: typeof assertConceptValue;
};

export const T: ConceptToolkit = toolkit;

export declare namespace T {
  /** TypeScript type of a concept's values: `type Rect = T.Infer<typeof RectLike>`. */
  export type Infer<TConcept> = InferTypes.InferConcept<TConcept>;
  export type Matches<TConcept, TType> = InferTypes.ConceptMatches<TConcept, TType>;
}
