import { describe, expect, it } from "vitest";
import { MachinaAuthoringError, cell, fixed } from "../../src/machina";

function expectCode(fn: () => unknown, code: string) {
  expect(fn).toThrow(MachinaAuthoringError);
  try {
    fn();
  } catch (error) {
    expect((error as MachinaAuthoringError).code).toBe(code);
  }
}

describe("machina grid cell", () => {
  it("lowers explicit cells and spans", () => {
    expect(cell("c", 2, 1, { colSpan: 3, rowSpan: 2, view: "Card" }).rows()).toEqual([
      { id: "c", frame: { kind: "cell", col: 2, row: 1, colSpan: 3, rowSpan: 2 }, view: "Card" },
    ]);
  });

  it("rejects invalid coordinates and spans", () => {
    expectCode(() => cell("c", -1, 0), "InvalidGridArea");
    expectCode(() => cell("c", 0.5, 0), "InvalidGridArea");
    expectCode(() => cell("c", 0, -1), "InvalidGridArea");
    expectCode(() => cell("c", 0, 0, { colSpan: 0 }), "InvalidGridArea");
    expectCode(() => cell("c", 0, 0, { rowSpan: 1.5 }), "InvalidGridArea");
  });

  it("injects parents and propagates stack axis to children", () => {
    const rows = cell("host", 0, 0, { arrange: { kind: "stack", axis: "vertical" } }, [
      fixed("child", 24),
    ]).rows();
    expect(rows[1]).toMatchObject({
      id: "child",
      parent: "host",
      frame: { kind: "fixed", height: 24 },
    });
  });
});
