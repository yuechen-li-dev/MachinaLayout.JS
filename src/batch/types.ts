export type BatchTask<TInput, TOutput, TError = unknown> = {
  readonly kind: "batchTask";
  readonly id: string;
  readonly inputs: readonly TInput[];
  readonly map: (
    input: TInput,
    context: BatchItemContext<TInput>,
  ) => Promise<BatchItemResult<TOutput, TError>> | BatchItemResult<TOutput, TError>;
  readonly concurrency?: number;
  readonly description?: string;
};

export type BatchItemContext<TInput> = {
  readonly index: number;
  readonly input: TInput;
  readonly batchId: string;
  readonly signal: AbortSignal;
  readonly trace: (event: BatchTraceEvent) => void;
};

export type BatchItemResult<TOutput, TError = unknown> =
  | {
      readonly kind: "ok";
      readonly value: TOutput;
    }
  | {
      readonly kind: "err";
      readonly error: TError;
    };

export type BatchCancelResult = {
  readonly kind: "cancelled";
  readonly reason?: string;
};

export type BatchFailureError<TError> = TError | (unknown extends TError ? unknown : never);

export type BatchResult<TOutput, TError = unknown> =
  | {
      readonly kind: "ok";
      readonly values: readonly TOutput[];
      readonly board: BatchBoard<TOutput, TError>;
    }
  | {
      readonly kind: "err";
      readonly error: BatchFailureError<TError>;
      readonly failedIndex: number;
      readonly board: BatchBoard<TOutput, TError>;
    }
  | {
      readonly kind: "cancelled";
      readonly reason?: string;
      readonly board: BatchBoard<TOutput, TError>;
    };

export type BatchStatus = "idle" | "running" | "succeeded" | "failed" | "cancelled";

export type BatchBoard<TOutput, TError = unknown> = {
  readonly batchId: string;
  readonly status: BatchStatus;
  readonly inputCount: number;
  readonly concurrency: number;
  readonly startedCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly activeCount: number;
  readonly outputs: readonly (TOutput | undefined)[];
  readonly failedIndex?: number;
  readonly error?: BatchFailureError<TError>;
  readonly cancelReason?: string;
  readonly trace: readonly BatchTraceEvent[];
};

export type BatchTraceEvent = {
  readonly kind:
    | "created"
    | "started"
    | "itemStarted"
    | "itemSucceeded"
    | "itemFailed"
    | "cancelled"
    | "succeeded"
    | "failed";
  readonly batchId: string;
  readonly at: number;
  readonly index?: number;
  readonly message?: string;
};

export type BatchRunOptions = {
  readonly concurrency?: number;
  readonly signal?: AbortSignal;
  readonly now?: () => number;
};

export type BatchDiagnostic = {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly message: string;
  readonly path?: string;
};

export type BatchTaskDescription = {
  readonly kind: "batchTask";
  readonly id: string;
  readonly description?: string;
  readonly inputCount: number;
  readonly concurrency?: number;
};
