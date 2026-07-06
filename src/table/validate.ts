import { formatTableDiagnostics } from "./format";
import type { ColumnarTable, TableColumns, TableDiagnostic, TableObjectRow } from "./types";

function tablePath(tableId: string, column?: string, row?: number): string {
  if (row !== undefined && column !== undefined) return `${tableId}[${row}].${column}`;
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

export function validateTable(table: ColumnarTable): TableDiagnostic[] {
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
          column: column,
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
      if (!Object.hasOwn(row, column)) {
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
