import { useCallback, useEffect, useRef, useState } from "react";

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

export type UseDeusMachineResult<TBoard, TEvent extends DeusEvent> = {
  snapshot: DeusSnapshot<TBoard>;
  board: TBoard;
  state: DeusStatePath;
  dispatch: (event: TEvent) => DeusStepResult<TBoard>;
  lastTrace: DeusStepTrace | null;
  reset: (board?: TBoard | (() => TBoard)) => void;
};

type InitialBoard<TBoard> = TBoard | (() => TBoard);

export type UseDeusMachineOptions<TStatePath extends DeusPathInput = DeusPathInput> = {
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
  options?: UseDeusMachineOptions<TStatePath>,
): UseDeusMachineResult<TBoard, TEvent> {
  const initialBoardRef = useRef(initialBoard);
  initialBoardRef.current = initialBoard;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const createSnapshot = useCallback(
    (board?: InitialBoard<TBoard>) => {
      const resolvedBoard = resolveInitialBoard(board ?? initialBoardRef.current);
      return optionsRef.current?.initialState !== undefined
        ? hydrateDeusSnapshot(machine, {
            board: resolvedBoard,
            statePath: optionsRef.current.initialState,
          })
        : createDeusSnapshot(machine, resolvedBoard);
    },
    [machine],
  );

  const [snapshot, setSnapshot] = useState<DeusSnapshot<TBoard>>(() => createSnapshot());
  const snapshotRef = useRef(snapshot);
  const [lastTrace, setLastTrace] = useState<DeusStepTrace | null>(null);

  const didMountRef = useRef(false);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const nextSnapshot = createSnapshot();
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
    setLastTrace(null);
  }, [createSnapshot]);

  const dispatch = useCallback(
    (event: TEvent) => {
      const result = stepDeusMachine(machine, snapshotRef.current, event);
      snapshotRef.current = result.snapshot;
      setSnapshot(result.snapshot);
      setLastTrace(result.trace);
      return result;
    },
    [machine],
  );

  const reset = useCallback(
    (board?: InitialBoard<TBoard>) => {
      const nextSnapshot = createSnapshot(board);
      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
      setLastTrace(null);
    },
    [createSnapshot],
  );

  return {
    snapshot,
    board: snapshot.board,
    state: snapshot.state,
    dispatch,
    lastTrace,
    reset,
  };
}
