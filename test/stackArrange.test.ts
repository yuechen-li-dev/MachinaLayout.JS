import { describe, expect, it } from "vitest";
import {
  MachinaLayoutError,
  resolveLayoutDocument,
  resolveLayoutRows,
  type LayoutDocument,
  type LayoutRow,
  type MachinaLayoutErrorCode,
} from "../src";

function expectCode(run: () => unknown, code: MachinaLayoutErrorCode): void {
  try {
    run();
    throw new Error("expected throw");
  } catch (error) {
    expect(error).toBeInstanceOf(MachinaLayoutError);
    expect((error as MachinaLayoutError).code).toBe(code);
  }
}

function baseDoc(arrange: LayoutDocument["nodes"][string]["arrange"]): LayoutDocument {
  return {
    rootId: "root",
    nodes: {
      root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
      parent: { id: "parent", frame: { kind: "absolute", x: 10, y: 20, width: 300, height: 40 }, arrange },
      a: { id: "a", frame: { kind: "fixed", width: 50, height: 20 } },
      b: { id: "b", frame: { kind: "fixed", width: 60, height: 20 } },
      c: { id: "c", frame: { kind: "fixed", width: 70, height: 20 } },
    },
    children: { root: ["parent"], parent: ["a", "b", "c"] },
  };
}

describe("stack arrange", () => {
  it("places horizontal children sequentially with defaults", () => {
    const resolved = resolveLayoutDocument(baseDoc({ kind: "stack", axis: "horizontal" }), { x: 0, y: 0, width: 1000, height: 800 });
    expect(resolved.nodes.parent.rect).toEqual({ x: 10, y: 20, width: 300, height: 40 });
    expect(resolved.nodes.a.rect).toEqual({ x: 10, y: 20, width: 50, height: 20 });
    expect(resolved.nodes.b.rect).toEqual({ x: 60, y: 20, width: 60, height: 20 });
    expect(resolved.nodes.c.rect).toEqual({ x: 120, y: 20, width: 70, height: 20 });
  });

  it("supports gap, padding, justify, align and space-between", () => {
    const resolved = resolveLayoutDocument(
      baseDoc({ kind: "stack", axis: "horizontal", gap: 10, padding: { top: 2, right: 4, bottom: 6, left: 8 }, justify: "space-between", align: "end" }),
      { x: 0, y: 0, width: 1000, height: 800 }
    );
    expect(resolved.nodes.a.rect).toEqual({ x: 18, y: 34, width: 50, height: 20 });
    expect(resolved.nodes.b.rect.x).toBe(122);
    expect(resolved.nodes.c.rect.x).toBe(236);

    const centered = resolveLayoutDocument(
      baseDoc({ kind: "stack", axis: "horizontal", justify: "center", align: "center" }),
      { x: 0, y: 0, width: 1000, height: 800 }
    );
    expect(centered.nodes.a.rect.x).toBe(70);
    expect(centered.nodes.a.rect.y).toBe(30);
  });

  it("supports vertical stacks and nested stacks", () => {
    const doc: LayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        outer: { id: "outer", frame: { kind: "absolute", x: 100, y: 200, width: 300, height: 400 }, arrange: { kind: "stack", axis: "vertical", gap: 10, padding: 5 } },
        row: { id: "row", frame: { kind: "fixed", width: 200, height: 50 }, arrange: { kind: "stack", axis: "horizontal", gap: 5 } },
        b1: { id: "b1", frame: { kind: "fixed", width: 40, height: 20 } },
        b2: { id: "b2", frame: { kind: "fixed", width: 50, height: 20 } },
      },
      children: { root: ["outer"], outer: ["row"], row: ["b1", "b2"] },
    };
    const resolved = resolveLayoutDocument(doc, { x: 0, y: 0, width: 1000, height: 1000 });
    expect(resolved.nodes.row.rect).toEqual({ x: 105, y: 205, width: 200, height: 50 });
    expect(resolved.nodes.b1.rect).toEqual({ x: 105, y: 205, width: 40, height: 20 });
    expect(resolved.nodes.b2.rect).toEqual({ x: 150, y: 205, width: 50, height: 20 });
  });

  it("throws required stack errors", () => {
    const withAbsoluteChild = baseDoc({ kind: "stack", axis: "horizontal" });
    withAbsoluteChild.nodes.a = { id: "a", frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 } };
    expectCode(() => resolveLayoutDocument(withAbsoluteChild, { x: 0, y: 0, width: 500, height: 500 }), "StackChildMustBeFixed");

    const overflow = baseDoc({ kind: "stack", axis: "horizontal" });
    overflow.nodes.parent.frame = { kind: "absolute", x: 0, y: 0, width: 100, height: 40 };
    expectCode(() => resolveLayoutDocument(overflow, { x: 0, y: 0, width: 500, height: 500 }), "StackOverflow");

    const contentNegative = baseDoc({ kind: "stack", axis: "horizontal", padding: { top: 0, right: 200, bottom: 0, left: 200 } });
    expectCode(() => resolveLayoutDocument(contentNegative, { x: 0, y: 0, width: 500, height: 500 }), "StackContentNegative");
  });

  it("enforces numeric validation and preserves non-stack fixed behavior", () => {
    expectCode(() => resolveLayoutDocument(baseDoc({ kind: "stack", axis: "horizontal", gap: -1 }), { x: 0, y: 0, width: 500, height: 500 }), "NegativeGap");
    expectCode(() => resolveLayoutDocument(baseDoc({ kind: "stack", axis: "horizontal", gap: Number.NaN }), { x: 0, y: 0, width: 500, height: 500 }), "NonFiniteNumber");
    expectCode(() => resolveLayoutDocument(baseDoc({ kind: "stack", axis: "horizontal", padding: { top: -1, right: 0, bottom: 0, left: 0 } }), { x: 0, y: 0, width: 500, height: 500 }), "NegativePadding");

    const nonArranging: LayoutDocument = {
      rootId: "root",
      nodes: { root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } }, child: { id: "child", frame: { kind: "fixed", width: 10, height: 10 } } },
      children: { root: ["child"] },
    };
    expectCode(() => resolveLayoutDocument(nonArranging, { x: 0, y: 0, width: 100, height: 100 }), "FixedFrameWithoutArranger");
  });

  it("supports empty stacks, zero sizes, immutability, and resolveLayoutRows", () => {
    const empty: LayoutDocument = {
      rootId: "root",
      nodes: { root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 }, arrange: { kind: "stack", axis: "horizontal" } } },
      children: { root: [] },
    };
    expect(() => resolveLayoutDocument(empty, { x: 0, y: 0, width: 0, height: 0 })).not.toThrow();

    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
      { id: "toolbar", parent: "root", frame: { kind: "absolute", x: 10, y: 10, width: 100, height: 20 }, arrange: { kind: "stack", axis: "horizontal" } },
      { id: "z", parent: "toolbar", frame: { kind: "fixed", width: 0, height: 0 } },
    ];
    const before = JSON.stringify(rows);
    const resolved = resolveLayoutRows(rows, { x: 0, y: 0, width: 500, height: 500 });
    expect(resolved.nodes.z.rect).toEqual({ x: 10, y: 10, width: 0, height: 0 });
    expect(JSON.stringify(rows)).toBe(before);
  });
});
