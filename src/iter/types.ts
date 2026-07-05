export type IterMachine<TEnv, TCursor, TYield, TReturn = void, TError = unknown> = {
  readonly kind: "iterMachine";
  readonly id: string;
  readonly env: TEnv;
  readonly initial: TCursor;
  readonly step: (
    env: TEnv,
    cursor: TCursor,
    ctx: IterStepContext<TCursor, TYield, TReturn, TError>,
  ) => IterStep<TCursor, TYield, TReturn, TError>;
  readonly description?: string;
};

export type IterStepContext<TCursor, TYield, TReturn = void, TError = unknown> = {
  readonly iteration: number;
  readonly trace: (event: IterTraceEvent<TCursor, TYield, TReturn, TError>) => void;
};

export type IterStep<TCursor, TYield, TReturn = void, TError = unknown> =
  | {
      kind: "yield";
      value: TYield;
      cursor: TCursor;
    }
  | {
      kind: "done";
      value: TReturn;
    }
  | {
      kind: "fail";
      error: TError;
    };

export type IterNext<TYield, TReturn = void, TError = unknown> =
  | {
      kind: "yield";
      value: TYield;
      done: false;
    }
  | {
      kind: "done";
      value: TReturn;
      done: true;
    }
  | {
      kind: "fail";
      error: TError;
      done: true;
    };

export type IterStatus = "idle" | "running" | "yielded" | "done" | "failed";

export type IterTraceEvent<TCursor, TYield, TReturn = void, TError = unknown> = {
  readonly kind: "created" | "started" | "yielded" | "done" | "failed" | "reset";
  readonly machineId: string;
  readonly iteration: number;
  readonly message?: string;
  readonly cursor?: TCursor;
  readonly yielded?: TYield;
  readonly returnValue?: TReturn;
  readonly error?: TError;
};

export type IterBoard<TCursor, TYield, TReturn = void, TError = unknown> = {
  readonly machineId: string;
  readonly status: IterStatus;
  readonly cursor: TCursor;
  readonly yieldCount: number;
  readonly lastYield?: TYield;
  readonly returnValue?: TReturn;
  readonly error?: TError;
  readonly trace: readonly IterTraceEvent<TCursor, TYield, TReturn, TError>[];
};

export type IterSnapshot<TCursor, TYield, TReturn = void, TError = unknown> = {
  readonly statePath: readonly string[];
  readonly board: IterBoard<TCursor, TYield, TReturn, TError>;
};

export type IterCollectOptions = {
  readonly maxSteps?: number;
};

export type IterCollectResult<TYield, TReturn = void, TError = unknown> =
  | {
      kind: "done";
      values: readonly TYield[];
      value: TReturn;
    }
  | {
      kind: "fail";
      values: readonly TYield[];
      error: TError;
    }
  | {
      kind: "limit";
      values: readonly TYield[];
      maxSteps: number;
    };

export type IterController<TEnv, TCursor, TYield, TReturn = void, TError = unknown> = {
  readonly machine: IterMachine<TEnv, TCursor, TYield, TReturn, TError>;
  next(): IterNext<TYield, TReturn, TError>;
  collect(options?: IterCollectOptions): IterCollectResult<TYield, TReturn, TError>;
  reset(cursor?: TCursor): void;
  getSnapshot(): IterSnapshot<TCursor, TYield, TReturn, TError>;
  getBoard(): IterBoard<TCursor, TYield, TReturn, TError>;
};

export type IterControllerOptions = {
  readonly trace?: boolean;
};

export type IterDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
};

export type IterMachineDescription = {
  kind: "iterMachine";
  id: string;
  description?: string;
  envKeys: readonly string[];
  hasStep: boolean;
};
