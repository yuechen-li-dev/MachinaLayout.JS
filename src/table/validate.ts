import { formatTableDiagnostics } from "./format";
import type {
  ColumnarTable,
  SchemaColumnarTable,
  TableColumns,
  TableColumnSchema,
  TableDiagnostic,
  TableObjectRow,
  TableSchema,
  TableSchemaPrimitive,
} from "./types";

function tablePath(tableId: string, column?: string, row?: number): string {
  if (row !== undefined && column !== undefined) return `${tableId}.${column}[${row}]`;
  if (row !== undefined) return `${tableId}[${row}]`;
  if (column !== undefined) return `${tableId}.${column}`;
  return tableId;
}

function createDiagnostic(
  diagnostic: Omit<TableDiagnostic, "severity" | "path"> & {
    readonly severity?: TableDiagnostic["severity"];
  },
): TableDiagnostic {
  const path =
    diagnostic.tableId === undefined
      ? undefined
      : tablePath(diagnostic.tableId, diagnostic.column, diagnostic.row);
  return {
    severity: diagnostic.severity ?? "error",
    ...diagnostic,
    path,
  };
}

function isReadonlyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isObjectRow(value: unknown): value is TableObjectRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSchemaPrimitive(value: unknown): value is TableSchemaPrimitive {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isTableColumnSchema(value: unknown): value is TableColumnSchema {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const schema = value as Partial<TableColumnSchema>;
  if (schema.optional !== undefined && schema.optional !== true) {
    return false;
  }

  switch (schema.kind) {
    case "string":
    case "number":
    case "boolean":
    case "unknown":
      return true;
    case "literal":
      return isSchemaPrimitive(schema.value);
    case "enum":
      return Array.isArray(schema.values) && schema.values.every(isSchemaPrimitive);
    default:
      return false;
  }
}

function isTableSchema(value: unknown): value is TableSchema {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const schema = value as Partial<TableSchema>;
  return (
    schema.kind === "tableSchema" &&
    typeof schema.columns === "object" &&
    schema.columns !== null &&
    !Array.isArray(schema.columns)
  );
}

function describeValueKind(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function validateCellValue(
  schema: TableColumnSchema,
  value: unknown,
): Omit<TableDiagnostic, "severity" | "path"> | undefined {
  if (value === undefined) {
    if (schema.optional === true) {
      return undefined;
    }

    return {
      code: "InvalidTableCell",
      message: `Column expected ${schema.kind} but received undefined.`,
    };
  }

  switch (schema.kind) {
    case "string":
      return typeof value === "string"
        ? undefined
        : {
            code: "InvalidTableCell",
            message: `Column expected string but received ${describeValueKind(value)}.`,
          };
    case "number":
      return typeof value === "number"
        ? undefined
        : {
            code: "InvalidTableCell",
            message: `Column expected number but received ${describeValueKind(value)}.`,
          };
    case "boolean":
      return typeof value === "boolean"
        ? undefined
        : {
            code: "InvalidTableCell",
            message: `Column expected boolean but received ${describeValueKind(value)}.`,
          };
    case "unknown":
      return undefined;
    case "literal":
      return Object.is(value, schema.value)
        ? undefined
        : {
            code: "InvalidTableLiteralValue",
            message: `Column expected literal ${JSON.stringify(schema.value)} but received ${JSON.stringify(value)}.`,
          };
    case "enum":
      return schema.values.some((candidate) => Object.is(candidate, value))
        ? undefined
        : {
            code: "InvalidTableEnumValue",
            message: `Column expected one of ${schema.values.map((candidate) => JSON.stringify(candidate)).join(", ")} but received ${JSON.stringify(value)}.`,
          };
    default:
      return {
        code: "InvalidTableSchema",
        message: "Column schema kind is not supported.",
      };
  }
}

export class TableError extends Error {
  readonly diagnostics: readonly TableDiagnostic[];

  constructor(diagnostics: readonly TableDiagnostic[], message?: string) {
    super(message ?? formatTableDiagnostics(diagnostics));
    this.name = "TableError";
    this.diagnostics = [...diagnostics];
  }
}

export function assertNoTableErrors(diagnostics: readonly TableDiagnostic[]): void {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }
}

export function validateTableSchema(schema: unknown, tableId?: string): TableDiagnostic[] {
  const diagnostics: TableDiagnostic[] = [];

  if (!isTableSchema(schema)) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidTableSchema",
        message: 'Table schema must be an object with kind "tableSchema" and a columns object.',
        tableId,
      }),
    );
    return diagnostics;
  }

  for (const [columnName, columnSchema] of Object.entries(schema.columns)) {
    if (columnName.trim().length === 0) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidColumnName",
          message: "Schema column names must be non-empty strings.",
          tableId,
          column: columnName,
        }),
      );
    }

    if (!isTableColumnSchema(columnSchema)) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidTableSchema",
          message: `Schema column "${columnName}" is not a supported table column schema.`,
          tableId,
          column: columnName,
        }),
      );
      continue;
    }

    if (columnSchema.kind === "enum") {
      if (columnSchema.values.length === 0) {
        diagnostics.push(
          createDiagnostic({
            code: "EmptyTableEnum",
            message: `Schema column "${columnName}" must define at least one enum value.`,
            tableId,
            column: columnName,
          }),
        );
      }

      const seen = new Set<TableSchemaPrimitive>();
      for (const value of columnSchema.values) {
        if (seen.has(value)) {
          diagnostics.push(
            createDiagnostic({
              severity: "warning",
              code: "DuplicateTableEnumValue",
              message: `Schema column "${columnName}" repeats enum value ${JSON.stringify(value)}.`,
              tableId,
              column: columnName,
            }),
          );
        } else {
          seen.add(value);
        }
      }
    }
  }

  return diagnostics;
}

export function validateTable(
  table: ColumnarTable | (ColumnarTable & { readonly schema?: unknown }),
): TableDiagnostic[] {
  const diagnostics: TableDiagnostic[] = [];
  const { id, columns, rowCount } = table;

  if (typeof id !== "string" || id.trim().length === 0) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidTableId",
        message: "Table id must be a non-empty string.",
        tableId: typeof id === "string" && id.length > 0 ? id : undefined,
      }),
    );
  }

  if (typeof columns !== "object" || columns === null || Array.isArray(columns)) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidColumnValues",
        message: "Table columns must be an object whose values are arrays.",
        tableId: typeof id === "string" && id.length > 0 ? id : undefined,
      }),
    );
    return diagnostics;
  }

  for (const [columnName, values] of Object.entries(columns)) {
    if (columnName.trim().length === 0) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidColumnName",
          message: "Column names must be non-empty strings.",
          tableId: id,
          column: columnName,
        }),
      );
    }

    if (!isReadonlyArray(values)) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidColumnValues",
          message: `Column "${columnName}" must be an array of values.`,
          tableId: id,
          column: columnName,
        }),
      );
      continue;
    }

    if (values.length !== rowCount) {
      diagnostics.push(
        createDiagnostic({
          code: "ColumnLengthMismatch",
          message: `Column "${columnName}" has length ${values.length} but expected ${rowCount}.`,
          tableId: id,
          column: columnName,
        }),
      );
    }
  }

  if (typeof rowCount !== "number" || !Number.isInteger(rowCount) || rowCount < 0) {
    diagnostics.push(
      createDiagnostic({
        code: "ColumnLengthMismatch",
        message: "Table rowCount must be a non-negative integer.",
        tableId: id,
      }),
    );
  }

  if (!("schema" in table) || table.schema === undefined) {
    return diagnostics;
  }

  const schemaDiagnostics = validateTableSchema(table.schema, id);
  diagnostics.push(...schemaDiagnostics);

  if (!isTableSchema(table.schema)) {
    return diagnostics;
  }

  const schemaColumnNames = Object.keys(table.schema.columns);
  const tableColumnNames = Object.keys(columns);
  const tableColumnSet = new Set(tableColumnNames);
  const schemaColumnSet = new Set(schemaColumnNames);

  for (const columnName of schemaColumnNames) {
    if (!tableColumnSet.has(columnName)) {
      diagnostics.push(
        createDiagnostic({
          code: "MissingSchemaColumn",
          message: `Table is missing schema column "${columnName}".`,
          tableId: id,
          column: columnName,
        }),
      );
    }
  }

  for (const columnName of tableColumnNames) {
    if (!schemaColumnSet.has(columnName)) {
      diagnostics.push(
        createDiagnostic({
          code: "ExtraSchemaColumn",
          message: `Table column "${columnName}" is not present in the schema.`,
          tableId: id,
          column: columnName,
        }),
      );
    }
  }

  for (const [columnName, columnSchema] of Object.entries(table.schema.columns)) {
    const values = columns[columnName];
    if (!Array.isArray(values) || !isTableColumnSchema(columnSchema)) {
      continue;
    }

    values.forEach((value, row) => {
      const diagnostic = validateCellValue(columnSchema, value);
      if (diagnostic !== undefined) {
        diagnostics.push(
          createDiagnostic({
            ...diagnostic,
            message: `Column "${columnName}" ${diagnostic.message.replace(/^Column /, "")}`,
            tableId: id,
            column: columnName,
            row,
          }),
        );
      }
    });
  }

  return diagnostics;
}

export function validateRowTableInput(input: {
  readonly id: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly unknown[])[];
}): TableDiagnostic[] {
  const diagnostics: TableDiagnostic[] = [];
  const { id, columns, rows } = input;

  if (typeof id !== "string" || id.trim().length === 0) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidTableId",
        message: "Table id must be a non-empty string.",
      }),
    );
  }

  const seen = new Set<string>();
  columns.forEach((column, index) => {
    if (typeof column !== "string" || column.trim().length === 0) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidColumnName",
          message: `Column at index ${index} must be a non-empty string.`,
          tableId: id,
          column,
        }),
      );
      return;
    }

    if (seen.has(column)) {
      diagnostics.push(
        createDiagnostic({
          code: "DuplicateColumnName",
          message: `Column "${column}" appears more than once.`,
          tableId: id,
          column,
        }),
      );
      return;
    }

    seen.add(column);
  });

  rows.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidRowWidth",
          message: `Row ${rowIndex} must be an array with ${columns.length} values.`,
          tableId: id,
          row: rowIndex,
        }),
      );
      return;
    }

    if (row.length !== columns.length) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidRowWidth",
          message: `Row ${rowIndex} has width ${row.length} but expected ${columns.length}.`,
          tableId: id,
          row: rowIndex,
        }),
      );
    }
  });

  return diagnostics;
}

export function validateObjectRowsInput(input: {
  readonly id: string;
  readonly rows: readonly TableObjectRow[];
  readonly columns?: readonly string[];
}): TableDiagnostic[] {
  const diagnostics: TableDiagnostic[] = [];
  const { id, rows, columns } = input;

  if (typeof id !== "string" || id.trim().length === 0) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidTableId",
        message: "Table id must be a non-empty string.",
      }),
    );
  }

  const columnOrder = columns
    ? [...columns]
    : rows.length > 0 && isObjectRow(rows[0])
      ? Object.keys(rows[0])
      : [];
  const columnSet = new Set(columnOrder);

  columnOrder.forEach((column, index) => {
    if (typeof column !== "string" || column.trim().length === 0) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidColumnName",
          message: `Column at index ${index} must be a non-empty string.`,
          tableId: id,
          column,
        }),
      );
      return;
    }

    if (columnOrder.indexOf(column) !== index) {
      diagnostics.push(
        createDiagnostic({
          code: "DuplicateColumnName",
          message: `Column "${column}" appears more than once.`,
          tableId: id,
          column,
        }),
      );
    }
  });

  rows.forEach((row, rowIndex) => {
    if (!isObjectRow(row)) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidColumnValues",
          message: `Row ${rowIndex} must be an object.`,
          tableId: id,
          row: rowIndex,
        }),
      );
      return;
    }

    for (const column of columnOrder) {
      if (Object.getOwnPropertyDescriptor(row, column) === undefined) {
        diagnostics.push(
          createDiagnostic({
            code: "MissingObjectColumn",
            message: `Row ${rowIndex} is missing required column "${column}".`,
            tableId: id,
            row: rowIndex,
            column,
          }),
        );
      }
    }

    for (const key of Object.keys(row)) {
      if (!columnSet.has(key)) {
        diagnostics.push(
          createDiagnostic({
            code: "ExtraObjectColumn",
            message: `Row ${rowIndex} has extra column "${key}" not present in the table definition.`,
            tableId: id,
            row: rowIndex,
            column: key,
          }),
        );
      }
    }
  });

  return diagnostics;
}

export function cloneColumns<TColumns extends TableColumns>(columns: TColumns): TColumns {
  const cloned = {} as Record<string, readonly unknown[]>;
  for (const [columnName, values] of Object.entries(columns)) {
    cloned[columnName] = Array.isArray(values) ? [...values] : values;
  }
  return cloned as TColumns;
}

export function isSchemaTable<TSchema extends TableSchema>(
  table: ColumnarTable | SchemaColumnarTable<TSchema>,
): table is SchemaColumnarTable<TSchema> {
  return "schema" in table && isTableSchema(table.schema);
}
