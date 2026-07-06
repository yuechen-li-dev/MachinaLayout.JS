import { getRow } from "./access";
import type {
  ColumnarTable,
  KeyedTable,
  KeyedTableDescription,
  TableDiagnostic,
  TableKeyValue,
  TableRow,
} from "./types";
import { TableError, assertNoTableErrors } from "./validate";

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
  return {
    severity: diagnostic.severity ?? "error",
    ...diagnostic,
    path:
      diagnostic.tableId === undefined
        ? undefined
        : tablePath(diagnostic.tableId, diagnostic.column, diagnostic.row),
  };
}

function isTableKeyValue(value: unknown): value is TableKeyValue {
  return typeof value === "string" || typeof value === "number";
}

export function validateKey(table: ColumnarTable, keyColumn: string): TableDiagnostic[] {
  const diagnostics: TableDiagnostic[] = [];

  if (!Object.hasOwn(table.columns, keyColumn)) {
    diagnostics.push(
      createDiagnostic({
        code: "MissingTableKeyColumn",
        message: `Key column "${keyColumn}" does not exist in table "${table.id}".`,
        tableId: table.id,
        column: keyColumn,
      }),
    );
    return diagnostics;
  }

  const column = table.columns[keyColumn];
  const firstRowByKey = new Map<TableKeyValue, number>();

  column.forEach((value, row) => {
    if (!isTableKeyValue(value)) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidTableKeyCell",
          message: `Key column "${keyColumn}" must contain only string or number values, but row ${row} received ${value === null ? "null" : Array.isArray(value) ? "array" : typeof value}.`,
          tableId: table.id,
          column: keyColumn,
          row,
        }),
      );
      return;
    }

    const existingRow = firstRowByKey.get(value);
    if (existingRow !== undefined) {
      diagnostics.push(
        createDiagnostic({
          code: "DuplicateTableKey",
          message: `Key ${JSON.stringify(value)} already appears at row ${existingRow}.`,
          tableId: table.id,
          column: keyColumn,
          row,
        }),
      );
      return;
    }

    firstRowByKey.set(value, row);
  });

  return diagnostics;
}

export function keyBy<
  TTable extends ColumnarTable,
  TKeyColumn extends keyof TTable["columns"] & string,
>(table: TTable, keyColumn: TKeyColumn): KeyedTable<TTable, TKeyColumn>;
export function keyBy<TTable extends ColumnarTable, TKeyColumn extends string>(
  table: TTable,
  keyColumn: TKeyColumn,
): KeyedTable<TTable, TKeyColumn>;
export function keyBy<TTable extends ColumnarTable, TKeyColumn extends string>(
  table: TTable,
  keyColumn: TKeyColumn,
): KeyedTable<TTable, TKeyColumn> {
  const diagnostics = validateKey(table, keyColumn);
  assertNoTableErrors(diagnostics);

  const rowByKey = new Map<TableKeyValue, number>();
  const column = table.columns[keyColumn] as readonly TableKeyValue[];
  column.forEach((value, row) => {
    rowByKey.set(value, row);
  });

  return {
    kind: "keyedTable",
    table,
    keyColumn,
    rowByKey,
    keyCount: rowByKey.size,
  };
}

export function lookup<TTable extends ColumnarTable, TKeyColumn extends string>(
  keyed: KeyedTable<TTable, TKeyColumn>,
  key: TableKeyValue,
): TableRow<TTable> | undefined {
  const row = keyed.rowByKey.get(key);
  return row === undefined ? undefined : (getRow(keyed.table, row) as TableRow<TTable>);
}

export function requireLookup<TTable extends ColumnarTable, TKeyColumn extends string>(
  keyed: KeyedTable<TTable, TKeyColumn>,
  key: TableKeyValue,
): TableRow<TTable> {
  const row = lookup(keyed, key);
  if (row !== undefined) {
    return row;
  }

  throw new TableError([
    createDiagnostic({
      code: "MissingTableKey",
      message: `Key ${JSON.stringify(key)} does not exist in table "${keyed.table.id}" for column "${keyed.keyColumn}".`,
      tableId: keyed.table.id,
      column: keyed.keyColumn,
    }),
  ]);
}

export function hasKey(keyed: KeyedTable, key: TableKeyValue): boolean {
  return keyed.rowByKey.has(key);
}

export function keys(keyed: KeyedTable): readonly TableKeyValue[] {
  return Array.from(keyed.rowByKey.keys());
}

export function describeKeyed(keyed: KeyedTable): KeyedTableDescription {
  return {
    kind: "keyedTableDescription",
    tableId: keyed.table.id,
    keyColumn: keyed.keyColumn,
    keyCount: keyed.keyCount,
    rowCount: keyed.table.rowCount,
  };
}
