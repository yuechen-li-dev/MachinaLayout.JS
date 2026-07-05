import {
  defineDeusMachine,
  type DeusAction,
  type DeusEvent,
  type DeusMachine,
  type DeusPathInput,
  type DeusStatePath,
  type DeusStateRow,
  type DeusTransitionRow,
} from "../deus";

export type MachinaStateOptions<TBoard, TEvent extends DeusEvent> = {
  onEnter?: DeusAction<TBoard, TEvent>;
  onExit?: DeusAction<TBoard, TEvent>;
};

export type MachinaOnOptions<TBoard, TEvent extends DeusEvent> = {
  key?: string;
  when?: (board: TBoard, event: TEvent) => boolean;
  score?: number | ((board: TBoard, event: TEvent) => number);
  reason?: string | ((board: TBoard, event: TEvent) => string);
};

export type MachinaChooseCandidate<TBoard, TEvent extends DeusEvent> = {
  key: string;
  when?: (board: TBoard, event: TEvent) => boolean;
  score: number | ((board: TBoard, event: TEvent) => number);
  reason?: string | ((board: TBoard, event: TEvent) => string);
  do?: DeusAction<TBoard, TEvent>;
};

export type MachinaChooseOptions<TBoard, TEvent extends DeusEvent> = MachinaOnOptions<
  TBoard,
  TEvent
> & {
  hysteresis?: {
    previous: (board: TBoard) => string | undefined;
    margin: number;
  };
  do?: DeusAction<TBoard, TEvent>;
};

function copyPath(path: DeusStatePath): DeusStatePath {
  return [...path];
}

function pathKey(path: DeusStatePath): string {
  return path.join("/");
}

function generatedTransitionKey<TBoard, TEvent extends DeusEvent>(
  from: DeusStatePath,
  eventType: TEvent["type"],
  to: DeusPathInput | ((board: TBoard, event: TEvent) => DeusPathInput),
  suffix = "",
): string {
  const target = Array.isArray(to) ? pathKey(to) : typeof to === "string" ? to : "dynamic";
  return `${pathKey(from)}:${eventType}->${target}${suffix}`;
}

export function state<TBoard, TEvent extends DeusEvent>(
  path: DeusStatePath,
  options: MachinaStateOptions<TBoard, TEvent> = {},
): DeusStateRow<TBoard, TEvent> {
  return {
    path: copyPath(path),
    ...(options.onEnter ? { onEnter: options.onEnter } : null),
    ...(options.onExit ? { onExit: options.onExit } : null),
  };
}

export function on<TBoard, TEvent extends DeusEvent>(
  eventType: TEvent["type"],
  from: DeusStatePath,
  to: DeusPathInput | ((board: TBoard, event: TEvent) => DeusPathInput),
  action?: DeusAction<TBoard, TEvent>,
  options: MachinaOnOptions<TBoard, TEvent> = {},
): DeusTransitionRow<TBoard, TEvent> {
  return {
    key: options.key ?? generatedTransitionKey(from, eventType, to),
    event: eventType,
    from: copyPath(from),
    to: Array.isArray(to) ? copyPath(to) : to,
    ...(action ? { do: action } : null),
    ...(options.when ? { when: options.when } : null),
    ...(options.score !== undefined ? { score: options.score } : null),
    ...(options.reason !== undefined ? { reason: options.reason } : null),
  };
}

export function choose<TBoard, TEvent extends DeusEvent>(
  eventType: TEvent["type"],
  from: DeusStatePath,
  to: DeusPathInput | ((board: TBoard, event: TEvent) => DeusPathInput),
  candidates: readonly MachinaChooseCandidate<TBoard, TEvent>[],
  options: MachinaChooseOptions<TBoard, TEvent> = {},
): DeusTransitionRow<TBoard, TEvent> {
  return {
    key: options.key ?? generatedTransitionKey(from, eventType, to, ":utility"),
    event: eventType,
    from: copyPath(from),
    to: Array.isArray(to) ? copyPath(to) : to,
    utility: candidates.map((candidate) => ({ ...candidate })),
    ...(options.when ? { when: options.when } : null),
    ...(options.score !== undefined ? { score: options.score } : null),
    ...(options.reason !== undefined ? { reason: options.reason } : null),
    ...(options.hysteresis ? { hysteresis: options.hysteresis } : null),
    ...(options.do ? { do: options.do } : null),
  };
}

export function machine<TBoard, TEvent extends DeusEvent>(
  definition: DeusMachine<TBoard, TEvent>,
): DeusMachine<TBoard, TEvent> {
  return defineDeusMachine(definition);
}
