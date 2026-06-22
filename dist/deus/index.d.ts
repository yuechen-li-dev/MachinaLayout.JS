import { U as UtilityCandidate, J as JudgeUtilityOptions, f as UtilityJudgment, D as DeusEvent, e as DeusMachine, a as DeusSnapshot, b as DeusStatePath, d as DeusStepTrace, c as DeusStepResult } from '../types-CWaup8Z6.js';
export { g as DeusAction, h as DeusMachinaError, i as DeusStateRow, j as DeusTransitionRow, k as DeusTransitionTrace, l as DeusUtilityTransitionCandidate, m as UtilityCandidateResult, n as UtilityScore } from '../types-CWaup8Z6.js';
export { a as MachinaDebugOverlayBehavior, b as MachinaDebugOverlayBoard, c as MachinaDebugOverlayEvent, M as MachinaDebugOverlayMode, d as createMachinaDebugOverlayMachine, g as getMachinaDebugOverlayBehavior } from '../debugOverlay-fWLv1cS7.js';

declare function judgeUtility<TContext, TKey extends string = string>(context: TContext, candidates: readonly UtilityCandidate<TContext, TKey>[], options?: JudgeUtilityOptions<TKey>): UtilityJudgment<TKey>;

declare function formatDeusPath(path: DeusStatePath): string;
declare function sameDeusPath(a: DeusStatePath, b: DeusStatePath): boolean;
declare function isDeusAncestorPath(ancestor: DeusStatePath, path: DeusStatePath): boolean;
declare function defineDeusMachine<TBoard, TEvent extends DeusEvent>(machine: DeusMachine<TBoard, TEvent>): DeusMachine<TBoard, TEvent>;
declare function createDeusSnapshot<TBoard, TEvent extends DeusEvent>(machine: DeusMachine<TBoard, TEvent>, board: TBoard): DeusSnapshot<TBoard>;
declare function stepDeusMachine<TBoard, TEvent extends DeusEvent>(machine: DeusMachine<TBoard, TEvent>, snapshot: DeusSnapshot<TBoard>, event: NoInfer<TEvent>): DeusStepResult<TBoard>;
declare function formatDeusStepTrace(trace: DeusStepTrace): string;

export { DeusEvent, DeusMachine, DeusSnapshot, DeusStatePath, DeusStepResult, DeusStepTrace, JudgeUtilityOptions, UtilityCandidate, UtilityJudgment, createDeusSnapshot, defineDeusMachine, formatDeusPath, formatDeusStepTrace, isDeusAncestorPath, judgeUtility, sameDeusPath, stepDeusMachine };
