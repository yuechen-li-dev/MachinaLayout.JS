import type {
  ColumnarTable,
  SchemaColumnarTable,
  TableColumnSchema,
  TableColumns,
  TableSchema,
  TableSchemaColumns,
  TableSchemaPrimitive,
} from "./types";
import { assertNoTableErrors, cloneColumns, validateTable, validateTableSchema } from "./validate";

function createTable<TColumns extends TableColumns>(input: {
  readonly id: string;
  readonly columns: TColumns;
}): ColumnarTable<TColumns> {
  return {
    kind: "table",
    id: input.id,
    columns: cloneColumns(input.columns),
    rowCount: Math.max(0, ...Object.values(input.columns).map((column) => column.length)),
  };
}

function cloneColumnSchema<TColumn extends TableColumnSchema>(column: TColumn): TColumn {
  if (column.kind === "enum") {
    return {
      ...column,
      values: [...column.values],
    } as TColumn;
  }

  return { ...column };
}

function cloneSchema<TSchema extends TableSchema>(tableSchema: TSchema): TSchema {
  const columns = Object.fromEntries(
    Object.entries(tableSchema.columns).map(([name, column]) => [name, cloneColumnSchema(column)]),
  );

  return {
    kind: "tableSchema",
    columns,
  } as TSchema;
}

export function string(): { readonly kind: "string"; readonly optional?: boolean } {
  return { kind: "string" };
}

export function number(): { readonly kind: "number"; readonly optional?: boolean } {
  return { kind: "number" };
}

export function boolean(): { readonly kind: "boolean"; readonly optional?: boolean } {
  return { kind: "boolean" };
}

export function literal<const TValue extends TableSchemaPrimitive>(
  value: TValue,
): {
  readonly kind: "literal";
  readonly value: TValue;
  readonly optional?: boolean;
} {
  return { kind: "literal", value };
}

export function enumColumn<const TValues extends readonly TableSchemaPrimitive[]>(
  values: TValues,
): {
  readonly kind: "enum";
  readonly values: TValues;
  readonly optional?: boolean;
} {
  return { kind: "enum", values: [...values] as TValues };
}

export function unknown(): { readonly kind: "unknown"; readonly optional?: boolean } {
  return { kind: "unknown" };
}

export function optional<TColumn extends TableColumnSchema>(
  column: TColumn,
): Omit<TColumn, "optional"> & { readonly optional: true } {
  if (column.kind === "enum") {
    return {
      ...column,
      values: [...column.values],
      optional: true,
    } as Omit<TColumn, "optional"> & { readonly optional: true };
  }

  return {
    ...column,
    optional: true,
  } as Omit<TColumn, "optional"> & { readonly optional: true };
}

export function schema<const TColumns extends Record<string, TableColumnSchema>>(
  columns: TColumns,
): TableSchema<TColumns> {
  const definition = {
    kind: "tableSchema",
    columns: Object.fromEntries(
      Object.entries(columns).map(([name, column]) => [name, cloneColumnSchema(column)]),
    ) as TColumns,
  } as const satisfies TableSchema<TColumns>;

  const diagnostics = validateTableSchema(definition);
  assertNoTableErrors(diagnostics);
  return definition;
}

export function define<const TColumns extends Record<string, readonly unknown[]>>(input: {
  id: string;
  columns: TColumns;
}): ColumnarTable<TColumns> {
  const table = createTable(input);
  const diagnostics = validateTable(table);
  assertNoTableErrors(diagnostics);
  return table;
}

export function defineWithSchema<const TSchema extends TableSchema>(input: {
  id: string;
  schema: TSchema;
  columns: TableSchemaColumns<TSchema>;
}): SchemaColumnarTable<TSchema, TableSchemaColumns<TSchema>> {
  const table = {
    ...createTable({
      id: input.id,
      columns: input.columns,
    }),
    schema: cloneSchema(input.schema),
  } as SchemaColumnarTable<TSchema, TableSchemaColumns<TSchema>>;

  const diagnostics = validateTable(table);
  assertNoTableErrors(diagnostics);
  return table;
}

export function withSchema<TSchema extends TableSchema>(
  table: ColumnarTable,
  tableSchema: TSchema,
): SchemaColumnarTable<TSchema> {
  return defineWithSchema({
    id: table.id,
    schema: tableSchema,
    columns: table.columns as TableSchemaColumns<TSchema>,
  });
}
