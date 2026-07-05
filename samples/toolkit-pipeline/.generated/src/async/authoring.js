import { createController, run } from "./controller.js";
import { describeAsyncTask } from "./describe.js";
import { cancelled, err, ok, timeout } from "./result.js";
import { validateAsyncTask } from "./validate.js";
function assertTaskId(id) {
    if (id.trim().length === 0) {
        throw new Error("Async task id must be non-empty.");
    }
}
function assertTaskRun(run) {
    if (typeof run !== "function") {
        throw new Error("Async task run must be a function.");
    }
}
function assertTimeout(timeoutMs) {
    if (timeoutMs === undefined) {
        return;
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error("Async task timeoutMs must be a positive finite number.");
    }
}
export function task(input) {
    assertTaskId(input.id);
    assertTaskRun(input.run);
    assertTimeout(input.timeoutMs);
    return {
        kind: "asyncTask",
        id: input.id,
        env: input.env,
        run: input.run,
        description: input.description,
        timeoutMs: input.timeoutMs,
    };
}
export const A = {
    task,
    ok,
    err,
    cancelled,
    timeout,
    createController,
    run,
    describe: describeAsyncTask,
    validate: validateAsyncTask,
};
