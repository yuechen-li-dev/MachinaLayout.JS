import type {
  ColumnarTable,
  SchemaColumnarTable,
  TableColumns,
  TableSchema,
  TableSchemaRow,
} from "./types";
import { TableError } from "./validate";

function assertColumnExists<TColumns extends TableColumns, TKey extends keyof TColumns & string>(
  table: ColumnarTable<TColumns>,
  column: TKey,
): TColumns[TKey] {
  if (Object.getOwnPropertyDescriptor(table.columns, column) === undefined) {
    throw new TableError([
      {
        severity: "error",
        code: "InvalidColumnName",
        message: `Column "${column}" does not exist in table "${table.id}".`,
        tableId: table.id,
        column,
        path: `${table.id}.${column}`,
      },
    ]);
  }
  return table.columns[column];
}

function assertRowIndex(table: ColumnarTable, row: number): void {
  if (!Number.isInteger(row) || row < 0 || row >= table.rowCount) {
    throw new TableError([
      {
        severity: "error",
        code: "InvalidRowWidth",
        message: `Row ${row} is out of bounds for table "${table.id}" with ${table.rowCount} rows.`,
        tableId: table.id,
        row,
        path: `${table.id}[${row}]`,
      },
    ]);
  }
}

export function columnNames<TColumns extends TableColumns>(
  table: ColumnarTable<TColumns>,
): Array<keyof TColumns & string> {
  return Object.keys(table.columns) as Array<keyof TColumns & string>;
}

export function rowCount(table: ColumnarTable): number {
  return table.rowCount;
}

export function getColumn<TColumns extends TableColumns, TKey extends keyof TColumns & string>(
  table: ColumnarTable<TColumns>,
  column: TKey,
): TColumns[TKey] {
  return assertColumnExists(table, column);
}

export function getCell<
  TSchema extends TableSchema,
  TKey extends keyof TSchema["columns"] & string,
>(table: SchemaColumnarTable<TSchema>, row: number, column: TKey): TableSchemaRow<TSchema>[TKey];
export function getCell<TColumns extends TableColumns, TKey extends keyof TColumns & string>(
  table: ColumnarTable<TColumns>,
  row: number,
  column: TKey,
): TColumns[TKey][number];
export function getCell<TColumns extends TableColumns, TKey extends keyof TColumns & string>(
  table: ColumnarTable<TColumns>,
  row: number,
  column: TKey,
): TColumns[TKey][number] {
  assertRowIndex(table, row);
  return assertColumnExists(table, column)[row] as TColumns[TKey][number];
}

export function getRow<TSchema extends TableSchema>(
  table: SchemaColumnarTable<TSchema>,
  row: number,
): TableSchemaRow<TSchema>;
export function getRow<TColumns extends TableColumns>(
  table: ColumnarTable<TColumns>,
  row: number,
): { readonly [K in keyof TColumns]: TColumns[K][number] };
export function getRow<TColumns extends TableColumns>(
  table: ColumnarTable<TColumns>,
  row: number,
): { readonly [K in keyof TColumns]: TColumns[K][number] } {
  assertRowIndex(table, row);
  const result = {} as { readonly [K in keyof TColumns]: TColumns[K][number] };
  for (const column of columnNames(table)) {
    (result as Record<string, unknown>)[column] = table.columns[column][row];
  }
  return result;
}
