import type { ConceptFieldConstraint } from "../concept/types";

/**
 * One effect invocation as plain data. Workflows yield these; drivers decide
 * what actually happens. Because the request is data, a test can assert on it
 * and a log can record it.
 */
export type EffectCall = {
  readonly name: string;
  readonly args: readonly unknown[];
};

export type EffectMode = "call" | "attempt";

/** Result shape delivered by `I.attempt(...)` instead of throwing. */
export type EffectAttempt<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: EffectError };

declare const responseType: unique symbol;

/**
 * A yieldable request. `yield* request` returns `TResponse` — the response
 * type survives `yield`, which plain `yield value` cannot give you.
 */
export type EffectRequest<TResponse> = {
  readonly kind: "effectRequest";
  readonly calls: readonly EffectCall[];
  readonly modes: readonly EffectMode[];
  /** `true` for `I.all(...)`: one log entry, outcomes delivered as a tuple. */
  readonly parallel: boolean;
  /** Definitions behind each call (default handlers, response concepts). Never logged. */
  readonly definitions: readonly AnyEffectDefinition[];
  readonly [responseType]?: TResponse;
  [Symbol.iterator](): Generator<AnyEffectRequest, TResponse, unknown>;
};

export type AnyEffectRequest = EffectRequest<unknown>;

export type EffectDefinition<TArgs extends readonly unknown[], TResponse> = {
  (...args: TArgs): EffectRequest<TResponse>;
  readonly kind: "effectDefinition";
  readonly effectName: string;
  readonly description?: string;
  /** Default (production) handler; drivers may override it. */
  readonly run?: (...args: TArgs) => TResponse | Promise<TResponse>;
  /** Concept/constraint every response (live or replayed) must satisfy. */
  readonly response?: ConceptFieldConstraint;
  /** Build a handler override, typed against this effect. */
  readonly handle: (run: (...args: TArgs) => TResponse | Promise<TResponse>) => EffectHandler;
};

export type EffectHandler = {
  readonly kind: "effectHandler";
  readonly name: string;
  readonly run: (...args: readonly unknown[]) => unknown;
};

/** What drivers need from any effect definition (structural, so every definition fits). */
export type AnyEffectDefinition = {
  readonly kind: "effectDefinition";
  readonly effectName: string;
  readonly run?: (...args: never) => unknown;
  readonly response?: ConceptFieldConstraint;
};

export type EffectResponse<TDefinition> =
  TDefinition extends EffectDefinition<infer _TArgs, infer TResponse> ? TResponse : never;

/** Error delivered into a workflow when an effect fails. Identical live and on replay. */
export class EffectError extends Error {
  readonly effect: string;
  readonly data?: unknown;

  constructor(effect: string, message: string, options?: { name?: string; data?: unknown }) {
    super(message);
    this.name = options?.name ?? "EffectError";
    this.effect = effect;
    this.data = options?.data;
  }
}

function makeRequest<TResponse>(
  calls: readonly EffectCall[],
  modes: readonly EffectMode[],
  parallel: boolean,
  definitions: readonly AnyEffectDefinition[],
): EffectRequest<TResponse> {
  const request = {
    kind: "effectRequest" as const,
    calls,
    modes,
    parallel,
    definitions,
    *[Symbol.iterator](): Generator<AnyEffectRequest, TResponse, unknown> {
      return (yield request as AnyEffectRequest) as TResponse;
    },
  };
  return request as EffectRequest<TResponse>;
}

/**
 * Declare an effect: `const fetchUser = I.effect("fetchUser", { run: api.getUser, response: User })`.
 * Calling it builds a request; `yield* fetchUser(7)` inside a workflow returns the typed response.
 */
export function effect<TArgs extends readonly unknown[], TResponse>(
  name: string,
  options: {
    readonly run?: (...args: TArgs) => TResponse | Promise<TResponse>;
    readonly response?: ConceptFieldConstraint;
    readonly description?: string;
  } = {},
): EffectDefinition<TArgs, TResponse> {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Effect name must be non-empty.");
  }
  const definition: (...args: TArgs) => EffectRequest<TResponse> = (...args: TArgs) =>
    makeRequest<TResponse>([{ name, args }], ["call"], false, [
      result as unknown as AnyEffectDefinition,
    ]);
  const result = Object.assign(definition, {
    kind: "effectDefinition" as const,
    effectName: name,
    description: options.description,
    run: options.run,
    response: options.response,
    handle: (run: (...args: TArgs) => TResponse | Promise<TResponse>): EffectHandler => ({
      kind: "effectHandler",
      name,
      run: run as (...args: readonly unknown[]) => unknown,
    }),
  });
  return result;
}

/** `yield* I.attempt(fetchUser(7))` → `{ ok: true, value } | { ok: false, error }`, never throws. */
export function attempt<TResponse>(
  request: EffectRequest<TResponse>,
): EffectRequest<EffectAttempt<TResponse>> {
  return makeRequest(
    request.calls,
    request.calls.map(() => "attempt"),
    request.parallel,
    request.definitions,
  );
}

type ResponsesOf<TRequests extends readonly EffectRequest<unknown>[]> = {
  -readonly [K in keyof TRequests]: TRequests[K] extends EffectRequest<infer TResponse>
    ? TResponse
    : never;
};

/**
 * Run several single effects as one step (in parallel under async drivers).
 * Logged as one entry; delivered as a typed tuple. A failing `call` member
 * throws the first failure in order; wrap members in `I.attempt` to collect.
 */
export function all<const TRequests extends readonly EffectRequest<unknown>[]>(
  requests: TRequests,
): EffectRequest<ResponsesOf<TRequests>> {
  for (const request of requests) {
    if (request.parallel || request.calls.length !== 1) {
      throw new Error("I.all accepts single effect requests (no nested I.all).");
    }
  }
  return makeRequest(
    requests.map((request) => request.calls[0]),
    requests.map((request) => request.modes[0]),
    true,
    requests.map((request) => request.definitions[0]),
  );
}

/** Wall-clock time as a logged effect, so replay sees the same value. */
export const now: EffectDefinition<[], number> = effect("now", {
  run: () => Date.now(),
  description: "Current time in ms (logged for deterministic replay).",
});

/** Randomness as a logged effect, so replay sees the same value. */
export const random: EffectDefinition<[], number> = effect("random", {
  run: () => Math.random(),
  description: "Math.random() (logged for deterministic replay).",
});

export function isEffectRequest(value: unknown): value is AnyEffectRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "effectRequest"
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON: logs must survive JSON round trips byte-for-byte.
// ---------------------------------------------------------------------------

export class UnserializableValueError extends Error {
  readonly path: string;
  constructor(path: string, reason: string) {
    super(`${path || "<root>"}: ${reason}`);
    this.name = "UnserializableValueError";
    this.path = path;
  }
}

/** Throws `UnserializableValueError` unless `value` round-trips through JSON unchanged. */
export function assertJsonSafe(value: unknown, path = ""): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new UnserializableValueError(path, `${value} does not survive JSON`);
    }
    return;
  }
  if (value === undefined) {
    throw new UnserializableValueError(path, "undefined does not survive JSON (use null)");
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertJsonSafe(item, `${path}[${index}]`);
    });
    return;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new UnserializableValueError(
        path,
        `${prototype?.constructor?.name ?? "class instance"} is not plain data`,
      );
    }
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) {
        assertJsonSafe(item, path ? `${path}.${key}` : key);
      }
    }
    return;
  }
  throw new UnserializableValueError(path, `${typeof value} is not plain data`);
}

/** Stable JSON (sorted keys, undefined object fields dropped) for exact comparison. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.keys(item)
          .sort()
          .map((key) => [key, (item as Record<string, unknown>)[key]]),
      );
    }
    return item;
  });
}
