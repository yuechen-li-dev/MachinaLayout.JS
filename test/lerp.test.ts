import { describe, expect, it } from "vitest";
import {
  MachinaLayoutError,
  lerpNumber,
  lerpRect,
  lerpResolvedLayouts,
  resolveLayoutRows,
  type MachinaLayoutErrorCode,
  type ResolvedLayoutDocument,
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

describe("lerpNumber", () => {
  it("interpolates", () => {
    expect(lerpNumber(0, 10, 0)).toBe(0);
    expect(lerpNumber(0, 10, 0.5)).toBe(5);
    expect(lerpNumber(0, 10, 1)).toBe(10);
  });

  it("allows overshoot", () => {
    expect(lerpNumber(0, 10, -0.5)).toBe(-5);
    expect(lerpNumber(0, 10, 1.5)).toBe(15);
  });

  it("rejects non-finite", () => {
    expectCode(() => lerpNumber(Number.NaN, 10, 0.5), "NonFiniteNumber");
    expectCode(() => lerpNumber(0, Number.POSITIVE_INFINITY, 0.5), "NonFiniteNumber");
    expectCode(() => lerpNumber(0, 10, Number.NEGATIVE_INFINITY), "NonFiniteNumber");
  });
});

describe("lerpRect", () => {
  it("interpolates and returns fresh rect", () => {
    const a = { x: 0, y: 10, width: 100, height: 50 };
    const b = { x: 10, y: 30, width: 200, height: 100 };
    const beforeA = JSON.stringify(a);
    const beforeB = JSON.stringify(b);

    const result = lerpRect(a, b, 0.5);

    expect(result).toEqual({ x: 5, y: 20, width: 150, height: 75 });
    expect(result).not.toBe(a);
    expect(result).not.toBe(b);
    expect(JSON.stringify(a)).toBe(beforeA);
    expect(JSON.stringify(b)).toBe(beforeB);
  });
});

function makeDocs(): { a: ResolvedLayoutDocument; b: ResolvedLayoutDocument } {
  return {
    a: {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 100, height: 100 }, frame: { kind: "root" }, view: "AView", slot: "ASlot", debugLabel: "A Root" },
        child: { id: "child", rect: { x: 0, y: 0, width: 50, height: 50 }, frame: { kind: "absolute", x: 0, y: 0, width: 50, height: 50 }, arrange: { kind: "stack", axis: "horizontal" }, z: 1, offset: { x: 1, y: 2 }, view: "ChildA", slot: "SlotA", debugLabel: "Child A" },
      },
      children: { root: ["child"] },
    },
    b: {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 200, height: 200 }, frame: { kind: "root" }, view: "BView", slot: "BSlot", debugLabel: "B Root" },
        child: { id: "child", rect: { x: 100, y: 100, width: 100, height: 100 }, frame: { kind: "absolute", x: 100, y: 100, width: 100, height: 100 }, arrange: { kind: "stack", axis: "vertical" }, z: 9, offset: { x: 9, y: 10 }, view: "ChildB", slot: "SlotB", debugLabel: "Child B" },
      },
      children: { root: ["child"] },
    },
  };
}

describe("lerpResolvedLayouts", () => {
  it("interpolates compatible layouts", () => {
    const { a, b } = makeDocs();
    const result = lerpResolvedLayouts(a, b, 0.5);
    expect(result.nodes.root.rect).toEqual({ x: 0, y: 0, width: 150, height: 150 });
    expect(result.nodes.child.rect).toEqual({ x: 50, y: 50, width: 75, height: 75 });
  });

  it("preserves metadata from B", () => {
    const { a, b } = makeDocs();
    const result = lerpResolvedLayouts(a, b, 0.25);
    expect(result.nodes.child.frame).toBe(b.nodes.child.frame);
    expect(result.nodes.child.arrange).toBe(b.nodes.child.arrange);
    expect(result.nodes.child.view).toBe(b.nodes.child.view);
    expect(result.nodes.child.slot).toBe(b.nodes.child.slot);
    expect(result.nodes.child.debugLabel).toBe(b.nodes.child.debugLabel);
    expect(result.nodes.child.z).toBe(b.nodes.child.z);
    expect(result.nodes.child.offset).toBe(b.nodes.child.offset);
  });

  it("preserves children from B as fresh arrays", () => {
    const { a, b } = makeDocs();
    const result = lerpResolvedLayouts(a, b, 0.25);
    expect(result.children.root).toEqual(b.children.root);
    expect(result.children.root).not.toBe(b.children.root);
  });

  it("returns fresh nodes and rects", () => {
    const { a, b } = makeDocs();
    const result = lerpResolvedLayouts(a, b, 0.25);
    expect(result.nodes.child).not.toBe(a.nodes.child);
    expect(result.nodes.child).not.toBe(b.nodes.child);
    expect(result.nodes.child.rect).not.toBe(a.nodes.child.rect);
    expect(result.nodes.child.rect).not.toBe(b.nodes.child.rect);
  });

  it("does not mutate inputs", () => {
    const { a, b } = makeDocs();
    const beforeA = JSON.stringify(a);
    const beforeB = JSON.stringify(b);
    lerpResolvedLayouts(a, b, 0.25);
    expect(JSON.stringify(a)).toBe(beforeA);
    expect(JSON.stringify(b)).toBe(beforeB);
  });

  it("rejects incompatible roots", () => {
    const { a, b } = makeDocs();
    expectCode(() => lerpResolvedLayouts(a, { ...b, rootId: "other" }, 0.5), "IncompatibleLayouts");
  });

  it("rejects missing nodes in either direction", () => {
    const { a, b } = makeDocs();
    const { child: _unused, ...nodesWithoutChild } = b.nodes;
    expectCode(() => lerpResolvedLayouts(a, { ...b, nodes: nodesWithoutChild }, 0.5), "IncompatibleLayouts");
    expectCode(() => lerpResolvedLayouts({ ...a, nodes: nodesWithoutChild }, b, 0.5), "IncompatibleLayouts");
  });

  it("rejects different children order", () => {
    const a: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 1, height: 1 }, frame: { kind: "root" } },
        a: { id: "a", rect: { x: 0, y: 0, width: 1, height: 1 }, frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 } },
        b: { id: "b", rect: { x: 0, y: 0, width: 1, height: 1 }, frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 } },
      },
      children: { root: ["a", "b"] },
    };
    const b: ResolvedLayoutDocument = { ...a, children: { root: ["b", "a"] } };
    expectCode(() => lerpResolvedLayouts(a, b, 0.5), "IncompatibleLayouts");
  });

  it("rejects different parent map", () => {
    const { a, b } = makeDocs();
    expectCode(() => lerpResolvedLayouts(a, { ...b, children: { root: [] } }, 0.5), "IncompatibleLayouts");
    expectCode(() => lerpResolvedLayouts(a, { ...b, children: { root: [], other: ["child"] } }, 0.5), "IncompatibleLayouts");
  });

  it("rejects missing root node", () => {
    const { a, b } = makeDocs();
    const { root: _unused, ...nodesWithoutRoot } = b.nodes;
    expectCode(() => lerpResolvedLayouts(a, { ...b, nodes: nodesWithoutRoot }, 0.5), "IncompatibleLayouts");
  });

  it("works with real resolveLayoutRows output", () => {
    const rowsA = [
      { id: "root", frame: { kind: "root" as const } },
      { id: "sidebar", parent: "root", frame: { kind: "anchor" as const, left: 0, top: 0, bottom: 0, width: 200 } },
    ];
    const rowsB = [
      { id: "root", frame: { kind: "root" as const } },
      { id: "sidebar", parent: "root", frame: { kind: "anchor" as const, left: 0, top: 0, bottom: 0, width: 300 } },
    ];
    const rootRect = { x: 0, y: 0, width: 1200, height: 800 };
    const resolvedA = resolveLayoutRows(rowsA, rootRect);
    const resolvedB = resolveLayoutRows(rowsB, rootRect);

    const mid = lerpResolvedLayouts(resolvedA, resolvedB, 0.5);
    expect(mid.nodes.sidebar.rect.width).toBe(250);
  });
});
