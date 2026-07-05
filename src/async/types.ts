export type AsyncTask<TEnv, TInput, TOutput, TError> = {
  readonly kind: "asyncTask";
  readonly id: string;
  readonly env: TEnv;
  readonly run: (
    env: TEnv,
    input: TInput,
    ctx: AsyncTaskContext,
  ) => Promise<AsyncTaskResult<TOutput, TError>>;
  readonly description?: string;
  readonly timeoutMs?: number;
};

export type AsyncTaskContext = {
  readonly signal: AbortSignal;
  readonly runId: number;
  readonly startedAt: number;
  readonly now: () => number;
  readonly trace: (event: AsyncTaskTraceEvent) => void;
};

export type AsyncTaskResult<TOutput, TError> =
  | {
      kind: "ok";
      value: TOutput;
    }
  | {
      kind: "err";
      error: TError;
    }
  | {
      kind: "cancelled";
      reason?: string;
    }
  | {
      kind: "timeout";
      timeoutMs: number;
    };

export type AsyncTaskStatus =
  | "idle"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timedOut";

export type AsyncTaskTraceEvent = {
  readonly kind:
    | "created"
    | "started"
    | "resolved"
    | "failed"
    | "cancelled"
    | "timedOut"
    | "staleCompletionIgnored"
    | "domain";
  readonly taskId: string;
  readonly runId: number;
  readonly at: number;
  readonly message?: string;
};

export type AsyncTaskBoard<TInput, TOutput, TError> = {
  readonly taskId: string;
  readonly status: AsyncTaskStatus;
  readonly runId: number;
  readonly input?: TInput;
  readonly result?: TOutput;
  readonly error?: TError;
  readonly cancelReason?: string;
  readonly timeoutMs?: number;
  readonly startedAt?: number;
  readonly finishedAt?: number;
  readonly signal?: AbortSignal;
  readonly trace: readonly AsyncTaskTraceEvent[];
};

export type AsyncTaskSnapshot<TInput, TOutput, TError> = {
  readonly statePath: readonly string[];
  readonly board: AsyncTaskBoard<TInput, TOutput, TError>;
};

export type AsyncTaskController<TEnv, TInput, TOutput, TError> = {
  readonly task: AsyncTask<TEnv, TInput, TOutput, TError>;
  start(input: TInput): Promise<AsyncTaskResult<TOutput, TError>>;
  cancel(reason?: string): void;
  getSnapshot(): AsyncTaskSnapshot<TInput, TOutput, TError>;
  getBoard(): AsyncTaskBoard<TInput, TOutput, TError>;
};

export type AsyncTaskControllerOptions = {
  now?: () => number;
};

export type AsyncTaskDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
};

export type AsyncTaskDescription = {
  kind: "asyncTask";
  id: string;
  description?: string;
  envKeys: readonly string[];
  hasRun: boolean;
  timeoutMs?: number;
};
