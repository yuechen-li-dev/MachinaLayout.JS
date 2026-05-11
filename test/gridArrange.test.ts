import { describe, expect, it } from "vitest";
import { MachinaLayoutError, flattenResolvedTree, lerpResolvedLayouts, resolveLayoutRows, toResolvedTree, type LayoutRow, type MachinaLayoutErrorCode } from "../src";

function expectCode(run: () => unknown, code: MachinaLayoutErrorCode): void {
  try { run(); throw new Error("expected throw"); } catch (error) {
    expect(error).toBeInstanceOf(MachinaLayoutError);
    expect((error as MachinaLayoutError).code).toBe(code);
  }
}

describe("grid arrange", () => {
  it("simple fixed placement + padding + spans + offset", () => {
    const r = resolveLayoutRows([
      { id: "root", frame: { kind: "root" }, arrange: { kind: "grid", columns: [{ kind: "fixed", size: 100 }, { kind: "fixed", size: 50 }], rows: [{ kind: "fixed", size: 40 }, { kind: "fixed", size: 60 }], columnGap: 10, rowGap: 5, padding: { top: 2, right: 4, bottom: 6, left: 8 } } },
      { id: "a", parent: "root", frame: { kind: "cell", row: 0, col: 0 }, offset: { x: 20 } },
      { id: "b", parent: "root", frame: { kind: "cell", row: 0, col: 1 } },
      { id: "c", parent: "root", frame: { kind: "cell", row: 1, col: 0, colSpan: 2 } },
    ], { x: 10, y: 20, width: 300, height: 200 });
    expect(r.nodes.a.rect).toEqual({ x: 38, y: 22, width: 100, height: 40 });
    expect(r.nodes.b.rect).toEqual({ x: 128, y: 22, width: 50, height: 40 });
    expect(r.nodes.c.rect).toEqual({ x: 18, y: 67, width: 160, height: 60 });
  });

  it("fill tracks: equal, weighted, mixed and no-fill trailing space", () => {
    const mk = (columns: any[]): number[] => {
      const r = resolveLayoutRows([
        { id: "root", frame: { kind: "root" }, arrange: { kind: "grid", columns, rows: [{ kind: "fixed", size: 10 }] } },
        { id: "a", parent: "root", frame: { kind: "cell", row: 0, col: 0 } },
        { id: "b", parent: "root", frame: { kind: "cell", row: 0, col: 1 } },
        { id: "c", parent: "root", frame: { kind: "cell", row: 0, col: 2 } },
      ], { x: 0, y: 0, width: 300, height: 20 });
      return [r.nodes.a.rect.width, r.nodes.b.rect.width, r.nodes.c.rect.width];
    };
    expect(mk([{ kind: "fill" }, { kind: "fill" }, { kind: "fill" }]).map((n) => Math.round(n))).toEqual([100, 100, 100]);
    expect(mk([{ kind: "fill", weight: 1 }, { kind: "fill", weight: 2 }, { kind: "fixed", size: 0 }])[0]).toBeCloseTo(100);

    const mixed = resolveLayoutRows([
      { id: "root", frame: { kind: "root" }, arrange: { kind: "grid", columns: [{ kind: "fixed", size: 50 }, { kind: "fill", weight: 1 }, { kind: "fixed", size: 70 }], rows: [{ kind: "fixed", size: 10 }], columnGap: 10 } },
      { id: "a", parent: "root", frame: { kind: "cell", row: 0, col: 0 } },
      { id: "b", parent: "root", frame: { kind: "cell", row: 0, col: 1 } },
      { id: "c", parent: "root", frame: { kind: "cell", row: 0, col: 2 } },
    ], { x: 0, y: 0, width: 300, height: 20 });
    expect(mixed.nodes.a.rect).toEqual({ x: 0, y: 0, width: 50, height: 10 });
    expect(mixed.nodes.b.rect.width).toBeCloseTo(160);
    expect(mixed.nodes.c.rect.x).toBeCloseTo(230);
  });

  it("errors and metadata", () => {
    expectCode(() => resolveLayoutRows([{ id: "root", frame: { kind: "root" } }, { id: "child", parent: "root", frame: { kind: "cell", row: 0, col: 0 } }], { x: 0, y: 0, width: 10, height: 10 }), "CellFrameWithoutGrid");
    expectCode(() => resolveLayoutRows([{ id: "root", frame: { kind: "root" }, arrange: { kind: "stack", axis: "horizontal" } }, { id: "child", parent: "root", frame: { kind: "cell", row: 0, col: 0 } }], { x: 0, y: 0, width: 10, height: 10 }), "StackChildMustBeFixed");
    expectCode(() => resolveLayoutRows([{ id: "root", frame: { kind: "root" }, arrange: { kind: "grid", columns: [{ kind: "fixed", size: 1 }], rows: [{ kind: "fixed", size: 1 }] } }, { id: "child", parent: "root", frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 } }], { x: 0, y: 0, width: 10, height: 10 }), "GridChildMustBeCell");
    expectCode(() => resolveLayoutRows([{ id: "root", frame: { kind: "root" }, arrange: { kind: "grid", columns: [], rows: [{ kind: "fixed", size: 1 }] } }], { x: 0, y: 0, width: 10, height: 10 }), "InvalidGridTrack");
    expectCode(() => resolveLayoutRows([{ id: "root", frame: { kind: "root" }, arrange: { kind: "grid", columns: [{ kind: "fixed", size: 100 }], rows: [{ kind: "fixed", size: 1 }] } }], { x: 0, y: 0, width: 10, height: 10 }), "GridOverflow");
    expectCode(() => resolveLayoutRows([{ id: "root", frame: { kind: "root" }, arrange: { kind: "grid", columns: [{ kind: "fixed", size: 1 }], rows: [{ kind: "fixed", size: 1 }], padding: { top: 0, right: 20, bottom: 0, left: 20 } } }], { x: 0, y: 0, width: 10, height: 10 }), "GridContentNegative");

    const resolved = resolveLayoutRows([
      { id: "root", frame: { kind: "root" }, arrange: { kind: "grid", columns: [{ kind: "fixed", size: 50 }], rows: [{ kind: "fixed", size: 50 }] } },
      { id: "child", parent: "root", z: 5, frame: { kind: "cell", row: 0, col: 0 } },
    ], { x: 0, y: 0, width: 100, height: 100 });
    const tree = toResolvedTree(resolved);
    const flat = flattenResolvedTree(tree);
    expect(tree.arrange?.kind).toBe("grid");
    expect(flat[1].frame.kind).toBe("cell");
    expect(flat[1].z).toBe(5);
  });

  it("lerp works with grid-resolved docs", () => {
    const a = resolveLayoutRows([
      { id: "root", frame: { kind: "root" }, arrange: { kind: "grid", columns: [{ kind: "fixed", size: 100 }], rows: [{ kind: "fixed", size: 10 }] } },
      { id: "c", parent: "root", frame: { kind: "cell", row: 0, col: 0 } },
    ], { x: 0, y: 0, width: 100, height: 10 });
    const b = resolveLayoutRows([
      { id: "root", frame: { kind: "root" }, arrange: { kind: "grid", columns: [{ kind: "fixed", size: 200 }], rows: [{ kind: "fixed", size: 10 }] } },
      { id: "c", parent: "root", frame: { kind: "cell", row: 0, col: 0 } },
    ], { x: 0, y: 0, width: 200, height: 10 });
    const m = lerpResolvedLayouts(a, b, 0.5);
    expect(m.nodes.c.rect.width).toBe(150);
  });
});
