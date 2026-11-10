import { invariant } from "../kit";
import { collect, createController, next, reset } from "./controller";
import { describeIterMachine } from "./describe";
import { all, attempt, effect, now, random } from "./effects";
import { done, fail, yieldValue } from "./result";
import { once, seq } from "./sequences";
import type { IterMachine, IterStep, IterStepContext } from "./types";
import { validateIterMachine } from "./validate";
import {
  driveWorkflow,
  formatWorkflowDiagnostics,
  resumeWorkflow,
  runWorkflow,
  runWorkflowSync,
  validateWorkflowSnapshot,
  workflow,
  workflowMachine,
} from "./workflow";

function assertMachineId(id: string): void {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error("Iter machine id must be non-empty.");
  }
}

function assertStep(
  step: unknown,
): asserts step is (...args: readonly unknown[]) => Record<string, unknown> {
  invariant(typeof step === "function", "Iter machine step must be a function.");
}

function assertDescription(description: string | undefined): void {
  if (description !== undefined && typeof description !== "string") {
    throw new Error("Iter machine description must be a string when provided.");
  }
}

export function machine<TEnv, TCursor, TYield, TReturn = void, TError = unknown>(input: {
  id: string;
  env: TEnv;
  initial: TCursor;
  step: (
    env: TEnv,
    cursor: TCursor,
    ctx: IterStepContext<TCursor, TYield, TReturn, TError>,
  ) => IterStep<TCursor, TYield, TReturn, TError>;
  description?: string;
}): IterMachine<TEnv, TCursor, TYield, TReturn, TError> {
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
  effect,
  attempt,
  all,
  now,
  random,
  workflow,
  run: runWorkflow,
  runSync: runWorkflowSync,
  resume: resumeWorkflow,
  drive: driveWorkflow,
  formatDiagnostics: formatWorkflowDiagnostics,
  validateSnapshot: validateWorkflowSnapshot,
  toMachine: workflowMachine,
  seq,
  once,
} as const;
