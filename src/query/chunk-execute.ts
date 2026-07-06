import { B, type BatchBoard } from "../batch";
import {
  Table,
  TableError,
  type ChunkedColumnarTable,
  type ColumnarTable,
  type ColumnarTableChunk,
} from "../table";
import type {
  SplitTableQueryPlan,
  TableChunkQueryBoard,
  TableChunkQueryExecution,
  TableChunkQueryDiagnostic,
  TableChunkQueryOptions,
  TableChunkQueryTraceEvent,
  TableQueryDiagnostic,
  TableQueryOperation,
  TableQueryOperationExecutionScope,
  TableQueryPlan,
} from "./types";
import { execute } from "./execute";
import { plan as createPlan } from "./plan";
import { TableQueryError, validate } from "./validate";

type MutableTableChunkQueryBoard = {
  kind: "tableChunkQueryBoard";
  id: string;
  planId: string;
  tableId: string;
  status: TableChunkQueryBoard["status"];
  chunkCount: number;
  chunkLocalOperationCount: number;
  globalOperationCount: number;
  scannedChunkCount: number;
  failedChunkCount: number;
  mergedRowCount: number;
  outputRowCount: number;
  batchBoard?: BatchBoard<unknown, Error>;
  trace: TableChunkQueryTraceEvent[];
};

type ScannedChunk = {
  readonly chunkId: string;
  readonly rowOffset: number;
  readonly table: ColumnarTable;
};

function classifyQueryOperation(operation: TableQueryOperation): TableQueryOperationExecutionScope {
  switch (operation.kind) {
    case "where":
    case "filterRows":
    case "select":
    case "renameColumns":
      return "chunkLocal";
    case "sortBy":
    case "take":
    case "drop":
      return "global";
  }
}

function splitQueryPlanForChunks<TTable extends ColumnarTable>(
  plan: TableQueryPlan<TTable>,
): SplitTableQueryPlan<TTable> {
  const firstGlobalOperationIndex = plan.operations.findIndex(
    (operation) => classifyQueryOperation(operation) === "global",
  );

  return {
    kind: "splitTableQueryPlan",
    plan,
    chunkLocalOperations:
      firstGlobalOperationIndex === -1
        ? [...plan.operations]
        : plan.operations.slice(0, firstGlobalOperationIndex),
    globalOperations:
      firstGlobalOperationIndex === -1 ? [] : plan.operations.slice(firstGlobalOperationIndex),
    firstGlobalOperationIndex,
  };
}

function createEmptyTable(id: string, source: ColumnarTable): ColumnarTable {
  const columns = Object.fromEntries(
    Table.columnNames(source).map((column) => [column, [] as unknown[]]),
  ) as Record<string, readonly unknown[]>;
  const table = Table.define({ id, columns });
  return "schema" in source ? Table.withSchema(table, source.schema as never) : table;
}

function tableFromChunk(chunk: ColumnarTableChunk): ColumnarTable {
  const table = Table.define({
    id: chunk.chunkId,
    columns: chunk.columns,
  });
  return chunk.schema !== undefined ? Table.withSchema(table, chunk.schema as never) : table;
}

function cloneTrace(trace: readonly TableChunkQueryTraceEvent[]): TableChunkQueryTraceEvent[] {
  return trace.map((event) => ({ ...event }));
}

function cloneBoard(board: MutableTableChunkQueryBoard): TableChunkQueryBoard {
  return {
    kind: board.kind,
    id: board.id,
    planId: board.planId,
    tableId: board.tableId,
    status: board.status,
    chunkCount: board.chunkCount,
    chunkLocalOperationCount: board.chunkLocalOperationCount,
    globalOperationCount: board.globalOperationCount,
    scannedChunkCount: board.scannedChunkCount,
    failedChunkCount: board.failedChunkCount,
    mergedRowCount: board.mergedRowCount,
    outputRowCount: board.outputRowCount,
    batchBoard: board.batchBoard,
    trace: cloneTrace(board.trace),
  };
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function recordTrace(
  board: MutableTableChunkQueryBoard,
  event: Omit<TableChunkQueryTraceEvent, "at" | "queryId" | "planId"> & {
    readonly at?: number;
    readonly message?: string;
  },
  now: () => number,
): void {
  board.trace.push({
    at: event.at ?? now(),
    kind: event.kind,
    queryId: board.id,
    planId: board.planId,
    chunkId: event.chunkId,
    message: event.message,
  });
}

function columnShape(table: ColumnarTable): string {
  return Table.columnNames(table).join("\u0000");
}

function mergeTables(
  id: string,
  tables: readonly ColumnarTable[],
  fallback: ColumnarTable,
): ColumnarTable {
  if (tables.length === 0) {
    return createEmptyTable(id, fallback);
  }

  const expectedColumns = Table.columnNames(tables[0]);
  const expectedShape = expectedColumns.join("\u0000");
  const columns = Object.fromEntries(
    expectedColumns.map((column) => [column, [] as unknown[]]),
  ) as Record<string, unknown[]>;

  for (const table of tables) {
    if (columnShape(table) !== expectedShape) {
      throw new Error("Chunk-local query outputs must preserve the same column names and order.");
    }
    for (const column of expectedColumns) {
      columns[column].push(...table.columns[column]);
    }
  }

  const merged = Table.define({ id, columns });
  return "schema" in tables[0] ? Table.withSchema(merged, tables[0].schema as never) : merged;
}

function createLocalPlan(
  plan: TableQueryPlan,
  source: ColumnarTable,
  operations: readonly TableQueryOperation[],
  chunkId: string,
): TableQueryPlan {
  return createPlan({
    id: `${plan.id}.${chunkId}.local`,
    source,
    operations,
  });
}

function createGlobalPlan(
  plan: TableQueryPlan,
  source: ColumnarTable,
  operations: readonly TableQueryOperation[],
): TableQueryPlan {
  return createPlan({
    id: `${plan.id}.global`,
    source,
    operations,
  });
}

function createChunkCompatibilityDiagnostics(
  plan: TableQueryPlan,
  chunks: readonly ColumnarTableChunk[],
): TableChunkQueryDiagnostic[] {
  const diagnostics: TableChunkQueryDiagnostic[] = [];
  const sourceColumns = Table.columnNames(plan.source).join("\u0000");
  const sourceSchema = "schema" in plan.source ? JSON.stringify(plan.source.schema) : undefined;

  chunks.forEach((chunk, index) => {
    const chunkColumns = Object.keys(chunk.columns).join("\u0000");
    if (chunkColumns !== sourceColumns) {
      diagnostics.push({
        severity: "error",
        code: "ManifestChunkColumnMismatch",
        message: `Chunk "${chunk.chunkId}" columns do not match query source column order.`,
        tableId: chunk.tableId,
        path: `${plan.id}.chunks[${index}].columns`,
      });
    }

    if (sourceSchema !== undefined && chunk.schema !== undefined) {
      if (JSON.stringify(chunk.schema) !== sourceSchema) {
        diagnostics.push({
          severity: "error",
          code: "ManifestChunkTableMismatch",
          message: `Chunk "${chunk.chunkId}" schema does not match the query source schema.`,
          tableId: chunk.tableId,
          path: `${plan.id}.chunks[${index}].schema`,
        });
      }
    }
  });

  return diagnostics;
}

export function validateChunkQuery(
  plan: TableQueryPlan,
  chunks: readonly ColumnarTableChunk[],
): TableChunkQueryDiagnostic[] {
  return [
    ...validate(plan),
    ...chunks.flatMap((chunk) => Table.validateChunk(chunk)),
    ...createChunkCompatibilityDiagnostics(plan, chunks),
  ];
}

export async function executeOnChunks<TTable extends ColumnarTable>(
  plan: TableQueryPlan<TTable>,
  chunks: readonly ColumnarTableChunk[],
  options: TableChunkQueryOptions = {},
): TableChunkQueryExecution {
  const now = options.now ?? (() => Date.now());
  const split = splitQueryPlanForChunks(plan);
  const board: MutableTableChunkQueryBoard = {
    kind: "tableChunkQueryBoard",
    id: options.id ?? `${plan.id}.chunked`,
    planId: plan.id,
    tableId: plan.source.id,
    status: "idle",
    chunkCount: chunks.length,
    chunkLocalOperationCount: split.chunkLocalOperations.length,
    globalOperationCount: split.globalOperations.length,
    scannedChunkCount: 0,
    failedChunkCount: 0,
    mergedRowCount: 0,
    outputRowCount: 0,
    trace: [],
  };

  recordTrace(board, { kind: "created", message: "Chunk query created." }, now);

  try {
    const diagnostics = validateChunkQuery(plan, chunks);
    if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      const queryDiagnostics = diagnostics.filter(
        (diagnostic): diagnostic is TableQueryDiagnostic => "planId" in diagnostic,
      );
      throw queryDiagnostics.length > 0
        ? new TableQueryError(queryDiagnostics)
        : new TableError(diagnostics as never);
    }

    board.status = "running";
    recordTrace(board, { kind: "started", message: "Chunk query started." }, now);
    recordTrace(
      board,
      {
        kind: "splitPlan",
        message: `Split into ${split.chunkLocalOperations.length} chunk-local and ${split.globalOperations.length} global operations.`,
      },
      now,
    );

    const orderedChunks = [...chunks].sort((left, right) => {
      if (left.rowOffset !== right.rowOffset) {
        return left.rowOffset - right.rowOffset;
      }
      return left.chunkId.localeCompare(right.chunkId);
    });

    const batchTask = B.task<ColumnarTableChunk, ScannedChunk, Error>({
      id: `${board.id}.chunkScan`,
      inputs: orderedChunks,
      concurrency: options.concurrency,
      map: (chunk) => {
        recordTrace(
          board,
          {
            kind: "chunkScanStarted",
            chunkId: chunk.chunkId,
            message: `Scanning chunk "${chunk.chunkId}".`,
          },
          now,
        );

        try {
          const chunkTable = tableFromChunk(chunk);
          const localPlan = createLocalPlan(
            plan,
            chunkTable,
            split.chunkLocalOperations,
            chunk.chunkId,
          );
          const table = split.chunkLocalOperations.length === 0 ? chunkTable : execute(localPlan);
          board.scannedChunkCount += 1;
          recordTrace(
            board,
            {
              kind: "chunkScanSucceeded",
              chunkId: chunk.chunkId,
              message: `Scanned chunk "${chunk.chunkId}" (${table.rowCount} rows).`,
            },
            now,
          );
          return B.ok({
            chunkId: chunk.chunkId,
            rowOffset: chunk.rowOffset,
            table,
          });
        } catch (error) {
          board.failedChunkCount += 1;
          recordTrace(
            board,
            {
              kind: "chunkScanFailed",
              chunkId: chunk.chunkId,
              message: asError(error).message,
            },
            now,
          );
          return B.err(asError(error));
        }
      },
    });

    const batchResult = await B.run(batchTask, {
      concurrency: options.concurrency,
      now,
    });
    board.batchBoard = batchResult.board;

    if (batchResult.kind !== "ok") {
      board.status = "failed";
      recordTrace(
        board,
        {
          kind: "failed",
          message:
            batchResult.kind === "cancelled"
              ? (batchResult.reason ?? "Chunk query was cancelled.")
              : asError(batchResult.error).message,
        },
        now,
      );
      return {
        kind: "err",
        error:
          batchResult.kind === "cancelled"
            ? new Error(batchResult.reason ?? "Chunk query was cancelled.")
            : asError(batchResult.error),
        board: cloneBoard(board),
      };
    }

    recordTrace(board, { kind: "mergeStarted", message: "Merging chunk-local tables." }, now);
    const merged = mergeTables(
      `${board.id}.merged`,
      [...batchResult.values]
        .sort((left, right) => {
          if (left.rowOffset !== right.rowOffset) {
            return left.rowOffset - right.rowOffset;
          }
          return left.chunkId.localeCompare(right.chunkId);
        })
        .map((value) => value.table),
      split.chunkLocalOperations.length === 0
        ? createEmptyTable(`${board.id}.source`, plan.source)
        : execute(
            createLocalPlan(
              plan,
              createEmptyTable(`${board.id}.source`, plan.source),
              split.chunkLocalOperations,
              "empty",
            ),
          ),
    );
    board.mergedRowCount = merged.rowCount;
    recordTrace(board, { kind: "mergeFinished", message: `Merged ${merged.rowCount} rows.` }, now);

    const output =
      split.globalOperations.length === 0
        ? merged
        : (() => {
            recordTrace(
              board,
              { kind: "globalStarted", message: "Running global query suffix." },
              now,
            );
            const result = execute(createGlobalPlan(plan, merged, split.globalOperations), {
              id: board.id,
            });
            recordTrace(
              board,
              { kind: "globalFinished", message: `Global query produced ${result.rowCount} rows.` },
              now,
            );
            return result;
          })();

    board.status = "succeeded";
    board.outputRowCount = output.rowCount;
    recordTrace(board, { kind: "succeeded", message: "Chunk query succeeded." }, now);
    return {
      kind: "ok",
      table: output,
      board: cloneBoard(board),
    };
  } catch (error) {
    board.status = "failed";
    if (
      board.failedChunkCount === 0 &&
      board.trace.some((event) => event.kind === "chunkScanFailed")
    ) {
      board.failedChunkCount = 1;
    }
    recordTrace(board, { kind: "failed", message: asError(error).message }, now);
    return {
      kind: "err",
      error: asError(error),
      board: cloneBoard(board),
    };
  }
}

export async function executeOnChunkedTable<TTable extends ColumnarTable>(
  plan: TableQueryPlan<TTable>,
  chunked: ChunkedColumnarTable,
  options: TableChunkQueryOptions = {},
): TableChunkQueryExecution {
  const manifestDiagnostics = Table.validateChunksAgainstManifest(chunked.manifest, chunked.chunks);
  if (manifestDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    const now = options.now ?? (() => Date.now());
    const board: MutableTableChunkQueryBoard = {
      kind: "tableChunkQueryBoard",
      id: options.id ?? `${plan.id}.chunked`,
      planId: plan.id,
      tableId: chunked.manifest.tableId,
      status: "failed",
      chunkCount: chunked.chunks.length,
      chunkLocalOperationCount: 0,
      globalOperationCount: 0,
      scannedChunkCount: 0,
      failedChunkCount: 0,
      mergedRowCount: 0,
      outputRowCount: 0,
      trace: [],
    };
    recordTrace(board, { kind: "created", message: "Chunk query created." }, now);
    recordTrace(board, { kind: "failed", message: "Chunk manifest validation failed." }, now);
    return {
      kind: "err",
      error: new TableError(manifestDiagnostics),
      board: cloneBoard(board),
    };
  }

  return executeOnChunks(plan, chunked.chunks, options);
}

export { classifyQueryOperation, splitQueryPlanForChunks };
