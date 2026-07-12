import { describe, expect, it } from "vitest";

import {
  createDeusSnapshot,
  defineDeusMachine,
  stepDeusMachine,
  transitionsFromWorkflow,
  type DeusTransitionRow,
} from "../../src/deus";
import { M } from "../../src/machina";

type Board = { live: boolean; value?: string; log: string[] };
type Event =
  | { type: "edit"; value: string }
  | { type: "confirm" }
  | { type: "back" }
  | { type: "submit" };

const workflow = M.workflow<Board, Event>(
  ["booking"],
  ({ scope, on, goto, push, pop, stay, relative }) => [
    scope("selecting", [
      on("edit", {
        do: (board, event) => {
          board.value = event.value;
          board.log.push("edit");
        },
        to: (board) => (board.live ? goto("live") : stay()),
      }),
      on("confirm", { to: push("confirmation") }),
    ]),
    scope("confirmation", [
      on("back", { to: pop() }),
      on("submit", { to: goto(relative("done", "sent")) }),
    ]),
  ],
);

describe("workflow authoring", () => {
  it("creates immutable root-normalized records without retaining its factory", () => {
    expect(workflow).toMatchObject({
      kind: "deusWorkflow",
      root: ["booking"],
      scopes: [{ from: ["booking", "selecting"] }, { from: ["booking", "confirmation"] }],
    });
    expect(Object.isFrozen(workflow)).toBe(true);
    expect(Object.isFrozen(workflow.root)).toBe(true);
    expect(Object.keys(workflow)).not.toContain("factory");
    let calls = 0;
    M.workflow<Board, Event>(["once"], ({ scope, on }) => {
      calls += 1;
      return [scope("state", [on("submit", {})])];
    });
    expect(calls).toBe(1);
  });

  it("lowers deterministic absolute rows without mutation", () => {
    const rows = transitionsFromWorkflow(workflow);
    const typed: DeusTransitionRow<Board, Event>[] = rows;
    expect(typed).toHaveLength(4);
    expect(rows).toMatchObject([
      { from: ["booking", "selecting"], event: "edit" },
      {
        from: ["booking", "selecting"],
        event: "confirm",
        to: { kind: "push", state: ["booking", "confirmation"] },
      },
      { from: ["booking", "confirmation"], event: "back", to: { kind: "pop" } },
      {
        from: ["booking", "confirmation"],
        event: "submit",
        to: { kind: "goto", state: ["booking", "done", "sent"] },
      },
    ]);
    expect(workflow.scopes[0]?.from).toEqual(["booking", "selecting"]);
  });

  it("uses the existing runtime for stay, push/pop, dynamic targets, and reducers", () => {
    const selecting = ["booking", "selecting"] as const;
    const confirmation = ["booking", "confirmation"] as const;
    const live = ["booking", "live"] as const;
    const sent = ["booking", "done", "sent"] as const;
    const machine = defineDeusMachine<Board, Event>({
      initial: selecting,
      states: [{ path: selecting }, { path: confirmation }, { path: live }, { path: sent }],
      transitions: transitionsFromWorkflow(workflow),
    });
    let snapshot = createDeusSnapshot(machine, { live: false, log: [] });
    snapshot = stepDeusMachine(machine, snapshot, { type: "edit", value: "x" }).snapshot;
    expect(snapshot).toMatchObject({
      state: selecting,
      stack: [],
      board: { value: "x", log: ["edit"] },
    });
    snapshot = stepDeusMachine(machine, snapshot, { type: "confirm" }).snapshot;
    expect(snapshot).toMatchObject({ state: confirmation, stack: [{ returnState: selecting }] });
    snapshot = stepDeusMachine(machine, snapshot, { type: "back" }).snapshot;
    expect(snapshot).toMatchObject({ state: selecting, stack: [] });
    snapshot = stepDeusMachine(
      machine,
      { ...snapshot, board: { ...snapshot.board, live: true } },
      { type: "edit", value: "y" },
    ).snapshot;
    expect(snapshot.state).toEqual(live);
  });

  it("keeps absolute arrays absolute and rejects ambiguous local paths", () => {
    const absolute = M.workflow<Board, Event>(["booking"], ({ scope, on, goto }) => [
      scope(["global", "shutdown"], [on("submit", { to: goto(["global", "done"]) })]),
    ]);
    expect(transitionsFromWorkflow(absolute)[0]).toMatchObject({
      from: ["global", "shutdown"],
      to: { state: ["global", "done"] },
    });
    expect(() =>
      M.workflow<Board, Event>(["booking"], ({ scope, on }) => [scope("a/b", [on("submit", {})])]),
    ).toThrow(expect.objectContaining({ code: "DEUS_WORKFLOW_INVALID_RELATIVE_PATH" }));
    expect(() =>
      M.workflow<Board, Event>(["booking"], ({ scope, on }) => [scope("..", [on("submit", {})])]),
    ).toThrow(expect.objectContaining({ code: "DEUS_WORKFLOW_INVALID_RELATIVE_PATH" }));
  });
});
