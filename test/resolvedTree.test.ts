import { describe, expect, it } from "vitest";
import {
  MachinaLayoutError,
  flattenResolvedTree,
  formatRect,
  resolveLayoutRows,
  toResolvedTree,
  type MachinaLayoutErrorCode,
  type ResolvedLayoutDocument,
  type ResolvedLayoutTree,
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

describe("resolved tree helpers", () => {
  it("toResolvedTree: root only", () => {
    const document: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 1, y: 2, width: 3, height: 4 }, frame: { kind: "root" }, view: "AppView", slot: "app", debugLabel: "Root" },
      },
      children: { root: [] },
    };

    const tree = toResolvedTree(document);
    expect(tree.id).toBe("root");
    expect(tree.rect).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(tree.rect).not.toBe(document.nodes.root.rect);
    expect(tree.children).toEqual([]);
    expect(tree.children).not.toBe(document.children.root);
    expect(tree.slot).toBe("app");
    expect(tree.view).toBe("AppView");
    expect(tree.debugLabel).toBe("Root");
    expect(tree.frame.kind).toBe("root");
  });

  it("toResolvedTree: nested tree + preserved order + fresh objects + no mutation", () => {
    const document: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 100, height: 100 }, frame: { kind: "fixed", width: 1, height: 1 }, debugLabel: "r" },
        b: { id: "b", z: -5, rect: { x: 2, y: 2, width: 10, height: 10 }, frame: { kind: "fixed", width: 10, height: 10 } },
        a: { id: "a", z: 5, rect: { x: 1, y: 1, width: 10, height: 10 }, frame: { kind: "fixed", width: 10, height: 10 }, slot: "panel", offset: { x: 3 } },
        c: { id: "c", z: 0, rect: { x: 3, y: 3, width: 10, height: 10 }, frame: { kind: "fixed", width: 10, height: 10 } },
        a1: { id: "a1", rect: { x: 11, y: 11, width: 2, height: 2 }, frame: { kind: "absolute", x: 1, y: 1, width: 2, height: 2 } },
      },
      children: { root: ["b", "a", "c"], a: ["a1"] },
    };
    const before = JSON.stringify(document);

    const tree = toResolvedTree(document);

    expect(tree.children.map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(tree.children.map((x) => x.z)).toEqual([-5, 5, 0]);
    expect(tree.children[1].children[0].id).toBe("a1");
    expect(tree).not.toBe(document.nodes.root as unknown as ResolvedLayoutTree);
    expect(tree.rect).not.toBe(document.nodes.root.rect);
    expect(tree.children).not.toBe(document.children.root);
    expect(tree.children[1].slot).toBe("panel");
    expect(tree.children[1].offset).toEqual({ x: 3 });
    expect(tree.debugLabel).toBe("r");
    expect(JSON.stringify(document)).toBe(before);
  });

  it("toResolvedTree malformed docs", () => {
    expectCode(() => toResolvedTree({ rootId: "missing", nodes: {}, children: {} }), "MissingRoot");

    expectCode(
      () =>
        toResolvedTree({
          rootId: "root",
          nodes: { root: { id: "root", rect: { x: 0, y: 0, width: 1, height: 1 }, frame: { kind: "fixed", width: 1, height: 1 } } },
          children: { root: ["missing"] },
        }),
      "UnknownParent"
    );

    expectCode(
      () =>
        toResolvedTree({
          rootId: "root",
          nodes: {
            root: { id: "root", rect: { x: 0, y: 0, width: 1, height: 1 }, frame: { kind: "fixed", width: 1, height: 1 } },
            a: { id: "a", rect: { x: 0, y: 0, width: 1, height: 1 }, frame: { kind: "fixed", width: 1, height: 1 } },
            b: { id: "b", rect: { x: 0, y: 0, width: 1, height: 1 }, frame: { kind: "fixed", width: 1, height: 1 } },
          },
          children: { root: ["a"], a: ["b"], b: ["a"] },
        }),
      "Cycle"
    );

    expectCode(
      () =>
        toResolvedTree({
          rootId: "root",
          nodes: {
            root: { id: "root", rect: { x: 0, y: 0, width: 1, height: 1 }, frame: { kind: "fixed", width: 1, height: 1 } },
            orphan: { id: "orphan", rect: { x: 0, y: 0, width: 1, height: 1 }, frame: { kind: "fixed", width: 1, height: 1 } },
          },
          children: {},
        }),
      "UnreachableNode"
    );
  });

  it("flattenResolvedTree preorder + fresh + no mutation", () => {
    const tree: ResolvedLayoutTree = {
      id: "root",
      rect: { x: 0, y: 0, width: 100, height: 100 },
      frame: { kind: "fixed", width: 1, height: 1 },
      children: [
        { id: "a", z: 5, rect: { x: 1, y: 1, width: 10, height: 10 }, frame: { kind: "fixed", width: 10, height: 10 }, slot: "s", children: [{ id: "a1", rect: { x: 2, y: 2, width: 3, height: 3 }, frame: { kind: "fixed", width: 3, height: 3 }, children: [] }] },
        { id: "b", z: -5, rect: { x: 4, y: 4, width: 10, height: 10 }, frame: { kind: "fixed", width: 10, height: 10 }, children: [] },
      ],
    };
    const before = JSON.stringify(tree);
    const flat = flattenResolvedTree(tree);
    expect(flat.map((n) => n.id)).toEqual(["root", "a", "a1", "b"]);
    expect(flat[0].frame.kind).toBe("fixed");
    expect(flat[1].z).toBe(5);
    expect(flat[3].z).toBe(-5);
    expect(flat[0]).not.toBe(tree as unknown as never);
    expect(flat[0].rect).not.toBe(tree.rect);
    expect(flat[1].slot).toBe("s");
    expect(flat[1].offset).toBeUndefined();
    expect(JSON.stringify(tree)).toBe(before);
  });


  it("preserves UiLength metadata in tree and flattened output", () => {
    const resolved = resolveLayoutRows(
      [
        { id: "root", frame: { kind: "root" } },
        { id: "child", parent: "root", frame: { kind: "anchor", left: { unit: "ui", value: 0.25 }, width: { unit: "px", value: 120 }, top: 10, height: 20 } },
      ],
      { x: 0, y: 0, width: 800, height: 600 }
    );
    const tree = toResolvedTree(resolved);
    const flat = flattenResolvedTree(tree);
    expect((tree.children[0].frame as any).left).toEqual({ unit: "ui", value: 0.25 });
    expect((flat[1].frame as any).width).toEqual({ unit: "px", value: 120 });
    expect(flat[1].rect).toEqual({ x: 200, y: 10, width: 120, height: 20 });
  });

  it("formatRect exact output", () => {
    expect(formatRect({ x: 1, y: 2, width: 3, height: 4 })).toBe("x=1 y=2 w=3 h=4");
    expect(formatRect({ x: 1.5, y: -2, width: 0, height: 42 })).toBe("x=1.5 y=-2 w=0 h=42");
  });

  it("integration smoke with resolveLayoutRows", () => {
    const resolved = resolveLayoutRows(
      [
        { id: "root", frame: { kind: "root" } },
        { id: "panel", parent: "root", frame: { kind: "absolute", x: 10, y: 20, width: 100, height: 50 } },
        { id: "button", parent: "panel", frame: { kind: "absolute", x: 5, y: 6, width: 30, height: 10 } },
      ],
      { x: 0, y: 0, width: 500, height: 300 }
    );

    const tree = toResolvedTree(resolved);
    expect(tree.id).toBe("root");
    expect(tree.children[0].id).toBe("panel");
    expect(tree.children[0].children[0].id).toBe("button");
    const flat = flattenResolvedTree(tree);
    expect(flat.map((n) => n.id)).toEqual(["root", "panel", "button"]);
    expect(flat[1].rect).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    expect(flat[2].rect).toEqual({ x: 15, y: 26, width: 30, height: 10 });
  });


  it("flattenResolvedTree preserves view", () => {
    const tree: ResolvedLayoutTree = {
      id: "root",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      frame: { kind: "root" },
      children: [
        {
          id: "child",
          rect: { x: 1, y: 1, width: 4, height: 4 },
          frame: { kind: "absolute", x: 1, y: 1, width: 4, height: 4 },
          view: "Header",
          children: [],
        },
      ],
    };

    const flat = flattenResolvedTree(tree);
    expect(flat[1].view).toBe("Header");
  });
});
