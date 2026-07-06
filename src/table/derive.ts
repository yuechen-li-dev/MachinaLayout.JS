import { columnNames, getCell, getRow } from "./access";
import { define, defineWithSchema } from "./authoring";
import type {
  ColumnarTable,
  SchemaColumnarTable,
  TableDeriveOptions,
  TableDiagnostic,
  TableRow,
  TableSchema,
  TableSortDirection,
} from "./types";
import { isSchemaTable, TableError } from "./validate";

function createDeriveDiagnostic(
  table: ColumnarTable,
  input: Omit<TableDiagnostic, "severity" | "tableId" | "path">,
): TableDiagnostic {
  const path =
    input.row !== undefined && input.column !== undefined
      ? `${table.id}.${input.column}[${input.row}]`
      : input.column !== undefined
        ? `${table.id}.${input.column}`
        : input.row !== undefined
          ? `${table.id}[${input.row}]`
          : table.id;

  return {
    severity: "error",
    tableId: table.id,
    path,
    ...input,
  };
}

function resolveDerivedId(
  table: ColumnarTable,
  suffix: "select" | "filter" | "sort" | "take" | "drop" | "rename",
  options?: TableDeriveOptions,
): string {
  return options?.id ?? `${table.id}.${suffix}`;
}

function defineDerivedTable(
  table: ColumnarTable,
  id: string,
  columns: Record<string, readonly unknown[]>,
): ColumnarTable {
  if (!isSchemaTable(table)) {
    return define({
      id,
      columns,
    });
  }

  return defineWithSchema({
    id,
    schema: table.schema,
    columns: columns as SchemaColumnarTable<TableSchema>["columns"],
  });
}

function defineProjectedSchemaTable(
  _table: SchemaColumnarTable<TableSchema>,
  id: string,
  columns: Record<string, readonly unknown[]>,
  schemaColumns: Record<string, TableSchema["columns"][string]>,
): ColumnarTable {
  return defineWithSchema({
    id,
    schema: {
      kind: "tableSchema",
      columns: schemaColumns,
    },
    columns: columns as SchemaColumnarTable<TableSchema>["columns"],
  });
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function stringifyComparable(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "symbol") {
    return String(value);
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function typeRank(value: unknown): number {
  switch (typeof value) {
    case "boolean":
      return 0;
    case "number":
      return 1;
    case "bigint":
      return 2;
    case "string":
      return 3;
    case "symbol":
      return 4;
    case "object":
      return 5;
    case "function":
      return 6;
    case "undefined":
      return 7;
    default:
      return 8;
  }
}

function compareValues(left: unknown, right: unknown): number {
  const leftNullish = left === undefined || left === null;
  const rightNullish = right === undefined || right === null;

  if (leftNullish || rightNullish) {
    if (leftNullish && rightNullish) return 0;
    return leftNullish ? 1 : -1;
  }

  if (typeof left === typeof right) {
    switch (typeof left) {
      case "number":
        return left < (right as number) ? -1 : left > (right as number) ? 1 : 0;
      case "bigint":
        return left < (right as bigint) ? -1 : left > (right as bigint) ? 1 : 0;
      case "string":
        return compareStrings(left, right as string);
      case "boolean":
        return left === right ? 0 : left === false ? -1 : 1;
      default:
        return compareStrings(stringifyComparable(left), stringifyComparable(right));
    }
  }

  const rank = typeRank(left) - typeRank(right);
  if (rank !== 0) {
    return rank;
  }

  return compareStrings(stringifyComparable(left), stringifyComparable(right));
}

function validateSliceCount(table: ColumnarTable, count: number): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new TableError([
      createDeriveDiagnostic(table, {
        code: "InvalidTableSliceCount",
        message: `Slice count must be a non-negative integer, but received ${JSON.stringify(count)}.`,
      }),
    ]);
  }
}

export function reorderRows(
  table: ColumnarTable,
  rowIndexes: readonly number[],
  id: string,
): ColumnarTable {
  const columns = Object.fromEntries(
    columnNames(table).map((column) => [
      column,
      rowIndexes.map((row) => table.columns[column]?.[row]),
    ]),
  );

  return defineDerivedTable(table, id, columns);
}

export function projectColumns(
  table: ColumnarTable,
  selectedColumns: readonly string[],
  id: string,
): ColumnarTable {
  const columns = Object.fromEntries(
    selectedColumns.map((column) => [column, [...(table.columns[column] ?? [])]]),
  );

  if (!isSchemaTable(table)) {
    return define({
      id,
      columns,
    });
  }

  const schemaColumns = Object.fromEntries(
    selectedColumns.map((column) => [
      column,
      table.schema.columns[column] as TableSchema["columns"][string],
    ]),
  );

  return defineProjectedSchemaTable(table, id, columns, schemaColumns);
}

export function select<TTable extends ColumnarTable, const TColumns extends readonly string[]>(
  table: TTable,
  columns: TColumns,
  options?: TableDeriveOptions,
): ColumnarTable {
  const seen = new Set<string>();

  for (const column of columns) {
    if (seen.has(column)) {
      throw new TableError([
        createDeriveDiagnostic(table, {
          code: "DuplicateSelectedColumn",
          message: `Column "${column}" was selected more than once for table "${table.id}".`,
          column,
        }),
      ]);
    }

    if (!Object.hasOwn(table.columns, column)) {
      throw new TableError([
        createDeriveDiagnostic(table, {
          code: "MissingSelectedColumn",
          message: `Column "${column}" does not exist in table "${table.id}".`,
          column,
        }),
      ]);
    }

    seen.add(column);
  }

  return projectColumns(table, columns, resolveDerivedId(table, "select", options));
}

export function filter<TTable extends ColumnarTable>(
  table: TTable,
  predicate: (
    row: TableRow<TTable>,
    context: {
      readonly row: number;
      readonly table: TTable;
    },
  ) => boolean,
  options?: TableDeriveOptions,
): ColumnarTable {
  const rowIndexes: number[] = [];

  for (let row = 0; row < table.rowCount; row += 1) {
    try {
      if (predicate(getRow(table, row) as TableRow<TTable>, { row, table })) {
        rowIndexes.push(row);
      }
    } catch (error) {
      if (error instanceof TableError) {
        throw error;
      }

      throw new TableError([
        createDeriveDiagnostic(table, {
          code: "TableFilterPredicateError",
          message: `Filter predicate threw while evaluating row ${row}.`,
          row,
        }),
      ]);
    }
  }

  return reorderRows(table, rowIndexes, resolveDerivedId(table, "filter", options));
}

export function filterRows<TTable extends ColumnarTable>(
  table: TTable,
  predicate: (context: {
    readonly row: number;
    readonly table: TTable;
    readonly getCell: (column: string) => unknown;
  }) => boolean,
  options?: TableDeriveOptions,
): ColumnarTable {
  const rowIndexes: number[] = [];

  for (let row = 0; row < table.rowCount; row += 1) {
    try {
      if (
        predicate({
          row,
          table,
          getCell: (column) => getCell(table, row, column as never),
        })
      ) {
        rowIndexes.push(row);
      }
    } catch (error) {
      if (error instanceof TableError) {
        throw error;
      }

      throw new TableError([
        createDeriveDiagnostic(table, {
          code: "TableFilterPredicateError",
          message: `Filter predicate threw while evaluating row ${row}.`,
          row,
        }),
      ]);
    }
  }

  return reorderRows(table, rowIndexes, resolveDerivedId(table, "filter", options));
}

export function sortBy<TTable extends ColumnarTable>(
  table: TTable,
  column: string,
  direction: TableSortDirection = "asc",
  options?: TableDeriveOptions,
): ColumnarTable {
  if (!Object.hasOwn(table.columns, column)) {
    throw new TableError([
      createDeriveDiagnostic(table, {
        code: "MissingSortColumn",
        message: `Column "${column}" does not exist in table "${table.id}".`,
        column,
      }),
    ]);
  }

  const directionSign = direction === "desc" ? -1 : 1;
  const sortedRowIndexes = Array.from({ length: table.rowCount }, (_, row) => row).sort(
    (left, right) => {
      const comparison =
        compareValues(table.columns[column]?.[left], table.columns[column]?.[right]) *
        directionSign;
      return comparison !== 0 ? comparison : left - right;
    },
  );

  return reorderRows(table, sortedRowIndexes, resolveDerivedId(table, "sort", options));
}

export function take<TTable extends ColumnarTable>(
  table: TTable,
  count: number,
  options?: TableDeriveOptions,
): ColumnarTable {
  validateSliceCount(table, count);

  return reorderRows(
    table,
    Array.from({ length: Math.min(count, table.rowCount) }, (_, row) => row),
    resolveDerivedId(table, "take", options),
  );
}

export function drop<TTable extends ColumnarTable>(
  table: TTable,
  count: number,
  options?: TableDeriveOptions,
): ColumnarTable {
  validateSliceCount(table, count);

  const start = Math.min(count, table.rowCount);
  return reorderRows(
    table,
    Array.from({ length: table.rowCount - start }, (_, index) => start + index),
    resolveDerivedId(table, "drop", options),
  );
}

export function renameColumns<TTable extends ColumnarTable>(
  table: TTable,
  rename: Record<string, string>,
  options?: TableDeriveOptions,
): ColumnarTable {
  for (const [source, target] of Object.entries(rename)) {
    if (!Object.hasOwn(table.columns, source)) {
      throw new TableError([
        createDeriveDiagnostic(table, {
          code: "MissingRenameColumn",
          message: `Column "${source}" does not exist in table "${table.id}".`,
          column: source,
        }),
      ]);
    }

    if (typeof target !== "string" || target.trim().length === 0) {
      throw new TableError([
        createDeriveDiagnostic(table, {
          code: "InvalidRenameColumnName",
          message: `Renamed column "${source}" must target a non-empty column name.`,
          column: source,
        }),
      ]);
    }
  }

  const nextNames = columnNames(table).map((column) => rename[column] ?? column);
  const seen = new Set<string>();

  for (const column of nextNames) {
    if (seen.has(column)) {
      throw new TableError([
        createDeriveDiagnostic(table, {
          code: "DuplicateRenameColumn",
          message: `Renaming would create duplicate column "${column}" in table "${table.id}".`,
          column,
        }),
      ]);
    }

    seen.add(column);
  }

  const columns = Object.fromEntries(
    columnNames(table).map((column, index) => [nextNames[index], [...table.columns[column]]]),
  );

  if (!isSchemaTable(table)) {
    return define({
      id: resolveDerivedId(table, "rename", options),
      columns,
    });
  }

  const schemaColumns = Object.fromEntries(
    columnNames(table).map((column, index) => [
      nextNames[index],
      table.schema.columns[column] as TableSchema["columns"][string],
    ]),
  );

  return defineProjectedSchemaTable(
    table,
    resolveDerivedId(table, "rename", options),
    columns,
    schemaColumns,
  );
}
