import { Table } from "../table";
import type { ColumnarTable, TableDiagnostic } from "../table/types";
import { TableError, validateTable } from "../table/validate";
import type {
  FieldsFromTableOptions,
  FormFieldControl,
  FormFieldRecord,
  FormFieldTableDescription,
  FormFieldTableSchema,
  FormFieldValue,
} from "./types";

type ResolvedFieldColumns = {
  readonly field: string;
  readonly label: string;
  readonly control: string;
  readonly inputId: string;
  readonly value: string;
  readonly changeKey: string;
  readonly disabled: string;
  readonly placeholder: string;
  readonly description: string;
  readonly required: string;
  readonly testId: string;
};

const formFieldControls = ["input", "textarea"] as const satisfies readonly FormFieldControl[];

function resolveColumns(options: FieldsFromTableOptions | undefined): ResolvedFieldColumns {
  return {
    field: options?.fieldColumn ?? "field",
    label: options?.labelColumn ?? "label",
    control: options?.controlColumn ?? "control",
    inputId: options?.inputIdColumn ?? "inputId",
    value: options?.valueColumn ?? "value",
    changeKey: options?.changeKeyColumn ?? "changeKey",
    disabled: options?.disabledColumn ?? "disabled",
    placeholder: options?.placeholderColumn ?? "placeholder",
    description: options?.descriptionColumn ?? "description",
    required: options?.requiredColumn ?? "required",
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

function isFormFieldControl(value: unknown): value is FormFieldControl {
  return typeof value === "string" && formFieldControls.some((candidate) => candidate === value);
}

function validateRequiredColumn(
  table: ColumnarTable,
  column: string,
  diagnostics: TableDiagnostic[],
): readonly unknown[] | undefined {
  if (Object.getOwnPropertyDescriptor(table.columns, column) === undefined) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "MissingFormFieldColumn",
        message: `Form field column "${column}" does not exist in table "${table.id}".`,
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

export function fieldSchema(): FormFieldTableSchema {
  return Table.schema({
    field: Table.string(),
    label: Table.string(),
    control: Table.enum(formFieldControls),
    inputId: Table.string(),
    value: Table.unknown(),
    changeKey: Table.string(),
    disabled: Table.boolean(),
    placeholder: Table.optional(Table.string()),
    description: Table.optional(Table.string()),
    required: Table.optional(Table.boolean()),
    testId: Table.optional(Table.string()),
  });
}

export function validateFieldTable(
  table: ColumnarTable,
  options?: FieldsFromTableOptions,
): TableDiagnostic[] {
  const columns = resolveColumns(options);
  const diagnostics = [...validateTable(table)];

  const fieldValues = validateRequiredColumn(table, columns.field, diagnostics);
  const labelValues = validateRequiredColumn(table, columns.label, diagnostics);
  const controlValues = validateRequiredColumn(table, columns.control, diagnostics);
  const inputIdValues = validateRequiredColumn(table, columns.inputId, diagnostics);
  const changeKeyValues = validateRequiredColumn(table, columns.changeKey, diagnostics);
  const disabledValues = validateRequiredColumn(table, columns.disabled, diagnostics);
  validateRequiredColumn(table, columns.value, diagnostics);

  const placeholderValues = getOptionalColumn(table, columns.placeholder);
  const descriptionValues = getOptionalColumn(table, columns.description);
  const requiredValues = getOptionalColumn(table, columns.required);
  const testIdValues = getOptionalColumn(table, columns.testId);

  if (
    fieldValues === undefined ||
    labelValues === undefined ||
    controlValues === undefined ||
    inputIdValues === undefined ||
    changeKeyValues === undefined ||
    disabledValues === undefined
  ) {
    return diagnostics;
  }

  const seenFields = new Map<string, number>();
  const seenInputIds = new Map<string, number>();

  for (let row = 0; row < table.rowCount; row += 1) {
    const field = fieldValues[row];
    if (!isNonEmptyString(field)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidFormFieldName",
          message: "Form field name must be a non-empty string.",
          column: columns.field,
          row,
        }),
      );
    } else {
      const firstRow = seenFields.get(field);
      if (firstRow !== undefined) {
        diagnostics.push(
          createDiagnostic(table, {
            code: "DuplicateFormField",
            message: `Form field ${JSON.stringify(field)} already appears at row ${firstRow}.`,
            column: columns.field,
            row,
          }),
        );
      } else {
        seenFields.set(field, row);
      }
    }

    const label = labelValues[row];
    if (!isNonEmptyString(label)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidFormFieldLabel",
          message: "Form field label must be a non-empty string.",
          column: columns.label,
          row,
        }),
      );
    }

    const control = controlValues[row];
    if (!isFormFieldControl(control)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidFormFieldControl",
          message: 'Form field control must be "input" or "textarea".',
          column: columns.control,
          row,
        }),
      );
    }

    const inputId = inputIdValues[row];
    if (!isNonEmptyString(inputId)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidFormFieldInputId",
          message: "Form field inputId must be a non-empty string.",
          column: columns.inputId,
          row,
        }),
      );
    } else {
      const firstRow = seenInputIds.get(inputId);
      if (firstRow !== undefined) {
        diagnostics.push(
          createDiagnostic(table, {
            code: "DuplicateFormFieldInputId",
            message: `Input id ${JSON.stringify(inputId)} already appears at row ${firstRow}.`,
            column: columns.inputId,
            row,
          }),
        );
      } else {
        seenInputIds.set(inputId, row);
      }
    }

    const changeKey = changeKeyValues[row];
    if (!isNonEmptyString(changeKey)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidFormFieldChangeKey",
          message: "Form field changeKey must be a non-empty string.",
          column: columns.changeKey,
          row,
        }),
      );
    }

    const disabled = disabledValues[row];
    if (typeof disabled !== "boolean") {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidFormFieldDisabled",
          message: "Form field disabled must be a boolean.",
          column: columns.disabled,
          row,
        }),
      );
    }

    const placeholder = placeholderValues?.[row];
    if (placeholder !== undefined && typeof placeholder !== "string") {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidFormFieldPlaceholder",
          message: "Form field placeholder must be a string when provided.",
          column: columns.placeholder,
          row,
        }),
      );
    }

    const description = descriptionValues?.[row];
    if (description !== undefined && typeof description !== "string") {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidFormFieldDescription",
          message: "Form field description must be a string when provided.",
          column: columns.description,
          row,
        }),
      );
    }

    const required = requiredValues?.[row];
    if (required !== undefined && typeof required !== "boolean") {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidFormFieldRequired",
          message: "Form field required must be a boolean when provided.",
          column: columns.required,
          row,
        }),
      );
    }

    const testId = testIdValues?.[row];
    if (testId !== undefined && typeof testId !== "string") {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidFormFieldTestId",
          message: "Form field testId must be a string when provided.",
          column: columns.testId,
          row,
        }),
      );
    }
  }

  return diagnostics;
}

export function fieldsFromTable(
  table: ColumnarTable,
  options?: FieldsFromTableOptions,
): readonly FormFieldRecord[] {
  const diagnostics = validateFieldTable(table, options);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  const columns = resolveColumns(options);
  const fieldValues = table.columns[columns.field] ?? [];
  const labelValues = table.columns[columns.label] ?? [];
  const controlValues = table.columns[columns.control] ?? [];
  const inputIdValues = table.columns[columns.inputId] ?? [];
  const valueValues = table.columns[columns.value] ?? [];
  const changeKeyValues = table.columns[columns.changeKey] ?? [];
  const disabledValues = table.columns[columns.disabled] ?? [];
  const placeholderValues = table.columns[columns.placeholder];
  const descriptionValues = table.columns[columns.description];
  const requiredValues = table.columns[columns.required];
  const testIdValues = table.columns[columns.testId];

  const fields: FormFieldRecord[] = [];

  for (let row = 0; row < table.rowCount; row += 1) {
    const field: FormFieldRecord = {
      kind: "formField",
      field: fieldValues[row] as string,
      label: labelValues[row] as string,
      control: controlValues[row] as FormFieldControl,
      inputId: inputIdValues[row] as string,
      value: valueValues[row] as FormFieldValue,
      changeKey: changeKeyValues[row] as string,
      disabled: disabledValues[row] as boolean,
      ...(placeholderValues?.[row] === undefined
        ? {}
        : { placeholder: placeholderValues[row] as string }),
      ...(descriptionValues?.[row] === undefined
        ? {}
        : { description: descriptionValues[row] as string }),
      ...(requiredValues?.[row] === undefined ? {} : { required: requiredValues[row] as boolean }),
      ...(testIdValues?.[row] === undefined ? {} : { testId: testIdValues[row] as string }),
    };
    fields.push(field);
  }

  return fields;
}

export function describeFields(
  fields: readonly FormFieldRecord[],
  tableId = "",
): FormFieldTableDescription {
  const controls: FormFieldControl[] = [];

  for (const field of fields) {
    if (!controls.includes(field.control)) {
      controls.push(field.control);
    }
  }

  return {
    kind: "formFieldTableDescription",
    tableId,
    fieldCount: fields.length,
    controls,
  };
}

export const Form = {
  fieldSchema,
  fieldsFromTable,
  validateFieldTable,
  describeFields,
} as const;
