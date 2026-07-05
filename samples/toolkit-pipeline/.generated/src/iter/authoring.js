import { createController, collect, next, reset } from "./controller.js";
import { describeIterMachine } from "./describe.js";
import { done, fail, yieldValue } from "./result.js";
import { validateIterMachine } from "./validate.js";
function assertMachineId(id) {
    if (typeof id !== "string" || id.trim().length === 0) {
        throw new Error("Iter machine id must be non-empty.");
    }
}
function assertStep(step) {
    if (typeof step !== "function") {
        throw new Error("Iter machine step must be a function.");
    }
}
function assertDescription(description) {
    if (description !== undefined && typeof description !== "string") {
        throw new Error("Iter machine description must be a string when provided.");
    }
}
export function machine(input) {
    assertMachineId(input.id);
    assertStep(input.step);
    assertDescription(input.description);
    return {
        kind: "iterMachine",
        id: input.id,
        env: input.env,
        initial: input.initial,
        step: input.step,
        description: input.description,
    };
}
export const I = {
    machine,
    yield: yieldValue,
    yieldValue,
    done,
    fail,
    createController,
    next,
    collect,
    reset,
    describe: describeIterMachine,
    validate: validateIterMachine,
};
