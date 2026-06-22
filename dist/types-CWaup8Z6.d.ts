declare class DeusMachinaError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
type UtilityScore<TContext> = number | ((context: TContext) => number);
type UtilityCandidate<TContext, TKey extends string = string> = {
    key: TKey;
    when?: (context: TContext) => boolean;
    score: UtilityScore<TContext>;
    reason?: string | ((context: TContext) => string);
};
type UtilityCandidateResult<TKey extends string = string> = {
    key: TKey;
    eligible: boolean;
    score: number;
    index: number;
    reason?: string;
};
type UtilityJudgment<TKey extends string = string> = {
    selected: UtilityCandidateResult<TKey> | null;
    candidates: UtilityCandidateResult<TKey>[];
};
type JudgeUtilityOptions<TKey extends string = string> = {
    previousKey?: TKey;
    hysteresis?: number;
};
type DeusStatePath = readonly string[];
type DeusEvent = {
    type: string;
};
type DeusAction<TBoard, TEvent extends DeusEvent> = (board: TBoard, event: TEvent) => void;
type DeusStateRow<TBoard, TEvent extends DeusEvent> = {
    path: DeusStatePath;
    onEnter?: DeusAction<TBoard, TEvent>;
    onExit?: DeusAction<TBoard, TEvent>;
};
type DeusUtilityTransitionCandidate<TBoard, TEvent extends DeusEvent, TKey extends string = string> = {
    key: TKey;
    when?: (board: TBoard, event: TEvent) => boolean;
    score: number | ((board: TBoard, event: TEvent) => number);
    do?: DeusAction<TBoard, TEvent>;
    reason?: string | ((board: TBoard, event: TEvent) => string);
};
type DeusTransitionRow<TBoard, TEvent extends DeusEvent> = {
    key: string;
    from: DeusStatePath;
    event?: TEvent["type"];
    to?: DeusStatePath | ((board: TBoard, event: TEvent) => DeusStatePath);
    when?: (board: TBoard, event: TEvent) => boolean;
    score?: number | ((board: TBoard, event: TEvent) => number);
    do?: DeusAction<TBoard, TEvent>;
    reason?: string | ((board: TBoard, event: TEvent) => string);
    utility?: readonly DeusUtilityTransitionCandidate<TBoard, TEvent>[];
    hysteresis?: {
        previous: (board: TBoard) => string | undefined;
        margin: number;
    };
};
type DeusMachine<TBoard, TEvent extends DeusEvent> = {
    initial: DeusStatePath;
    states: readonly DeusStateRow<TBoard, TEvent>[];
    transitions: readonly DeusTransitionRow<TBoard, TEvent>[];
};
type DeusSnapshot<TBoard> = {
    state: DeusStatePath;
    board: TBoard;
    stepIndex: number;
};
type DeusTransitionTrace = {
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
type DeusStepTrace = {
    stateBefore: DeusStatePath;
    stateAfter: DeusStatePath;
    event: string;
    selectedTransition?: DeusTransitionTrace;
    transitions: DeusTransitionTrace[];
};
type DeusStepResult<TBoard> = {
    snapshot: DeusSnapshot<TBoard>;
    trace: DeusStepTrace;
};

export { type DeusEvent as D, type JudgeUtilityOptions as J, type UtilityCandidate as U, type DeusSnapshot as a, type DeusStatePath as b, type DeusStepResult as c, type DeusStepTrace as d, type DeusMachine as e, type UtilityJudgment as f, type DeusAction as g, DeusMachinaError as h, type DeusStateRow as i, type DeusTransitionRow as j, type DeusTransitionTrace as k, type DeusUtilityTransitionCandidate as l, type UtilityCandidateResult as m, type UtilityScore as n };
