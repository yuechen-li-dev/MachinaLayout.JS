import { T } from "../concept/authoring";
import type { ConceptDefinition } from "../concept/types";
import { validateConceptValue } from "../concept/validate";
import {
  type AnyEffectDefinition,
  type AnyEffectRequest,
  assertJsonSafe,
  canonicalJson,
  type EffectCall,
  EffectError,
  type EffectHandler,
  isEffectRequest,
  type UnserializableValueError,
} from "./effects";
import { done as doneStep, fail as failStep, yieldValue } from "./result";
import type { IterDiagnostic, IterMachine } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SerializedEffectError = {
  readonly name: string;
  readonly message: string;
  readonly data?: unknown;
};

export type EffectOutcome =
  | { readonly kind: "ok"; readonly value: unknown }
  | { readonly kind: "err"; readonly error: SerializedEffectError };

/** One resolved step: what was asked (calls) and what came back (outcomes). Plain JSON. */
export type WorkflowLogEntry = {
  readonly calls: readonly EffectCall[];
  readonly parallel: boolean;
  readonly outcomes: readonly EffectOutcome[];
};

/** Everything needed to resume: the input plus the effect log. JSON-serializable. */
export type WorkflowSnapshot<TInput = unknown> = {
  readonly kind: "workflowSnapshot";
  readonly workflowId: string;
  readonly input: TInput;
  readonly log: readonly WorkflowLogEntry[];
};

export type Workflow<TInput, TReturn> = {
  readonly kind: "workflow";
  readonly id: string;
  readonly description?: string;
  /** Optional concept the input (and snapshot input on resume) must satisfy. */
  readonly input?: ConceptDefinition;
  readonly run: (input: TInput) => Generator<AnyEffectRequest, TReturn, unknown>;
};

export type WorkflowDiagnostic = IterDiagnostic & {
  /** Log index (effect step) the diagnostic refers to. */
  readonly step?: number;
  readonly expected?: string;
  readonly received?: string;
};

export type WorkflowRun<TInput, TReturn> =
  | {
      readonly kind: "done";
      readonly value: TReturn;
      readonly snapshot: WorkflowSnapshot<TInput>;
    }
  | {
      readonly kind: "failed";
      /** What the workflow threw (uncaught). */
      readonly error: unknown;
      readonly snapshot: WorkflowSnapshot<TInput>;
    }
  | {
      /** Stopped on purpose (`maxSteps`, abort signal, manual driver); resume with the snapshot. */
      readonly kind: "suspended";
      readonly pending: readonly EffectCall[];
      readonly snapshot: WorkflowSnapshot<TInput>;
    }
  | {
      /** Replay did not match the log: the code or its inputs changed. Nothing was executed live. */
      readonly kind: "diverged";
      readonly diagnostics: readonly WorkflowDiagnostic[];
      readonly snapshot: WorkflowSnapshot<TInput>;
    }
  | {
      /** Bad input, bad snapshot, or a missing handler. Fix and resume from `snapshot`. */
      readonly kind: "invalid";
      readonly diagnostics: readonly WorkflowDiagnostic[];
      readonly snapshot: WorkflowSnapshot<TInput>;
    };

export type WorkflowRunOptions = {
  /** Handler overrides; anything not listed falls back to the effect's own `run`. */
  readonly handlers?: readonly EffectHandler[];
  /** Stop (as `suspended`) after this many live (non-replayed) steps. */
  readonly maxSteps?: number;
  readonly signal?: AbortSignal;
};

// ---------------------------------------------------------------------------
// Authoring
// ---------------------------------------------------------------------------

/**
 * A resumable workflow written with ordinary generator syntax:
 * `I.workflow({ id, run: function* (order) { const fx = yield* fetchRate(order.currency); ... } })`.
 * Its state is the effect log, so it can be snapshotted, resumed, and replayed.
 */
export function workflow<TInput, TReturn>(input: {
  id: string;
  run: (input: TInput) => Generator<AnyEffectRequest, TReturn, unknown>;
  input?: ConceptDefinition;
  description?: string;
}): Workflow<TInput, TReturn> {
  if (typeof input.id !== "string" || input.id.trim().length === 0) {
    throw new Error("Workflow id must be non-empty.");
  }
  if (typeof input.run !== "function") {
    throw new Error("Workflow run must be a generator function.");
  }
  return {
    kind: "workflow",
    id: input.id,
    run: input.run,
    ...(input.input ? { input: input.input } : {}),
    ...(input.description ? { description: input.description } : {}),
  };
}

// ---------------------------------------------------------------------------
// Replay engine
// ---------------------------------------------------------------------------

type SessionState<TReturn> =
  | { readonly kind: "pending"; readonly request: AnyEffectRequest }
  | { readonly kind: "done"; readonly value: TReturn }
  | { readonly kind: "failed"; readonly error: unknown }
  | { readonly kind: "diverged"; readonly diagnostics: readonly WorkflowDiagnostic[] };

type Resume =
  | { readonly kind: "next"; readonly value: unknown }
  | { readonly kind: "throw"; readonly error: unknown };

function describeCalls(calls: readonly EffectCall[], parallel: boolean): string {
  const text = calls.map((call) => `${call.name}(${canonicalJson(call.args).slice(1, -1)})`);
  return parallel ? `all[${text.join(", ")}]` : (text[0] ?? "<none>");
}

export function serializeError(error: unknown): SerializedEffectError {
  if (error instanceof EffectError) {
    return {
      name: error.name,
      message: error.message,
      ...(error.data === undefined ? {} : { data: error.data }),
    };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "Error", message: String(error) };
}

function toEffectError(effect: string, error: SerializedEffectError): EffectError {
  return new EffectError(effect, error.message, { name: error.name, data: error.data });
}

/** Turn logged outcomes into what the generator receives (value, tuple, or throw). */
function deliver(request: AnyEffectRequest, outcomes: readonly EffectOutcome[]): Resume {
  const values: unknown[] = [];
  for (const [index, outcome] of outcomes.entries()) {
    const effectName = request.calls[index]?.name ?? "unknown";
    if (request.modes[index] === "attempt") {
      values.push(
        outcome.kind === "ok"
          ? { ok: true, value: outcome.value }
          : { ok: false, error: toEffectError(effectName, outcome.error) },
      );
    } else if (outcome.kind === "err") {
      return { kind: "throw", error: toEffectError(effectName, outcome.error) };
    } else {
      values.push(outcome.value);
    }
  }
  return { kind: "next", value: request.parallel ? values : values[0] };
}

function responseDiagnostics(
  definition: AnyEffectDefinition | undefined,
  value: unknown,
): readonly string[] {
  if (!definition?.response) {
    return [];
  }
  const wrapper = T.concept({
    id: definition.effectName,
    fields: { response: definition.response },
  });
  return validateConceptValue(wrapper, { response: value })
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => `${diagnostic.path ?? ""}: ${diagnostic.message}`);
}

/**
 * Drives one generator instance against a log. `start()` replays the log;
 * afterwards the session is either finished or waiting on a live request.
 */
export class WorkflowSession<TInput, TReturn> {
  readonly workflow: Workflow<TInput, TReturn>;
  readonly input: TInput;
  readonly log: WorkflowLogEntry[];
  /** Number of log entries consumed by replay. */
  replayed = 0;
  state: SessionState<TReturn> = { kind: "diverged", diagnostics: [] };
  private readonly generator: Generator<AnyEffectRequest, TReturn, unknown>;

  constructor(
    workflowRecord: Workflow<TInput, TReturn>,
    input: TInput,
    log: readonly WorkflowLogEntry[],
  ) {
    this.workflow = workflowRecord;
    this.input = input;
    this.log = [...log];
    this.generator = workflowRecord.run(input);
  }

  snapshot(): WorkflowSnapshot<TInput> {
    return {
      kind: "workflowSnapshot",
      workflowId: this.workflow.id,
      input: this.input,
      log: [...this.log],
    };
  }

  start(): this {
    this.advance({ kind: "next", value: undefined });
    return this;
  }

  private step(resume: Resume): IteratorResult<AnyEffectRequest, TReturn> | { failed: unknown } {
    try {
      return resume.kind === "next"
        ? this.generator.next(resume.value)
        : this.generator.throw(resume.error);
    } catch (error) {
      return { failed: error };
    }
  }

  private advance(initial: Resume): void {
    let resume = initial;
    for (;;) {
      const result = this.step(resume);
      if ("failed" in result) {
        this.state = { kind: "failed", error: result.failed };
        return;
      }
      if (result.done) {
        if (this.replayed < this.log.length) {
          const extra = this.log.length - this.replayed;
          this.state = {
            kind: "diverged",
            diagnostics: [
              {
                severity: "error",
                code: "ReplayDivergence",
                step: this.replayed,
                message: `workflow returned after ${this.replayed} steps but the log has ${extra} more (next: ${describeCalls(this.log[this.replayed].calls, this.log[this.replayed].parallel)})`,
                expected: describeCalls(
                  this.log[this.replayed].calls,
                  this.log[this.replayed].parallel,
                ),
                received: "<return>",
              },
            ],
          };
          return;
        }
        this.state = { kind: "done", value: result.value };
        return;
      }

      const request = result.value;
      if (!isEffectRequest(request)) {
        this.state = {
          kind: "failed",
          error: new TypeError(
            `Workflow '${this.workflow.id}' yielded a non-effect value; use \`yield* someEffect(...)\`.`,
          ),
        };
        return;
      }

      if (this.replayed >= this.log.length) {
        this.state = { kind: "pending", request };
        return;
      }

      const entry = this.log[this.replayed];
      const expected = describeCalls(entry.calls, entry.parallel);
      const received = describeCalls(request.calls, request.parallel);
      if (
        entry.parallel !== request.parallel ||
        canonicalJson(entry.calls) !== canonicalJson(request.calls)
      ) {
        const sameNames =
          entry.calls.length === request.calls.length &&
          entry.calls.every((call, index) => call.name === request.calls[index]?.name);
        this.state = {
          kind: "diverged",
          diagnostics: [
            {
              severity: "error",
              code: "ReplayDivergence",
              step: this.replayed,
              path: `log[${this.replayed}]`,
              message: sameNames
                ? `step ${this.replayed}: ${received} was yielded with different arguments than the log's ${expected}; something nondeterministic (time, randomness, external state) fed the arguments — make it an effect`
                : `step ${this.replayed}: workflow yielded ${received} but the log has ${expected}; the workflow code changed since this snapshot`,
              expected,
              received,
            },
          ],
        };
        return;
      }

      const responseProblems = entry.outcomes.flatMap((outcome, index) =>
        outcome.kind === "ok"
          ? responseDiagnostics(request.definitions[index], outcome.value).map(
              (problem) => `${entry.calls[index]?.name}${problem}`,
            )
          : [],
      );
      if (responseProblems.length > 0) {
        this.state = {
          kind: "diverged",
          diagnostics: responseProblems.map((problem) => ({
            severity: "error" as const,
            code: "InvalidReplayResponse",
            step: this.replayed,
            path: `log[${this.replayed}].outcomes`,
            message: `step ${this.replayed}: logged response no longer satisfies the effect's response concept — ${problem}`,
          })),
        };
        return;
      }

      this.replayed += 1;
      resume = deliver(request, entry.outcomes);
    }
  }

  /** Record live outcomes for the pending request and continue. */
  resolve(outcomes: readonly EffectOutcome[]): this {
    if (this.state.kind !== "pending") {
      throw new Error(
        `Workflow '${this.workflow.id}' is not waiting on an effect (${this.state.kind}).`,
      );
    }
    const request = this.state.request;
    if (outcomes.length !== request.calls.length) {
      throw new Error(
        `Expected ${request.calls.length} outcome(s) for ${describeCalls(request.calls, request.parallel)}, received ${outcomes.length}.`,
      );
    }
    const checked = outcomes.map((outcome, index) => checkLiveOutcome(request, index, outcome));
    this.log.push({ calls: request.calls, parallel: request.parallel, outcomes: checked });
    this.replayed += 1;
    this.advance(deliver(request, checked));
    return this;
  }
}

function checkLiveOutcome(
  request: AnyEffectRequest,
  index: number,
  outcome: EffectOutcome,
): EffectOutcome {
  if (outcome.kind === "err") {
    return outcome;
  }
  const problems = responseDiagnostics(request.definitions[index], outcome.value);
  if (problems.length > 0) {
    return {
      kind: "err",
      error: {
        name: "InvalidEffectResponse",
        message: `${request.calls[index]?.name} response failed its concept: ${problems.join("; ")}`,
        data: problems,
      },
    };
  }
  try {
    assertJsonSafe(outcome.value);
  } catch (error) {
    return {
      kind: "err",
      error: {
        name: "UnserializableEffectResponse",
        message: `${request.calls[index]?.name} returned a value that cannot be logged: ${(error as UnserializableValueError).message}`,
      },
    };
  }
  return outcome;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function findHandler(
  call: EffectCall,
  definition: AnyEffectDefinition | undefined,
  handlers: readonly EffectHandler[] | undefined,
): ((...args: readonly unknown[]) => unknown) | undefined {
  const override = handlers?.find((handler) => handler.name === call.name);
  if (override) {
    return override.run;
  }
  return definition?.run as ((...args: readonly unknown[]) => unknown) | undefined;
}

function missingHandlers(
  request: AnyEffectRequest,
  handlers: readonly EffectHandler[] | undefined,
): WorkflowDiagnostic[] {
  return request.calls.flatMap((call, index) =>
    findHandler(call, request.definitions[index], handlers)
      ? []
      : [
          {
            severity: "error" as const,
            code: "MissingEffectHandler",
            message: `no handler for effect '${call.name}': give the effect a \`run\` or pass \`handlers: [${call.name}.handle(...)]\``,
          },
        ],
  );
}

function argsJsonDiagnostics(request: AnyEffectRequest): WorkflowDiagnostic[] {
  return request.calls.flatMap((call) => {
    try {
      assertJsonSafe(call.args);
      return [];
    } catch (error) {
      return [
        {
          severity: "error" as const,
          code: "UnserializableEffectArgs",
          message: `effect '${call.name}' args cannot be logged: ${(error as Error).message}`,
        },
      ];
    }
  });
}

async function runCall(
  run: (...args: readonly unknown[]) => unknown,
  call: EffectCall,
): Promise<EffectOutcome> {
  try {
    return { kind: "ok", value: await run(...call.args) };
  } catch (error) {
    return { kind: "err", error: serializeError(error) };
  }
}

function runCallSync(
  run: (...args: readonly unknown[]) => unknown,
  call: EffectCall,
): EffectOutcome {
  try {
    const value = run(...call.args);
    if (value && typeof (value as { then?: unknown }).then === "function") {
      throw new Error(
        `Handler for '${call.name}' returned a Promise; this driver is synchronous. Use I.run for async handlers.`,
      );
    }
    return { kind: "ok", value };
  } catch (error) {
    if (error instanceof Error && error.message.includes("this driver is synchronous")) {
      throw error;
    }
    return { kind: "err", error: serializeError(error) };
  }
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

function inputDiagnostics<TInput>(
  workflowRecord: Workflow<TInput, unknown>,
  input: unknown,
): WorkflowDiagnostic[] {
  if (!workflowRecord.input) {
    return [];
  }
  return validateConceptValue(workflowRecord.input, input)
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => ({
      severity: "error" as const,
      code: "InvalidWorkflowInput",
      path: diagnostic.path ? `input.${diagnostic.path}` : "input",
      message: diagnostic.message,
    }));
}

function settle<TInput, TReturn>(
  session: WorkflowSession<TInput, TReturn>,
): WorkflowRun<TInput, TReturn> | undefined {
  const state = session.state;
  switch (state.kind) {
    case "done":
      return { kind: "done", value: state.value, snapshot: session.snapshot() };
    case "failed":
      return { kind: "failed", error: state.error, snapshot: session.snapshot() };
    case "diverged":
      return { kind: "diverged", diagnostics: state.diagnostics, snapshot: session.snapshot() };
    case "pending":
      return undefined;
  }
}

function suspended<TInput, TReturn>(
  session: WorkflowSession<TInput, TReturn>,
  request: AnyEffectRequest,
): WorkflowRun<TInput, TReturn> {
  return { kind: "suspended", pending: request.calls, snapshot: session.snapshot() };
}

function begin<TInput, TReturn>(
  workflowRecord: Workflow<TInput, TReturn>,
  input: TInput,
  log: readonly WorkflowLogEntry[],
): WorkflowSession<TInput, TReturn> | WorkflowRun<TInput, TReturn> {
  const snapshot: WorkflowSnapshot<TInput> = {
    kind: "workflowSnapshot",
    workflowId: workflowRecord.id,
    input,
    log,
  };
  const diagnostics = inputDiagnostics(workflowRecord, input);
  if (diagnostics.length > 0) {
    return { kind: "invalid", diagnostics, snapshot };
  }
  return new WorkflowSession(workflowRecord, input, log).start();
}

/**
 * Run (or continue) a workflow with async handlers. Pass `log` from a
 * snapshot to resume: the log is replayed first, then execution goes live.
 */
export async function runWorkflow<TInput, TReturn>(
  workflowRecord: Workflow<TInput, TReturn>,
  input: TInput,
  options: WorkflowRunOptions & { readonly log?: readonly WorkflowLogEntry[] } = {},
): Promise<WorkflowRun<TInput, TReturn>> {
  const started = begin(workflowRecord, input, options.log ?? []);
  if (!(started instanceof WorkflowSession)) {
    return started;
  }
  const session = started;
  let liveSteps = 0;

  for (;;) {
    const settled = settle(session);
    if (settled) {
      return settled;
    }
    const request = (session.state as { request: AnyEffectRequest }).request;
    if (
      options.signal?.aborted ||
      (options.maxSteps !== undefined && liveSteps >= options.maxSteps)
    ) {
      return suspended(session, request);
    }
    const problems = [
      ...missingHandlers(request, options.handlers),
      ...argsJsonDiagnostics(request),
    ];
    if (problems.length > 0) {
      return { kind: "invalid", diagnostics: problems, snapshot: session.snapshot() };
    }
    const outcomes = await Promise.all(
      request.calls.map((call, index) =>
        runCall(findHandler(call, request.definitions[index], options.handlers)!, call),
      ),
    );
    liveSteps += 1;
    session.resolve(outcomes);
  }
}

const SnapshotConcept = T.concept({
  id: "WorkflowSnapshot",
  closed: true,
  fields: {
    kind: T.literal("workflowSnapshot"),
    workflowId: T.string({ nonEmpty: true }),
    input: T.unknown(),
    log: T.array(
      T.concept({
        id: "WorkflowLogEntry",
        closed: true,
        fields: {
          calls: T.array(
            T.concept({
              id: "EffectCall",
              closed: true,
              fields: { name: T.string({ nonEmpty: true }), args: T.array() },
            }),
            { minLength: 1 },
          ),
          parallel: T.boolean(),
          outcomes: T.array(
            T.union(
              T.concept({
                id: "OkOutcome",
                closed: true,
                fields: { kind: T.literal("ok"), value: T.optional(T.unknown()) },
              }),
              T.concept({
                id: "ErrOutcome",
                closed: true,
                fields: {
                  kind: T.literal("err"),
                  error: T.concept({
                    id: "SerializedEffectError",
                    fields: { name: T.string(), message: T.string() },
                  }),
                },
              }),
            ),
            { minLength: 1 },
          ),
        },
      }),
    ),
  },
});

/** Validate an untrusted snapshot (e.g. loaded from storage) with fix-hint diagnostics. */
export function validateWorkflowSnapshot(
  workflowRecord: Workflow<unknown, unknown>,
  snapshot: unknown,
): WorkflowDiagnostic[] {
  const diagnostics: WorkflowDiagnostic[] = validateConceptValue(SnapshotConcept, snapshot)
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => ({
      severity: "error" as const,
      code: "InvalidWorkflowSnapshot",
      path: diagnostic.path,
      message: diagnostic.message,
    }));
  if (diagnostics.length > 0) {
    const input =
      typeof snapshot === "object" && snapshot !== null && "input" in snapshot
        ? (snapshot as { input: unknown }).input
        : undefined;
    return [
      ...diagnostics,
      ...(input === undefined ? [] : inputDiagnostics(workflowRecord, input)),
    ];
  }
  const record = snapshot as WorkflowSnapshot;
  if (record.workflowId !== workflowRecord.id) {
    diagnostics.push({
      severity: "error",
      code: "WorkflowIdMismatch",
      path: "workflowId",
      message: `snapshot belongs to workflow '${record.workflowId}', not '${workflowRecord.id}'`,
    });
  }
  for (const [index, entry] of record.log.entries()) {
    if (
      entry.calls.length !== entry.outcomes.length ||
      (!entry.parallel && entry.calls.length !== 1)
    ) {
      diagnostics.push({
        severity: "error",
        code: "InvalidWorkflowSnapshot",
        path: `log[${index}]`,
        step: index,
        message: `entry has ${entry.calls.length} calls and ${entry.outcomes.length} outcomes`,
      });
    }
  }
  return [...diagnostics, ...inputDiagnostics(workflowRecord, record.input)];
}

/** Resume from a (possibly untrusted) snapshot: validate, replay, then continue live. */
export async function resumeWorkflow<TInput, TReturn>(
  workflowRecord: Workflow<TInput, TReturn>,
  snapshot: unknown,
  options: WorkflowRunOptions = {},
): Promise<WorkflowRun<TInput, TReturn>> {
  const diagnostics = validateWorkflowSnapshot(
    workflowRecord as Workflow<unknown, unknown>,
    snapshot,
  );
  if (diagnostics.length > 0) {
    return {
      kind: "invalid",
      diagnostics,
      snapshot: snapshot as WorkflowSnapshot<TInput>,
    };
  }
  const record = snapshot as WorkflowSnapshot<TInput>;
  return runWorkflow(workflowRecord, record.input, { ...options, log: record.log });
}

/** Synchronous run with synchronous handlers (tests, scripts, deterministic tools). */
export function runWorkflowSync<TInput, TReturn>(
  workflowRecord: Workflow<TInput, TReturn>,
  input: TInput,
  options: Omit<WorkflowRunOptions, "signal"> & {
    readonly log?: readonly WorkflowLogEntry[];
  } = {},
): WorkflowRun<TInput, TReturn> {
  const started = begin(workflowRecord, input, options.log ?? []);
  if (!(started instanceof WorkflowSession)) {
    return started;
  }
  const session = started;
  let liveSteps = 0;
  for (;;) {
    const settled = settle(session);
    if (settled) {
      return settled;
    }
    const request = (session.state as { request: AnyEffectRequest }).request;
    if (options.maxSteps !== undefined && liveSteps >= options.maxSteps) {
      return suspended(session, request);
    }
    const problems = [
      ...missingHandlers(request, options.handlers),
      ...argsJsonDiagnostics(request),
    ];
    if (problems.length > 0) {
      return { kind: "invalid", diagnostics: problems, snapshot: session.snapshot() };
    }
    const outcomes = request.calls.map((call, index) =>
      runCallSync(findHandler(call, request.definitions[index], options.handlers)!, call),
    );
    liveSteps += 1;
    session.resolve(outcomes);
  }
}

// ---------------------------------------------------------------------------
// Manual driver for tests
// ---------------------------------------------------------------------------

export type WorkflowStepper<TInput, TReturn> = {
  /** Effects the workflow is waiting on (as data), or `undefined` once finished. */
  readonly pending: readonly EffectCall[] | undefined;
  /** Final result once the workflow stops waiting. */
  readonly result: WorkflowRun<TInput, TReturn> | undefined;
  /**
   * Assert the workflow is waiting on `definition` (optionally with `args`), then respond.
   * Throws a readable error naming what it is actually waiting on.
   */
  expect<TArgs extends readonly unknown[], TResponse>(
    definition: import("./effects").EffectDefinition<TArgs, TResponse>,
    args?: NoInfer<TArgs>,
  ): {
    respond(value: TResponse): WorkflowStepper<TInput, TReturn>;
    fail(
      message: string,
      options?: { name?: string; data?: unknown },
    ): WorkflowStepper<TInput, TReturn>;
  };
  /** Typed `expect` for an `I.all(...)` step: one definition per parallel call, in order. */
  expectAll<const TDefinitions extends readonly import("./effects").AnyEffectDefinition[]>(
    definitions: TDefinitions,
  ): {
    respond(
      ...values: { [K in keyof TDefinitions]: import("./effects").EffectResponse<TDefinitions[K]> }
    ): WorkflowStepper<TInput, TReturn>;
  };
  /** Respond to every pending call (one value per call, for `I.all`). Untyped; prefer `expect`/`expectAll`. */
  respond(...values: readonly unknown[]): WorkflowStepper<TInput, TReturn>;
  snapshot(): WorkflowSnapshot<TInput>;
};

/**
 * Step a workflow by hand: no handlers, no promises, no mocks. Each pending
 * effect is plain data you assert on and answer.
 */
export function driveWorkflow<TInput, TReturn>(
  workflowRecord: Workflow<TInput, TReturn>,
  input: TInput,
  options: { readonly log?: readonly WorkflowLogEntry[] } = {},
): WorkflowStepper<TInput, TReturn> {
  const started = begin(workflowRecord, input, options.log ?? []);
  const session = started instanceof WorkflowSession ? started : undefined;
  const early = started instanceof WorkflowSession ? undefined : started;

  const current = () => (session ? settle(session) : early);
  const pendingRequest = () =>
    session?.state.kind === "pending" ? session.state.request : undefined;

  const stepper: WorkflowStepper<TInput, TReturn> = {
    get pending() {
      return pendingRequest()?.calls;
    },
    get result() {
      return current();
    },
    expect(definition, args) {
      const request = pendingRequest();
      const call = request?.calls[0];
      const describeWaiting = () => {
        const result = current();
        return request
          ? describeCalls(request.calls, request.parallel)
          : `nothing (workflow ${result?.kind}${result?.kind === "failed" ? `: ${String((result as { error: unknown }).error)}` : ""})`;
      };
      if (
        !request ||
        request.parallel ||
        call?.name !== definition.effectName ||
        (args !== undefined && canonicalJson(call.args) !== canonicalJson(args))
      ) {
        const wanted = `${definition.effectName}(${args === undefined ? "…" : canonicalJson(args).slice(1, -1)})`;
        throw new Error(
          `Expected workflow to wait on ${wanted}, but it waits on ${describeWaiting()}.`,
        );
      }
      return {
        respond: (value) => {
          session!.resolve([{ kind: "ok", value }]);
          return stepper;
        },
        fail: (message, failOptions) => {
          session!.resolve([
            {
              kind: "err",
              error: {
                name: failOptions?.name ?? "EffectError",
                message,
                ...(failOptions?.data === undefined ? {} : { data: failOptions.data }),
              },
            },
          ]);
          return stepper;
        },
      };
    },
    expectAll(definitions) {
      const request = pendingRequest();
      const names = definitions.map((definition) => definition.effectName);
      if (
        !request?.parallel ||
        canonicalJson(request.calls.map((call) => call.name)) !== canonicalJson(names)
      ) {
        const waiting = request
          ? describeCalls(request.calls, request.parallel)
          : `nothing (${current()?.kind})`;
        throw new Error(
          `Expected workflow to wait on all[${names.join(", ")}], but it waits on ${waiting}.`,
        );
      }
      return {
        respond: (...values) => {
          session!.resolve(values.map((value) => ({ kind: "ok", value })));
          return stepper;
        },
      };
    },
    respond(...values) {
      if (!pendingRequest()) {
        throw new Error(`Workflow is not waiting on an effect (${current()?.kind}).`);
      }
      session!.resolve(values.map((value) => ({ kind: "ok", value })));
      return stepper;
    },
    snapshot() {
      return session ? session.snapshot() : early!.snapshot;
    },
  };
  return stepper;
}

// ---------------------------------------------------------------------------
// Lowering to an explicit IterMachine
// ---------------------------------------------------------------------------

export type WorkflowCursor = { readonly log: readonly WorkflowLogEntry[] };

/**
 * Lower a workflow to an `IterMachine` whose cursor is the effect log: each
 * step resolves one effect (sync handlers) and yields its log entry, so the
 * controller's snapshot/trace/Deus machinery applies to generator code.
 * Each step replays from the start (O(n²) total) — fine for authoring-scale logs.
 */
export function workflowMachine<TInput, TReturn>(
  workflowRecord: Workflow<TInput, TReturn>,
  input: TInput,
  options: { readonly handlers?: readonly EffectHandler[] } = {},
): IterMachine<{ readonly input: TInput }, WorkflowCursor, WorkflowLogEntry, TReturn, unknown> {
  return {
    kind: "iterMachine",
    id: workflowRecord.id,
    description:
      workflowRecord.description ?? `Workflow '${workflowRecord.id}' (cursor = effect log).`,
    env: { input },
    initial: { log: [] },
    step: (env, cursor) => {
      const run = runWorkflowSync(workflowRecord, env.input, {
        log: cursor.log,
        handlers: options.handlers,
        maxSteps: 1,
      });
      switch (run.kind) {
        case "done":
          return run.snapshot.log.length > cursor.log.length
            ? yieldValue(run.snapshot.log[cursor.log.length], {
                log: run.snapshot.log.slice(0, cursor.log.length + 1),
              })
            : doneStep(run.value);
        case "suspended":
          return run.snapshot.log.length > cursor.log.length
            ? yieldValue(run.snapshot.log[cursor.log.length], { log: run.snapshot.log })
            : failStep({ kind: "suspended", pending: run.pending });
        case "failed":
          return run.snapshot.log.length > cursor.log.length
            ? yieldValue(run.snapshot.log[cursor.log.length], {
                log: run.snapshot.log.slice(0, cursor.log.length + 1),
              })
            : failStep(run.error);
        case "diverged":
        case "invalid":
          return failStep({ kind: run.kind, diagnostics: run.diagnostics });
      }
    },
  };
}

/** One line per diagnostic: `[error] ReplayDivergence at log[2] (step 2): …`. */
export function formatWorkflowDiagnostics(diagnostics: readonly WorkflowDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return "No workflow diagnostics.";
  }
  return diagnostics
    .map((diagnostic) => {
      const path = diagnostic.path ? ` at ${diagnostic.path}` : "";
      const step = diagnostic.step !== undefined ? ` (step ${diagnostic.step})` : "";
      return `[${diagnostic.severity}] ${diagnostic.code}${path}${step}: ${diagnostic.message}`;
    })
    .join("\n");
}
