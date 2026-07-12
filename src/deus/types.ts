export class DeusMachinaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DeusMachinaError";
  }
}

export type UtilityScore<TContext> = number | ((context: TContext) => number);
export type UtilityCandidate<TContext, TKey extends string = string> = {
  key: TKey;
  when?: (context: TContext) => boolean;
  score: UtilityScore<TContext>;
  reason?: string | ((context: TContext) => string);
};
export type UtilityCandidateResult<TKey extends string = string> = {
  key: TKey;
  eligible: boolean;
  score: number;
  index: number;
  reason?: string;
};
export type UtilityJudgment<TKey extends string = string> = {
  selected: UtilityCandidateResult<TKey> | null;
  candidates: UtilityCandidateResult<TKey>[];
};
export type JudgeUtilityOptions<TKey extends string = string> = {
  previousKey?: TKey;
  hysteresis?: number;
};

export type DeusStatePath = readonly string[];
export type DeusPathInput = DeusStatePath | string;
export type DeusGotoTarget = { readonly kind: "goto"; readonly state: DeusPathInput };
export type DeusPushTarget = { readonly kind: "push"; readonly state: DeusPathInput };
export type DeusPopTarget = { readonly kind: "pop" };
export type DeusStayTarget = { readonly kind: "stay" };
export type DeusControlTarget = DeusGotoTarget | DeusPushTarget | DeusPopTarget | DeusStayTarget;
export type DeusTransitionTarget = DeusPathInput | DeusControlTarget | undefined;
export type DeusStackFrame = { readonly returnState: DeusStatePath };
export type DeusEvent = { type: string };
export type DeusAction<TBoard, TEvent extends DeusEvent> = (board: TBoard, event: TEvent) => void;
export type DeusStateRow<TBoard, TEvent extends DeusEvent> = {
  path: DeusStatePath;
  onEnter?: DeusAction<TBoard, TEvent>;
  onExit?: DeusAction<TBoard, TEvent>;
};
export type DeusUtilityTransitionCandidate<
  TBoard,
  TEvent extends DeusEvent,
  TKey extends string = string,
> = {
  key: TKey;
  when?: (board: TBoard, event: TEvent) => boolean;
  score: number | ((board: TBoard, event: TEvent) => number);
  do?: DeusAction<TBoard, TEvent>;
  reason?: string | ((board: TBoard, event: TEvent) => string);
};
export type DeusTransitionRow<TBoard, TEvent extends DeusEvent> = {
  key: string;
  from: DeusStatePath;
  event?: TEvent["type"];
  to?: DeusTransitionTarget | ((board: TBoard, event: TEvent) => DeusTransitionTarget);
  when?: (board: TBoard, event: TEvent) => boolean;
  score?: number | ((board: TBoard, event: TEvent) => number);
  do?: DeusAction<TBoard, TEvent>;
  reason?: string | ((board: TBoard, event: TEvent) => string);
  utility?: readonly DeusUtilityTransitionCandidate<TBoard, TEvent>[];
  hysteresis?: { previous: (board: TBoard) => string | undefined; margin: number };
};
export type DeusEventOfType<TEvent extends DeusEvent, TType extends TEvent["type"]> = Extract<
  TEvent,
  { type: TType }
>;
export type DeusScopedTransitionOptions<
  TBoard,
  TEvent extends DeusEvent,
  TType extends TEvent["type"],
> = {
  key?: string;
  to?:
    | DeusTransitionTarget
    | ((board: TBoard, event: DeusEventOfType<TEvent, TType>) => DeusTransitionTarget);
  when?: (board: TBoard, event: DeusEventOfType<TEvent, TType>) => boolean;
  score?: number | ((board: TBoard, event: DeusEventOfType<TEvent, TType>) => number);
  do?: (board: TBoard, event: DeusEventOfType<TEvent, TType>) => void;
  reason?: string | ((board: TBoard, event: DeusEventOfType<TEvent, TType>) => string);
  utility?: readonly DeusUtilityTransitionCandidate<TBoard, DeusEventOfType<TEvent, TType>>[];
  hysteresis?: { previous: (board: TBoard) => string | undefined; margin: number };
};
type DeusScopedTransitionRowForType<
  TBoard,
  TEvent extends DeusEvent,
  TType extends TEvent["type"],
> = Readonly<{
  kind: "deusScopedTransition";
  event: TType;
}> &
  Readonly<DeusScopedTransitionOptions<TBoard, TEvent, TType>>;
export type DeusScopedTransitionRow<
  TBoard,
  TEvent extends DeusEvent,
  TType extends TEvent["type"] = TEvent["type"],
> = TType extends TEvent["type"] ? DeusScopedTransitionRowForType<TBoard, TEvent, TType> : never;
export type DeusTransitionScope<TBoard, TEvent extends DeusEvent> = Readonly<{
  kind: "deusTransitionScope";
  from: DeusPathInput;
  rows: readonly DeusScopedTransitionRow<TBoard, TEvent>[];
}>;
/** An explicit multi-segment path relative to an M.workflow root. */
export type DeusWorkflowRelativePath = Readonly<{
  kind: "deusWorkflowRelativePath";
  segments: DeusStatePath;
}>;
export type DeusWorkflowPathInput = string | DeusStatePath | DeusWorkflowRelativePath;
export type DeusWorkflowScopeBuilder<TBoard, TEvent extends DeusEvent> = (
  from: DeusWorkflowPathInput,
  rows: readonly DeusScopedTransitionRow<TBoard, TEvent>[],
) => DeusTransitionScope<TBoard, TEvent>;
export type DeusWorkflowOnBuilder<TBoard, TEvent extends DeusEvent> = <
  TType extends TEvent["type"],
>(
  event: TType,
  options?: DeusScopedTransitionOptions<TBoard, TEvent, TType>,
) => DeusScopedTransitionRow<TBoard, TEvent, TType>;
export type DeusWorkflowGotoBuilder = (state: DeusWorkflowPathInput) => DeusGotoTarget;
export type DeusWorkflowPushBuilder = (state: DeusWorkflowPathInput) => DeusPushTarget;
export type DeusWorkflowRelativePathBuilder = (
  ...segments: readonly [string, ...string[]] | [DeusStatePath]
) => DeusWorkflowRelativePath;
export type DeusWorkflowAuthoringContext<TBoard, TEvent extends DeusEvent> = Readonly<{
  scope: DeusWorkflowScopeBuilder<TBoard, TEvent>;
  on: DeusWorkflowOnBuilder<TBoard, TEvent>;
  goto: DeusWorkflowGotoBuilder;
  push: DeusWorkflowPushBuilder;
  pop: () => DeusPopTarget;
  stay: () => DeusStayTarget;
  relative: DeusWorkflowRelativePathBuilder;
}>;
declare const deusWorkflowTypes: unique symbol;
export type DeusWorkflowDefinition<TBoard, TEvent extends DeusEvent> = Readonly<{
  kind: "deusWorkflow";
  root: DeusStatePath;
  scopes: readonly DeusTransitionScope<TBoard, TEvent>[];
  readonly [deusWorkflowTypes]?: { readonly board: TBoard; readonly event: TEvent };
}>;
export type DeusMachine<TBoard, TEvent extends DeusEvent> = {
  initial: DeusStatePath;
  states: readonly DeusStateRow<TBoard, TEvent>[];
  transitions: readonly DeusTransitionRow<TBoard, TEvent>[];
};
export type DeusSnapshot<TBoard> = {
  state: DeusStatePath;
  board: TBoard;
  stack: readonly DeusStackFrame[];
  stepIndex: number;
};
export type CreateDeusSnapshotOptions<TBoard> = {
  board: TBoard;
  statePath?: DeusPathInput;
  stack?: readonly DeusStackFrame[];
  runEnter?: boolean;
};
export type DeusTransitionTrace = {
  key: string;
  from: DeusStatePath;
  to?: DeusStatePath;
  event?: string;
  eligible: boolean;
  score: number;
  index: number;
  reason?: string;
  utility?: UtilityJudgment<string>;
};
export type DeusStepTrace = {
  stateBefore: DeusStatePath;
  stateAfter: DeusStatePath;
  event: string;
  searchedTransitionPaths?: DeusStatePath[];
  transitionOwnerPath?: DeusStatePath;
  usedParentTransition?: boolean;
  selectedTransition?: DeusTransitionTrace;
  transitions: DeusTransitionTrace[];
};
export type DeusStepResult<TBoard> = { snapshot: DeusSnapshot<TBoard>; trace: DeusStepTrace };
