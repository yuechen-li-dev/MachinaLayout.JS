import { columnNames } from "./access";
import { define, withSchema } from "./authoring";
import { preview } from "./render";
import type {
  ChunkedColumnarTable,
  ColumnarTable,
  ColumnarTableChunk,
  ColumnarTableChunkDescription,
  ColumnarTableManifest,
  ColumnarTableManifestChunk,
  ColumnarTableManifestDescription,
  TableChunkOptions,
  TableColumns,
  TableDiagnostic,
  TableManifestOptions,
  TablePreview,
  TableSchema,
} from "./types";
import { TableError, cloneColumns, isSchemaTable } from "./validate";

function chunkTablePath(tableId: string, chunkId: string, suffix?: string): string {
  const base = `${tableId}.${chunkId}`;
  return suffix === undefined ? base : `${base}.${suffix}`;
}

function manifestPath(tableId: string, suffix?: string): string {
  return suffix === undefined ? `${tableId}.manifest` : `${tableId}.manifest.${suffix}`;
}

function createDiagnostic(input: {
  readonly code: TableDiagnostic["code"];
  readonly message: string;
  readonly tableId?: string;
  readonly column?: string;
  readonly row?: number;
  readonly path?: string;
  readonly severity?: TableDiagnostic["severity"];
}): TableDiagnostic {
  return {
    severity: input.severity ?? "error",
    code: input.code,
    message: input.message,
    tableId: input.tableId,
    column: input.column,
    row: input.row,
    path: input.path,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
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

function shouldIncludeSchema(
  value: unknown,
  includeSchema: boolean | undefined,
): value is TableSchema | unknown {
  if (includeSchema === true) {
    return value !== undefined && isJsonSafe(value);
  }

  if (includeSchema === false) {
    return false;
  }

  return value !== undefined && isJsonSafe(value);
}

function cloneChunkColumns(columns: TableColumns): TableColumns {
  return cloneColumns(columns);
}

function sliceChunkColumns<TColumns extends TableColumns>(
  columns: TColumns,
  rowOffset: number,
  rowCount: number,
): TColumns {
  const nextColumns = {} as Record<string, readonly unknown[]>;
  for (const [name, values] of Object.entries(columns)) {
    nextColumns[name] = values.slice(rowOffset, rowOffset + rowCount);
  }
  return nextColumns as TColumns;
}

function padChunkIndex(index: number): string {
  return index.toString().padStart(4, "0");
}

function validateChunkSize(chunkSize: number): void {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new TableError([
      createDiagnostic({
        code: "InvalidChunkRowCount",
        message: "Chunk size must be a positive integer.",
      }),
    ]);
  }
}

function getManifestChunkPath(tableId: string, index: number, field?: string): string {
  return manifestPath(
    tableId,
    field === undefined ? `chunks[${index}]` : `chunks[${index}].${field}`,
  );
}

function cloneManifestChunks(
  chunks: readonly ColumnarTableManifestChunk[],
): readonly ColumnarTableManifestChunk[] {
  return chunks.map((chunk) => ({ ...chunk }));
}

function cloneSchemaIfJsonSafe<TSchema>(schema: TSchema | undefined): TSchema | undefined {
  return schema !== undefined && isJsonSafe(schema)
    ? (JSON.parse(JSON.stringify(schema)) as TSchema)
    : undefined;
}

function sameSchema(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sortChunks(chunks: readonly ColumnarTableChunk[]): readonly ColumnarTableChunk[] {
  return [...chunks].sort((left, right) => {
    if (left.rowOffset !== right.rowOffset) {
      return left.rowOffset - right.rowOffset;
    }
    return left.chunkId.localeCompare(right.chunkId);
  });
}

function firstChunkColumnNames(chunks: readonly ColumnarTableChunk[]): readonly string[] {
  return chunks.length > 0 ? Object.keys(chunks[0].columns) : [];
}

function validateChunkLike(chunk: unknown): TableDiagnostic[] {
  if (!isPlainObject(chunk)) {
    return [
      createDiagnostic({
        code: "InvalidColumnarTableChunk",
        message: "Columnar table chunk must be an object.",
      }),
    ];
  }

  const diagnostics: TableDiagnostic[] = [];
  const tableId = isNonEmptyString(chunk.tableId) ? chunk.tableId : undefined;
  const chunkId = isNonEmptyString(chunk.chunkId) ? chunk.chunkId : undefined;

  if (chunk.kind !== "columnarTableChunk") {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidChunkKind",
        message: 'Chunk kind must be "columnarTableChunk".',
        tableId,
        path:
          chunkId === undefined || tableId === undefined
            ? undefined
            : chunkTablePath(tableId, chunkId),
      }),
    );
  }

  if (!isNonEmptyString(chunk.tableId)) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidChunkTableId",
        message: "Chunk tableId must be a non-empty string.",
        path: tableId === undefined ? undefined : tableId,
      }),
    );
  }

  if (!isNonEmptyString(chunk.chunkId)) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidChunkId",
        message: "Chunk chunkId must be a non-empty string.",
        tableId,
        path: tableId === undefined ? undefined : manifestPath(tableId, "chunkId"),
      }),
    );
  }

  if (!isNonNegativeInteger(chunk.rowOffset)) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidChunkRowOffset",
        message: "Chunk rowOffset must be a non-negative integer.",
        tableId,
        path:
          tableId !== undefined && chunkId !== undefined
            ? chunkTablePath(tableId, chunkId, "rowOffset")
            : undefined,
      }),
    );
  }

  if (!isNonNegativeInteger(chunk.rowCount)) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidChunkRowCount",
        message: "Chunk rowCount must be a non-negative integer.",
        tableId,
        path:
          tableId !== undefined && chunkId !== undefined
            ? chunkTablePath(tableId, chunkId, "rowCount")
            : undefined,
      }),
    );
  }

  if ("rows" in chunk) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidChunkRowsField",
        message: 'Chunk JSON must remain columnar and must not include a "rows" field.',
        tableId,
        path:
          tableId !== undefined && chunkId !== undefined
            ? chunkTablePath(tableId, chunkId, "rows")
            : undefined,
      }),
    );
  }

  if (!isPlainObject(chunk.columns)) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidChunkColumns",
        message: "Chunk columns must be an object whose values are arrays.",
        tableId,
        path:
          tableId !== undefined && chunkId !== undefined
            ? chunkTablePath(tableId, chunkId, "columns")
            : undefined,
      }),
    );
    return diagnostics;
  }

  for (const [columnName, values] of Object.entries(chunk.columns)) {
    const columnPath =
      tableId !== undefined && chunkId !== undefined
        ? chunkTablePath(tableId, chunkId, `columns.${columnName}`)
        : undefined;

    if (!Array.isArray(values)) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidChunkColumns",
          message: `Chunk column "${columnName}" must be an array of values.`,
          tableId,
          column: columnName,
          path: columnPath,
        }),
      );
      continue;
    }

    if (isNonNegativeInteger(chunk.rowCount) && values.length !== chunk.rowCount) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidChunkColumnLength",
          message: `Chunk column "${columnName}" has length ${values.length} but expected ${chunk.rowCount}.`,
          tableId,
          column: columnName,
          path: columnPath,
        }),
      );
    }
  }

  return diagnostics;
}

function validateManifestLike(manifest: unknown): TableDiagnostic[] {
  if (!isPlainObject(manifest)) {
    return [
      createDiagnostic({
        code: "InvalidColumnarTableManifest",
        message: "Columnar table manifest must be an object.",
      }),
    ];
  }

  const diagnostics: TableDiagnostic[] = [];
  const tableId = isNonEmptyString(manifest.tableId) ? manifest.tableId : undefined;

  if (manifest.kind !== "columnarTableManifest") {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidManifestKind",
        message: 'Manifest kind must be "columnarTableManifest".',
        tableId,
        path: tableId === undefined ? undefined : manifestPath(tableId),
      }),
    );
  }

  if (!isNonEmptyString(manifest.tableId)) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidManifestTableId",
        message: "Manifest tableId must be a non-empty string.",
      }),
    );
  }

  if (!isNonNegativeInteger(manifest.rowCount)) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidManifestRowCount",
        message: "Manifest rowCount must be a non-negative integer.",
        tableId,
        path: tableId === undefined ? undefined : manifestPath(tableId, "rowCount"),
      }),
    );
  }

  if (!Array.isArray(manifest.columnNames)) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidManifestColumnNames",
        message: "Manifest columnNames must be an array of non-empty strings.",
        tableId,
        path: tableId === undefined ? undefined : manifestPath(tableId, "columnNames"),
      }),
    );
  } else {
    const seen = new Set<string>();
    manifest.columnNames.forEach((columnName, index) => {
      if (!isNonEmptyString(columnName)) {
        diagnostics.push(
          createDiagnostic({
            code: "InvalidManifestColumnNames",
            message: `Manifest column name at index ${index} must be a non-empty string.`,
            tableId,
            path:
              tableId === undefined ? undefined : manifestPath(tableId, `columnNames[${index}]`),
          }),
        );
        return;
      }

      if (seen.has(columnName)) {
        diagnostics.push(
          createDiagnostic({
            code: "DuplicateManifestColumnName",
            message: `Manifest column name "${columnName}" appears more than once.`,
            tableId,
            column: columnName,
            path:
              tableId === undefined ? undefined : manifestPath(tableId, `columnNames[${index}]`),
          }),
        );
        return;
      }

      seen.add(columnName);
    });
  }

  if (!Array.isArray(manifest.chunks)) {
    diagnostics.push(
      createDiagnostic({
        code: "InvalidManifestChunks",
        message: "Manifest chunks must be an array.",
        tableId,
        path: tableId === undefined ? undefined : manifestPath(tableId, "chunks"),
      }),
    );
    return diagnostics;
  }

  type Range = { readonly start: number; readonly end: number; readonly index: number };
  const ranges: Range[] = [];
  let sum = 0;

  manifest.chunks.forEach((chunk, index) => {
    if (!isPlainObject(chunk)) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidManifestChunks",
          message: `Manifest chunk at index ${index} must be an object.`,
          tableId,
          path: getManifestChunkPath(tableId ?? "table", index),
        }),
      );
      return;
    }

    if (!isNonEmptyString(chunk.chunkId)) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidManifestChunkId",
          message: `Manifest chunk at index ${index} must have a non-empty chunkId.`,
          tableId,
          path: getManifestChunkPath(tableId ?? "table", index, "chunkId"),
        }),
      );
    }

    if (!isNonNegativeInteger(chunk.rowOffset)) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidManifestChunkOffset",
          message: `Manifest chunk at index ${index} must have a non-negative integer rowOffset.`,
          tableId,
          path: getManifestChunkPath(tableId ?? "table", index, "rowOffset"),
        }),
      );
    }

    if (!isNonNegativeInteger(chunk.rowCount)) {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidManifestChunkRowCount",
          message: `Manifest chunk at index ${index} must have a non-negative integer rowCount.`,
          tableId,
          path: getManifestChunkPath(tableId ?? "table", index, "rowCount"),
        }),
      );
    }

    if (chunk.href !== undefined && typeof chunk.href !== "string") {
      diagnostics.push(
        createDiagnostic({
          code: "InvalidManifestChunkHref",
          message: `Manifest chunk at index ${index} href must be a string when provided.`,
          tableId,
          path: getManifestChunkPath(tableId ?? "table", index, "href"),
        }),
      );
    }

    if (isNonNegativeInteger(chunk.rowOffset) && isNonNegativeInteger(chunk.rowCount)) {
      ranges.push({
        start: chunk.rowOffset,
        end: chunk.rowOffset + chunk.rowCount,
        index,
      });
      sum += chunk.rowCount;
    }
  });

  const sortedRanges = [...ranges].sort((left, right) => left.start - right.start);
  let cursor = 0;

  sortedRanges.forEach((range) => {
    if (range.start < cursor) {
      diagnostics.push(
        createDiagnostic({
          code: "OverlappingManifestChunks",
          message: `Manifest chunk at index ${range.index} overlaps a previous chunk.`,
          tableId,
          path: getManifestChunkPath(tableId ?? "table", range.index, "rowOffset"),
        }),
      );
    }

    if (range.start !== cursor) {
      diagnostics.push(
        createDiagnostic({
          code: "NonContiguousManifestChunks",
          message: `Manifest chunk at index ${range.index} starts at row ${range.start} but expected ${cursor}.`,
          tableId,
          path: getManifestChunkPath(tableId ?? "table", range.index, "rowOffset"),
        }),
      );
    }

    cursor = Math.max(cursor, range.end);
  });

  if (isNonNegativeInteger(manifest.rowCount) && sum !== manifest.rowCount) {
    diagnostics.push(
      createDiagnostic({
        code: "ManifestRowCountMismatch",
        message: `Manifest rowCount is ${manifest.rowCount} but chunk rowCount sum is ${sum}.`,
        tableId,
        path: tableId === undefined ? undefined : manifestPath(tableId, "rowCount"),
      }),
    );
  }

  return diagnostics;
}

export function validateColumnarTableChunk(chunk: ColumnarTableChunk): TableDiagnostic[] {
  return validateChunkLike(chunk);
}

export function validateColumnarTableManifest(manifest: ColumnarTableManifest): TableDiagnostic[] {
  return validateManifestLike(manifest);
}

export function validateChunksAgainstManifest(
  manifest: ColumnarTableManifest,
  chunks: readonly ColumnarTableChunk[],
): TableDiagnostic[] {
  const diagnostics = [
    ...validateColumnarTableManifest(manifest),
    ...chunks.flatMap((chunk) => validateColumnarTableChunk(chunk)),
  ];

  const byId = new Map(chunks.map((chunk) => [chunk.chunkId, chunk] as const));
  const manifestChunkIds = new Set<string>();

  manifest.chunks.forEach((manifestChunk, index) => {
    manifestChunkIds.add(manifestChunk.chunkId);
    const pathBase = getManifestChunkPath(manifest.tableId, index);
    const chunk = byId.get(manifestChunk.chunkId);
    if (chunk === undefined) {
      diagnostics.push(
        createDiagnostic({
          code: "MissingManifestChunk",
          message: `Manifest chunk "${manifestChunk.chunkId}" was not provided.`,
          tableId: manifest.tableId,
          path: `${pathBase}.chunkId`,
        }),
      );
      return;
    }

    if (chunk.tableId !== manifest.tableId) {
      diagnostics.push(
        createDiagnostic({
          code: "ManifestChunkTableMismatch",
          message: `Chunk "${chunk.chunkId}" belongs to table "${chunk.tableId}" but manifest table is "${manifest.tableId}".`,
          tableId: manifest.tableId,
          path: chunkTablePath(chunk.tableId, chunk.chunkId),
        }),
      );
    }

    if (chunk.rowOffset !== manifestChunk.rowOffset) {
      diagnostics.push(
        createDiagnostic({
          code: "ManifestChunkOffsetMismatch",
          message: `Chunk "${chunk.chunkId}" rowOffset ${chunk.rowOffset} does not match manifest rowOffset ${manifestChunk.rowOffset}.`,
          tableId: manifest.tableId,
          path: chunkTablePath(chunk.tableId, chunk.chunkId, "rowOffset"),
        }),
      );
    }

    if (chunk.rowCount !== manifestChunk.rowCount) {
      diagnostics.push(
        createDiagnostic({
          code: "ManifestChunkRowCountMismatch",
          message: `Chunk "${chunk.chunkId}" rowCount ${chunk.rowCount} does not match manifest rowCount ${manifestChunk.rowCount}.`,
          tableId: manifest.tableId,
          path: chunkTablePath(chunk.tableId, chunk.chunkId, "rowCount"),
        }),
      );
    }

    const manifestColumns = manifest.columnNames.join("\u0000");
    const chunkColumns = Object.keys(chunk.columns).join("\u0000");
    if (manifestColumns !== chunkColumns) {
      diagnostics.push(
        createDiagnostic({
          code: "ManifestChunkColumnMismatch",
          message: `Chunk "${chunk.chunkId}" columns do not match the manifest column order.`,
          tableId: manifest.tableId,
          path: chunkTablePath(chunk.tableId, chunk.chunkId, "columns"),
        }),
      );
    }
  });

  chunks.forEach((chunk) => {
    if (!manifestChunkIds.has(chunk.chunkId)) {
      diagnostics.push(
        createDiagnostic({
          code: "ExtraManifestChunk",
          message: `Chunk "${chunk.chunkId}" is not present in the manifest.`,
          tableId: manifest.tableId,
          path: chunkTablePath(chunk.tableId, chunk.chunkId),
        }),
      );
    }
  });

  return diagnostics;
}

export function chunkFromTable<TColumns extends TableColumns>(
  table: ColumnarTable<TColumns>,
  input: {
    readonly chunkId: string;
    readonly rowOffset?: number;
    readonly rowCount?: number;
    readonly includeSchema?: boolean;
  },
): ColumnarTableChunk {
  const rowOffset = input.rowOffset ?? 0;
  const requestedRowCount = input.rowCount ?? table.rowCount - rowOffset;

  if (!isNonNegativeInteger(rowOffset)) {
    throw new TableError([
      createDiagnostic({
        code: "InvalidChunkRowOffset",
        message: "Chunk rowOffset must be a non-negative integer.",
        tableId: table.id,
        path: `${table.id}.${input.chunkId}.rowOffset`,
      }),
    ]);
  }

  if (!isNonNegativeInteger(requestedRowCount)) {
    throw new TableError([
      createDiagnostic({
        code: "InvalidChunkRowCount",
        message: "Chunk rowCount must be a non-negative integer.",
        tableId: table.id,
        path: `${table.id}.${input.chunkId}.rowCount`,
      }),
    ]);
  }

  if (rowOffset + requestedRowCount > table.rowCount) {
    throw new TableError([
      createDiagnostic({
        code: "InvalidChunkRowCount",
        message: `Chunk row range ${rowOffset}..${rowOffset + requestedRowCount} exceeds table rowCount ${table.rowCount}.`,
        tableId: table.id,
        path: `${table.id}.${input.chunkId}.rowCount`,
      }),
    ]);
  }

  const chunk: ColumnarTableChunk = {
    kind: "columnarTableChunk",
    tableId: table.id,
    chunkId: input.chunkId,
    rowOffset,
    rowCount: requestedRowCount,
    columns: sliceChunkColumns(table.columns, rowOffset, requestedRowCount),
  };

  if (isSchemaTable(table) && shouldIncludeSchema(table.schema, input.includeSchema)) {
    return {
      ...chunk,
      schema: cloneSchemaIfJsonSafe(table.schema),
    };
  }

  return chunk;
}

export function chunksFromTable<TColumns extends TableColumns>(
  table: ColumnarTable<TColumns>,
  options: TableChunkOptions,
): readonly ColumnarTableChunk[] {
  validateChunkSize(options.chunkSize);

  if (table.rowCount === 0) {
    return [];
  }

  const chunkIdPrefix = options.chunkIdPrefix ?? table.id;
  const chunks: ColumnarTableChunk[] = [];

  for (
    let rowOffset = 0, chunkIndex = 0;
    rowOffset < table.rowCount;
    rowOffset += options.chunkSize, chunkIndex += 1
  ) {
    const nextRowCount = Math.min(options.chunkSize, table.rowCount - rowOffset);
    chunks.push(
      chunkFromTable(table, {
        chunkId: `${chunkIdPrefix}-${padChunkIndex(chunkIndex)}`,
        rowOffset,
        rowCount: nextRowCount,
        includeSchema: options.includeSchema,
      }),
    );
  }

  return chunks;
}

export function manifestFromChunks(
  tableId: string,
  chunks: readonly ColumnarTableChunk[],
  options: TableManifestOptions = {},
): ColumnarTableManifest {
  const sorted = sortChunks(chunks);
  const manifest: ColumnarTableManifest = {
    kind: "columnarTableManifest",
    tableId,
    rowCount: sorted.reduce((sum, chunk) => sum + chunk.rowCount, 0),
    columnNames: firstChunkColumnNames(sorted),
    chunks: sorted.map((chunk, index) => ({
      chunkId: chunk.chunkId,
      rowOffset: chunk.rowOffset,
      rowCount: chunk.rowCount,
      href: options.hrefForChunk?.(chunk, index),
    })),
  };

  const schemaChunk = sorted.find((chunk) => chunk.schema !== undefined);
  if (schemaChunk !== undefined && shouldIncludeSchema(schemaChunk.schema, options.includeSchema)) {
    return {
      ...manifest,
      schema: cloneSchemaIfJsonSafe(schemaChunk.schema),
    };
  }

  return manifest;
}

export function chunkedFromTable<TColumns extends TableColumns>(
  table: ColumnarTable<TColumns>,
  options: TableChunkOptions & TableManifestOptions,
): ChunkedColumnarTable {
  const chunks = chunksFromTable(table, options);
  const manifest = manifestFromChunks(table.id, chunks, options);

  return {
    kind: "chunkedColumnarTable",
    manifest: {
      ...manifest,
      columnNames: columnNames(table),
      ...(isSchemaTable(table) && shouldIncludeSchema(table.schema, options.includeSchema)
        ? { schema: cloneSchemaIfJsonSafe(table.schema) }
        : {}),
    },
    chunks,
  };
}

export function tableFromChunks(
  chunks: readonly ColumnarTableChunk[],
  input: {
    readonly id?: string;
    readonly manifest?: ColumnarTableManifest;
  } = {},
): ColumnarTable {
  const chunkDiagnostics = chunks.flatMap((chunk) => validateColumnarTableChunk(chunk));
  if (chunkDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(chunkDiagnostics);
  }

  if (input.manifest !== undefined) {
    const manifestDiagnostics = validateChunksAgainstManifest(input.manifest, chunks);
    if (manifestDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      throw new TableError(manifestDiagnostics);
    }
  }

  const sorted = sortChunks(chunks);
  const resolvedId = input.id ?? input.manifest?.tableId ?? sorted[0]?.tableId;
  if (!isNonEmptyString(resolvedId)) {
    throw new TableError([
      createDiagnostic({
        code: "InvalidChunkTableId",
        message: "Cannot restore a table from empty chunks without an explicit id or manifest.",
      }),
    ]);
  }

  let cursor = 0;
  let tableId = sorted[0]?.tableId ?? resolvedId;
  const expectedColumns = input.manifest?.columnNames ?? firstChunkColumnNames(sorted);
  const schema =
    sorted.find((chunk) => chunk.schema !== undefined)?.schema ?? input.manifest?.schema;

  for (const chunk of sorted) {
    if (chunk.tableId !== tableId) {
      throw new TableError([
        createDiagnostic({
          code: "ManifestChunkTableMismatch",
          message: `Chunk "${chunk.chunkId}" tableId "${chunk.tableId}" does not match "${tableId}".`,
          tableId: resolvedId,
          path: chunkTablePath(chunk.tableId, chunk.chunkId),
        }),
      ]);
    }

    if (chunk.rowOffset < cursor) {
      throw new TableError([
        createDiagnostic({
          code: "OverlappingManifestChunks",
          message: `Chunk "${chunk.chunkId}" overlaps a previous chunk.`,
          tableId: resolvedId,
          path: chunkTablePath(chunk.tableId, chunk.chunkId, "rowOffset"),
        }),
      ]);
    }

    if (chunk.rowOffset !== cursor) {
      throw new TableError([
        createDiagnostic({
          code: "NonContiguousManifestChunks",
          message: `Chunk "${chunk.chunkId}" starts at row ${chunk.rowOffset} but expected ${cursor}.`,
          tableId: resolvedId,
          path: chunkTablePath(chunk.tableId, chunk.chunkId, "rowOffset"),
        }),
      ]);
    }

    const chunkColumns = Object.keys(chunk.columns);
    if (chunkColumns.join("\u0000") !== expectedColumns.join("\u0000")) {
      throw new TableError([
        createDiagnostic({
          code: "ManifestChunkColumnMismatch",
          message: `Chunk "${chunk.chunkId}" columns do not match the expected column order.`,
          tableId: resolvedId,
          path: chunkTablePath(chunk.tableId, chunk.chunkId, "columns"),
        }),
      ]);
    }

    if (schema !== undefined && chunk.schema !== undefined && !sameSchema(schema, chunk.schema)) {
      throw new TableError([
        createDiagnostic({
          code: "ManifestChunkTableMismatch",
          message: `Chunk "${chunk.chunkId}" schema does not match the restored table schema.`,
          tableId: resolvedId,
          path: chunkTablePath(chunk.tableId, chunk.chunkId, "schema"),
        }),
      ]);
    }

    cursor = chunk.rowOffset + chunk.rowCount;
    tableId = chunk.tableId;
  }

  if (input.manifest !== undefined && cursor !== input.manifest.rowCount) {
    throw new TableError([
      createDiagnostic({
        code: "ManifestRowCountMismatch",
        message: `Restored chunk rows total ${cursor} but manifest rowCount is ${input.manifest.rowCount}.`,
        tableId: resolvedId,
        path: manifestPath(resolvedId, "rowCount"),
      }),
    ]);
  }

  const restoredColumns = Object.fromEntries(
    expectedColumns.map((column) => [column, [] as unknown[]]),
  ) as Record<string, unknown[]>;

  for (const chunk of sorted) {
    for (const column of expectedColumns) {
      restoredColumns[column].push(...chunk.columns[column]);
    }
  }

  const restored = define({
    id: resolvedId,
    columns: restoredColumns,
  });

  if (schema !== undefined && isJsonSafe(schema)) {
    return withSchema(restored, schema as TableSchema);
  }

  return restored;
}

export function toChunkJson(chunk: ColumnarTableChunk): ColumnarTableChunk {
  const diagnostics = validateColumnarTableChunk(chunk);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  return {
    kind: "columnarTableChunk",
    tableId: chunk.tableId,
    chunkId: chunk.chunkId,
    rowOffset: chunk.rowOffset,
    rowCount: chunk.rowCount,
    columns: cloneChunkColumns(chunk.columns),
    ...(chunk.schema !== undefined && isJsonSafe(chunk.schema)
      ? { schema: cloneSchemaIfJsonSafe(chunk.schema) }
      : {}),
  };
}

export function fromChunkJson(input: unknown): ColumnarTableChunk {
  const diagnostics = validateChunkLike(input);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  const chunk = input as ColumnarTableChunk;
  return toChunkJson(chunk);
}

export function toManifestJson(manifest: ColumnarTableManifest): ColumnarTableManifest {
  const diagnostics = validateColumnarTableManifest(manifest);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  return {
    kind: "columnarTableManifest",
    tableId: manifest.tableId,
    rowCount: manifest.rowCount,
    columnNames: [...manifest.columnNames],
    chunks: cloneManifestChunks(manifest.chunks),
    ...(manifest.schema !== undefined && isJsonSafe(manifest.schema)
      ? { schema: cloneSchemaIfJsonSafe(manifest.schema) }
      : {}),
  };
}

export function fromManifestJson(input: unknown): ColumnarTableManifest {
  const diagnostics = validateManifestLike(input);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  const manifest = input as ColumnarTableManifest;
  return toManifestJson(manifest);
}

export function describeChunk(chunk: ColumnarTableChunk): ColumnarTableChunkDescription {
  return {
    kind: "columnarTableChunkDescription",
    tableId: chunk.tableId,
    chunkId: chunk.chunkId,
    rowOffset: chunk.rowOffset,
    rowCount: chunk.rowCount,
    columnCount: Object.keys(chunk.columns).length,
    columns: Object.keys(chunk.columns),
  };
}

export function describeManifest(
  manifest: ColumnarTableManifest,
): ColumnarTableManifestDescription {
  return {
    kind: "columnarTableManifestDescription",
    tableId: manifest.tableId,
    rowCount: manifest.rowCount,
    chunkCount: manifest.chunks.length,
    columnCount: manifest.columnNames.length,
    columns: [...manifest.columnNames],
  };
}

export function describeChunkedTable(
  chunked: ChunkedColumnarTable,
): ColumnarTableManifestDescription {
  return describeManifest(chunked.manifest);
}

export function previewChunk(
  chunk: ColumnarTableChunk,
  options: { readonly maxRows?: number } = {},
): TablePreview {
  return preview(tableFromChunks([chunk], { id: chunk.tableId }), options);
}
