import { getRow } from "./access";
import { define } from "./authoring";
import type { ColumnarTable, TableColumns, TableObjectRow } from "./types";
import { assertNoTableErrors, validateObjectRowsInput, validateRowTableInput } from "./validate";

export function toRows<TColumns extends TableColumns>(
  table: ColumnarTable<TColumns>,
): readonly unknown[][] {
  const names = Object.keys(table.columns);
  return Array.from({ length: table.rowCount }, (_, rowIndex) =>
    names.map((column) => table.columns[column]?.[rowIndex]),
  );
}

export function fromRows<const TColumnNames extends readonly string[]>(input: {
  id: string;
  columns: TColumnNames;
  rows: readonly (readonly unknown[])[];
}): ColumnarTable<Record<TColumnNames[number], readonly unknown[]>> {
  const diagnostics = validateRowTableInput(input);
  assertNoTableErrors(diagnostics);

  const columns: Record<string, unknown[]> = Object.fromEntries(
    input.columns.map((column) => [column, []]),
  );

  for (const row of input.rows) {
    input.columns.forEach((column, columnIndex) => {
      columns[column]?.push(row[columnIndex]);
    });
  }

  return define({
    id: input.id,
    columns: columns as Record<TColumnNames[number], readonly unknown[]>,
  });
}

export function toObjects<TColumns extends TableColumns>(
  table: ColumnarTable<TColumns>,
): readonly { readonly [K in keyof TColumns]: TColumns[K][number] }[] {
  return Array.from({ length: table.rowCount }, (_, rowIndex) => getRow(table, rowIndex));
}

export function fromObjects<const TRows extends readonly TableObjectRow[]>(input: {
  id: string;
  rows: TRows;
  columns?: readonly string[];
}): ColumnarTable<Record<string, readonly unknown[]>> {
  const diagnostics = validateObjectRowsInput(input);
  assertNoTableErrors(diagnostics);

  const columnOrder =
    input.columns !== undefined
      ? [...input.columns]
      : input.rows.length > 0
        ? Object.keys(input.rows[0] ?? {})
        : [];

  const columns: Record<string, unknown[]> = Object.fromEntries(
    columnOrder.map((column) => [column, []]),
  );

  input.rows.forEach((row) => {
    columnOrder.forEach((column) => {
      columns[column]?.push(row[column]);
    });
  });

  return define({
    id: input.id,
    columns,
  });
}
