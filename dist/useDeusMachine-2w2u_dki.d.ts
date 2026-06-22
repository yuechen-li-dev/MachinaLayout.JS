import { D as DeusEvent, a as DeusSnapshot, b as DeusStatePath, c as DeusStepResult, d as DeusStepTrace, e as DeusMachine } from './types-CWaup8Z6.js';

type UseDeusMachineResult<TBoard, TEvent extends DeusEvent> = {
    snapshot: DeusSnapshot<TBoard>;
    board: TBoard;
    state: DeusStatePath;
    dispatch: (event: TEvent) => DeusStepResult<TBoard>;
    lastTrace: DeusStepTrace | null;
    reset: (board?: TBoard | (() => TBoard)) => void;
};
type InitialBoard<TBoard> = TBoard | (() => TBoard);
declare function useDeusMachine<TBoard, TEvent extends DeusEvent>(machine: DeusMachine<TBoard, TEvent>, initialBoard: InitialBoard<TBoard>): UseDeusMachineResult<TBoard, TEvent>;

export { type UseDeusMachineResult as U, useDeusMachine as u };
