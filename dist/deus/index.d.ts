import { U as UtilityCandidate, J as JudgeUtilityOptions, a as UtilityJudgment, D as DeusEvent, b as DeusMachine, c as DeusSnapshot, d as DeusStatePath, e as DeusStepResult } from '../debugOverlay-ae9DqI9R.js';
export { f as DeusAction, g as DeusMachinaError, h as DeusStateRow, i as DeusStepTrace, j as DeusTransitionRow, k as DeusTransitionTrace, l as DeusUtilityTransitionCandidate, M as MachinaDebugOverlayBehavior, m as MachinaDebugOverlayBoard, n as MachinaDebugOverlayEvent, o as MachinaDebugOverlayMode, p as UtilityCandidateResult, q as UtilityScore, r as createMachinaDebugOverlayMachine, s as getMachinaDebugOverlayBehavior } from '../debugOverlay-ae9DqI9R.js';

declare function judgeUtility<TContext, TKey extends string = string>(context: TContext, candidates: readonly UtilityCandidate<TContext, TKey>[], options?: JudgeUtilityOptions<TKey>): UtilityJudgment<TKey>;

declare function formatDeusPath(path: DeusStatePath): string;
declare function sameDeusPath(a: DeusStatePath, b: DeusStatePath): boolean;
declare function isDeusAncestorPath(ancestor: DeusStatePath, path: DeusStatePath): boolean;
declare function defineDeusMachine<TBoard, TEvent extends DeusEvent>(machine: DeusMachine<TBoard, TEvent>): DeusMachine<TBoard, TEvent>;
declare function createDeusSnapshot<TBoard, TEvent extends DeusEvent>(machine: DeusMachine<TBoard, TEvent>, board: TBoard): DeusSnapshot<TBoard>;
declare function stepDeusMachine<TBoard, TEvent extends DeusEvent>(machine: DeusMachine<TBoard, TEvent>, snapshot: DeusSnapshot<TBoard>, event: NoInfer<TEvent>): DeusStepResult<TBoard>;

export { DeusEvent, DeusMachine, DeusSnapshot, DeusStatePath, DeusStepResult, JudgeUtilityOptions, UtilityCandidate, UtilityJudgment, createDeusSnapshot, defineDeusMachine, formatDeusPath, isDeusAncestorPath, judgeUtility, sameDeusPath, stepDeusMachine };
