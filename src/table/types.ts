export type TableColumnName = string;

export type TableColumns = Record<string, readonly unknown[]>;

export type ColumnarTable<TColumns extends TableColumns = TableColumns> = {
  readonly kind: "table";
  readonly id: string;
  readonly columns: TColumns;
  readonly rowCount: number;
};

export type RowTableInput<
  TColumnNames extends readonly string[] = readonly string[],
  TRow extends readonly unknown[] = readonly unknown[],
> = {
  readonly id: string;
  readonly columns: TColumnNames;
  readonly rows: readonly TRow[];
};

export type TableObjectRow = Record<string, unknown>;

export type TableDiagnosticCode =
  | "InvalidTableId"
  | "InvalidColumnName"
  | "DuplicateColumnName"
  | "InvalidColumnValues"
  | "ColumnLengthMismatch"
  | "InvalidRowWidth"
  | "MissingObjectColumn"
  | "ExtraObjectColumn";

export type TableDiagnostic = {
  readonly severity: "error" | "warning";
  readonly code: TableDiagnosticCode;
  readonly message: string;
  readonly tableId?: string;
  readonly column?: string;
  readonly row?: number;
  readonly path?: string;
};
