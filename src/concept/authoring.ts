import { describeConcept, describeTemplate } from "./describe";
import { runTemplate, template } from "./template";
import { assertConceptValue, validateConceptValue } from "./validate";
import type * as TypeHelpers from "./typeHelpers";
import type { ConceptDefinition, ConceptFieldConstraint } from "./types";

function cloneConstraint(constraint: ConceptFieldConstraint): ConceptFieldConstraint {
  if (constraint.kind === "literal") {
    return {
      kind: "literal",
      value: constraint.value,
      optional: constraint.optional,
    };
  }

  return {
    kind: constraint.kind,
    optional: constraint.optional,
  };
}

function cloneFields(
  input: Record<string, ConceptFieldConstraint> | undefined,
): Record<string, ConceptFieldConstraint> {
  const cloned: Record<string, ConceptFieldConstraint> = {};
  for (const [fieldName, constraint] of Object.entries(input ?? {})) {
    cloned[fieldName] = cloneConstraint(constraint);
  }
  return cloned;
}

function assertConceptId(id: string): void {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error("Concept id must be non-empty.");
  }
}

export function string() {
  return { kind: "string" as const };
}

export function number() {
  return { kind: "number" as const };
}

export function boolean() {
  return { kind: "boolean" as const };
}

export function fn() {
  return { kind: "function" as const };
}

export function object() {
  return { kind: "object" as const };
}

export function array() {
  return { kind: "array" as const };
}

export function literal(value: string | number | boolean) {
  return {
    kind: "literal" as const,
    value,
  };
}

export function optional<TConstraint extends ConceptFieldConstraint>(
  constraint: TConstraint,
): TConstraint & { readonly optional: true } {
  return {
    ...cloneConstraint(constraint),
    optional: true,
  } as TConstraint & { readonly optional: true };
}

export function fields(
  input: Record<string, ConceptFieldConstraint>,
): Record<string, ConceptFieldConstraint> {
  return cloneFields(input);
}

export function concept(input: {
  id: string;
  description?: string;
  fields?: Record<string, ConceptFieldConstraint>;
}): ConceptDefinition {
  assertConceptId(input.id);
  return {
    kind: "concept",
    id: input.id,
    description: input.description,
    fields: cloneFields(input.fields),
  };
}

export function compose(input: {
  id: string;
  description?: string;
  concepts: readonly ConceptDefinition[];
  fields?: Record<string, ConceptFieldConstraint>;
}): ConceptDefinition {
  assertConceptId(input.id);

  const mergedFields: Record<string, ConceptFieldConstraint> = {};
  for (const source of input.concepts) {
    Object.assign(mergedFields, cloneFields(source.fields));
  }
  Object.assign(mergedFields, cloneFields(input.fields));

  return {
    kind: "concept",
    id: input.id,
    description: input.description,
    fields: mergedFields,
    composedFrom: [...input.concepts],
  };
}

export const T = {
  concept,
  compose,
  validate: validateConceptValue,
  assert: assertConceptValue,
  describe: describeConcept,
  template,
  runTemplate,
  describeTemplate,
  fields,
  string,
  number,
  boolean,
  fn,
  function: fn,
  object,
  array,
  literal,
  optional,
} as const;

export declare namespace T {
  export type HasField<TKey extends PropertyKey, TValue> = TypeHelpers.ConceptTypeHelpers.HasField<
    TKey,
    TValue
  >;
  export type OptionalField<
    TKey extends PropertyKey,
    TValue,
  > = TypeHelpers.ConceptTypeHelpers.OptionalField<TKey, TValue>;
  export type HasId<TId = string> = TypeHelpers.ConceptTypeHelpers.HasId<TId>;
  export type HasKind<TKind = string> = TypeHelpers.ConceptTypeHelpers.HasKind<TKind>;
  export type And<TLeft, TRight> = TypeHelpers.ConceptTypeHelpers.And<TLeft, TRight>;
  export type All<TItems extends readonly unknown[]> = TypeHelpers.ConceptTypeHelpers.All<TItems>;
  export type ConceptType<TShape extends object> =
    TypeHelpers.ConceptTypeHelpers.ConceptType<TShape>;
  export type Extends<TValue, TExpected> = TypeHelpers.ConceptTypeHelpers.Extends<
    TValue,
    TExpected
  >;
  export type Equal<TLeft, TRight> = TypeHelpers.ConceptTypeHelpers.Equal<TLeft, TRight>;
  export type Assert<TValue extends true> = TypeHelpers.ConceptTypeHelpers.Assert<TValue>;
  export type Satisfies<TValue, TConcept> = TypeHelpers.ConceptTypeHelpers.Satisfies<
    TValue,
    TConcept
  >;
}
