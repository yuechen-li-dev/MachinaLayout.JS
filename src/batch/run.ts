import type {
  BatchBoard,
  BatchFailureError,
  BatchResult,
  BatchStatus,
  BatchTask,
  BatchTraceEvent,
  BatchRunOptions,
  BatchSchedulerBoard,
} from "./types";
import { isValidBatchConcurrency } from "./validate";

type BatchSchedulerKind = "promiseWorkQueue";

type NormalizedBatchRunOptions = {
  readonly concurrency: number;
};

type MutableBatchBoard<TOutput, TError> = {
  batchId: string;
  status: BatchStatus;
  inputCount: number;
  concurrency: number;
  startedCount: number;
  completedCount: number;
  failedCount: number;
  activeCount: number;
  outputs: (TOutput | undefined)[];
  failedIndex?: number;
  error?: BatchFailureError<TError>;
  cancelReason?: string;
  scheduler?: BatchSchedulerBoard;
  trace: BatchTraceEvent[];
};

type BatchSchedulerContext<TInput, TOutput, TError> = {
  task: BatchTask<TInput, TOutput, TError>;
  options: NormalizedBatchRunOptions;
  board: MutableBatchBoard<TOutput, TError>;
  signal: AbortSignal;
  abort: (reason?: unknown) => void;
  now: () => number;
  trace: (event: Omit<BatchTraceEvent, "batchId">) => void;
  externallyAborted: () => boolean;
};

const defaultConcurrency = 4;

function cloneTrace(trace: readonly BatchTraceEvent[]): BatchTraceEvent[] {
  return trace.map((event) => ({ ...event }));
}

function cloneBoard<TOutput, TError>(
  board: MutableBatchBoard<TOutput, TError>,
): BatchBoard<TOutput, TError> {
  return {
    batchId: board.batchId,
    status: board.status,
    inputCount: board.inputCount,
    concurrency: board.concurrency,
    startedCount: board.startedCount,
    completedCount: board.completedCount,
    failedCount: board.failedCount,
    activeCount: board.activeCount,
    outputs: [...board.outputs],
    failedIndex: board.failedIndex,
    error: board.error,
    cancelReason: board.cancelReason,
    scheduler: board.scheduler ? { ...board.scheduler } : undefined,
    trace: cloneTrace(board.trace),
  };
}

function resolveConcurrency<TInput, TOutput, TError>(
  task: BatchTask<TInput, TOutput, TError>,
  options: BatchRunOptions,
): number {
  const concurrency = options.concurrency ?? task.concurrency ?? defaultConcurrency;

  if (!isValidBatchConcurrency(concurrency)) {
    throw new Error("Batch run concurrency must be a positive finite integer.");
  }

  return concurrency;
}

async function runPromiseWorkQueue<TInput, TOutput, TError>(
  context: BatchSchedulerContext<TInput, TOutput, TError>,
): Promise<void> {
  const { task, options, board, signal, abort, now, trace, externallyAborted } = context;
  const inputs = task.inputs;
  const workerCount = Math.min(options.concurrency, inputs.length);
  let nextIndex = 0;
  let stopScheduling = false;

  function updateScheduler(): void {
    board.scheduler = {
      kind: "promiseWorkQueue" satisfies BatchSchedulerKind,
      workerCount,
      nextIndex,
      maxActiveCount: Math.max(board.scheduler?.maxActiveCount ?? 0, board.activeCount),
    };
  }

  function fail(index: number, error: BatchFailureError<TError>): void {
    if (board.status === "failed" || board.status === "cancelled") {
      return;
    }

    board.failedCount += 1;
    board.status = "failed";
    board.failedIndex = index;
    board.error = error;
    stopScheduling = true;
    abort(error);
    trace({
      kind: "itemFailed",
      at: now(),
      index,
      message: error instanceof Error ? error.message : undefined,
    });
  }

  function recordTaskTrace(event: BatchTraceEvent): void {
    trace({
      kind: event.kind,
      at: Number.isFinite(event.at) ? event.at : now(),
      index: event.index,
      workerId: event.workerId,
      message: event.message,
    });
  }

  async function runOne(index: number): Promise<void> {
    const input = inputs[index] as TInput;
    board.startedCount += 1;
    board.activeCount += 1;
    updateScheduler();
    trace({
      kind: "itemStarted",
      at: now(),
      index,
    });

    try {
      const result = await task.map(input, {
        index,
        input,
        batchId: task.id,
        signal,
        trace: recordTaskTrace,
      });

      if (board.status === "failed" || board.status === "cancelled" || externallyAborted()) {
        return;
      }

      if (result.kind === "ok") {
        board.outputs[index] = result.value;
        trace({
          kind: "itemSucceeded",
          at: now(),
          index,
        });
        return;
      }

      fail(index, result.error);
    } catch (error) {
      if (externallyAborted() || board.status === "cancelled") {
        return;
      }
      fail(index, error as BatchFailureError<TError>);
    } finally {
      board.completedCount += 1;
      board.activeCount -= 1;
      updateScheduler();
    }
  }

  async function worker(workerId: number): Promise<void> {
    trace({
      kind: "workerStarted",
      at: now(),
      workerId,
    });

    while (!stopScheduling && !externallyAborted() && nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      updateScheduler();
      await runOne(index);
    }
  }

  updateScheduler();
  await Promise.all(Array.from({ length: workerCount }, (_, workerId) => worker(workerId)));
  updateScheduler();

  if (nextIndex >= inputs.length) {
    trace({
      kind: "queueDrained",
      at: now(),
    });
  }
}

export async function run<TInput, TOutput, TError = unknown>(
  task: BatchTask<TInput, TOutput, TError>,
  options: BatchRunOptions = {},
): Promise<BatchResult<TOutput, TError>> {
  const now = options.now ?? (() => Date.now());
  const concurrency = resolveConcurrency(task, options);
  const normalizedOptions: NormalizedBatchRunOptions = {
    concurrency,
  };
  const inputs = task.inputs;
  const controller = new AbortController();
  const board: MutableBatchBoard<TOutput, TError> = {
    batchId: task.id,
    status: "idle",
    inputCount: inputs.length,
    concurrency,
    startedCount: 0,
    completedCount: 0,
    failedCount: 0,
    activeCount: 0,
    outputs: Array.from<TOutput | undefined>({ length: inputs.length }).fill(undefined),
    scheduler: {
      kind: "promiseWorkQueue",
      workerCount: Math.min(concurrency, inputs.length),
      nextIndex: 0,
      maxActiveCount: 0,
    },
    trace: [],
  };

  function recordTrace(event: Omit<BatchTraceEvent, "batchId">): void {
    board.trace.push({
      batchId: task.id,
      ...event,
    });
  }

  function cancel(reason?: string): BatchResult<TOutput, TError> {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
    board.status = "cancelled";
    board.cancelReason = reason;
    recordTrace({
      kind: "cancelled",
      at: now(),
      message: reason,
    });

    return {
      kind: "cancelled",
      reason,
      board: cloneBoard(board),
    };
  }

  recordTrace({
    kind: "created",
    at: now(),
  });

  if (options.signal?.aborted) {
    return cancel(String(options.signal.reason ?? "aborted"));
  }

  let externallyAborted = false;
  const onAbort = () => {
    externallyAborted = true;
    if (!controller.signal.aborted) {
      controller.abort(options.signal?.reason);
    }
  };
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    board.status = "running";
    recordTrace({
      kind: "started",
      at: now(),
    });

    if (inputs.length === 0) {
      board.status = "succeeded";
      recordTrace({
        kind: "succeeded",
        at: now(),
      });
      return {
        kind: "ok",
        values: [],
        board: cloneBoard(board),
      };
    }

    await runPromiseWorkQueue({
      task,
      options: normalizedOptions,
      board,
      signal: controller.signal,
      abort: (reason) => {
        if (!controller.signal.aborted) {
          controller.abort(reason);
        }
      },
      now,
      trace: recordTrace,
      externallyAborted: () => externallyAborted,
    });

    if (externallyAborted) {
      return cancel(String(options.signal?.reason ?? "aborted"));
    }

    if (board.failedIndex !== undefined) {
      board.status = "failed";
      const error = board.error as BatchFailureError<TError>;
      recordTrace({
        kind: "failed",
        at: now(),
        index: board.failedIndex,
        message: error instanceof Error ? error.message : undefined,
      });

      return {
        kind: "err",
        error,
        failedIndex: board.failedIndex ?? -1,
        board: cloneBoard(board),
      };
    }

    board.status = "succeeded";
    recordTrace({
      kind: "succeeded",
      at: now(),
    });

    return {
      kind: "ok",
      values: board.outputs as readonly TOutput[],
      board: cloneBoard(board),
    };
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }
}
