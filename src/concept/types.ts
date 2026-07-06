export type ConceptFieldConstraint =
  | {
      readonly kind: "string";
      readonly optional?: boolean;
    }
  | {
      readonly kind: "number";
      readonly optional?: boolean;
    }
  | {
      readonly kind: "boolean";
      readonly optional?: boolean;
    }
  | {
      readonly kind: "function";
      readonly optional?: boolean;
    }
  | {
      readonly kind: "object";
      readonly optional?: boolean;
    }
  | {
      readonly kind: "array";
      readonly optional?: boolean;
    }
  | {
      readonly kind: "literal";
      readonly value: string | number | boolean;
      readonly optional?: boolean;
    };

export type ConceptDefinition = {
  readonly kind: "concept";
  readonly id: string;
  readonly description?: string;
  readonly fields: Record<string, ConceptFieldConstraint>;
  readonly composedFrom?: readonly ConceptDefinition[];
};

export type ConceptDiagnostic = {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly message: string;
  readonly path?: string;
};

export type ConceptDescription = {
  readonly kind: "concept";
  readonly id: string;
  readonly description?: string;
  readonly fieldNames: readonly string[];
  readonly composedFrom: readonly string[];
  readonly fieldEntries: readonly string[];
};

export type ConceptPrimitiveKind = "string" | "number" | "boolean" | "enum" | "literal" | "unknown";

export type ConceptRecord = {
  readonly kind: "conceptRecord";
  readonly concept: string;
  readonly type: ConceptPrimitiveKind;
  readonly label: string;
  readonly required: boolean;
  readonly description?: string;
  readonly diagnosticLabel?: string;
  readonly controlHint?: string;
  readonly valuePath?: string;
  readonly changeKey?: string;
  readonly enumValues?: readonly (string | number | boolean)[];
  readonly literalValue?: string | number | boolean;
  readonly placeholder?: string;
  readonly testId?: string;
};

export type ConceptTableDescription = {
  readonly kind: "conceptTableDescription";
  readonly tableId: string;
  readonly conceptCount: number;
  readonly requiredCount: number;
  readonly types: readonly ConceptPrimitiveKind[];
};

export type ConceptsFromTableOptions = {
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

  constructor(conceptId: string, diagnostics: readonly ConceptDiagnostic[]) {
    super(`Concept '${conceptId}' validation failed.`);
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

export type ConceptValue<_TConcept extends ConceptDefinition> = Record<string, unknown>;
