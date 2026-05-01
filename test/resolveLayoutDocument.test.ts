import { describe, expect, it } from "vitest";
import {
  MachinaLayoutError,
  resolveLayoutDocument,
  type LayoutDocument,
  type MachinaLayoutErrorCode,
  type Rect,
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

describe("resolveLayoutDocument", () => {
  it("resolves root-only document", () => {
    const rootRect: Rect = { x: 1, y: 2, width: 300, height: 200 };
    const document: LayoutDocument = {
      rootId: "root",
      nodes: { root: { id: "root", frame: { kind: "root" }, slot: "app", debugLabel: "Root" } },
      children: { root: [] },
    };

    const resolved = resolveLayoutDocument(document, rootRect);
    expect(resolved.rootId).toBe("root");
    expect(resolved.nodes.root.rect).toEqual(rootRect);
    expect(resolved.nodes.root.rect).not.toBe(rootRect);
    expect(resolved.nodes.root.frame.kind).toBe("root");
    expect(resolved.nodes.root.slot).toBe("app");
    expect(resolved.nodes.root.debugLabel).toBe("Root");
    expect(resolved.children.root).toEqual([]);
    expect(resolved.children.root).not.toBe(document.children.root);
  });

  it("resolves children and grandchildren from parent rectangles", () => {
    const document: LayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        panel: { id: "panel", frame: { kind: "absolute", x: 100, y: 100, width: 300, height: 200 } },
        button: { id: "button", frame: { kind: "absolute", x: 10, y: 20, width: 50, height: 30 } },
      },
      children: { root: ["panel"], panel: ["button"] },
    };

    const resolved = resolveLayoutDocument(document, { x: 0, y: 0, width: 1000, height: 800 });
    expect(resolved.nodes.panel.rect).toEqual({ x: 100, y: 100, width: 300, height: 200 });
    expect(resolved.nodes.button.rect).toEqual({ x: 110, y: 120, width: 50, height: 30 });
  });

  it("resolves anchor child", () => {
    const doc: LayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        child: { id: "child", frame: { kind: "anchor", left: 16, right: 16, top: 12, height: 48 } },
      },
      children: { root: ["child"] },
    };
    const rootRect = { x: 100, y: 200, width: 800, height: 600 };
    const resolved = resolveLayoutDocument(doc, rootRect);
    expect(resolved.nodes.child.rect).toEqual({ x: 116, y: 212, width: 768, height: 48 });
  });

  it("preserves child order and fresh children arrays", () => {
    const doc: LayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        a: { id: "a", frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 } },
        b: { id: "b", frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 } },
        c: { id: "c", frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 } },
      },
      children: { root: ["b", "a", "c"] },
    };
    const resolved = resolveLayoutDocument(doc, { x: 0, y: 0, width: 10, height: 10 });
    expect(resolved.children.root).toEqual(["b", "a", "c"]);
    expect(resolved.children.root).not.toBe(doc.children.root);
  });

  it("preserves z metadata", () => {
    const doc: LayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        a: { id: "a", z: 4, frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 } },
      },
      children: { root: ["a"] },
    };
    const resolved = resolveLayoutDocument(doc, { x: 0, y: 0, width: 10, height: 10 });
    expect(resolved.nodes.a.z).toBe(4);
    expect(resolved.children.root).toEqual(["a"]);
  });

  it("resolves fixed frames under stack arranger", () => {
    const doc: LayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        parent: { id: "parent", frame: { kind: "absolute", x: 0, y: 0, width: 100, height: 100 }, arrange: { kind: "stack", axis: "horizontal" } },
        child: { id: "child", frame: { kind: "fixed", width: 10, height: 20 } },
      },
      children: { root: ["parent"], parent: ["child"] },
    };
    const resolved = resolveLayoutDocument(doc, { x: 0, y: 0, width: 100, height: 100 });
    expect(resolved.nodes.child.rect).toEqual({ x: 0, y: 0, width: 10, height: 20 });
  });

  it("validates root rect numeric rules", () => {
    const doc: LayoutDocument = { rootId: "root", nodes: { root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } } }, children: {} };
    expectCode(() => resolveLayoutDocument(doc, { x: Number.NaN, y: 0, width: 1, height: 1 }), "NonFiniteNumber");
    expectCode(() => resolveLayoutDocument(doc, { x: 0, y: Number.POSITIVE_INFINITY, width: 1, height: 1 }), "NonFiniteNumber");
    expectCode(() => resolveLayoutDocument(doc, { x: 0, y: 0, width: Number.NEGATIVE_INFINITY, height: 1 }), "NonFiniteNumber");
    expectCode(() => resolveLayoutDocument(doc, { x: 0, y: 0, width: 1, height: Number.NaN }), "NonFiniteNumber");
    expectCode(() => resolveLayoutDocument(doc, { x: 0, y: 0, width: -1, height: 1 }), "NegativeSize");
    expectCode(() => resolveLayoutDocument(doc, { x: 0, y: 0, width: 1, height: -1 }), "NegativeSize");
    expect(() => resolveLayoutDocument(doc, { x: -10, y: -20, width: 1, height: 1 })).not.toThrow();
  });

  it("fails malformed documents clearly", () => {
    expectCode(
      () =>
        resolveLayoutDocument({ rootId: "missing", nodes: {}, children: {} }, { x: 0, y: 0, width: 1, height: 1 }),
      "MissingRoot"
    );

    expectCode(
      () =>
        resolveLayoutDocument(
          {
            rootId: "root",
            nodes: { root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } } },
            children: { root: ["missingChild"] },
          },
          { x: 0, y: 0, width: 1, height: 1 }
        ),
      "UnknownParent"
    );

    expectCode(
      () =>
        resolveLayoutDocument(
          {
            rootId: "root",
            nodes: {
              root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
              a: { id: "a", frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 } },
              b: { id: "b", frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 } },
            },
            children: { root: ["a"], a: ["b"], b: ["a"] },
          },
          { x: 0, y: 0, width: 10, height: 10 }
        ),
      "Cycle"
    );

    expectCode(
      () =>
        resolveLayoutDocument(
          {
            rootId: "root",
            nodes: {
              root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
              orphan: { id: "orphan", frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 } },
            },
            children: {},
          },
          { x: 0, y: 0, width: 10, height: 10 }
        ),
      "UnreachableNode"
    );
  });

  it("preserves view metadata", () => {
    const doc: LayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", frame: { kind: "root" } },
        child: { id: "child", frame: { kind: "absolute", x: 1, y: 2, width: 3, height: 4 }, view: "Header", slot: "HeaderSlot" },
      },
      children: { root: ["child"] },
    };

    const resolved = resolveLayoutDocument(doc, { x: 0, y: 0, width: 100, height: 100 });
    expect(resolved.nodes.child.view).toBe("Header");
    expect(resolved.nodes.child.slot).toBe("HeaderSlot");
  });

  it("does not mutate inputs and returns fresh node objects", () => {
    const document: LayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        child: { id: "child", frame: { kind: "absolute", x: 1, y: 2, width: 3, height: 4 } },
      },
      children: { root: ["child"] },
    };
    const rootRect = { x: 10, y: 20, width: 100, height: 100 };
    const beforeDoc = JSON.stringify(document);
    const beforeRect = JSON.stringify(rootRect);

    const resolved = resolveLayoutDocument(document, rootRect);

    expect(JSON.stringify(document)).toBe(beforeDoc);
    expect(JSON.stringify(rootRect)).toBe(beforeRect);
    expect(resolved.nodes.root).not.toBe(document.nodes.root);
    expect(resolved.nodes.child).not.toBe(document.nodes.child);
  });
});

it("applies offset to absolute/anchor and ignores root offset", () => {
  const doc: LayoutDocument = {
    rootId: "root",
    nodes: {
      root: { id: "root", frame: { kind: "root" }, offset: { x: 100, y: 100 } },
      abs: { id: "abs", frame: { kind: "absolute", x: 10, y: 20, width: 100, height: 50 }, offset: { x: 5, y: -2 } },
      anc: { id: "anc", frame: { kind: "anchor", left: 10, width: 100, top: 20, height: 50 }, offset: { x: { unit: "ui", value: 0.1 }, y: { unit: "ui", value: -0.05 } } },
    },
    children: { root: ["abs", "anc"] },
  };
  const rootRect = { x: 100, y: 200, width: 800, height: 600 };
  const r = resolveLayoutDocument(doc, rootRect);
  expect(r.nodes.root.rect).toEqual(rootRect);
  expect(r.nodes.abs.rect).toEqual({ x: 115, y: 218, width: 100, height: 50 });
  expect(r.nodes.anc.rect).toEqual({ x: 190, y: 190, width: 100, height: 50 });
});

it("allows offsets outside parent and reports length errors", () => {
  const doc: LayoutDocument = {
    rootId: "root",
    nodes: {
      root: { id: "root", frame: { kind: "root" } },
      child: { id: "child", frame: { kind: "absolute", x: 0, y: 0, width: 10, height: 10 }, offset: { x: -1000, y: 1000 } },
    },
    children: { root: ["child"] },
  };
  const r = resolveLayoutDocument(doc, { x: 0, y: 0, width: 100, height: 100 });
  expect(r.nodes.child.rect).toEqual({ x: -1000, y: 1000, width: 10, height: 10 });
  expectCode(() => resolveLayoutDocument({ ...doc, nodes: { ...doc.nodes, child: { ...doc.nodes.child, offset: { x: Number.NaN } } } }, { x: 0, y: 0, width: 100, height: 100 }), "NonFiniteNumber");
  expectCode(() => resolveLayoutDocument({ ...doc, nodes: { ...doc.nodes, child: { ...doc.nodes.child, offset: { x: { unit: "bad" as never, value: 1 } } } } }, { x: 0, y: 0, width: 100, height: 100 }), "InvalidLengthUnit");
});
