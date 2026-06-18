import { U as UtilityCandidate, J as JudgeUtilityOptions, a as UtilityJudgment, D as DeusEvent, b as DeusMachine, c as DeusSnapshot, d as DeusStatePath, e as DeusStepTrace, f as DeusStepResult } from '../debugOverlay-pJpj0n5H.js';
export { g as DeusAction, h as DeusMachinaError, i as DeusStateRow, j as DeusTransitionRow, k as DeusTransitionTrace, l as DeusUtilityTransitionCandidate, M as MachinaDebugOverlayBehavior, m as MachinaDebugOverlayBoard, n as MachinaDebugOverlayEvent, o as MachinaDebugOverlayMode, p as UtilityCandidateResult, q as UtilityScore, r as createMachinaDebugOverlayMachine, s as getMachinaDebugOverlayBehavior } from '../debugOverlay-pJpj0n5H.js';

declare function judgeUtility<TContext, TKey extends string = string>(context: TContext, candidates: readonly UtilityCandidate<TContext, TKey>[], options?: JudgeUtilityOptions<TKey>): UtilityJudgment<TKey>;

declare function formatDeusPath(path: DeusStatePath): string;
declare function sameDeusPath(a: DeusStatePath, b: DeusStatePath): boolean;
declare function isDeusAncestorPath(ancestor: DeusStatePath, path: DeusStatePath): boolean;
declare function defineDeusMachine<TBoard, TEvent extends DeusEvent>(machine: DeusMachine<TBoard, TEvent>): DeusMachine<TBoard, TEvent>;
declare function createDeusSnapshot<TBoard, TEvent extends DeusEvent>(machine: DeusMachine<TBoard, TEvent>, board: TBoard): DeusSnapshot<TBoard>;
declare function stepDeusMachine<TBoard, TEvent extends DeusEvent>(machine: DeusMachine<TBoard, TEvent>, snapshot: DeusSnapshot<TBoard>, event: NoInfer<TEvent>): DeusStepResult<TBoard>;
declare function formatDeusStepTrace(trace: DeusStepTrace): string;

export { DeusEvent, DeusMachine, DeusSnapshot, DeusStatePath, DeusStepResult, DeusStepTrace, JudgeUtilityOptions, UtilityCandidate, UtilityJudgment, createDeusSnapshot, defineDeusMachine, formatDeusPath, formatDeusStepTrace, isDeusAncestorPath, judgeUtility, sameDeusPath, stepDeusMachine };
