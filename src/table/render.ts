import { columnNames } from "./access";
import { define, withSchema } from "./authoring";
import { fromObjects, toObjects, toRows } from "./convert";
import type {
  ColumnarTable,
  ColumnarTableJson,
  TableColumns,
  TableCsvOptions,
  TableDescription,
  TableDiagnostic,
  TableMarkdownOptions,
  TableObjectRow,
  TablePreview,
  TableSchema,
} from "./types";
import { TableError, isSchemaTable, validateTableSchema } from "./validate";

function createTableDiagnostic(
  code: TableDiagnostic["code"],
  message: string,
  tableId?: string,
  column?: string,
): TableDiagnostic {
  const path =
    tableId === undefined ? undefined : column === undefined ? tableId : `${tableId}.${column}`;

  return {
    severity: "error",
    code,
    message,
    tableId,
    column,
    path,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonSafe(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(value);
    case "undefined":
    case "function":
    case "symbol":
    case "bigint":
      return false;
    case "object":
      if (Array.isArray(value)) {
        return value.every((item) => isJsonSafe(item));
      }

      return Object.values(value).every((item) => isJsonSafe(item));
    default:
      return false;
  }
}

function cloneJsonColumns(
  columns: Record<string, readonly unknown[]>,
): Record<string, readonly unknown[]> {
  return Object.fromEntries(Object.entries(columns).map(([name, values]) => [name, [...values]]));
}

function stringifyStructuredValue(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    return json ?? "[unserializable]";
  } catch {
    return "[unserializable]";
  }
}

function stringifyCell(value: unknown, emptyCell: string): string {
  if (value === undefined || value === null) {
    return emptyCell;
  }

  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "boolean":
      return String(value);
    case "function":
      return "[function]";
    case "symbol":
      return String(value);
    case "bigint":
      return String(value);
    case "object":
      return stringifyStructuredValue(value);
    default:
      return String(value);
  }
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|");
}

function escapeCsvCell(value: string): string {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function normalizeMaxRows(maxRows: number | undefined, rowCount: number): number {
  if (maxRows === undefined) {
    return rowCount;
  }

  if (!Number.isFinite(maxRows) || maxRows < 0) {
    return 0;
  }

  return Math.min(rowCount, Math.floor(maxRows));
}

export function toColumnarJson<TColumns extends TableColumns>(
  table: ColumnarTable<TColumns>,
): ColumnarTableJson {
  const base = {
    kind: "columnarTable",
    id: table.id,
    rowCount: table.rowCount,
    columns: cloneJsonColumns(table.columns),
  } as const;

  if (isSchemaTable(table) && isJsonSafe(table.schema)) {
    return {
      ...base,
      schema: table.schema,
    };
  }

  return base;
}

export function fromColumnarJson(input: ColumnarTableJson): ColumnarTable {
  const diagnostics: TableDiagnostic[] = [];
  const tableId =
    typeof input?.id === "string" && input.id.trim().length > 0 ? input.id : undefined;

  if (!isPlainObject(input)) {
    throw new TableError([
      createTableDiagnostic("InvalidColumnarJson", "Columnar table JSON must be an object."),
    ]);
  }

  if (input.kind !== "columnarTable") {
    diagnostics.push(
      createTableDiagnostic(
        "InvalidColumnarJsonKind",
        'Columnar table JSON kind must be "columnarTable".',
        tableId,
      ),
    );
  }

  if (typeof input.id !== "string" || input.id.trim().length === 0) {
    diagnostics.push(
      createTableDiagnostic("InvalidTableId", "Table id must be a non-empty string."),
    );
  }

  if (!Number.isInteger(input.rowCount) || input.rowCount < 0) {
    diagnostics.push(
      createTableDiagnostic(
        "InvalidColumnarJsonRowCount",
        "Columnar table JSON rowCount must be a non-negative integer.",
        tableId,
      ),
    );
  }

  if (!isPlainObject(input.columns)) {
    diagnostics.push(
      createTableDiagnostic(
        "InvalidColumnarJson",
        "Columnar table JSON columns must be an object whose values are arrays.",
        tableId,
      ),
    );
  } else {
    for (const [columnName, values] of Object.entries(input.columns)) {
      if (!Array.isArray(values)) {
        diagnostics.push(
          createTableDiagnostic(
            "InvalidColumnValues",
            `Column "${columnName}" must be an array of values.`,
            tableId,
            columnName,
          ),
        );
        continue;
      }

      if (
        Number.isInteger(input.rowCount) &&
        input.rowCount >= 0 &&
        values.length !== input.rowCount
      ) {
        diagnostics.push(
          createTableDiagnostic(
            "InvalidColumnarJsonRowCount",
            `Column "${columnName}" has length ${values.length} but expected ${input.rowCount}.`,
            tableId,
            columnName,
          ),
        );
      }
    }
  }

  if (diagnostics.length > 0) {
    throw new TableError(diagnostics);
  }

  const table = define({
    id: input.id,
    columns: cloneJsonColumns(input.columns),
  });

  if (input.schema === undefined) {
    return table;
  }

  const schemaDiagnostics = validateTableSchema(input.schema, input.id);
  if (schemaDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(
      schemaDiagnostics.map((diagnostic) => ({
        ...diagnostic,
        code: "InvalidColumnarJsonSchema",
      })),
    );
  }

  return withSchema(table, input.schema as TableSchema);
}

export function toJsonObjects<TColumns extends TableColumns>(
  table: ColumnarTable<TColumns>,
): readonly { readonly [key: string]: unknown }[] {
  return toObjects(table) as readonly { readonly [key: string]: unknown }[];
}

export function fromJsonObjects<const TRows extends readonly TableObjectRow[]>(input: {
  id: string;
  rows: TRows;
  columns?: readonly string[];
}): ColumnarTable<Record<string, readonly unknown[]>> {
  return fromObjects(input);
}

export function toJsonRows<TColumns extends TableColumns>(
  table: ColumnarTable<TColumns>,
): readonly unknown[][] {
  return toRows(table);
}

export function toMarkdown(table: ColumnarTable, options: TableMarkdownOptions = {}): string {
  const names = columnNames(table);
  const includeRowIndex = options.includeRowIndex === true;
  const emptyCell = options.emptyCell ?? "";
  const visibleRowCount = normalizeMaxRows(options.maxRows, table.rowCount);
  const isTruncated = visibleRowCount < table.rowCount;
  const headers = includeRowIndex ? ["#", ...names] : [...names];
  const separator = headers.map(() => "---");
  const lines = [`| ${headers.join(" | ")} |`, `| ${separator.join(" | ")} |`];

  for (let rowIndex = 0; rowIndex < visibleRowCount; rowIndex += 1) {
    const cells = names.map((column) =>
      escapeMarkdownCell(stringifyCell(table.columns[column]?.[rowIndex], emptyCell)),
    );
    const row = includeRowIndex ? [String(rowIndex), ...cells] : cells;
    lines.push(`| ${row.join(" | ")} |`);
  }

  if (isTruncated) {
    const ellipsisCells = names.map(() => "...");
    const row = includeRowIndex ? ["...", ...ellipsisCells] : ellipsisCells;
    lines.push(`| ${row.join(" | ")} |`);
  }

  return lines.join("\n");
}

export function toCsv(table: ColumnarTable, options: TableCsvOptions = {}): string {
  const names = columnNames(table);
  const includeHeader = options.includeHeader !== false;
  const lines: string[] = [];

  if (includeHeader) {
    lines.push(names.map((name) => escapeCsvCell(name)).join(","));
  }

  for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex += 1) {
    const row = names.map((column) =>
      escapeCsvCell(stringifyCell(table.columns[column]?.[rowIndex], "")),
    );
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

export function describe(table: ColumnarTable): TableDescription {
  const names = columnNames(table);

  return {
    kind: "tableDescription",
    id: table.id,
    rowCount: table.rowCount,
    columnCount: names.length,
    columns: names,
    hasSchema: isSchemaTable(table),
  };
}

export function preview(table: ColumnarTable, options: TableMarkdownOptions = {}): TablePreview {
  return {
    kind: "tablePreview",
    description: describe(table),
    markdown: toMarkdown(table, {
      maxRows: options.maxRows ?? 10,
      includeRowIndex: options.includeRowIndex,
      emptyCell: options.emptyCell,
    }),
  };
}
