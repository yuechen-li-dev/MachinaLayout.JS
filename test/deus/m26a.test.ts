import { describe, expect, it } from "vitest";
import {
  createDeusSnapshot,
  createMachinaDebugOverlayMachine,
  defineDeusMachine,
  DeusMachinaError,
  formatDeusPath,
  formatDeusStepTrace,
  getMachinaDebugOverlayBehavior,
  isDeusAncestorPath,
  judgeUtility,
  sameDeusPath,
  stepDeusMachine,
  type MachinaDebugOverlayBoard,
  type MachinaDebugOverlayEvent,
} from "../../src/deus";

type Board = { log: string[]; prefer?: string; previous?: string };
type Event = { type: "go" | "other" | "same" };

const root = ["root"] as const;
const a = ["root", "a"] as const;
const ax = ["root", "a", "x"] as const;
const ay = ["root", "a", "y"] as const;
const by = ["root", "b", "y"] as const;

describe("DeusMachina M26a contract", () => {
  it("hardens path helpers", () => {
    expect(formatDeusPath(["a", "b"])).toBe("a/b");
    expect(sameDeusPath(["a"], ["a"])).toBe(true);
    expect(sameDeusPath(["a"], ["a", "b"])).toBe(false);
    expect(isDeusAncestorPath(["a"], ["a", "b"])).toBe(true);
    expect(isDeusAncestorPath(["a", "b"], ["a", "b"])).toBe(true);
    expect(isDeusAncestorPath(["a", "c"], ["a", "b"])).toBe(false);
    expect(() => formatDeusPath([])).toThrow(DeusMachinaError);
    expect(() => formatDeusPath(["a", " "])).toThrow(/segment 1/);
    expect(() => formatDeusPath(["a", 1] as never)).toThrow(/segment 1/);
  });

  it("reports validation errors with Deus-specific codes", () => {
    const cases: Array<[unknown, string]> = [
      [null, "InvalidDeusMachine"],
      [{ initial: [], states: [], transitions: [] }, "InvalidDeusPath"],
      [{ initial: root, states: "no", transitions: [] }, "InvalidDeusMachine"],
      [{ initial: root, states: [{ path: root }], transitions: "no" }, "InvalidDeusMachine"],
      [
        { initial: root, states: [{ path: root }, { path: root }], transitions: [] },
        "DuplicateDeusStatePath",
      ],
      [{ initial: ["missing"], states: [{ path: root }], transitions: [] }, "UnknownDeusStatePath"],
      [
        { initial: root, states: [{ path: root }], transitions: [{ key: "", from: root }] },
        "InvalidDeusTransition",
      ],
      [
        {
          initial: root,
          states: [{ path: root }],
          transitions: [
            { key: "x", from: root },
            { key: "x", from: root },
          ],
        },
        "DuplicateDeusTransitionKey",
      ],
      [
        { initial: root, states: [{ path: root }], transitions: [{ key: "x", from: ["missing"] }] },
        "UnknownDeusStatePath",
      ],
      [
        {
          initial: root,
          states: [{ path: root }],
          transitions: [{ key: "x", from: root, to: ["missing"] }],
        },
        "UnknownDeusStatePath",
      ],
      [
        {
          initial: root,
          states: [{ path: root }],
          transitions: [{ key: "x", from: root, score: Number.POSITIVE_INFINITY }],
        },
        "InvalidDeusTransition",
      ],
      [
        {
          initial: root,
          states: [{ path: root }],
          transitions: [{ key: "x", from: root, hysteresis: { previous: "bad", margin: 1 } }],
        },
        "InvalidHysteresis",
      ],
      [
        {
          initial: root,
          states: [{ path: root }],
          transitions: [
            { key: "x", from: root, hysteresis: { previous: () => undefined, margin: -1 } },
          ],
        },
        "InvalidHysteresis",
      ],
      [
        {
          initial: root,
          states: [{ path: root }],
          transitions: [
            {
              key: "x",
              from: root,
              utility: [
                { key: "u", score: 1 },
                { key: "u", score: 2 },
              ],
            },
          ],
        },
        "DuplicateUtilityKey",
      ],
      [
        {
          initial: root,
          states: [{ path: root }],
          transitions: [{ key: "x", from: root, utility: [{ key: "u", score: Number.NaN }] }],
        },
        "InvalidUtilityScore",
      ],
    ];
    for (const [machine, code] of cases) {
      expect(() => defineDeusMachine(machine as never)).toThrow(expect.objectContaining({ code }));
    }
  });

  it("selects transitions by leaf-to-root order, score, event, when, and stable ties", () => {
    const machine = defineDeusMachine<Board, Event>({
      initial: ax,
      states: [{ path: root }, { path: a }, { path: ax }, { path: ay }],
      transitions: [
        { key: "parent-high", from: a, event: "go", to: ay, score: 5 },
        { key: "leaf-low", from: ax, event: "go", to: ay, score: 2 },
        { key: "leaf-when-false", from: ax, event: "go", when: () => false, score: 99 },
        { key: "root-any", from: root, to: ay, score: 5 },
      ],
    });
    const result = stepDeusMachine(machine, createDeusSnapshot(machine, { log: [] }), {
      type: "go",
    });
    expect(result.trace.transitions.map((t) => t.key)).toEqual([
      "leaf-low",
      "leaf-when-false",
      "parent-high",
      "root-any",
    ]);
    expect(result.trace.selectedTransition?.key).toBe("parent-high");
    expect(result.trace.transitions.find((t) => t.key === "leaf-when-false")).toMatchObject({
      eligible: false,
      score: 0,
    });
    expect(JSON.stringify(result.trace)).toContain("parent-high");
    expect(formatDeusStepTrace(result.trace)).toBe("root/a/x --go/parent-high--> root/a/y");
  });

  it("increments steps for no selection and validates dynamic target at runtime", () => {
    const machine = defineDeusMachine<Board, Event>({
      initial: root,
      states: [{ path: root }],
      transitions: [{ key: "dynamic", from: root, event: "go", to: () => ["missing"] }],
    });
    const snapshot = createDeusSnapshot(machine, { log: [] });
    const noMatch = stepDeusMachine(machine, snapshot, { type: "other" });
    expect(noMatch.snapshot.stepIndex).toBe(1);
    expect(noMatch.trace.selectedTransition).toBeUndefined();
    expect(() => stepDeusMachine(machine, snapshot, { type: "go" })).toThrow(
      expect.objectContaining({ code: "UnknownDeusStatePath" }),
    );
  });

  it("runs exit, utility action, transition action, and enter in documented order", () => {
    const machine = defineDeusMachine<Board, Event>({
      initial: ax,
      states: [
        { path: root },
        { path: a, onExit: (b) => b.log.push("exit a") },
        { path: ax, onExit: (b) => b.log.push("exit ax") },
        { path: ["root", "b"] },
        { path: by, onEnter: (b) => b.log.push("enter by") },
      ],
      transitions: [
        {
          key: "go",
          from: ax,
          event: "go",
          to: by,
          utility: [{ key: "u", score: 1, do: (b) => b.log.push("utility do") }],
          do: (b) => b.log.push("transition do"),
        },
      ],
    });
    const board = { log: [] };
    stepDeusMachine(machine, createDeusSnapshot(machine, board), { type: "go" });
    expect(board.log).toEqual(["exit ax", "exit a", "utility do", "transition do", "enter by"]);
  });

  it("does not run exit or enter for same-state transitions and propagates user errors", () => {
    const machine = defineDeusMachine<Board, Event>({
      initial: root,
      states: [
        { path: root, onExit: (b) => b.log.push("exit"), onEnter: (b) => b.log.push("enter") },
      ],
      transitions: [
        { key: "same", from: root, event: "same", to: root, do: (b) => b.log.push("do") },
        {
          key: "throw",
          from: root,
          event: "go",
          do: () => {
            throw new Error("boom");
          },
        },
      ],
    });
    const board = { log: [] };
    stepDeusMachine(machine, createDeusSnapshot(machine, board), { type: "same" });
    expect(board.log).toEqual(["do"]);
    expect(() =>
      stepDeusMachine(machine, createDeusSnapshot(machine, board), { type: "go" }),
    ).toThrow("boom");
  });

  it("hardens utility judgment edge cases", () => {
    const calls: string[] = [];
    const candidates = [
      {
        key: "old",
        when: () => true,
        score: () => {
          calls.push("old");
          return 10;
        },
      },
      {
        key: "blocked",
        when: () => false,
        score: () => {
          calls.push("blocked");
          return 100;
        },
      },
      { key: "new", score: 11 },
    ] as const;
    expect(judgeUtility({}, candidates, { previousKey: "old", hysteresis: 1 }).selected?.key).toBe(
      "new",
    );
    expect(judgeUtility({}, candidates, { previousKey: "old", hysteresis: 2 }).selected?.key).toBe(
      "old",
    );
    expect(
      judgeUtility({}, candidates, { previousKey: "missing", hysteresis: 999 }).selected?.key,
    ).toBe("new");
    expect(calls).not.toContain("blocked");
    expect(() => judgeUtility({}, [{ key: "bad", score: Number.POSITIVE_INFINITY }])).toThrow(
      expect.objectContaining({ code: "InvalidUtilityScore" }),
    );
    expect(() => judgeUtility({}, [{ key: "a", score: 1 }], { hysteresis: Number.NaN })).toThrow(
      expect.objectContaining({ code: "InvalidHysteresis" }),
    );
  });

  it("hardens utility transition selection and tracing", () => {
    const machine = defineDeusMachine<Board, Event>({
      initial: root,
      states: [{ path: root }, { path: a }],
      transitions: [
        { key: "plain", from: root, event: "go", to: a, score: 4 },
        {
          key: "utility",
          from: root,
          event: "go",
          to: a,
          utility: [
            { key: "u1", score: 1 },
            { key: "u2", score: 5, do: (b) => b.log.push("u2") },
          ],
          do: (b) => b.log.push("outer"),
        },
      ],
    });
    const board = { log: [] };
    const result = stepDeusMachine(machine, createDeusSnapshot(machine, board), { type: "go" });
    expect(result.trace.selectedTransition?.key).toBe("utility");
    expect(result.trace.selectedTransition?.utility?.candidates.map((c) => c.key)).toEqual([
      "u1",
      "u2",
    ]);
    expect(board.log).toEqual(["u2", "outer"]);
  });

  it("hardens debug overlay machine and behavior", () => {
    const machine = createMachinaDebugOverlayMachine();
    let board: MachinaDebugOverlayBoard = { mode: "collapsed", labels: false, borders: false };
    let snapshot = createDeusSnapshot(machine, { ...board });
    expect(snapshot.state).toEqual(["debugOverlay", "collapsed"]);
    let result = stepDeusMachine(machine, snapshot, { type: "showOverlay" });
    expect(result.trace.selectedTransition?.key).toBe("collapsed.showOverlay");
    expect(getMachinaDebugOverlayBehavior(result.snapshot.board)).toMatchObject({
      visible: true,
      pointerEvents: "none",
      consumesLayoutSpace: false,
      showLabels: false,
      showBorders: false,
    });
    result = stepDeusMachine(machine, result.snapshot, { type: "selectNode", nodeId: "ignored" });
    expect(result.trace.selectedTransition).toBeUndefined();
    snapshot = stepDeusMachine(machine, result.snapshot, {
      type: "openPanel",
      nodeId: "node",
    }).snapshot;
    expect(getMachinaDebugOverlayBehavior(snapshot.board)).toMatchObject({
      visible: true,
      pointerEvents: "auto",
      consumesLayoutSpace: true,
    });
    snapshot = stepDeusMachine(machine, snapshot, { type: "collapse" }).snapshot;
    expect(snapshot.board.selectedNodeId).toBeUndefined();
    board = { mode: "collapsed", labels: false, borders: false };
    const event: MachinaDebugOverlayEvent = { type: "showOverlay" };
    expect(event.type).toBe("showOverlay");
    expect(board.mode).toBe("collapsed");
  });
});
