import { Table } from "../table";
import type { ColumnarTable, TableDiagnostic, TableSchema } from "../table/types";
import { TableError, validateTable } from "../table/validate";
import type { ConceptPrimitiveKind, ConceptRecord, ConceptsFromTableOptions } from "./types";

type ResolvedConceptColumns = {
  readonly concept: string;
  readonly type: string;
  readonly label: string;
  readonly required: string;
  readonly description: string;
  readonly diagnosticLabel: string;
  readonly controlHint: string;
  readonly valuePath: string;
  readonly changeKey: string;
  readonly enumValues: string;
  readonly literalValue: string;
  readonly placeholder: string;
  readonly testId: string;
};

const conceptPrimitiveKinds = [
  "string",
  "number",
  "boolean",
  "enum",
  "literal",
  "unknown",
] as const satisfies readonly ConceptPrimitiveKind[];

type OptionalConceptStringDiagnosticCode =
  | "InvalidConceptDescription"
  | "InvalidConceptDiagnosticLabel"
  | "InvalidConceptControlHint"
  | "InvalidConceptValuePath"
  | "InvalidConceptChangeKey"
  | "InvalidConceptPlaceholder"
  | "InvalidConceptTestId";

function resolveColumns(options: ConceptsFromTableOptions | undefined): ResolvedConceptColumns {
  return {
    concept: options?.conceptColumn ?? "concept",
    type: options?.typeColumn ?? "type",
    label: options?.labelColumn ?? "label",
    required: options?.requiredColumn ?? "required",
    description: options?.descriptionColumn ?? "description",
    diagnosticLabel: options?.diagnosticLabelColumn ?? "diagnosticLabel",
    controlHint: options?.controlHintColumn ?? "controlHint",
    valuePath: options?.valuePathColumn ?? "valuePath",
    changeKey: options?.changeKeyColumn ?? "changeKey",
    enumValues: options?.enumValuesColumn ?? "enumValues",
    literalValue: options?.literalValueColumn ?? "literalValue",
    placeholder: options?.placeholderColumn ?? "placeholder",
    testId: options?.testIdColumn ?? "testId",
  };
}

function createDiagnostic(
  table: ColumnarTable,
  diagnostic: Omit<TableDiagnostic, "severity" | "tableId" | "path">,
): TableDiagnostic {
  const { column, row } = diagnostic;
  return {
    severity: "error",
    tableId: table.id,
    path:
      row !== undefined && column !== undefined
        ? `${table.id}.${column}[${row}]`
        : column !== undefined
          ? `${table.id}.${column}`
          : row !== undefined
            ? `${table.id}[${row}]`
            : table.id,
    ...diagnostic,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isConceptPrimitiveKind(value: unknown): value is ConceptPrimitiveKind {
  return (
    typeof value === "string" && conceptPrimitiveKinds.some((candidate) => candidate === value)
  );
}

function isConceptPrimitiveValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function validateRequiredColumn(
  table: ColumnarTable,
  column: string,
  diagnostics: TableDiagnostic[],
): readonly unknown[] | undefined {
  if (Object.getOwnPropertyDescriptor(table.columns, column) === undefined) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "MissingConceptColumn",
        message: `Concept column "${column}" does not exist in table "${table.id}".`,
        column,
      }),
    );
    return undefined;
  }

  return table.columns[column];
}

function getOptionalColumn(table: ColumnarTable, column: string): readonly unknown[] | undefined {
  return Object.getOwnPropertyDescriptor(table.columns, column) !== undefined
    ? table.columns[column]
    : undefined;
}

function validateOptionalString(
  table: ColumnarTable,
  column: string,
  row: number,
  value: unknown,
  code: OptionalConceptStringDiagnosticCode,
  message: string,
  diagnostics: TableDiagnostic[],
): void {
  if (value !== undefined && typeof value !== "string") {
    diagnostics.push(
      createDiagnostic(table, {
        code,
        message,
        column,
        row,
      }),
    );
  }
}

function validateEnumValues(
  table: ColumnarTable,
  row: number,
  type: ConceptPrimitiveKind,
  value: unknown,
  column: string,
  concept: string | undefined,
  diagnostics: TableDiagnostic[],
): void {
  if (type !== "enum") {
    if (value !== undefined) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "UnexpectedConceptEnumValues",
          message: `Concept ${concept === undefined ? `at row ${row}` : JSON.stringify(concept)} has type "${type}" and must not define enum values.`,
          column,
          row,
        }),
      );
    }
    return;
  }

  if (value === undefined) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "MissingConceptEnumValues",
        message: `Concept ${concept === undefined ? `at row ${row}` : JSON.stringify(concept)} has type "enum" but no enum values.`,
        column,
        row,
      }),
    );
    return;
  }

  if (!Array.isArray(value) || value.length === 0 || !value.every(isConceptPrimitiveValue)) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "InvalidConceptEnumValues",
        message:
          "Concept enumValues must be a non-empty array of string, number, or boolean values.",
        column,
        row,
      }),
    );
  }
}

function validateLiteralValue(
  table: ColumnarTable,
  row: number,
  type: ConceptPrimitiveKind,
  value: unknown,
  column: string,
  concept: string | undefined,
  diagnostics: TableDiagnostic[],
): void {
  if (type !== "literal") {
    if (value !== undefined) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "UnexpectedConceptLiteralValue",
          message: `Concept ${concept === undefined ? `at row ${row}` : JSON.stringify(concept)} has type "${type}" and must not define a literal value.`,
          column,
          row,
        }),
      );
    }
    return;
  }

  if (value === undefined) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "MissingConceptLiteralValue",
        message: `Concept ${concept === undefined ? `at row ${row}` : JSON.stringify(concept)} has type "literal" but no literal value.`,
        column,
        row,
      }),
    );
    return;
  }

  if (!isConceptPrimitiveValue(value)) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "InvalidConceptLiteralValue",
        message: "Concept literalValue must be a string, number, or boolean value.",
        column,
        row,
      }),
    );
  }
}

export function conceptTableSchema(): TableSchema<{
  readonly concept: { readonly kind: "string"; readonly optional?: boolean };
  readonly type: {
    readonly kind: "enum";
    readonly values: readonly ConceptPrimitiveKind[];
    readonly optional?: boolean;
  };
  readonly label: { readonly kind: "string"; readonly optional?: boolean };
  readonly required: { readonly kind: "boolean"; readonly optional?: boolean };
  readonly description: { readonly kind: "string"; readonly optional: true };
  readonly diagnosticLabel: { readonly kind: "string"; readonly optional: true };
  readonly controlHint: { readonly kind: "string"; readonly optional: true };
  readonly valuePath: { readonly kind: "string"; readonly optional: true };
  readonly changeKey: { readonly kind: "string"; readonly optional: true };
  readonly enumValues: { readonly kind: "unknown"; readonly optional: true };
  readonly literalValue: { readonly kind: "unknown"; readonly optional: true };
  readonly placeholder: { readonly kind: "string"; readonly optional: true };
  readonly testId: { readonly kind: "string"; readonly optional: true };
}> {
  return Table.schema({
    concept: Table.string(),
    type: Table.enum(conceptPrimitiveKinds),
    label: Table.string(),
    required: Table.boolean(),
    description: Table.optional(Table.string()),
    diagnosticLabel: Table.optional(Table.string()),
    controlHint: Table.optional(Table.string()),
    valuePath: Table.optional(Table.string()),
    changeKey: Table.optional(Table.string()),
    enumValues: Table.optional(Table.unknown()),
    literalValue: Table.optional(Table.unknown()),
    placeholder: Table.optional(Table.string()),
    testId: Table.optional(Table.string()),
  });
}

export function validateConceptTable(
  table: ColumnarTable,
  options?: ConceptsFromTableOptions,
): TableDiagnostic[] {
  const columns = resolveColumns(options);
  const diagnostics = [...validateTable(table)];

  const conceptValues = validateRequiredColumn(table, columns.concept, diagnostics);
  const typeValues = validateRequiredColumn(table, columns.type, diagnostics);
  const labelValues = validateRequiredColumn(table, columns.label, diagnostics);
  const requiredValues = validateRequiredColumn(table, columns.required, diagnostics);

  const descriptionValues = getOptionalColumn(table, columns.description);
  const diagnosticLabelValues = getOptionalColumn(table, columns.diagnosticLabel);
  const controlHintValues = getOptionalColumn(table, columns.controlHint);
  const valuePathValues = getOptionalColumn(table, columns.valuePath);
  const changeKeyValues = getOptionalColumn(table, columns.changeKey);
  const enumValues = getOptionalColumn(table, columns.enumValues);
  const literalValues = getOptionalColumn(table, columns.literalValue);
  const placeholderValues = getOptionalColumn(table, columns.placeholder);
  const testIdValues = getOptionalColumn(table, columns.testId);

  if (
    conceptValues === undefined ||
    typeValues === undefined ||
    labelValues === undefined ||
    requiredValues === undefined
  ) {
    return diagnostics;
  }

  const seenConcepts = new Map<string, number>();

  for (let row = 0; row < table.rowCount; row += 1) {
    const concept = conceptValues[row];
    const type = typeValues[row];
    const label = labelValues[row];
    const required = requiredValues[row];

    if (!isNonEmptyString(concept)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidConceptId",
          message: "Concept id must be a non-empty string.",
          column: columns.concept,
          row,
        }),
      );
    } else {
      const firstRow = seenConcepts.get(concept);
      if (firstRow !== undefined) {
        diagnostics.push(
          createDiagnostic(table, {
            code: "DuplicateConcept",
            message: `Concept ${JSON.stringify(concept)} already appears at row ${firstRow}.`,
            column: columns.concept,
            row,
          }),
        );
      } else {
        seenConcepts.set(concept, row);
      }
    }

    if (!isConceptPrimitiveKind(type)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidConceptType",
          message: "Concept type must be one of string, number, boolean, enum, literal, unknown.",
          column: columns.type,
          row,
        }),
      );
    }

    if (!isNonEmptyString(label)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidConceptLabel",
          message: "Concept label must be a non-empty string.",
          column: columns.label,
          row,
        }),
      );
    }

    if (typeof required !== "boolean") {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidConceptRequired",
          message: "Concept required must be a boolean.",
          column: columns.required,
          row,
        }),
      );
    }

    validateOptionalString(
      table,
      columns.description,
      row,
      descriptionValues?.[row],
      "InvalidConceptDescription",
      "Concept description must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.diagnosticLabel,
      row,
      diagnosticLabelValues?.[row],
      "InvalidConceptDiagnosticLabel",
      "Concept diagnosticLabel must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.controlHint,
      row,
      controlHintValues?.[row],
      "InvalidConceptControlHint",
      "Concept controlHint must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.valuePath,
      row,
      valuePathValues?.[row],
      "InvalidConceptValuePath",
      "Concept valuePath must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.changeKey,
      row,
      changeKeyValues?.[row],
      "InvalidConceptChangeKey",
      "Concept changeKey must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.placeholder,
      row,
      placeholderValues?.[row],
      "InvalidConceptPlaceholder",
      "Concept placeholder must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.testId,
      row,
      testIdValues?.[row],
      "InvalidConceptTestId",
      "Concept testId must be a string when provided.",
      diagnostics,
    );

    if (isConceptPrimitiveKind(type)) {
      validateEnumValues(
        table,
        row,
        type,
        enumValues?.[row],
        columns.enumValues,
        isNonEmptyString(concept) ? concept : undefined,
        diagnostics,
      );
      validateLiteralValue(
        table,
        row,
        type,
        literalValues?.[row],
        columns.literalValue,
        isNonEmptyString(concept) ? concept : undefined,
        diagnostics,
      );
    }
  }

  return diagnostics;
}

export function conceptsFromTable(
  table: ColumnarTable,
  options?: ConceptsFromTableOptions,
): readonly ConceptRecord[] {
  const diagnostics = validateConceptTable(table, options);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  const columns = resolveColumns(options);
  const conceptValues = table.columns[columns.concept] ?? [];
  const typeValues = table.columns[columns.type] ?? [];
  const labelValues = table.columns[columns.label] ?? [];
  const requiredValues = table.columns[columns.required] ?? [];
  const descriptionValues = table.columns[columns.description];
  const diagnosticLabelValues = table.columns[columns.diagnosticLabel];
  const controlHintValues = table.columns[columns.controlHint];
  const valuePathValues = table.columns[columns.valuePath];
  const changeKeyValues = table.columns[columns.changeKey];
  const enumValues = table.columns[columns.enumValues];
  const literalValues = table.columns[columns.literalValue];
  const placeholderValues = table.columns[columns.placeholder];
  const testIdValues = table.columns[columns.testId];

  const concepts: ConceptRecord[] = [];

  for (let row = 0; row < table.rowCount; row += 1) {
    const type = typeValues[row] as ConceptPrimitiveKind;
    const concept: ConceptRecord = {
      kind: "conceptRecord",
      concept: conceptValues[row] as string,
      type,
      label: labelValues[row] as string,
      required: requiredValues[row] as boolean,
      ...(descriptionValues?.[row] === undefined
        ? {}
        : { description: descriptionValues[row] as string }),
      ...(diagnosticLabelValues?.[row] === undefined
        ? {}
        : { diagnosticLabel: diagnosticLabelValues[row] as string }),
      ...(controlHintValues?.[row] === undefined
        ? {}
        : { controlHint: controlHintValues[row] as string }),
      ...(valuePathValues?.[row] === undefined
        ? {}
        : { valuePath: valuePathValues[row] as string }),
      ...(changeKeyValues?.[row] === undefined
        ? {}
        : { changeKey: changeKeyValues[row] as string }),
      ...(placeholderValues?.[row] === undefined
        ? {}
        : { placeholder: placeholderValues[row] as string }),
      ...(testIdValues?.[row] === undefined ? {} : { testId: testIdValues[row] as string }),
      ...(type === "enum"
        ? {
            enumValues: [...(enumValues?.[row] as readonly (string | number | boolean)[])],
          }
        : {}),
      ...(type === "literal"
        ? {
            literalValue: literalValues?.[row] as string | number | boolean,
          }
        : {}),
    };
    concepts.push(concept);
  }

  return concepts;
}
