/**
 * Small ergonomics for everyday TypeScript: options defaulting that
 * `undefined` cannot clobber, and one-line invariants that narrow types.
 */

/** Thrown by `must` / `invariant`. Carries a diagnostic code like the rest of Machina. */
export class MachinaInvariantError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MachinaInvariantError";
    this.code = code;
  }
}

type Message = string | (() => string);

function resolve(message: Message): string {
  return typeof message === "function" ? message() : message;
}

/**
 * Return `value` narrowed to non-null, or throw.
 * `const file = must(files.find(byPath), "no index.html")`.
 * Pass a function as `message` to avoid building strings on the happy path.
 */
export function must<TValue>(
  value: TValue,
  message: Message,
  code = "MissingValue",
): NonNullable<TValue> {
  if (value === null || value === undefined) {
    throw new MachinaInvariantError(code, resolve(message));
  }
  return value as NonNullable<TValue>;
}

/** Assert a condition (narrows like `if`): `invariant(rows.length > 0, "table has no rows")`. */
export function invariant(
  condition: unknown,
  message: Message,
  code = "InvariantViolation",
): asserts condition {
  if (!condition) {
    throw new MachinaInvariantError(code, resolve(message));
  }
}

type Defaultable<TDefaults> = {
  readonly [K in keyof TDefaults]?: TDefaults[K] | undefined;
};

/**
 * Fill option defaults. Unlike `{ ...defaults, ...options }`, an explicit
 * `undefined` in `options` never overwrites a default. Only keys present in
 * `defaults` are returned (read other options directly).
 *
 * `const columns = withDefaults(options, { concept: "concept", label: "label" })`
 */
export function withDefaults<TDefaults extends object>(
  options: NoInfer<Defaultable<TDefaults>> | undefined,
  defaults: TDefaults,
): TDefaults {
  const result = { ...defaults } as Record<string, unknown>;
  if (options) {
    for (const key of Object.keys(defaults)) {
      const value = (options as Record<string, unknown>)[key];
      if (value !== undefined) {
        result[key] = value;
      }
    }
  }
  return result as TDefaults;
}
