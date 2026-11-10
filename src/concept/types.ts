import type { DiagnosticFix, DiagnosticOf } from "../diagnostics/types";

declare const phantomType: unique symbol;
declare const brandKey: unique symbol;

/**
 * Compile-time-only carrier for types the runtime cannot check (function
 * signatures, custom guards). Never present on runtime records.
 */
export type Phantom<TValue> = { readonly [phantomType]?: TValue };

/** Nominal tag added to inferred number/string types by `{ brand }`. */
export type Brand<TBrand extends string> = { readonly [brandKey]: TBrand };

/**
 * Presentation/projection metadata a field can carry (formerly the separate
 * `ConceptRecord` model). Ignored by validation, inference, and refinement.
 */
export type FieldMeta = {
  readonly label?: string;
  readonly description?: string;
  readonly diagnosticLabel?: string;
  readonly controlHint?: string;
  readonly valuePath?: string;
  readonly changeKey?: string;
  readonly placeholder?: string;
  readonly testId?: string;
};

export const fieldMetaKeys = [
  "label",
  "description",
  "diagnosticLabel",
  "controlHint",
  "valuePath",
  "changeKey",
  "placeholder",
  "testId",
] as const satisfies readonly (keyof FieldMeta)[];

type ConstraintBase = FieldMeta & {
  readonly optional?: boolean;
};

export type StringConstraint = ConstraintBase & {
  readonly kind: "string";
  readonly nonEmpty?: boolean;
  readonly brand?: string;
};

export type NumberConstraint = ConstraintBase & {
  readonly kind: "number";
  /** Reject Infinity / -Infinity. NaN is always rejected unless `allowNaN`. */
  readonly finite?: boolean;
  readonly int?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly allowNaN?: boolean;
  readonly brand?: string;
};

export type BooleanConstraint = ConstraintBase & { readonly kind: "boolean" };

/** Any present value (only absence is rejected). */
export type UnknownConstraint = ConstraintBase & { readonly kind: "unknown" };

export type FunctionConstraint<TFn = (...args: never[]) => unknown> = ConstraintBase &
  Phantom<TFn> & { readonly kind: "function" };

export type ObjectConstraint<TShape extends ConceptDefinition | undefined = undefined> =
  ConstraintBase & {
    readonly kind: "object";
    readonly shape?: TShape;
  };

export type ArrayConstraint<TElement extends ConceptFieldConstraint | undefined = undefined> =
  ConstraintBase & {
    readonly kind: "array";
    readonly element?: TElement;
    readonly minLength?: number;
  };

export type LiteralConstraint<
  TValue extends string | number | boolean = string | number | boolean,
> = ConstraintBase & {
  readonly kind: "literal";
  readonly value: TValue;
};

export type EnumConstraint<
  TValues extends readonly (string | number | boolean)[] = readonly (string | number | boolean)[],
> = ConstraintBase & {
  readonly kind: "enum";
  readonly values: TValues;
};

export type UnionConstraint<
  TOptions extends readonly ConceptFieldConstraint[] = readonly ConceptFieldConstraint[],
> = ConstraintBase & {
  readonly kind: "union";
  readonly options: TOptions;
};

export type CustomConstraint<TValue = unknown> = ConstraintBase &
  Phantom<TValue> & {
    readonly kind: "custom";
    readonly name: string;
    readonly check: (value: unknown) => boolean;
    readonly example?: TValue;
  };

interface WideObjectConstraint extends ConstraintBase {
  readonly kind: "object";
  readonly shape?: ConceptDefinition;
}

interface WideArrayConstraint extends ConstraintBase {
  readonly kind: "array";
  readonly element?: ConceptFieldConstraint;
  readonly minLength?: number;
}

interface WideUnionConstraint extends ConstraintBase {
  readonly kind: "union";
  readonly options: readonly ConceptFieldConstraint[];
}

/**
 * A field constraint. A `ConceptDefinition` is itself a constraint: using a
 * concept as a field means "a nested value satisfying that concept".
 */
export type ConceptFieldConstraint =
  | StringConstraint
  | NumberConstraint
  | BooleanConstraint
  | UnknownConstraint
  | FunctionConstraint<unknown>
  | WideObjectConstraint
  | WideArrayConstraint
  | LiteralConstraint
  | EnumConstraint
  | WideUnionConstraint
  | CustomConstraint<unknown>
  | ConceptDefinition;

export type ConceptConstraintKind = Exclude<ConceptFieldConstraint["kind"], "concept">;

export interface ConceptFields {
  readonly [field: string]: ConceptFieldConstraint;
}

export interface ConceptDefinition<TFields extends ConceptFields = ConceptFields> {
  readonly kind: "concept";
  readonly id: string;
  readonly description?: string;
  readonly fields: TFields;
  readonly composedFrom?: readonly ConceptDefinition[];
  /** Closed concepts reject unknown keys (with did-you-mean suggestions). */
  readonly closed?: boolean;
  /** For composed concepts: which source concept contributed each field. */
  readonly fieldOrigins?: { readonly [field: string]: string };
}

/** @deprecated Alias of `DiagnosticFix` (now part of every `MachinaDiagnostic`). */
export type ConceptFix = DiagnosticFix;

export type ConceptDiagnostic = DiagnosticOf<{
  readonly severity: "error" | "warning";
  /** Concept that declared the failing field (origin, for composed concepts). */
  readonly concept?: string;
  readonly expected?: string;
  readonly received?: string;
}>;

export type ConceptDescription = {
  readonly kind: "concept";
  readonly id: string;
  readonly description?: string;
  readonly fieldNames: readonly string[];
  readonly composedFrom: readonly string[];
  readonly fieldEntries: readonly string[];
  readonly closed?: boolean;
};

/** Field types a concept table row can declare (the `type` column vocabulary). */
export type ConceptPrimitiveKind = "string" | "number" | "boolean" | "enum" | "literal" | "unknown";

export type ConceptFromTableOptions = {
  /** Concept id; defaults to the table id. */
  readonly id?: string;
  readonly description?: string;
  readonly closed?: boolean;
  readonly conceptColumn?: string;
  readonly typeColumn?: string;
  readonly labelColumn?: string;
  readonly requiredColumn?: string;
  readonly descriptionColumn?: string;
  readonly diagnosticLabelColumn?: string;
  readonly controlHintColumn?: string;
  readonly valuePathColumn?: string;
  readonly changeKeyColumn?: string;
  readonly enumValuesColumn?: string;
  readonly literalValueColumn?: string;
  readonly placeholderColumn?: string;
  readonly testIdColumn?: string;
};

export class ConceptError extends Error {
  readonly conceptId: string;
  readonly diagnostics: readonly ConceptDiagnostic[];

  constructor(conceptId: string, diagnostics: readonly ConceptDiagnostic[], message?: string) {
    super(message ?? `Concept '${conceptId}' validation failed.`);
    this.name = "ConceptError";
    this.conceptId = conceptId;
    this.diagnostics = diagnostics;
  }
}

export type TemplateRecord<TInput, TOutput> = {
  readonly kind: "template";
  readonly id: string;
  readonly requires: ConceptDefinition;
  readonly run: (input: TInput) => TOutput;
  readonly description?: string;
};

export type TemplateDescription = {
  readonly kind: "template";
  readonly id: string;
  readonly description?: string;
  readonly requires: ConceptDescription;
};
