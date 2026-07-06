export type TableColumnName = string;

export type TableColumns = Record<string, readonly unknown[]>;

export type ColumnarTable<TColumns extends TableColumns = TableColumns> = {
  readonly kind: "table";
  readonly id: string;
  readonly columns: TColumns;
  readonly rowCount: number;
};

export type TableSchemaPrimitive = string | number | boolean;

export type TableColumnSchema =
  | {
      readonly kind: "string";
      readonly optional?: boolean;
    }
  | {
      readonly kind: "number";
      readonly optional?: boolean;
    }
  | {
      readonly kind: "boolean";
      readonly optional?: boolean;
    }
  | {
      readonly kind: "literal";
      readonly value: TableSchemaPrimitive;
      readonly optional?: boolean;
    }
  | {
      readonly kind: "enum";
      readonly values: readonly TableSchemaPrimitive[];
      readonly optional?: boolean;
    }
  | {
      readonly kind: "unknown";
      readonly optional?: boolean;
    };

export type TableSchema<
  TColumns extends Record<string, TableColumnSchema> = Record<string, TableColumnSchema>,
> = {
  readonly kind: "tableSchema";
  readonly columns: TColumns;
};

type TableColumnBaseValue<TColumn extends TableColumnSchema> = TColumn extends { kind: "string" }
  ? string
  : TColumn extends { kind: "number" }
    ? number
    : TColumn extends { kind: "boolean" }
      ? boolean
      : TColumn extends { kind: "literal"; value: infer TValue }
        ? TValue
        : TColumn extends { kind: "enum"; values: readonly (infer TValue)[] }
          ? TValue
          : TColumn extends { kind: "unknown" }
            ? unknown
            : unknown;

export type TableColumnValue<TColumn extends TableColumnSchema> =
  | TableColumnBaseValue<TColumn>
  | (TColumn extends { optional: true } ? undefined : never);

export type TableSchemaRow<TSchema extends TableSchema> = {
  readonly [K in keyof TSchema["columns"]]: TableColumnValue<TSchema["columns"][K]>;
};

export type TableSchemaColumns<TSchema extends TableSchema> = {
  readonly [K in keyof TSchema["columns"]]: readonly TableColumnValue<TSchema["columns"][K]>[];
};

export type SchemaColumnarTable<
  TSchema extends TableSchema,
  TColumns extends TableColumns = TableSchemaColumns<TSchema>,
> = ColumnarTable<TColumns> & {
  readonly schema: TSchema;
};

export type TableColumnElement<
  TTable extends ColumnarTable,
  TColumn extends string,
> = TColumn extends keyof TTable["columns"] ? TTable["columns"][TColumn][number] : unknown;

export type TableRow<TTable extends ColumnarTable> =
  TTable extends SchemaColumnarTable<infer TSchema>
    ? TableSchemaRow<TSchema>
    : { readonly [K in keyof TTable["columns"]]: TTable["columns"][K][number] };

export type TableKeyValue = string | number;

export type KeyedTable<
  TTable extends ColumnarTable = ColumnarTable,
  TKeyColumn extends string = string,
> = {
  readonly kind: "keyedTable";
  readonly table: TTable;
  readonly keyColumn: TKeyColumn;
  readonly rowByKey: ReadonlyMap<TableKeyValue, number>;
  readonly keyCount: number;
};

export type ColumnarTableJson = {
  readonly kind: "columnarTable";
  readonly id: string;
  readonly columns: Record<string, readonly unknown[]>;
  readonly rowCount: number;
  readonly schema?: unknown;
};

export type TableMarkdownOptions = {
  readonly maxRows?: number;
  readonly includeRowIndex?: boolean;
  readonly emptyCell?: string;
};

export type TableCsvOptions = {
  readonly includeHeader?: boolean;
};

export type TableDescription = {
  readonly kind: "tableDescription";
  readonly id: string;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly columns: readonly string[];
  readonly hasSchema: boolean;
};

export type TablePreview = {
  readonly kind: "tablePreview";
  readonly description: TableDescription;
  readonly markdown: string;
};

export type KeyedTableDescription = {
  readonly kind: "keyedTableDescription";
  readonly tableId: string;
  readonly keyColumn: string;
  readonly keyCount: number;
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
  | "InvalidColumnarJson"
  | "InvalidColumnarJsonKind"
  | "InvalidColumnarJsonRowCount"
  | "InvalidColumnarJsonSchema"
  | "InvalidRowWidth"
  | "MissingObjectColumn"
  | "ExtraObjectColumn"
  | "MissingSchemaColumn"
  | "ExtraSchemaColumn"
  | "InvalidTableCell"
  | "InvalidTableEnumValue"
  | "InvalidTableLiteralValue"
  | "InvalidTableSchema"
  | "EmptyTableEnum"
  | "DuplicateTableEnumValue"
  | "MissingDispatchKeyColumn"
  | "MissingDispatchHandlerColumn"
  | "InvalidDispatchKey"
  | "InvalidDispatchHandler"
  | "DuplicateDispatchKey"
  | "MissingTableKeyColumn"
  | "InvalidTableKeyCell"
  | "DuplicateTableKey"
  | "MissingTableKey";

export type TableDiagnostic = {
  readonly severity: "error" | "warning";
  readonly code: TableDiagnosticCode;
  readonly message: string;
  readonly tableId?: string;
  readonly column?: string;
  readonly row?: number;
  readonly path?: string;
};
