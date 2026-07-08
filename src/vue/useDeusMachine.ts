import { computed, ref, type ComputedRef, type Ref } from "vue";

import {
  createDeusSnapshot,
  type DeusPathInput,
  hydrateDeusSnapshot,
  stepDeusMachine,
  type DeusEvent,
  type DeusMachine,
  type DeusSnapshot,
  type DeusStatePath,
  type DeusStepResult,
  type DeusStepTrace,
} from "../deus";

export type UseVueDeusMachineResult<TBoard, TEvent extends DeusEvent> = {
  snapshot: Ref<DeusSnapshot<TBoard>>;
  board: ComputedRef<TBoard>;
  state: ComputedRef<DeusStatePath>;
  dispatch: (event: TEvent) => DeusStepResult<TBoard>;
  lastTrace: Ref<DeusStepTrace | null>;
  reset: (board?: TBoard | (() => TBoard)) => void;
};

type InitialBoard<TBoard> = TBoard | (() => TBoard);

export type UseVueDeusMachineOptions<TStatePath extends DeusPathInput = DeusPathInput> = {
  initialState?: TStatePath;
};

function resolveInitialBoard<TBoard>(initialBoard: InitialBoard<TBoard>): TBoard {
  return typeof initialBoard === "function" ? (initialBoard as () => TBoard)() : initialBoard;
}

export function useDeusMachine<
  TBoard,
  TEvent extends DeusEvent,
  TStatePath extends DeusPathInput = DeusPathInput,
>(
  machine: DeusMachine<TBoard, TEvent> & {
    initial: TStatePath;
    states: readonly { path: TStatePath }[];
  },
  initialBoard: InitialBoard<TBoard>,
  options?: UseVueDeusMachineOptions<TStatePath>,
): UseVueDeusMachineResult<TBoard, TEvent> {
  const createSnapshot = (board?: InitialBoard<TBoard>) => {
    const resolvedBoard = resolveInitialBoard(board ?? initialBoard);
    return options?.initialState !== undefined
      ? hydrateDeusSnapshot(machine, {
          board: resolvedBoard,
          statePath: options.initialState,
        })
      : createDeusSnapshot(machine, resolvedBoard);
  };
  const snapshot = ref(createSnapshot()) as Ref<DeusSnapshot<TBoard>>;
  const lastTrace = ref<DeusStepTrace | null>(null) as Ref<DeusStepTrace | null>;

  const dispatch = (event: TEvent) => {
    const result = stepDeusMachine(machine, snapshot.value, event);
    snapshot.value = result.snapshot;
    lastTrace.value = result.trace;
    return result;
  };

  const reset = (board?: InitialBoard<TBoard>) => {
    snapshot.value = createSnapshot(board);
    lastTrace.value = null;
  };

  return {
    snapshot,
    board: computed(() => snapshot.value.board),
    state: computed(() => snapshot.value.state),
    dispatch,
    lastTrace,
    reset,
  };
}
