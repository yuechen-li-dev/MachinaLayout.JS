import { createDeusSnapshot, defineDeusMachine, stepDeusMachine, } from "../deus";
import { cancelled, err, timeout } from "./result";
const idlePath = ["idle"];
const runningPath = ["running"];
const succeededPath = ["succeeded"];
const failedPath = ["failed"];
const cancelledPath = ["cancelled"];
const timedOutPath = ["timedOut"];
function applyStartEvent(board, event) {
    if (event.type !== "start") {
        return;
    }
    board.runId = event.runId;
    board.input = event.input;
    board.result = undefined;
    board.error = undefined;
    board.cancelReason = undefined;
    board.timeoutMs = undefined;
    board.startedAt = event.startedAt;
    board.finishedAt = undefined;
    board.signal = event.signal;
}
function applyOkEvent(board, event) {
    if (event.type !== "ok") {
        return;
    }
    board.result = event.result;
    board.error = undefined;
    board.cancelReason = undefined;
    board.timeoutMs = undefined;
    board.finishedAt = event.finishedAt;
    board.signal = undefined;
}
function applyErrEvent(board, event) {
    if (event.type !== "err") {
        return;
    }
    board.result = undefined;
    board.error = event.error;
    board.cancelReason = undefined;
    board.timeoutMs = undefined;
    board.finishedAt = event.finishedAt;
    board.signal = undefined;
}
function applyCancelEvent(board, event) {
    if (event.type !== "cancel") {
        return;
    }
    board.result = undefined;
    board.error = undefined;
    board.cancelReason = event.reason;
    board.timeoutMs = undefined;
    board.finishedAt = event.finishedAt;
    board.signal = undefined;
}
function applyTimeoutEvent(board, event) {
    if (event.type !== "timeout") {
        return;
    }
    board.result = undefined;
    board.error = undefined;
    board.cancelReason = undefined;
    board.timeoutMs = event.timeoutMs;
    board.finishedAt = event.finishedAt;
    board.signal = undefined;
}
function cloneTrace(trace) {
    return trace.map((event) => ({ ...event }));
}
function cloneBoard(board) {
    return {
        taskId: board.taskId,
        status: board.status,
        runId: board.runId,
        input: board.input,
        result: board.result,
        error: board.error,
        cancelReason: board.cancelReason,
        timeoutMs: board.timeoutMs,
        startedAt: board.startedAt,
        finishedAt: board.finishedAt,
        signal: board.signal,
        trace: cloneTrace(board.trace),
    };
}
function setStatus(status) {
    return (board) => {
        board.status = status;
    };
}
function lifecycleMachine() {
    return defineDeusMachine({
        initial: idlePath,
        states: [
            { path: idlePath, onEnter: setStatus("idle") },
            { path: runningPath, onEnter: setStatus("running") },
            { path: succeededPath, onEnter: setStatus("succeeded") },
            { path: failedPath, onEnter: setStatus("failed") },
            { path: cancelledPath, onEnter: setStatus("cancelled") },
            { path: timedOutPath, onEnter: setStatus("timedOut") },
        ],
        transitions: [
            {
                key: "idle:start",
                from: idlePath,
                event: "start",
                to: runningPath,
                do: applyStartEvent,
            },
            {
                key: "running:ok",
                from: runningPath,
                event: "ok",
                to: succeededPath,
                do: applyOkEvent,
            },
            {
                key: "running:err",
                from: runningPath,
                event: "err",
                to: failedPath,
                do: applyErrEvent,
            },
            {
                key: "running:cancel",
                from: runningPath,
                event: "cancel",
                to: cancelledPath,
                do: applyCancelEvent,
            },
            {
                key: "running:timeout",
                from: runningPath,
                event: "timeout",
                to: timedOutPath,
                do: applyTimeoutEvent,
            },
            {
                key: "succeeded:start",
                from: succeededPath,
                event: "start",
                to: runningPath,
                do: applyStartEvent,
            },
            {
                key: "failed:start",
                from: failedPath,
                event: "start",
                to: runningPath,
                do: applyStartEvent,
            },
            {
                key: "cancelled:start",
                from: cancelledPath,
                event: "start",
                to: runningPath,
                do: applyStartEvent,
            },
            {
                key: "timedOut:start",
                from: timedOutPath,
                event: "start",
                to: runningPath,
                do: applyStartEvent,
            },
        ],
    });
}
export function createController(task, options = {}) {
    const now = options.now ?? (() => Date.now());
    const board = {
        taskId: task.id,
        status: "idle",
        runId: 0,
        trace: [],
    };
    const machine = lifecycleMachine();
    let snapshot = createDeusSnapshot(machine, board);
    let activeRun;
    let runId = 0;
    recordTrace({
        kind: "created",
        runId: 0,
        at: now(),
    });
    function dispatch(event) {
        snapshot = stepDeusMachine(machine, snapshot, event).snapshot;
    }
    function recordTrace(event) {
        board.trace.push({
            taskId: task.id,
            ...event,
        });
    }
    function recordTaskTrace(runIdValue, event) {
        recordTrace({
            kind: event.kind,
            runId: runIdValue,
            at: Number.isFinite(event.at) ? event.at : now(),
            message: event.message,
        });
    }
    function finishRun(result) {
        if (!activeRun || activeRun.settled) {
            return;
        }
        clearTimeout(activeRun.timeoutHandle);
        activeRun.settled = true;
        const resolver = activeRun.resolve;
        activeRun = undefined;
        resolver(result);
    }
    function ignoreStaleCompletion(localRunId, message) {
        recordTrace({
            kind: "staleCompletionIgnored",
            runId: localRunId,
            at: now(),
            message,
        });
    }
    function cancelCurrent(reason) {
        if (!activeRun || snapshot.board.status !== "running") {
            return;
        }
        const current = activeRun;
        current.controller.abort(reason);
        dispatch({
            type: "cancel",
            runId: current.runId,
            finishedAt: now(),
            reason,
        });
        recordTrace({
            kind: "cancelled",
            runId: current.runId,
            at: snapshot.board.finishedAt ?? now(),
            message: reason,
        });
        finishRun(cancelled(reason));
    }
    function settleResolvedResult(localRunId, result) {
        if (!activeRun || activeRun.runId !== localRunId || snapshot.board.status !== "running") {
            ignoreStaleCompletion(localRunId, "Completion arrived after the run was no longer current.");
            return;
        }
        const finishedAt = now();
        switch (result.kind) {
            case "ok":
                dispatch({
                    type: "ok",
                    runId: localRunId,
                    finishedAt,
                    result: result.value,
                });
                recordTrace({
                    kind: "resolved",
                    runId: localRunId,
                    at: finishedAt,
                });
                finishRun(result);
                return;
            case "err":
                dispatch({
                    type: "err",
                    runId: localRunId,
                    finishedAt,
                    error: result.error,
                });
                recordTrace({
                    kind: "failed",
                    runId: localRunId,
                    at: finishedAt,
                });
                finishRun(result);
                return;
            case "cancelled":
                activeRun.controller.abort(result.reason);
                dispatch({
                    type: "cancel",
                    runId: localRunId,
                    finishedAt,
                    reason: result.reason,
                });
                recordTrace({
                    kind: "cancelled",
                    runId: localRunId,
                    at: finishedAt,
                    message: result.reason,
                });
                finishRun(result);
                return;
            case "timeout":
                activeRun.controller.abort("timeout");
                dispatch({
                    type: "timeout",
                    runId: localRunId,
                    finishedAt,
                    timeoutMs: result.timeoutMs,
                });
                recordTrace({
                    kind: "timedOut",
                    runId: localRunId,
                    at: finishedAt,
                    message: `Timed out after ${result.timeoutMs}ms.`,
                });
                finishRun(result);
                return;
        }
    }
    function settleRejectedResult(localRunId, failure) {
        if (!activeRun || activeRun.runId !== localRunId || snapshot.board.status !== "running") {
            ignoreStaleCompletion(localRunId, "Rejected completion arrived after the run was no longer current.");
            return;
        }
        const finishedAt = now();
        dispatch({
            type: "err",
            runId: localRunId,
            finishedAt,
            error: failure,
        });
        recordTrace({
            kind: "failed",
            runId: localRunId,
            at: finishedAt,
            message: "Task rejected or threw.",
        });
        finishRun(err(failure));
    }
    return {
        task,
        start(input) {
            if (activeRun && snapshot.board.status === "running") {
                cancelCurrent("restarted");
            }
            runId += 1;
            const localRunId = runId;
            const startedAt = now();
            const controller = new AbortController();
            let resolveResult;
            const resultPromise = new Promise((resolve) => {
                resolveResult = resolve;
            });
            const currentRun = {
                runId: localRunId,
                controller,
                resolve: resolveResult,
                settled: false,
            };
            activeRun = currentRun;
            dispatch({
                type: "start",
                runId: localRunId,
                input,
                startedAt,
                signal: controller.signal,
            });
            recordTrace({
                kind: "started",
                runId: localRunId,
                at: startedAt,
            });
            if (task.timeoutMs !== undefined) {
                const timeoutMs = task.timeoutMs;
                currentRun.timeoutHandle = setTimeout(() => {
                    if (!activeRun || activeRun.runId !== localRunId || snapshot.board.status !== "running") {
                        return;
                    }
                    activeRun.controller.abort("timeout");
                    const finishedAt = now();
                    dispatch({
                        type: "timeout",
                        runId: localRunId,
                        finishedAt,
                        timeoutMs,
                    });
                    recordTrace({
                        kind: "timedOut",
                        runId: localRunId,
                        at: finishedAt,
                        message: `Timed out after ${timeoutMs}ms.`,
                    });
                    finishRun(timeout(timeoutMs));
                }, timeoutMs);
            }
            const ctx = {
                signal: controller.signal,
                runId: localRunId,
                startedAt,
                now,
                trace: (event) => recordTaskTrace(localRunId, event),
            };
            void Promise.resolve()
                .then(() => task.run(task.env, input, ctx))
                .then((result) => settleResolvedResult(localRunId, result), (error) => settleRejectedResult(localRunId, error));
            return resultPromise;
        },
        cancel(reason) {
            cancelCurrent(reason);
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
export async function run(task, input, options) {
    return createController(task, options).start(input);
}
