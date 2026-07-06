import { I, type IterMachine } from "../iter";
import { Table, type ColumnarTable } from "../table";
import type {
  TableQueryDiagnostic,
  TableQueryIteratorBoard,
  TableQueryIteratorCollectOptions,
  TableQueryIteratorCursor,
  TableQueryIteratorMachineEnv,
  TableQueryIteratorOptions,
  TableQueryIteratorResult,
  TableQueryIteratorRunner,
  TableQueryIteratorSnapshot,
  TableQueryIteratorStep,
  TableQueryIteratorTraceEvent,
  TableQueryOperation,
  TableQueryPlan,
} from "./types";
import { TableQueryError, validate } from "./validate";

type MutableBoard = {
  kind: "tableQueryIteratorBoard";
  planId: string;
  sourceTableId: string;
  status: TableQueryIteratorBoard["status"];
  operationCount: number;
  currentOperationIndex: number;
  currentOperationKind?: TableQueryOperation["kind"];
  sourceRowCount: number;
  inputRowCount: number;
  outputRowCount: number;
  acceptedRowCount: number;
  rejectedRowCount: number;
  emittedRowCount: number;
  stepCount: number;
  trace: TableQueryIteratorTraceEvent[];
};

const defaultMaxSteps = 10_000;

function assertValidPlan<TTable extends ColumnarTable>(plan: TableQueryPlan<TTable>): void {
  const diagnostics = validate(plan);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableQueryError(diagnostics);
  }
}

function cloneTrace(
  trace: readonly TableQueryIteratorTraceEvent[],
): TableQueryIteratorTraceEvent[] {
  return trace.map((event) => ({ ...event }));
}

function cloneBoard(board: MutableBoard): TableQueryIteratorBoard {
  return {
    kind: board.kind,
    planId: board.planId,
    sourceTableId: board.sourceTableId,
    status: board.status,
    operationCount: board.operationCount,
    currentOperationIndex: board.currentOperationIndex,
    currentOperationKind: board.currentOperationKind,
    sourceRowCount: board.sourceRowCount,
    inputRowCount: board.inputRowCount,
    outputRowCount: board.outputRowCount,
    acceptedRowCount: board.acceptedRowCount,
    rejectedRowCount: board.rejectedRowCount,
    emittedRowCount: board.emittedRowCount,
    stepCount: board.stepCount,
    trace: cloneTrace(board.trace),
  };
}

function executeOperation(
  table: ColumnarTable,
  operation: TableQueryOperation,
  id?: string,
): ColumnarTable {
  switch (operation.kind) {
    case "select":
      return Table.select(table, operation.columns, { id });
    case "where":
      return Table.filter(table, operation.predicate, { id });
    case "filterRows":
      return Table.filterRows(table, operation.predicate, { id });
    case "sortBy":
      return Table.sortBy(table, operation.column, operation.direction, { id });
    case "take":
      return Table.take(table, operation.count, { id });
    case "drop":
      return Table.drop(table, operation.count, { id });
    case "renameColumns":
      return Table.renameColumns(table, operation.rename, { id });
  }
}

function maxStepsError(planId: string, maxSteps: number): TableQueryError {
  const diagnostic: TableQueryDiagnostic = {
    severity: "error",
    code: "QueryIteratorMaxStepsExceeded",
    message: `Query iterator for plan "${planId}" exceeded maxSteps ${maxSteps}.`,
    planId,
    path: `${planId}.iterator.maxSteps`,
  };
  return new TableQueryError([diagnostic]);
}

function assertMaxSteps(maxSteps: number): void {
  if (!Number.isInteger(maxSteps) || maxSteps <= 0) {
    throw new TableQueryError([
      {
        severity: "error",
        code: "QueryIteratorInvalidState",
        message: "Query iterator collect maxSteps must be a positive integer.",
        path: "query.iterator.maxSteps",
      },
    ]);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function iterate<TTable extends ColumnarTable>(
  plan: TableQueryPlan<TTable>,
  options: TableQueryIteratorOptions = {},
): TableQueryIteratorRunner<TTable> {
  assertValidPlan(plan);

  const now = options.now ?? Date.now;
  let currentTable: ColumnarTable = plan.source;
  let operationIndex = 0;
  let terminalStep: TableQueryIteratorStep | undefined;
  const board: MutableBoard = {
    kind: "tableQueryIteratorBoard",
    planId: plan.id,
    sourceTableId: plan.source.id,
    status: "idle",
    operationCount: plan.operations.length,
    currentOperationIndex: 0,
    sourceRowCount: plan.source.rowCount,
    inputRowCount: plan.source.rowCount,
    outputRowCount: plan.source.rowCount,
    acceptedRowCount: 0,
    rejectedRowCount: 0,
    emittedRowCount: 0,
    stepCount: 0,
    trace: [],
  };

  function record(
    event: Omit<TableQueryIteratorTraceEvent, "planId" | "at"> & { readonly at?: number },
  ): void {
    board.trace.push({
      planId: plan.id,
      at: event.at ?? now(),
      kind: event.kind,
      operationIndex: event.operationIndex,
      operationKind: event.operationKind,
      row: event.row,
      message: event.message,
    });
  }

  function snapshotBoard(): TableQueryIteratorBoard {
    return cloneBoard(board);
  }

  function finish(): TableQueryIteratorStep {
    board.status = "done";
    board.currentOperationIndex = plan.operations.length;
    board.currentOperationKind = undefined;
    board.outputRowCount = currentTable.rowCount;
    board.emittedRowCount = currentTable.rowCount;
    record({ kind: "finished", message: "Query iterator finished." });
    terminalStep = {
      kind: "done",
      board: snapshotBoard(),
      table: currentTable,
    };
    return terminalStep;
  }

  record({ kind: "created", message: "Query iterator created." });

  return {
    kind: "tableQueryIteratorRunner",
    plan,
    next(): TableQueryIteratorStep {
      if (terminalStep !== undefined) {
        return terminalStep;
      }

      if (board.status === "idle") {
        board.status = "running";
        record({ kind: "started", message: "Query iterator started." });
      }

      if (operationIndex >= plan.operations.length) {
        board.stepCount += 1;
        return finish();
      }

      const operation = plan.operations[operationIndex];
      const inputRowCount = currentTable.rowCount;
      const finalOperation = operationIndex === plan.operations.length - 1;

      board.status = "running";
      board.currentOperationIndex = operationIndex;
      board.currentOperationKind = operation.kind;
      board.inputRowCount = inputRowCount;
      board.stepCount += 1;
      record({
        kind: "operationStarted",
        operationIndex,
        operationKind: operation.kind,
      });

      try {
        currentTable = executeOperation(
          currentTable,
          operation,
          finalOperation ? options.id : undefined,
        );
        const outputRowCount = currentTable.rowCount;
        const accepted = outputRowCount;
        const rejected = Math.max(0, inputRowCount - outputRowCount);

        board.outputRowCount = outputRowCount;
        board.emittedRowCount = outputRowCount;

        if (operation.kind === "where" || operation.kind === "filterRows") {
          board.acceptedRowCount += accepted;
          board.rejectedRowCount += rejected;
          record({
            kind: "rowAccepted",
            operationIndex,
            operationKind: operation.kind,
            message: `Accepted ${accepted} rows.`,
          });
          record({
            kind: "rowRejected",
            operationIndex,
            operationKind: operation.kind,
            message: `Rejected ${rejected} rows.`,
          });
        }

        record({
          kind: "operationFinished",
          operationIndex,
          operationKind: operation.kind,
        });

        operationIndex += 1;
        if (operationIndex >= plan.operations.length) {
          return finish();
        }

        return {
          kind: "yield",
          board: snapshotBoard(),
          table: currentTable,
        };
      } catch (error) {
        board.status = "failed";
        record({
          kind: "failed",
          operationIndex,
          operationKind: operation.kind,
          message: errorMessage(error),
        });
        terminalStep = {
          kind: "fail",
          board: snapshotBoard(),
          error: error instanceof Error ? error : new Error(String(error)),
        };
        return terminalStep;
      }
    },
    snapshot(): TableQueryIteratorSnapshot {
      return {
        kind: "tableQueryIteratorSnapshot",
        board: snapshotBoard(),
      };
    },
    collect(optionsArg: TableQueryIteratorCollectOptions = {}): TableQueryIteratorResult {
      const maxSteps = optionsArg.maxSteps ?? defaultMaxSteps;
      assertMaxSteps(maxSteps);

      for (let steps = 0; steps < maxSteps; steps += 1) {
        const step = this.next();
        if (step.kind === "yield") {
          continue;
        }

        if (step.kind === "done") {
          return {
            kind: "ok",
            board: step.board,
            table: step.table,
          };
        }

        return {
          kind: "err",
          board: step.board,
          error: step.error,
        };
      }

      const error = maxStepsError(plan.id, maxSteps);
      board.status = "failed";
      record({
        kind: "failed",
        message: error.message,
      });
      return {
        kind: "err",
        board: snapshotBoard(),
        error,
      };
    },
  };
}

export function toIterMachine<TTable extends ColumnarTable>(
  plan: TableQueryPlan<TTable>,
  options: TableQueryIteratorOptions = {},
): IterMachine<
  TableQueryIteratorMachineEnv<TTable>,
  TableQueryIteratorCursor,
  ColumnarTable,
  ColumnarTable,
  Error
> {
  assertValidPlan(plan);

  return I.machine<
    TableQueryIteratorMachineEnv<TTable>,
    TableQueryIteratorCursor,
    ColumnarTable,
    ColumnarTable,
    Error
  >({
    id: options.id ?? `${plan.id}.iterator`,
    env: { plan },
    initial: {
      operationIndex: 0,
      table: plan.source,
    },
    description: `Operation-level iterator machine for query ${plan.id}.`,
    step: (env, cursor) => {
      if (cursor.operationIndex >= env.plan.operations.length) {
        return I.done(cursor.table);
      }

      const operation = env.plan.operations[cursor.operationIndex];
      const finalOperation = cursor.operationIndex === env.plan.operations.length - 1;

      try {
        const table = executeOperation(
          cursor.table,
          operation,
          finalOperation ? options.id : undefined,
        );
        const nextCursor = {
          operationIndex: cursor.operationIndex + 1,
          table,
        };

        if (nextCursor.operationIndex >= env.plan.operations.length) {
          return I.done(table);
        }

        return I.yield(table, nextCursor);
      } catch (error) {
        return I.fail(error instanceof Error ? error : new Error(String(error)));
      }
    },
  });
}

export function formatIteratorSnapshot(snapshot: TableQueryIteratorSnapshot): string {
  const { board } = snapshot;
  const operationLabel =
    board.currentOperationKind === undefined
      ? `operation ${Math.min(board.currentOperationIndex, board.operationCount)}/${board.operationCount}`
      : `operation ${board.currentOperationIndex + 1}/${board.operationCount} ${board.currentOperationKind}`;

  return [
    `query ${board.planId} ${board.status}`,
    `  ${operationLabel}`,
    `  source rows: ${board.sourceRowCount}`,
    `  current rows: ${board.outputRowCount}`,
    `  steps: ${board.stepCount}`,
  ].join("\n");
}
