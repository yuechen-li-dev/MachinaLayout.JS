import { createDeusSnapshot, defineDeusMachine, stepDeusMachine, } from "../deus";
import { doneNext, failNext, yieldedNext } from "./result";
const defaultMaxSteps = 10_000;
const idlePath = ["idle"];
const runningPath = ["running"];
const yieldedPath = ["yielded"];
const donePath = ["done"];
const failedPath = ["failed"];
function cloneTrace(trace) {
    return trace.map((event) => ({ ...event }));
}
function cloneBoard(board) {
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
function setStatus(status) {
    return (board) => {
        board.status = status;
    };
}
function applyYield(board, event) {
    if (event.type !== "yield") {
        return;
    }
    board.cursor = event.cursor;
    board.yieldCount += 1;
    board.lastYield = event.yielded;
    board.returnValue = undefined;
    board.error = undefined;
}
function applyDone(board, event) {
    if (event.type !== "done") {
        return;
    }
    board.returnValue = event.returnValue;
    board.error = undefined;
}
function applyFail(board, event) {
    if (event.type !== "fail") {
        return;
    }
    board.error = event.error;
    board.returnValue = undefined;
}
function applyReset(board, event) {
    if (event.type !== "reset") {
        return;
    }
    board.cursor = event.cursor;
    board.yieldCount = 0;
    board.lastYield = undefined;
    board.returnValue = undefined;
    board.error = undefined;
}
function lifecycleMachine() {
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
function assertMaxSteps(maxSteps) {
    if (!Number.isInteger(maxSteps) || maxSteps <= 0) {
        throw new Error("Iter collect maxSteps must be a positive integer.");
    }
}
function assertStepResult(step) {
    if (!step || typeof step !== "object") {
        throw new Error("Iter machine step must return a step result object.");
    }
    if (step.kind !== "yield" && step.kind !== "done" && step.kind !== "fail") {
        throw new Error(`Iter machine step returned unknown kind: ${step.kind}`);
    }
}
export function createController(machine, options = {}) {
    const traceEnabled = options.trace ?? true;
    const board = {
        machineId: machine.id,
        status: "idle",
        cursor: machine.initial,
        yieldCount: 0,
        trace: [],
    };
    const lifecycle = lifecycleMachine();
    let snapshot = createDeusSnapshot(lifecycle, board);
    let iteration = 0;
    let terminalResult;
    recordTrace({
        kind: "created",
        iteration: 0,
        cursor: board.cursor,
    });
    function dispatch(event) {
        snapshot = stepDeusMachine(lifecycle, snapshot, event).snapshot;
    }
    function recordTrace(event) {
        if (!traceEnabled) {
            return;
        }
        board.trace.push({
            machineId: machine.id,
            ...event,
        });
    }
    function recordStepTrace(currentIteration, event) {
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
                    return yieldedNext(step.value);
                }
                if (step.kind === "done") {
                    dispatch({
                        type: "done",
                        returnValue: step.value,
                    });
                    const result = doneNext(step.value);
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
                const result = failNext(step.error);
                terminalResult = result;
                recordTrace({
                    kind: "failed",
                    iteration: currentIteration,
                    cursor: snapshot.board.cursor,
                    error: step.error,
                });
                return result;
            }
            catch (error) {
                dispatch({
                    type: "fail",
                    error: error,
                });
                const result = failNext(error);
                terminalResult = result;
                recordTrace({
                    kind: "failed",
                    iteration: currentIteration,
                    cursor: snapshot.board.cursor,
                    error: error,
                    message: "Step threw.",
                });
                return result;
            }
        },
        collect(optionsArg = {}) {
            const maxSteps = optionsArg.maxSteps ?? defaultMaxSteps;
            assertMaxSteps(maxSteps);
            const values = [];
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
        getSnapshot() {
            return {
                statePath: [...snapshot.state],
                board: cloneBoard(snapshot.board),
            };
        },
        getBoard() {
            return cloneBoard(snapshot.board);
        },
    };
}
export function next(controller) {
    return controller.next();
}
export function collect(controller, options) {
    return controller.collect(options);
}
export function reset(controller, cursor) {
    controller.reset(cursor);
}
