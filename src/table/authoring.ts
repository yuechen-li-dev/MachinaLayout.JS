import type { ColumnarTable } from "./types";
import { assertNoTableErrors, cloneColumns, validateTable } from "./validate";

export function define<const TColumns extends Record<string, readonly unknown[]>>(input: {
  id: string;
  columns: TColumns;
}): ColumnarTable<TColumns> {
  const table: ColumnarTable<TColumns> = {
    kind: "table",
    id: input.id,
    columns: cloneColumns(input.columns),
    rowCount: Math.max(0, ...Object.values(input.columns).map((column) => column.length)),
  };
  const diagnostics = validateTable(table);
  assertNoTableErrors(diagnostics);
  return table;
}
