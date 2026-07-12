import { DeusMachinaError } from "./types";
import type {
  DeusEvent,
  DeusScopedTransitionRow,
  DeusStatePath,
  DeusTransitionRow,
  DeusTransitionScope,
} from "./types";

function scopePath(path: unknown): DeusStatePath {
  const candidate = typeof path === "string" ? path.replace(/^\//, "").split("/") : path;
  if (
    !Array.isArray(candidate) ||
    candidate.length === 0 ||
    candidate.some((segment) => typeof segment !== "string" || segment.trim().length === 0)
  ) {
    throw new DeusMachinaError(
      "DEUS_SCOPE_INVALID_FROM",
      "scope from must be a non-empty Deus path",
    );
  }
  return [...candidate];
}

function scopedKey(from: DeusStatePath, row: DeusScopedTransitionRow<unknown, DeusEvent>): string {
  if (row.key !== undefined) return row.key;
  const target = Array.isArray(row.to)
    ? row.to.join("/")
    : typeof row.to === "string"
      ? row.to
      : "dynamic";
  return `${from.join("/")}:${row.event}->${target}`;
}

/** Lowers authoring-only transition scopes into ordinary Deus transition rows. */
export function transitionsFromScopes<TBoard, TEvent extends DeusEvent>(
  scopes: readonly DeusTransitionScope<TBoard, TEvent>[],
): DeusTransitionRow<TBoard, TEvent>[] {
  const transitions: DeusTransitionRow<TBoard, TEvent>[] = [];
  for (const scope of scopes as readonly unknown[]) {
    if (
      !scope ||
      typeof scope !== "object" ||
      (scope as { kind?: unknown }).kind !== "deusTransitionScope"
    ) {
      throw new DeusMachinaError("DEUS_SCOPE_INVALID_ROW", "each entry must be an M.scope record");
    }
    const candidate = scope as { from: unknown; rows: unknown };
    const from = scopePath(candidate.from);
    if (!Array.isArray(candidate.rows) || candidate.rows.length === 0)
      throw new DeusMachinaError("DEUS_SCOPE_EMPTY", "scope rows must be a non-empty array");
    for (const row of candidate.rows) {
      if (
        !row ||
        typeof row !== "object" ||
        (row as { kind?: unknown }).kind !== "deusScopedTransition"
      )
        throw new DeusMachinaError(
          "DEUS_SCOPE_INVALID_ROW",
          "scope rows must be created with M.on",
        );
      const scoped = row as DeusScopedTransitionRow<TBoard, TEvent>;
      if (typeof scoped.event !== "string" || scoped.event.trim().length === 0)
        throw new DeusMachinaError(
          "DEUS_SCOPE_EVENT_INVALID",
          "scoped transition event must be a non-empty string",
        );
      const { kind: _kind, event, ...options } = scoped;
      transitions.push({
        ...options,
        key: scopedKey(from, scoped as DeusScopedTransitionRow<unknown, DeusEvent>),
        from: [...from],
        event,
      } as DeusTransitionRow<TBoard, TEvent>);
    }
  }
  return transitions;
}

export function isDeusTransitionScope<TBoard, TEvent extends DeusEvent>(
  value: unknown,
): value is DeusTransitionScope<TBoard, TEvent> {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { kind?: unknown }).kind === "deusTransitionScope"
  );
}
