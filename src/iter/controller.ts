import {
  createDeusSnapshot,
  defineDeusMachine,
  stepDeusMachine,
  type DeusAction,
  type DeusMachine,
  type DeusSnapshot,
} from "../deus";
import { doneNext, failNext, yieldedNext } from "./result";
import type {
  IterBoard,
  IterCollectOptions,
  IterCollectResult,
  IterController,
  IterControllerOptions,
  IterMachine,
  IterNext,
  IterSnapshot,
  IterStep,
  IterTraceEvent,
} from "./types";

type IterLifecycleEvent<TCursor, TYield, TReturn, TError> =
  | {
      type: "next";
    }
  | {
      type: "yield";
      cursor: TCursor;
      yielded: TYield;
    }
  | {
      type: "done";
      returnValue: TReturn;
    }
  | {
      type: "fail";
      error: TError;
    }
  | {
      type: "reset";
      cursor: TCursor;
    };

type MutableIterBoard<TCursor, TYield, TReturn, TError> = {
  machineId: string;
  status: IterBoard<TCursor, TYield, TReturn, TError>["status"];
  cursor: TCursor;
  yieldCount: number;
  lastYield?: TYield;
  returnValue?: TReturn;
  error?: TError;
  trace: IterTraceEvent<TCursor, TYield, TReturn, TError>[];
};

const defaultMaxSteps = 10_000;
const idlePath = ["idle"] as const;
const runningPath = ["running"] as const;
const yieldedPath = ["yielded"] as const;
const donePath = ["done"] as const;
const failedPath = ["failed"] as const;

function cloneTrace<TCursor, TYield, TReturn, TError>(
  trace: readonly IterTraceEvent<TCursor, TYield, TReturn, TError>[],
): IterTraceEvent<TCursor, TYield, TReturn, TError>[] {
  return trace.map((event) => ({ ...event }));
}

function cloneBoard<TCursor, TYield, TReturn, TError>(
  board: MutableIterBoard<TCursor, TYield, TReturn, TError>,
): IterBoard<TCursor, TYield, TReturn, TError> {
  return {
    machineId: board.machineId,
    status: board.status,
    cursor: board.cursor,
    yieldCount: board.yieldCount,
    lastYield: board.lastYield,
    returnValue: board.returnValue,
    error: board.error,
    trace: cloneTrace(board.trace),
  };
}

function setStatus<TCursor, TYield, TReturn, TError>(
  status: MutableIterBoard<TCursor, TYield, TReturn, TError>["status"],
): DeusAction<
  MutableIterBoard<TCursor, TYield, TReturn, TError>,
  IterLifecycleEvent<TCursor, TYield, TReturn, TError>
> {
  return (board) => {
    board.status = status;
  };
}

function applyYield<TCursor, TYield, TReturn, TError>(
  board: MutableIterBoard<TCursor, TYield, TReturn, TError>,
  event: IterLifecycleEvent<TCursor, TYield, TReturn, TError>,
): void {
  if (event.type !== "yield") {
    return;
  }

  board.cursor = event.cursor;
  board.yieldCount += 1;
  board.lastYield = event.yielded;
  board.returnValue = undefined;
  board.error = undefined;
}

function applyDone<TCursor, TYield, TReturn, TError>(
  board: MutableIterBoard<TCursor, TYield, TReturn, TError>,
  event: IterLifecycleEvent<TCursor, TYield, TReturn, TError>,
): void {
  if (event.type !== "done") {
    return;
  }

  board.returnValue = event.returnValue;
  board.error = undefined;
}

function applyFail<TCursor, TYield, TReturn, TError>(
  board: MutableIterBoard<TCursor, TYield, TReturn, TError>,
  event: IterLifecycleEvent<TCursor, TYield, TReturn, TError>,
): void {
  if (event.type !== "fail") {
    return;
  }

  board.error = event.error;
  board.returnValue = undefined;
}

function applyReset<TCursor, TYield, TReturn, TError>(
  board: MutableIterBoard<TCursor, TYield, TReturn, TError>,
  event: IterLifecycleEvent<TCursor, TYield, TReturn, TError>,
): void {
  if (event.type !== "reset") {
    return;
  }

  board.cursor = event.cursor;
  board.yieldCount = 0;
  board.lastYield = undefined;
  board.returnValue = undefined;
  board.error = undefined;
}

function lifecycleMachine<TCursor, TYield, TReturn, TError>(): DeusMachine<
  MutableIterBoard<TCursor, TYield, TReturn, TError>,
  IterLifecycleEvent<TCursor, TYield, TReturn, TError>
> {
  return defineDeusMachine({
    initial: idlePath,
    states: [
      { path: idlePath, onEnter: setStatus("idle") },
      { path: runningPath, onEnter: setStatus("running") },
      { path: yieldedPath, onEnter: setStatus("yielded") },
      { path: donePath, onEnter: setStatus("done") },
      { path: failedPath, onEnter: setStatus("failed") },
    ],
    transitions: [
      { key: "idle:next", from: idlePath, event: "next", to: runningPath },
      { key: "yielded:next", from: yieldedPath, event: "next", to: runningPath },
      { key: "running:yield", from: runningPath, event: "yield", to: yieldedPath, do: applyYield },
      { key: "running:done", from: runningPath, event: "done", to: donePath, do: applyDone },
      { key: "running:fail", from: runningPath, event: "fail", to: failedPath, do: applyFail },
      { key: "idle:reset", from: idlePath, event: "reset", to: idlePath, do: applyReset },
      { key: "yielded:reset", from: yieldedPath, event: "reset", to: idlePath, do: applyReset },
      { key: "done:reset", from: donePath, event: "reset", to: idlePath, do: applyReset },
      { key: "failed:reset", from: failedPath, event: "reset", to: idlePath, do: applyReset },
    ],
  });
}

function assertMaxSteps(maxSteps: number): void {
  if (!Number.isInteger(maxSteps) || maxSteps <= 0) {
    throw new Error("Iter collect maxSteps must be a positive integer.");
  }
}

function assertStepResult<TCursor, TYield, TReturn, TError>(
  step: IterStep<TCursor, TYield, TReturn, TError>,
): void {
  if (!step || typeof step !== "object") {
    throw new Error("Iter machine step must return a step result object.");
  }

  if (step.kind !== "yield" && step.kind !== "done" && step.kind !== "fail") {
    throw new Error(
      `Iter machine step returned unknown kind: ${(step as { kind?: unknown }).kind}`,
    );
  }
}

export function createController<TEnv, TCursor, TYield, TReturn = void, TError = unknown>(
  machine: IterMachine<TEnv, TCursor, TYield, TReturn, TError>,
  options: IterControllerOptions = {},
): IterController<TEnv, TCursor, TYield, TReturn, TError> {
  const traceEnabled = options.trace ?? true;
  const board: MutableIterBoard<TCursor, TYield, TReturn, TError> = {
    machineId: machine.id,
    status: "idle",
    cursor: machine.initial,
    yieldCount: 0,
    trace: [],
  };
  const lifecycle = lifecycleMachine<TCursor, TYield, TReturn, TError>();
  let snapshot: DeusSnapshot<MutableIterBoard<TCursor, TYield, TReturn, TError>> =
    createDeusSnapshot(lifecycle, board);
  let iteration = 0;
  let terminalResult: IterNext<TYield, TReturn, TError> | undefined;

  recordTrace({
    kind: "created",
    iteration: 0,
    cursor: board.cursor,
  });

  function dispatch(event: IterLifecycleEvent<TCursor, TYield, TReturn, TError>): void {
    snapshot = stepDeusMachine(lifecycle, snapshot, event).snapshot;
  }

  function recordTrace(
    event: Omit<IterTraceEvent<TCursor, TYield, TReturn, TError>, "machineId">,
  ): void {
    if (!traceEnabled) {
      return;
    }

    board.trace.push({
      machineId: machine.id,
      ...event,
    });
  }

  function recordStepTrace(
    currentIteration: number,
    event: IterTraceEvent<TCursor, TYield, TReturn, TError>,
  ): void {
    recordTrace({
      kind: event.kind,
      iteration: Number.isFinite(event.iteration) ? event.iteration : currentIteration,
      message: event.message,
      cursor: event.cursor,
      yielded: event.yielded,
      returnValue: event.returnValue,
      error: event.error,
    });
  }

  return {
    machine,
    next() {
      if (terminalResult) {
        return terminalResult;
      }

      iteration += 1;
      const currentIteration = iteration;
      recordTrace({
        kind: "started",
        iteration: currentIteration,
        cursor: snapshot.board.cursor,
      });
      dispatch({ type: "next" });

      try {
        const step = machine.step(machine.env, snapshot.board.cursor, {
          iteration: currentIteration,
          trace: (event) => recordStepTrace(currentIteration, event),
        });
        assertStepResult(step);

        if (step.kind === "yield") {
          dispatch({
            type: "yield",
            cursor: step.cursor,
            yielded: step.value,
          });
          recordTrace({
            kind: "yielded",
            iteration: currentIteration,
            cursor: step.cursor,
            yielded: step.value,
          });
          return yieldedNext(step.value) as IterNext<TYield, TReturn, TError>;
        }

        if (step.kind === "done") {
          dispatch({
            type: "done",
            returnValue: step.value,
          });
          const result = doneNext(step.value) as IterNext<TYield, TReturn, TError>;
          terminalResult = result;
          recordTrace({
            kind: "done",
            iteration: currentIteration,
            cursor: snapshot.board.cursor,
            returnValue: step.value,
          });
          return result;
        }

        dispatch({
          type: "fail",
          error: step.error,
        });
        const result = failNext(step.error) as IterNext<TYield, TReturn, TError>;
        terminalResult = result;
        recordTrace({
          kind: "failed",
          iteration: currentIteration,
          cursor: snapshot.board.cursor,
          error: step.error,
        });
        return result;
      } catch (error) {
        dispatch({
          type: "fail",
          error: error as TError,
        });
        const result = failNext(error as TError) as IterNext<TYield, TReturn, TError>;
        terminalResult = result;
        recordTrace({
          kind: "failed",
          iteration: currentIteration,
          cursor: snapshot.board.cursor,
          error: error as TError,
          message: "Step threw.",
        });
        return result;
      }
    },
    collect(optionsArg: IterCollectOptions = {}): IterCollectResult<TYield, TReturn, TError> {
      const maxSteps = optionsArg.maxSteps ?? defaultMaxSteps;
      assertMaxSteps(maxSteps);
      const values: TYield[] = [];

      for (let steps = 0; steps < maxSteps; steps += 1) {
        const result = this.next();
        if (result.kind === "yield") {
          values.push(result.value);
          continue;
        }

        if (result.kind === "done") {
          return {
            kind: "done",
            values,
            value: result.value,
          };
        }

        return {
          kind: "fail",
          values,
          error: result.error,
        };
      }

      return {
        kind: "limit",
        values,
        maxSteps,
      };
    },
    reset(cursor) {
      const nextCursor = cursor === undefined ? machine.initial : cursor;
      dispatch({
        type: "reset",
        cursor: nextCursor,
      });
      terminalResult = undefined;
      recordTrace({
        kind: "reset",
        iteration: 0,
        cursor: nextCursor,
      });
    },
    getSnapshot(): IterSnapshot<TCursor, TYield, TReturn, TError> {
      return {
        statePath: [...snapshot.state],
        board: cloneBoard(snapshot.board),
      };
    },
    getBoard(): IterBoard<TCursor, TYield, TReturn, TError> {
      return cloneBoard(snapshot.board);
    },
  };
}

export function next<TEnv, TCursor, TYield, TReturn = void, TError = unknown>(
  controller: IterController<TEnv, TCursor, TYield, TReturn, TError>,
): IterNext<TYield, TReturn, TError> {
  return controller.next();
}

export function collect<TEnv, TCursor, TYield, TReturn = void, TError = unknown>(
  controller: IterController<TEnv, TCursor, TYield, TReturn, TError>,
  options?: IterCollectOptions,
): IterCollectResult<TYield, TReturn, TError> {
  return controller.collect(options);
}

export function reset<TEnv, TCursor, TYield, TReturn = void, TError = unknown>(
  controller: IterController<TEnv, TCursor, TYield, TReturn, TError>,
  cursor?: TCursor,
): void {
  controller.reset(cursor);
}
