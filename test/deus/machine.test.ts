import { describe, expect, it } from "vitest";
import { createDeusSnapshot, defineDeusMachine, stepDeusMachine } from "../../src/deus";

type Board = { log: string[]; value?: string; previous?: string };
type Event = { type: "go" | "any" | "utility" };
const root = ["root"] as const;
const child = ["root", "child"] as const;
const other = ["root", "other"] as const;

describe("Deus machine", () => {
  it("validates initial, duplicate states, and duplicate transitions", () => {
    expect(() =>
      defineDeusMachine<Board, Event>({
        initial: ["missing"],
        states: [{ path: root }],
        transitions: [],
      }),
    ).toThrow();
    expect(() =>
      defineDeusMachine<Board, Event>({
        initial: root,
        states: [{ path: root }, { path: root }],
        transitions: [],
      }),
    ).toThrow();
    expect(() =>
      defineDeusMachine<Board, Event>({
        initial: root,
        states: [{ path: root }],
        transitions: [
          { key: "x", from: root },
          { key: "x", from: root },
        ],
      }),
    ).toThrow();
  });
  it("steps transitions, actions, scoring, fallback, utility, hooks, and dynamic targets", () => {
    const machine = defineDeusMachine<Board, Event>({
      initial: child,
      states: [
        {
          path: root,
          onExit: (b) => b.log.push("exit root"),
          onEnter: (b) => b.log.push("enter root"),
        },
        { path: child, onExit: (b) => b.log.push("exit child") },
        { path: other, onEnter: (b) => b.log.push("enter other") },
      ],
      transitions: [
        {
          key: "parent",
          from: root,
          event: "go",
          to: other,
          score: 2,
          do: (b) => b.log.push("parent"),
        },
        {
          key: "leaf",
          from: child,
          event: "go",
          to: other,
          score: 3,
          do: (b) => b.log.push("leaf"),
        },
        {
          key: "any",
          from: other,
          to: (b) => (b.value === "root" ? root : other),
          do: (b) => b.log.push("any"),
        },
        {
          key: "utility",
          from: other,
          event: "utility",
          utility: [
            { key: "u1", score: 1 },
            { key: "u2", score: 5, do: (b) => b.log.push("u2") },
          ],
        },
      ],
    });
    const board: Board = { log: [] };
    const r1 = stepDeusMachine(machine, createDeusSnapshot<Board, Event>(machine, board), {
      type: "go",
    });
    expect(r1.snapshot.state).toEqual(other);
    expect(r1.trace.selectedTransition?.key).toBe("leaf");
    expect(board.log).toEqual(["exit child", "leaf", "enter other"]);
    const r2 = stepDeusMachine(machine, r1.snapshot, { type: "utility" });
    expect(r2.trace.selectedTransition?.utility?.selected?.key).toBe("u2");
    expect(board.log).toContain("u2");
    board.value = "root";
    expect(stepDeusMachine(machine, r2.snapshot, { type: "any" }).snapshot.state).toEqual(root);
  });
  it("leaves state unchanged when no transition matches and does not mutate machine", () => {
    const raw = { initial: root, states: [{ path: root }], transitions: [] };
    const machine = defineDeusMachine<Board, Event>(raw);
    const result = stepDeusMachine(
      machine,
      createDeusSnapshot<Board, Event>(machine, { log: [] }),
      {
        type: "go",
      },
    );
    expect(result.snapshot.state).toEqual(root);
    expect(raw).toEqual({ initial: root, states: [{ path: root }], transitions: [] });
  });

  it("accepts consistent implicit ancestor states for shared transitions", () => {
    const machine = defineDeusMachine<Board, Event>({
      initial: child,
      states: [{ path: child }, { path: other }],
      transitions: [{ key: "parent", from: root, event: "go", to: other }],
    });

    expect(machine.states.map((state) => state.path)).toEqual(
      expect.arrayContaining([root, child]),
    );
    expect(
      stepDeusMachine(machine, createDeusSnapshot(machine, { log: [] }), { type: "go" }).snapshot
        .state,
    ).toEqual(other);
  });

  it("still rejects undeclared non-prefix transition owners", () => {
    expect(() =>
      defineDeusMachine<Board, Event>({
        initial: child,
        states: [{ path: child }, { path: other }],
        transitions: [{ key: "typo", from: ["setpu"], event: "go", to: other }],
      }),
    ).toThrow(expect.objectContaining({ code: "UnknownDeusStatePath" }));
  });

  it("preserves explicit parent states without duplicating them", () => {
    const machine = defineDeusMachine<Board, Event>({
      initial: child,
      states: [{ path: root }, { path: child }, { path: other }],
      transitions: [{ key: "parent", from: root, event: "go", to: other }],
    });

    expect(machine.states.filter((state) => state.path.join("/") === "root")).toHaveLength(1);
  });

  it("keeps state when a dynamic target returns undefined", () => {
    const machine = defineDeusMachine<Board, Event>({
      initial: root,
      states: [{ path: root }, { path: other }],
      transitions: [
        {
          key: "conditional",
          from: root,
          event: "go",
          to: (board) => (board.value === "move" ? other : undefined),
          do: (board) => board.log.push("ran"),
        },
      ],
    });
    const board: Board = { log: [] };

    const stay = stepDeusMachine(machine, createDeusSnapshot(machine, board), { type: "go" });
    expect(stay.snapshot.state).toEqual(root);
    expect(board.log).toEqual(["ran"]);

    board.value = "move";
    const move = stepDeusMachine(machine, stay.snapshot, { type: "go" });
    expect(move.snapshot.state).toEqual(other);
  });
});
