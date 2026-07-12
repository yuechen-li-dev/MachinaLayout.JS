import { describe, expect, it } from "vitest";

import {
  createDeusSnapshot,
  defineDeusMachine,
  stepDeusMachine,
  transitionsFromScopes,
  type DeusTransitionRow,
} from "../../src/deus";
import { M } from "../../src/machina";

type Board = { live: boolean; log: string[]; value?: string };
type Event =
  | { type: "edit"; value: string }
  | { type: "openReview" }
  | { type: "back" }
  | { type: "cancel" }
  | { type: "selectDate" };

const setup = ["setup"] as const;
const review = ["setup", "review"] as const;
const cancelled = ["cancelled"] as const;

describe("scoped Deus transitions", () => {
  it("creates immutable authoring records and lowers them in source order", () => {
    const edit = M.on<Board, Event, "edit">("edit", {
      do: (board, event) => (board.value = event.value),
    });
    const scoped = M.scope<Board, Event>(setup, [
      edit,
      M.on<Board, Event, "openReview">("openReview", { to: M.push(review) }),
    ]);
    expect(Object.isFrozen(edit)).toBe(true);
    expect(Object.isFrozen(scoped)).toBe(true);
    expect(scoped).toMatchObject({ kind: "deusTransitionScope", from: setup });
    const transitions = transitionsFromScopes<Board, Event>([scoped]);
    const typed: DeusTransitionRow<Board, Event>[] = transitions;
    expect(typed).toMatchObject([
      { from: setup, event: "edit", do: edit.do },
      { from: setup, event: "openReview", to: { kind: "push", state: review } },
    ]);
    expect(transitions[0]?.from).not.toBe(scoped.from);
  });

  it("preserves stack controls, plain targets, and dynamic undefined targets", () => {
    const transitions = transitionsFromScopes<Board, Event>([
      M.scope<Board, Event>(setup, [
        M.on<Board, Event, "edit">("edit", {
          to: M.stay(),
          do: (board, event) => board.log.push(event.value),
        }),
        M.on<Board, Event, "openReview">("openReview", { to: M.push(review) }),
        M.on<Board, Event, "cancel">("cancel", { to: M.goto(cancelled) }),
        M.on<Board, Event, "selectDate">("selectDate", {
          to: (board) => (board.live ? M.goto(review) : undefined),
        }),
      ]),
      M.scope<Board, Event>(review, [M.on<Board, Event, "back">("back", { to: M.pop() })]),
    ]);
    const machine = defineDeusMachine<Board, Event>({
      initial: setup,
      states: [{ path: setup }, { path: review }, { path: cancelled }],
      transitions,
    });
    let snapshot = createDeusSnapshot(machine, { live: false, log: [] });
    snapshot = stepDeusMachine(machine, snapshot, { type: "edit", value: "x" }).snapshot;
    expect(snapshot).toMatchObject({ state: setup, stack: [], board: { log: ["x"] } });
    snapshot = stepDeusMachine(machine, snapshot, { type: "openReview" }).snapshot;
    expect(snapshot).toMatchObject({ state: review, stack: [{ returnState: setup }] });
    snapshot = stepDeusMachine(machine, snapshot, { type: "back" }).snapshot;
    expect(snapshot).toMatchObject({ state: setup, stack: [] });
    snapshot = stepDeusMachine(machine, snapshot, { type: "selectDate" }).snapshot;
    expect(snapshot.state).toEqual(setup);
    snapshot = stepDeusMachine(machine, snapshot, { type: "cancel" }).snapshot;
    expect(snapshot).toMatchObject({ state: cancelled, stack: [] });
  });

  it("rejects invalid scopes at lowering time", () => {
    expect(() => transitionsFromScopes([M.scope([] as never, []) as never])).toThrow(
      expect.objectContaining({ code: "DEUS_SCOPE_INVALID_FROM" }),
    );
    expect(() =>
      transitionsFromScopes([{ kind: "deusTransitionScope", from: setup, rows: [] } as never]),
    ).toThrow(expect.objectContaining({ code: "DEUS_SCOPE_EMPTY" }));
  });
});
