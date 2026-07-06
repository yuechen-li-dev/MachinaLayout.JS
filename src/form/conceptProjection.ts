import { conceptsFromTable, type ConceptPrimitiveKind, type ConceptRecord } from "../concept";
import type { ColumnarTable, TableDiagnostic } from "../table/types";
import { TableError } from "../table/validate";
import type {
  ConceptFormProjectionOptions,
  FieldsFromConceptTableOptions,
  FormFieldControl,
  FormFieldRecord,
  FormFieldValue,
} from "./types";

const formFieldControls = ["input", "textarea"] as const satisfies readonly FormFieldControl[];
const conceptPrimitiveKinds = [
  "string",
  "number",
  "boolean",
  "enum",
  "literal",
  "unknown",
] as const satisfies readonly ConceptPrimitiveKind[];

type ProjectionContext = { readonly index: number };

type ProjectedConceptField = {
  readonly field: FormFieldRecord;
  readonly inputId: string;
  readonly testId?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFormFieldControl(value: unknown): value is FormFieldControl {
  return typeof value === "string" && formFieldControls.some((candidate) => candidate === value);
}

function isConceptPrimitiveKind(value: unknown): value is ConceptPrimitiveKind {
  return (
    typeof value === "string" && conceptPrimitiveKinds.some((candidate) => candidate === value)
  );
}

function sanitizeIdSegment(value: string, fallback: string): string {
  const sanitized = value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized === "" ? fallback : sanitized;
}

function conceptPath(index: number, property?: string): string {
  return property === undefined ? `concepts[${index}]` : `concepts[${index}].${property}`;
}

function createDiagnostic(
  index: number,
  diagnostic: {
    readonly code: TableDiagnostic["code"];
    readonly message: string;
    readonly column?: string;
    readonly path?: string;
  },
): TableDiagnostic {
  return {
    severity: "error",
    code: diagnostic.code,
    message: diagnostic.message,
    row: index,
    column: diagnostic.column,
    path: diagnostic.path ?? conceptPath(index, diagnostic.column),
  };
}

function resolveControlHint(
  concept: ConceptRecord,
  index: number,
  options: ConceptFormProjectionOptions | undefined,
  diagnostics: TableDiagnostic[],
): FormFieldControl {
  const context = { index } satisfies ProjectionContext;

  if (options?.controlForConcept !== undefined) {
    try {
      const control = options.controlForConcept(concept, context);
      if (control !== undefined) {
        if (!isFormFieldControl(control)) {
          diagnostics.push(
            createDiagnostic(index, {
              code: "InvalidConceptFormControl",
              column: "control",
              message: `Projected control ${JSON.stringify(control)} is not supported for concept ${JSON.stringify(concept.concept)}.`,
            }),
          );
          return options.defaultControl ?? "input";
        }
        return control;
      }
    } catch (error) {
      diagnostics.push(
        createDiagnostic(index, {
          code: "ConceptFormControlResolverError",
          column: "control",
          message: `controlForConcept threw for concept ${JSON.stringify(concept.concept)}: ${error instanceof Error ? error.message : String(error)}.`,
        }),
      );
      return options.defaultControl ?? "input";
    }
  }

  if (concept.controlHint !== undefined) {
    if (isFormFieldControl(concept.controlHint)) {
      return concept.controlHint;
    }

    diagnostics.push(
      createDiagnostic(index, {
        code: "InvalidConceptFormControl",
        column: "controlHint",
        message: `Concept controlHint ${JSON.stringify(concept.controlHint)} is not supported for concept ${JSON.stringify(concept.concept)}.`,
      }),
    );
  }

  return options?.defaultControl ?? "input";
}

function resolveValue(
  concept: ConceptRecord,
  index: number,
  options: ConceptFormProjectionOptions | undefined,
  diagnostics: TableDiagnostic[],
): FormFieldValue {
  const context = { index } satisfies ProjectionContext;

  if (options?.valueForConcept !== undefined) {
    try {
      return options.valueForConcept(concept, context);
    } catch (error) {
      diagnostics.push(
        createDiagnostic(index, {
          code: "ConceptFormValueResolverError",
          column: "value",
          message: `valueForConcept threw for concept ${JSON.stringify(concept.concept)}: ${error instanceof Error ? error.message : String(error)}.`,
        }),
      );
      return undefined;
    }
  }

  return options?.values?.[concept.concept];
}

function resolveDisabled(
  concept: ConceptRecord,
  index: number,
  options: ConceptFormProjectionOptions | undefined,
  diagnostics: TableDiagnostic[],
): boolean {
  const context = { index } satisfies ProjectionContext;

  if (options?.disabledForConcept !== undefined) {
    try {
      return options.disabledForConcept(concept, context);
    } catch (error) {
      diagnostics.push(
        createDiagnostic(index, {
          code: "ConceptFormDisabledResolverError",
          column: "disabled",
          message: `disabledForConcept threw for concept ${JSON.stringify(concept.concept)}: ${error instanceof Error ? error.message : String(error)}.`,
        }),
      );
      return false;
    }
  }

  if (typeof options?.disabled === "function") {
    try {
      return options.disabled(concept, context);
    } catch (error) {
      diagnostics.push(
        createDiagnostic(index, {
          code: "ConceptFormDisabledResolverError",
          column: "disabled",
          message: `disabled resolver threw for concept ${JSON.stringify(concept.concept)}: ${error instanceof Error ? error.message : String(error)}.`,
        }),
      );
      return false;
    }
  }

  if (typeof options?.disabled === "boolean") {
    return options.disabled;
  }

  return false;
}

function projectConceptFields(
  concepts: readonly ConceptRecord[],
  options: ConceptFormProjectionOptions | undefined,
): {
  readonly diagnostics: readonly TableDiagnostic[];
  readonly fields: readonly ProjectedConceptField[];
} {
  const diagnostics: TableDiagnostic[] = [];
  const fields: ProjectedConceptField[] = [];
  const seenFields = new Map<string, number>();
  const seenInputIds = new Map<string, number>();
  const seenTestIds = new Map<string, number>();

  for (const [index, concept] of concepts.entries()) {
    if (!isNonEmptyString(concept.concept)) {
      diagnostics.push(
        createDiagnostic(index, {
          code: "InvalidConceptId",
          column: "concept",
          message: "Concept id must be a non-empty string.",
        }),
      );
    }

    if (!isNonEmptyString(concept.label)) {
      diagnostics.push(
        createDiagnostic(index, {
          code: "InvalidConceptLabel",
          column: "label",
          message: "Concept label must be a non-empty string.",
        }),
      );
    }

    if (!isConceptPrimitiveKind(concept.type)) {
      diagnostics.push(
        createDiagnostic(index, {
          code: "InvalidConceptType",
          column: "type",
          message: "Concept type must be one of string, number, boolean, enum, literal, unknown.",
        }),
      );
    }

    const fieldName = concept.concept;
    if (isNonEmptyString(fieldName)) {
      const firstRow = seenFields.get(fieldName);
      if (firstRow !== undefined) {
        diagnostics.push(
          createDiagnostic(index, {
            code: "DuplicateConceptFormField",
            column: "concept",
            message: `Projected field ${JSON.stringify(fieldName)} already appears at concept index ${firstRow}.`,
          }),
        );
      } else {
        seenFields.set(fieldName, index);
      }
    }

    const control = resolveControlHint(concept, index, options, diagnostics);
    const value = resolveValue(concept, index, options, diagnostics);
    const disabled = resolveDisabled(concept, index, options, diagnostics);
    const inputId = `${options?.inputIdPrefix ?? "field"}-${sanitizeIdSegment(concept.concept, String(index))}`;
    const testId =
      concept.testId ??
      (options?.testIdPrefix ? `${options.testIdPrefix}-${concept.concept}` : undefined);

    const firstInputIdRow = seenInputIds.get(inputId);
    if (firstInputIdRow !== undefined) {
      diagnostics.push(
        createDiagnostic(index, {
          code: "DuplicateConceptFormInputId",
          column: "inputId",
          message: `Projected inputId ${JSON.stringify(inputId)} already appears at concept index ${firstInputIdRow}.`,
        }),
      );
    } else {
      seenInputIds.set(inputId, index);
    }

    if (testId !== undefined) {
      const firstTestIdRow = seenTestIds.get(testId);
      if (firstTestIdRow !== undefined) {
        diagnostics.push(
          createDiagnostic(index, {
            code: "DuplicateConceptFormTestId",
            column: "testId",
            message: `Projected testId ${JSON.stringify(testId)} already appears at concept index ${firstTestIdRow}.`,
          }),
        );
      } else {
        seenTestIds.set(testId, index);
      }
    }

    fields.push({
      inputId,
      testId,
      field: {
        kind: "formField",
        field: concept.concept,
        label: concept.label,
        control,
        inputId,
        value,
        changeKey: concept.changeKey ?? concept.concept,
        disabled,
        ...(concept.placeholder === undefined ? {} : { placeholder: concept.placeholder }),
        ...(concept.description === undefined ? {} : { description: concept.description }),
        required: concept.required,
        ...(testId === undefined ? {} : { testId }),
      },
    });
  }

  return { diagnostics, fields };
}

export function validateConceptFormProjection(
  concepts: readonly ConceptRecord[],
  options?: ConceptFormProjectionOptions,
): TableDiagnostic[] {
  return [...projectConceptFields(concepts, options).diagnostics];
}

export function fieldsFromConcepts(
  concepts: readonly ConceptRecord[],
  options?: ConceptFormProjectionOptions,
): readonly FormFieldRecord[] {
  const projection = projectConceptFields(concepts, options);
  if (projection.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(projection.diagnostics);
  }
  return projection.fields.map((entry) => entry.field);
}

export function fieldsFromConceptTable(
  table: ColumnarTable,
  options?: FieldsFromConceptTableOptions,
): readonly FormFieldRecord[] {
  const concepts = conceptsFromTable(table, options?.conceptOptions);
  return fieldsFromConcepts(concepts, options?.projection);
}
