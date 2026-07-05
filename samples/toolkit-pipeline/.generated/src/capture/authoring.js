import { describeCaptureTask } from "./describe.js";
import { validateCaptureTask } from "./validate.js";
function assertTaskId(id) {
    if (id.trim().length === 0) {
        throw new Error("Capture task id must be non-empty.");
    }
}
function assertTaskRun(run) {
    if (typeof run !== "function") {
        throw new Error("Capture task run must be a function.");
    }
}
function assertTaskDescription(description) {
    if (description !== undefined && typeof description !== "string") {
        throw new Error("InvalidCaptureDescription: Capture task description must be a string when provided.");
    }
}
function assertRebindInput(input) {
    if (input.id !== undefined && input.id.trim().length === 0) {
        throw new Error("InvalidCaptureId: Capture task id must be a non-empty string.");
    }
    assertTaskDescription(input.description);
    if (input.env !== undefined && input.envPatch !== undefined) {
        throw new Error("Capture task rebind cannot accept both env and envPatch.");
    }
}
export function task(input) {
    assertTaskId(input.id);
    assertTaskRun(input.run);
    return {
        kind: "task",
        id: input.id,
        env: input.env,
        run: input.run,
        description: input.description,
    };
}
export function run(captureTask, input) {
    return captureTask.run(captureTask.env, input);
}
export function withEnv(captureTask, patch) {
    return {
        kind: "task",
        id: captureTask.id,
        env: { ...captureTask.env, ...patch },
        run: captureTask.run,
        description: captureTask.description,
    };
}
export function rebind(captureTask, input) {
    assertRebindInput(input);
    const env = input.env !== undefined
        ? input.env
        : input.envPatch !== undefined
            ? { ...captureTask.env, ...input.envPatch }
            : captureTask.env;
    return {
        kind: "task",
        id: input.id ?? captureTask.id,
        env,
        run: captureTask.run,
        description: input.description ?? captureTask.description,
    };
}
export const rebindCaptureTask = rebind;
export function map(captureTask, inputs) {
    return inputs.map((input) => run(captureTask, input));
}
export const C = {
    task,
    run,
    withEnv,
    rebind,
    map,
    describe: describeCaptureTask,
    validate: validateCaptureTask,
};
