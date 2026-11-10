import {
  type ConceptDefinition,
  type ConceptField,
  conceptFields,
  conceptFromTable,
  describeConstraintType,
  isConceptDefinition,
} from "../concept";
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
const projectableKinds = new Set(["string", "number", "boolean", "enum", "literal", "unknown"]);

type ProjectionContext = { readonly index: number };

type ProjectedConceptField = {
  readonly field: FormFieldRecord;
  readonly inputId: string;
  readonly testId?: string;
};

function isFormFieldControl(value: unknown): value is FormFieldControl {
  return typeof value === "string" && formFieldControls.some((candidate) => candidate === value);
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

function createDiagnostic(
  index: number,
  field: string,
  diagnostic: {
    readonly code: TableDiagnostic["code"];
    readonly message: string;
    readonly column?: string;
  },
): TableDiagnostic {
  return {
    severity: "error",
    code: diagnostic.code,
    message: diagnostic.message,
    row: index,
    column: diagnostic.column,
    path:
      diagnostic.column === undefined ? `fields.${field}` : `fields.${field}.${diagnostic.column}`,
  };
}

function resolveControlHint(
  concept: ConceptField,
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
            createDiagnostic(index, concept.name, {
              code: "InvalidConceptFormControl",
              column: "control",
              message: `Projected control ${JSON.stringify(control)} is not supported for concept ${JSON.stringify(concept.name)}.`,
            }),
          );
          return options.defaultControl ?? "input";
        }
        return control;
      }
    } catch (error) {
      diagnostics.push(
        createDiagnostic(index, concept.name, {
          code: "ConceptFormControlResolverError",
          column: "control",
          message: `controlForConcept threw for concept ${JSON.stringify(concept.name)}: ${error instanceof Error ? error.message : String(error)}.`,
        }),
      );
      return options.defaultControl ?? "input";
    }
  }

  if (concept.meta.controlHint !== undefined) {
    if (isFormFieldControl(concept.meta.controlHint)) {
      return concept.meta.controlHint;
    }

    diagnostics.push(
      createDiagnostic(index, concept.name, {
        code: "InvalidConceptFormControl",
        column: "controlHint",
        message: `Concept controlHint ${JSON.stringify(concept.meta.controlHint)} is not supported for concept ${JSON.stringify(concept.name)}.`,
      }),
    );
  }

  return options?.defaultControl ?? "input";
}

function resolveValue(
  concept: ConceptField,
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
        createDiagnostic(index, concept.name, {
          code: "ConceptFormValueResolverError",
          column: "value",
          message: `valueForConcept threw for concept ${JSON.stringify(concept.name)}: ${error instanceof Error ? error.message : String(error)}.`,
        }),
      );
      return undefined;
    }
  }

  return options?.values?.[concept.name];
}

function resolveDisabled(
  concept: ConceptField,
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
        createDiagnostic(index, concept.name, {
          code: "ConceptFormDisabledResolverError",
          column: "disabled",
          message: `disabledForConcept threw for concept ${JSON.stringify(concept.name)}: ${error instanceof Error ? error.message : String(error)}.`,
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
        createDiagnostic(index, concept.name, {
          code: "ConceptFormDisabledResolverError",
          column: "disabled",
          message: `disabled resolver threw for concept ${JSON.stringify(concept.name)}: ${error instanceof Error ? error.message : String(error)}.`,
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
  definition: ConceptDefinition,
  options: ConceptFormProjectionOptions | undefined,
): {
  readonly diagnostics: readonly TableDiagnostic[];
  readonly fields: readonly ProjectedConceptField[];
} {
  const diagnostics: TableDiagnostic[] = [];
  const fields: ProjectedConceptField[] = [];
  const seenInputIds = new Map<string, number>();
  const seenTestIds = new Map<string, number>();

  for (const [index, concept] of conceptFields(definition).entries()) {
    const kind = isConceptDefinition(concept.constraint) ? "concept" : concept.constraint.kind;
    if (!projectableKinds.has(kind)) {
      diagnostics.push(
        createDiagnostic(index, concept.name, {
          code: "UnsupportedConceptFormField",
          column: "type",
          message: `Field ${JSON.stringify(concept.name)} is ${describeConstraintType(concept.constraint)}; only string, number, boolean, enum, literal, and unknown fields project to form controls.`,
        }),
      );
    }

    const label = concept.meta.label ?? concept.name;
    if (label.trim().length === 0) {
      diagnostics.push(
        createDiagnostic(index, concept.name, {
          code: "InvalidConceptLabel",
          column: "label",
          message: "Concept label must be a non-empty string.",
        }),
      );
    }

    const control = resolveControlHint(concept, index, options, diagnostics);
    const value = resolveValue(concept, index, options, diagnostics);
    const disabled = resolveDisabled(concept, index, options, diagnostics);
    const inputId = `${options?.inputIdPrefix ?? "field"}-${sanitizeIdSegment(concept.name, String(index))}`;
    const testId =
      concept.meta.testId ??
      (options?.testIdPrefix ? `${options.testIdPrefix}-${concept.name}` : undefined);

    const firstInputIdRow = seenInputIds.get(inputId);
    if (firstInputIdRow !== undefined) {
      diagnostics.push(
        createDiagnostic(index, concept.name, {
          code: "DuplicateConceptFormInputId",
          column: "inputId",
          message: `Projected inputId ${JSON.stringify(inputId)} already appears at field index ${firstInputIdRow}.`,
        }),
      );
    } else {
      seenInputIds.set(inputId, index);
    }

    if (testId !== undefined) {
      const firstTestIdRow = seenTestIds.get(testId);
      if (firstTestIdRow !== undefined) {
        diagnostics.push(
          createDiagnostic(index, concept.name, {
            code: "DuplicateConceptFormTestId",
            column: "testId",
            message: `Projected testId ${JSON.stringify(testId)} already appears at field index ${firstTestIdRow}.`,
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
        field: concept.name,
        label,
        control,
        inputId,
        value,
        changeKey: concept.meta.changeKey ?? concept.name,
        disabled,
        ...(concept.meta.placeholder === undefined
          ? {}
          : { placeholder: concept.meta.placeholder }),
        ...(concept.meta.description === undefined
          ? {}
          : { description: concept.meta.description }),
        required: concept.required,
        ...(testId === undefined ? {} : { testId }),
      },
    });
  }

  return { diagnostics, fields };
}

/** Diagnostics for projecting a concept's fields into form field records. */
export function validateConceptFormProjection(
  concept: ConceptDefinition,
  options?: ConceptFormProjectionOptions,
): TableDiagnostic[] {
  return [...projectConceptFields(concept, options).diagnostics];
}

/** Project a concept (authored in code or lowered from a concept table) into form fields. */
export function fieldsFromConcept(
  concept: ConceptDefinition,
  options?: ConceptFormProjectionOptions,
): readonly FormFieldRecord[] {
  const projection = projectConceptFields(concept, options);
  if (projection.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(projection.diagnostics);
  }
  return projection.fields.map((entry) => entry.field);
}

export function fieldsFromConceptTable(
  table: ColumnarTable,
  options?: FieldsFromConceptTableOptions,
): readonly FormFieldRecord[] {
  return fieldsFromConcept(conceptFromTable(table, options?.conceptOptions), options?.projection);
}
