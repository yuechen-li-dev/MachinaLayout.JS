import { describe, expect, it } from "vitest";
import {
  createDeusSnapshot,
  createMachinaDebugOverlayMachine,
  getMachinaDebugOverlayBehavior,
  stepDeusMachine,
  type MachinaDebugOverlayBoard,
} from "../../src/deus";

describe("Machina debug overlay machine", () => {
  it("drives modes and board flags", () => {
    const machine = createMachinaDebugOverlayMachine();
    const board: MachinaDebugOverlayBoard = { mode: "collapsed", labels: true, borders: true };
    let snapshot = createDeusSnapshot(machine, board);
    expect(snapshot.state).toEqual(["debugOverlay", "collapsed"]);
    snapshot = stepDeusMachine(machine, snapshot, { type: "showOverlay" }).snapshot;
    expect(board.mode).toBe("nonInteractiveOverlay");
    snapshot = stepDeusMachine(machine, snapshot, { type: "toggleLabels" }).snapshot;
    expect(board.labels).toBe(false);
    snapshot = stepDeusMachine(machine, snapshot, { type: "openPanel", nodeId: "a" }).snapshot;
    expect(board).toMatchObject({ mode: "interactivePanel", selectedNodeId: "a" });
    snapshot = stepDeusMachine(machine, snapshot, { type: "selectNode", nodeId: "b" }).snapshot;
    expect(board.selectedNodeId).toBe("b");
    snapshot = stepDeusMachine(machine, snapshot, { type: "toggleBorders" }).snapshot;
    expect(board.borders).toBe(false);
    stepDeusMachine(machine, snapshot, { type: "collapse" });
    expect(board).toMatchObject({ mode: "collapsed", selectedNodeId: undefined });
  });
  it("maps modes to behavior", () => {
    expect(
      getMachinaDebugOverlayBehavior({ mode: "collapsed", labels: true, borders: true }).visible,
    ).toBe(false);
    expect(
      getMachinaDebugOverlayBehavior({ mode: "nonInteractiveOverlay", labels: true, borders: true })
        .pointerEvents,
    ).toBe("none");
    expect(
      getMachinaDebugOverlayBehavior({ mode: "interactivePanel", labels: true, borders: true })
        .pointerEvents,
    ).toBe("auto");
  });
});
