import {
  DeusMachinaError,
  type DeusEvent,
  type DeusMachine,
  type DeusSnapshot,
  type DeusStatePath,
  type DeusStepResult,
  type DeusTransitionTrace,
  type UtilityJudgment,
} from "./types";
import { judgeUtility } from "./utility";

export function formatDeusPath(path: DeusStatePath): string {
  return path.join("/");
}
export function sameDeusPath(a: DeusStatePath, b: DeusStatePath): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
export function isDeusAncestorPath(ancestor: DeusStatePath, path: DeusStatePath): boolean {
  return ancestor.length <= path.length && ancestor.every((v, i) => v === path[i]);
}
function finite(value: number, key: string): number {
  if (!Number.isFinite(value))
    throw new DeusMachinaError("InvalidUtilityScore", `${key} score must be finite`);
  return value;
}
function pathKey(path: DeusStatePath): string {
  return formatDeusPath(path);
}

export function defineDeusMachine<TBoard, TEvent extends DeusEvent>(
  machine: DeusMachine<TBoard, TEvent>,
): DeusMachine<TBoard, TEvent> {
  const stateKeys = new Set<string>();
  const states = machine.states.map((s) => {
    if (s.path.length === 0)
      throw new DeusMachinaError("InvalidStatePath", "state paths must be non-empty");
    const key = pathKey(s.path);
    if (stateKeys.has(key))
      throw new DeusMachinaError("DuplicateStatePath", `duplicate state path ${key}`);
    stateKeys.add(key);
    return { ...s, path: [...s.path] };
  });
  if (!stateKeys.has(pathKey(machine.initial)))
    throw new DeusMachinaError("InvalidInitialState", "initial path must exist");
  const transitionKeys = new Set<string>();
  const transitions = machine.transitions.map((t) => {
    if (!t.key)
      throw new DeusMachinaError("InvalidTransitionKey", "transition keys must be non-empty");
    if (transitionKeys.has(t.key))
      throw new DeusMachinaError("DuplicateTransitionKey", `duplicate transition key ${t.key}`);
    transitionKeys.add(t.key);
    if (!stateKeys.has(pathKey(t.from)))
      throw new DeusMachinaError(
        "InvalidTransitionFrom",
        `transition ${t.key} from path must exist`,
      );
    if (Array.isArray(t.to) && !stateKeys.has(pathKey(t.to)))
      throw new DeusMachinaError("InvalidTransitionTo", `transition ${t.key} to path must exist`);
    return { ...t, from: [...t.from], to: Array.isArray(t.to) ? [...t.to] : t.to };
  });
  return { initial: [...machine.initial], states, transitions };
}

export function createDeusSnapshot<TBoard, TEvent extends DeusEvent>(
  machine: DeusMachine<TBoard, TEvent>,
  board: TBoard,
): DeusSnapshot<TBoard> {
  return { state: [...machine.initial], board, stepIndex: 0 };
}

export function stepDeusMachine<TBoard, TEvent extends DeusEvent>(
  machine: DeusMachine<TBoard, TEvent>,
  snapshot: DeusSnapshot<TBoard>,
  event: NoInfer<TEvent>,
): DeusStepResult<TBoard> {
  const stateBefore = [...snapshot.state];
  const stateMap = new Map(machine.states.map((s) => [pathKey(s.path), s]));
  const orderedFrom = stateBefore.map((_, i) => stateBefore.slice(0, stateBefore.length - i));
  const candidates = orderedFrom.flatMap((from) =>
    machine.transitions
      .map((t, authorIndex) => ({ t, authorIndex }))
      .filter(({ t }) => sameDeusPath(t.from, from)),
  );
  const traces: DeusTransitionTrace[] = [];
  let selected:
    | { trace: DeusTransitionTrace; t: (typeof machine.transitions)[number]; utilityKey?: string }
    | undefined;
  candidates.forEach(({ t }, index) => {
    const eventMatches = t.event === undefined || t.event === event.type;
    let eligible = eventMatches && (t.when?.(snapshot.board, event) ?? true);
    let utility: UtilityJudgment<string> | undefined;
    let utilityKey: string | undefined;
    let score = eligible
      ? t.score === undefined
        ? 1
        : finite(typeof t.score === "function" ? t.score(snapshot.board, event) : t.score, t.key)
      : 0;
    if (eligible && t.utility) {
      utility = judgeUtility(
        { board: snapshot.board, event },
        t.utility.map((u) => ({
          key: u.key,
          when: (ctx) => u.when?.(ctx.board, ctx.event) ?? true,
          score: (ctx) => (typeof u.score === "function" ? u.score(ctx.board, ctx.event) : u.score),
          reason:
            typeof u.reason === "function"
              ? (ctx) => {
                  const reason = u.reason;
                  return typeof reason === "function" ? reason(ctx.board, ctx.event) : "";
                }
              : u.reason,
        })),
        t.hysteresis
          ? { previousKey: t.hysteresis.previous(snapshot.board), hysteresis: t.hysteresis.margin }
          : undefined,
      );
      if (!utility.selected) eligible = false;
      else {
        utilityKey = utility.selected.key;
        if (t.score === undefined) score = utility.selected.score;
      }
    }
    const to =
      eligible && t.to
        ? typeof t.to === "function"
          ? [...t.to(snapshot.board, event)]
          : [...t.to]
        : undefined;
    const reason = typeof t.reason === "function" ? t.reason(snapshot.board, event) : t.reason;
    const trace = {
      key: t.key,
      from: [...t.from],
      ...(to ? { to } : null),
      event: t.event,
      eligible,
      score: eligible ? score : 0,
      index,
      ...(reason !== undefined ? { reason } : null),
      ...(utility ? { utility } : null),
    };
    traces.push(trace);
    if (eligible && (!selected || trace.score > selected.trace.score))
      selected = { trace, t, utilityKey };
  });
  if (!selected)
    return {
      snapshot: { state: stateBefore, board: snapshot.board, stepIndex: snapshot.stepIndex + 1 },
      trace: { stateBefore, stateAfter: stateBefore, event: event.type, transitions: traces },
    };
  const target = selected.trace.to ?? stateBefore;
  const common = stateBefore.findIndex((v, i) => target[i] !== v);
  const prefix = common === -1 ? Math.min(stateBefore.length, target.length) : common;
  for (let i = stateBefore.length; i > prefix; i--)
    stateMap.get(pathKey(stateBefore.slice(0, i)))?.onExit?.(snapshot.board, event);
  if (selected.utilityKey)
    selected.t.utility?.find((u) => u.key === selected?.utilityKey)?.do?.(snapshot.board, event);
  selected.t.do?.(snapshot.board, event);
  for (let i = prefix + 1; i <= target.length; i++)
    stateMap.get(pathKey(target.slice(0, i)))?.onEnter?.(snapshot.board, event);
  return {
    snapshot: { state: [...target], board: snapshot.board, stepIndex: snapshot.stepIndex + 1 },
    trace: {
      stateBefore,
      stateAfter: [...target],
      event: event.type,
      selectedTransition: selected.trace,
      transitions: traces,
    },
  };
}
