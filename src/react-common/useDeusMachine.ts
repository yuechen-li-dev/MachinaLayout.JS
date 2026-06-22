import { useCallback, useEffect, useRef, useState } from "react";

import {
  createDeusSnapshot,
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

function resolveInitialBoard<TBoard>(initialBoard: InitialBoard<TBoard>): TBoard {
  return typeof initialBoard === "function" ? (initialBoard as () => TBoard)() : initialBoard;
}

export function useDeusMachine<TBoard, TEvent extends DeusEvent>(
  machine: DeusMachine<TBoard, TEvent>,
  initialBoard: InitialBoard<TBoard>,
): UseDeusMachineResult<TBoard, TEvent> {
  const initialBoardRef = useRef(initialBoard);
  initialBoardRef.current = initialBoard;

  const createSnapshot = useCallback(
    (board?: InitialBoard<TBoard>) =>
      createDeusSnapshot(machine, resolveInitialBoard(board ?? initialBoardRef.current)),
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
