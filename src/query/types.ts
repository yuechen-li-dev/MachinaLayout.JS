import type { ColumnarTable, TableDiagnostic, TableRow, TableSortDirection } from "../table";
import type { BatchBoard } from "../batch";

export type TableQueryRowPredicate<TTable extends ColumnarTable = ColumnarTable> = (
  row: TableRow<TTable>,
  context: {
    readonly row: number;
    readonly table: TTable;
  },
) => boolean;

export type TableQueryCellPredicate<TTable extends ColumnarTable = ColumnarTable> = (context: {
  readonly row: number;
  readonly table: TTable;
  readonly getCell: (column: string) => unknown;
}) => boolean;

export type TableQuerySelectOperation = {
  readonly kind: "select";
  readonly columns: readonly string[];
};

export type TableQueryWhereOperation = {
  readonly kind: "where";
  readonly predicate: TableQueryRowPredicate;
};

export type TableQueryFilterRowsOperation = {
  readonly kind: "filterRows";
  readonly predicate: TableQueryCellPredicate;
};

export type TableQuerySortByOperation = {
  readonly kind: "sortBy";
  readonly column: string;
  readonly direction: TableSortDirection;
};

export type TableQueryTakeOperation = {
  readonly kind: "take";
  readonly count: number;
};

export type TableQueryDropOperation = {
  readonly kind: "drop";
  readonly count: number;
};

export type TableQueryRenameColumnsOperation = {
  readonly kind: "renameColumns";
  readonly rename: Readonly<Record<string, string>>;
};

export type TableQueryOperation =
  | TableQuerySelectOperation
  | TableQueryWhereOperation
  | TableQueryFilterRowsOperation
  | TableQuerySortByOperation
  | TableQueryTakeOperation
  | TableQueryDropOperation
  | TableQueryRenameColumnsOperation;

export type TableQueryPlan<TTable extends ColumnarTable = ColumnarTable> = {
  readonly kind: "tableQueryPlan";
  readonly id: string;
  readonly source: TTable;
  readonly operations: readonly TableQueryOperation[];
};

export type TableQueryOperationExecutionScope = "chunkLocal" | "global";

export type SplitTableQueryPlan<TTable extends ColumnarTable = ColumnarTable> = {
  readonly kind: "splitTableQueryPlan";
  readonly plan: TableQueryPlan<TTable>;
  readonly chunkLocalOperations: readonly TableQueryOperation[];
  readonly globalOperations: readonly TableQueryOperation[];
  readonly firstGlobalOperationIndex: number;
};

export type TableQueryExecutionResult = {
  readonly kind: "tableQueryExecutionResult";
  readonly plan: TableQueryPlan;
  readonly table: ColumnarTable;
};

export type TableQueryIteratorStatus = "idle" | "running" | "done" | "failed";

export type TableQueryIteratorTraceEvent = {
  readonly kind:
    | "created"
    | "started"
    | "operationStarted"
    | "rowAccepted"
    | "rowRejected"
    | "operationFinished"
    | "finished"
    | "failed";
  readonly planId: string;
  readonly at: number;
  readonly operationIndex?: number;
  readonly operationKind?: string;
  readonly row?: number;
  readonly message?: string;
};

export type TableQueryIteratorBoard = {
  readonly kind: "tableQueryIteratorBoard";
  readonly planId: string;
  readonly sourceTableId: string;
  readonly status: TableQueryIteratorStatus;
  readonly operationCount: number;
  readonly currentOperationIndex: number;
  readonly currentOperationKind?: TableQueryOperation["kind"];
  readonly sourceRowCount: number;
  readonly inputRowCount: number;
  readonly outputRowCount: number;
  readonly acceptedRowCount: number;
  readonly rejectedRowCount: number;
  readonly emittedRowCount: number;
  readonly stepCount: number;
  readonly trace: readonly TableQueryIteratorTraceEvent[];
};

export type TableQueryIteratorSnapshot = {
  readonly kind: "tableQueryIteratorSnapshot";
  readonly board: TableQueryIteratorBoard;
};

export type TableQueryIteratorStep =
  | {
      readonly kind: "yield";
      readonly board: TableQueryIteratorBoard;
      readonly table: ColumnarTable;
    }
  | {
      readonly kind: "done";
      readonly board: TableQueryIteratorBoard;
      readonly table: ColumnarTable;
    }
  | {
      readonly kind: "fail";
      readonly board: TableQueryIteratorBoard;
      readonly error: TableQueryErrorLike;
    };

export type TableQueryIteratorResult =
  | {
      readonly kind: "ok";
      readonly board: TableQueryIteratorBoard;
      readonly table: ColumnarTable;
    }
  | {
      readonly kind: "err";
      readonly board: TableQueryIteratorBoard;
      readonly error: TableQueryErrorLike;
    };

export type TableQueryIteratorOptions = {
  readonly now?: () => number;
  readonly id?: string;
};

export type TableQueryIteratorCollectOptions = {
  readonly maxSteps?: number;
};

export type TableQueryIteratorRunner<TTable extends ColumnarTable = ColumnarTable> = {
  readonly kind: "tableQueryIteratorRunner";
  readonly plan: TableQueryPlan<TTable>;

  next(): TableQueryIteratorStep;
  snapshot(): TableQueryIteratorSnapshot;
  collect(options?: TableQueryIteratorCollectOptions): TableQueryIteratorResult;
};

export type TableQueryIteratorCursor = {
  readonly operationIndex: number;
  readonly table: ColumnarTable;
};

export type TableQueryIteratorMachineEnv<TTable extends ColumnarTable = ColumnarTable> = {
  readonly plan: TableQueryPlan<TTable>;
};

export type TableQueryErrorLike = Error;

export type TableQueryFromOptions = {
  readonly id?: string;
};

export type TableQueryExecuteOptions = {
  readonly id?: string;
};

export type TableChunkQueryOptions = {
  readonly concurrency?: number;
  readonly id?: string;
  readonly now?: () => number;
};

export type TableChunkQueryStatus = "idle" | "running" | "succeeded" | "failed";

export type TableChunkQueryTraceEvent = {
  readonly kind:
    | "created"
    | "started"
    | "splitPlan"
    | "chunkScanStarted"
    | "chunkScanSucceeded"
    | "chunkScanFailed"
    | "mergeStarted"
    | "mergeFinished"
    | "globalStarted"
    | "globalFinished"
    | "succeeded"
    | "failed";
  readonly at: number;
  readonly queryId: string;
  readonly planId: string;
  readonly chunkId?: string;
  readonly message?: string;
};

export type TableChunkQueryBoard = {
  readonly kind: "tableChunkQueryBoard";
  readonly id: string;
  readonly planId: string;
  readonly tableId: string;
  readonly status: TableChunkQueryStatus;
  readonly chunkCount: number;
  readonly chunkLocalOperationCount: number;
  readonly globalOperationCount: number;
  readonly scannedChunkCount: number;
  readonly failedChunkCount: number;
  readonly mergedRowCount: number;
  readonly outputRowCount: number;
  readonly batchBoard?: BatchBoard<unknown, TableQueryErrorLike>;
  readonly trace: readonly TableChunkQueryTraceEvent[];
};

export type TableChunkQueryResult =
  | {
      readonly kind: "ok";
      readonly table: ColumnarTable;
      readonly board: TableChunkQueryBoard;
    }
  | {
      readonly kind: "err";
      readonly error: TableQueryErrorLike;
      readonly board: TableChunkQueryBoard;
    };

export type TableChunkQueryExecution = Promise<TableChunkQueryResult>;

export type TableQueryDiagnostic = {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly message: string;
  readonly planId?: string;
  readonly operationIndex?: number;
  readonly operationKind?: string;
  readonly column?: string;
  readonly path?: string;
};

export type TableChunkQueryDiagnostic = TableQueryDiagnostic | TableDiagnostic;

export type TableQueryPlanDescription = {
  readonly kind: "tableQueryPlanDescription";
  readonly id: string;
  readonly sourceTableId: string;
  readonly operationCount: number;
  readonly operations: readonly {
    readonly index: number;
    readonly kind: TableQueryOperation["kind"];
    readonly summary: string;
  }[];
};

export type TableQueryBuilder<TTable extends ColumnarTable = ColumnarTable> = {
  readonly kind: "tableQueryBuilder";
  readonly plan: TableQueryPlan<TTable>;

  select(columns: readonly string[]): TableQueryBuilder<TTable>;
  where(predicate: TableQueryRowPredicate<TTable>): TableQueryBuilder<TTable>;
  filterRows(predicate: TableQueryCellPredicate<TTable>): TableQueryBuilder<TTable>;
  sortBy(column: string, direction?: TableSortDirection): TableQueryBuilder<TTable>;
  take(count: number): TableQueryBuilder<TTable>;
  drop(count: number): TableQueryBuilder<TTable>;
  renameColumns(rename: Readonly<Record<string, string>>): TableQueryBuilder<TTable>;

  toPlan(): TableQueryPlan<TTable>;
  validate(): TableQueryDiagnostic[];
  describe(): TableQueryPlanDescription;
  format(): string;
  toTable(options?: TableQueryExecuteOptions): ColumnarTable;
};
