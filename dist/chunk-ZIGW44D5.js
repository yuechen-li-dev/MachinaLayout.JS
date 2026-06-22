import {
  createDeusSnapshot,
  stepDeusMachine
} from "./chunk-2ZQ2RFFI.js";

// src/react-common/useDeusMachine.ts
import { useCallback, useEffect, useRef, useState } from "react";
function resolveInitialBoard(initialBoard) {
  return typeof initialBoard === "function" ? initialBoard() : initialBoard;
}
function useDeusMachine(machine, initialBoard) {
  const initialBoardRef = useRef(initialBoard);
  initialBoardRef.current = initialBoard;
  const createSnapshot = useCallback(
    (board) => createDeusSnapshot(machine, resolveInitialBoard(board ?? initialBoardRef.current)),
    [machine]
  );
  const [snapshot, setSnapshot] = useState(() => createSnapshot());
  const snapshotRef = useRef(snapshot);
  const [lastTrace, setLastTrace] = useState(null);
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
    (event) => {
      const result = stepDeusMachine(machine, snapshotRef.current, event);
      snapshotRef.current = result.snapshot;
      setSnapshot(result.snapshot);
      setLastTrace(result.trace);
      return result;
    },
    [machine]
  );
  const reset = useCallback(
    (board) => {
      const nextSnapshot = createSnapshot(board);
      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
      setLastTrace(null);
    },
    [createSnapshot]
  );
  return {
    snapshot,
    board: snapshot.board,
    state: snapshot.state,
    dispatch,
    lastTrace,
    reset
  };
}

export {
  useDeusMachine
};
