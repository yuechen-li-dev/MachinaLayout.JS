import { describeCaptureTask } from "./describe";
import { validateCaptureTask } from "./validate";
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
export function map(captureTask, inputs) {
    return inputs.map((input) => run(captureTask, input));
}
export const C = {
    task,
    run,
    withEnv,
    map,
    describe: describeCaptureTask,
    validate: validateCaptureTask,
};
