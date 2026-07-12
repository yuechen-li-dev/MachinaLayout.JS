import { describe, expect, it } from "vitest";

import {
  createMachinaDebugOverlayMachine,
  getMachinaDebugOverlayBehavior,
  type DeusMachine,
} from "../../src/deus";
import { useDeusMachine } from "../../src/vue";
import { M } from "../../src/machina";

type Board = { count: number };
type Event = { type: "inc" };
const machine: DeusMachine<Board, Event> = {
  initial: ["idle"],
  states: [{ path: ["idle"] }, { path: ["active"] }],
  transitions: [
    { key: "inc", from: ["idle"], event: "inc", to: ["active"], do: (b) => b.count++ },
    { key: "active.inc", from: ["active"], event: "inc", do: (b) => b.count++ },
  ],
};

describe("Vue useDeusMachine", () => {
  it("initializes, dispatches, tracks trace, reflects mutation, and resets", () => {
    const hook = useDeusMachine(machine, () => ({ count: 0 }));
    expect(hook.snapshot.value.stepIndex).toBe(0);
    expect(hook.board.value.count).toBe(0);
    const result = hook.dispatch({ type: "inc" });
    expect(result.snapshot.state).toEqual(["active"]);
    expect(hook.snapshot.value.stepIndex).toBe(1);
    expect(hook.board.value.count).toBe(1);
    expect(hook.lastTrace.value?.selectedTransition?.key).toBe("inc");
    hook.reset({ count: 8 });
    expect(hook.board.value.count).toBe(8);
    expect(hook.state.value).toEqual(["idle"]);
    expect(hook.lastTrace.value).toBeNull();
  });

  it("drives the debug overlay machine", () => {
    const hook = useDeusMachine(createMachinaDebugOverlayMachine(), {
      mode: "collapsed",
      labels: true,
      borders: true,
    });
    hook.dispatch({ type: "showOverlay" });
    expect(getMachinaDebugOverlayBehavior(hook.board.value).visible).toBe(true);
  });

  it("exposes push/pop stack state", () => {
    const stackMachine: DeusMachine<Board, { type: "push" | "pop" }> = {
      initial: ["idle"],
      states: [{ path: ["idle"] }, { path: ["child"] }],
      transitions: [
        { key: "push", from: ["idle"], event: "push", to: M.push(["child"]) },
        { key: "pop", from: ["child"], event: "pop", to: M.pop() },
      ],
    };
    const hook = useDeusMachine(stackMachine, { count: 0 });
    hook.dispatch({ type: "push" });
    expect(hook.stack.value).toEqual([{ returnState: ["idle"] }]);
    hook.dispatch({ type: "pop" });
    expect(hook.stack.value).toEqual([]);
    expect(hook.state.value).toEqual(["idle"]);
  });
});
