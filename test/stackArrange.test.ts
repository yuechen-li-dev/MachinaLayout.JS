import { describe, expect, it } from "vitest";
import { MachinaLayoutError, resolveLayoutDocument, type LayoutDocument, type MachinaLayoutErrorCode } from "../src";

function expectCode(run: () => unknown, code: MachinaLayoutErrorCode): void {
  try { run(); throw new Error("expected throw"); } catch (error) {
    expect(error).toBeInstanceOf(MachinaLayoutError);
    expect((error as MachinaLayoutError).code).toBe(code);
  }
}

function stackDoc(axis: "horizontal"|"vertical", parentSize:{w:number;h:number}, children: LayoutDocument["nodes"]): LayoutDocument {
  return {
    rootId: "root",
    nodes: {
      root: { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
      parent: { id: "parent", frame: { kind: "absolute", x: 0, y: 0, width: parentSize.w, height: parentSize.h }, arrange: { kind: "stack", axis } },
      ...children,
    },
    children: { root: ["parent"], parent: Object.keys(children) },
  };
}

describe("stack arrange fill", () => {
  it("horizontal fixed+fill distributes remaining width", () => {
    const doc = stackDoc("horizontal", { w: 300, h: 40 }, {
      a: { id: "a", frame: { kind: "fixed", width: 50, height: 20 } },
      b: { id: "b", frame: { kind: "fill", weight: 1, cross: 20 } },
      c: { id: "c", frame: { kind: "fixed", width: 70, height: 20 } },
    });
    doc.nodes.parent.arrange = { kind: "stack", axis: "horizontal", gap: 10 };
    const r = resolveLayoutDocument(doc, { x: 0, y: 0, width: 999, height: 999 });
    expect(r.nodes.a.rect).toEqual({ x: 0, y: 0, width: 50, height: 20 });
    expect(r.nodes.b.rect).toEqual({ x: 60, y: 0, width: 160, height: 20 });
    expect(r.nodes.c.rect).toEqual({ x: 230, y: 0, width: 70, height: 20 });
  });

  it("weighted fill + justify no-op when fill exists", () => {
    for (const justify of ["start", "center", "end", "space-between"] as const) {
      const doc = stackDoc("horizontal", { w: 300, h: 40 }, {
        a: { id: "a", frame: { kind: "fixed", width: 50, height: 20 } },
        b: { id: "b", frame: { kind: "fill", weight: 1 } },
      });
      doc.nodes.parent.arrange = { kind: "stack", axis: "horizontal", justify, gap: 0 };
      const r = resolveLayoutDocument(doc, { x: 0, y: 0, width: 400, height: 200 });
      expect(r.nodes.a.rect.x).toBe(0);
      expect(r.nodes.b.rect.x).toBe(50);
      expect(r.nodes.b.rect.width).toBe(250);
    }
  });

  it("equal and weighted fill sizes", () => {
    const eq = stackDoc("horizontal", { w: 300, h: 20 }, {
      a: { id: "a", frame: { kind: "fill", cross: 20 } }, b: { id: "b", frame: { kind: "fill", cross: 20 } }, c: { id: "c", frame: { kind: "fill", cross: 20 } },
    });
    let r = resolveLayoutDocument(eq, { x: 0, y: 0, width: 500, height: 100 });
    expect(r.nodes.a.rect.width).toBe(100); expect(r.nodes.b.rect.width).toBe(100); expect(r.nodes.c.rect.width).toBe(100);
    const wt = stackDoc("horizontal", { w: 300, h: 20 }, {
      a: { id: "a", frame: { kind: "fill", weight: 1, cross: 20 } }, b: { id: "b", frame: { kind: "fill", weight: 2, cross: 20 } },
    });
    r = resolveLayoutDocument(wt, { x: 0, y: 0, width: 500, height: 100 });
    expect(r.nodes.a.rect.width).toBe(100); expect(r.nodes.b.rect.width).toBe(200);
  });

  it("vertical fill and cross/align behavior", () => {
    const doc = stackDoc("vertical", { w: 40, h: 300 }, {
      a: { id: "a", frame: { kind: "fixed", width: 20, height: 50 } },
      b: { id: "b", frame: { kind: "fill", weight: 1, cross: 20 } },
      c: { id: "c", frame: { kind: "fixed", width: 20, height: 70 } },
    });
    doc.nodes.parent.arrange = { kind: "stack", axis: "vertical", gap: 10 };
    const r = resolveLayoutDocument(doc, { x: 0, y: 0, width: 999, height: 999 });
    expect(r.nodes.b.rect.height).toBe(160);
    expect(r.nodes.c.rect.y).toBe(230);
  });

  it("validates fill errors and overflow", () => {
    expectCode(() => resolveLayoutDocument(stackDoc("horizontal", { w: 100, h: 20 }, { f: { id: "f", frame: { kind: "fill", weight: 0 } } }), { x: 0, y: 0, width: 1, height: 1 }), "InvalidFillWeight");
    expectCode(() => resolveLayoutDocument(stackDoc("horizontal", { w: 100, h: 20 }, { f: { id: "f", frame: { kind: "fill", weight: Number.NaN } } }), { x: 0, y: 0, width: 1, height: 1 }), "NonFiniteNumber");
    expectCode(() => resolveLayoutDocument(stackDoc("horizontal", { w: 100, h: 20 }, { f: { id: "f", frame: { kind: "fill", cross: -1 } } }), { x: 0, y: 0, width: 1, height: 1 }), "NegativeSize");
    expectCode(() => resolveLayoutDocument(stackDoc("horizontal", { w: 100, h: 20 }, { f: { id: "f", frame: { kind: "fill", cross: 30 } } }), { x: 0, y: 0, width: 1, height: 1 }), "StackOverflow");
  });
});

it("offset on fixed child does not affect siblings", () => {
  const doc = stackDoc("horizontal", { w: 300, h: 40 }, {
    a: { id: "a", frame: { kind: "fixed", width: 100, height: 20 } },
    b: { id: "b", frame: { kind: "fixed", width: 100, height: 20 }, offset: { x: 20 } },
    c: { id: "c", frame: { kind: "fixed", width: 100, height: 20 } },
  });
  const r = resolveLayoutDocument(doc, { x: 0, y: 0, width: 300, height: 40 });
  expect(r.nodes.a.rect.x).toBe(0); expect(r.nodes.b.rect.x).toBe(120); expect(r.nodes.c.rect.x).toBe(200);
});

it("offset on fill child does not affect distribution", () => {
  const doc = stackDoc("horizontal", { w: 300, h: 40 }, {
    a: { id: "a", frame: { kind: "fixed", width: 100, height: 20 } },
    b: { id: "b", frame: { kind: "fill", weight: 1, cross: 20 }, offset: { x: 10 } },
    c: { id: "c", frame: { kind: "fixed", width: 50, height: 20 } },
  });
  const r = resolveLayoutDocument(doc, { x: 0, y: 0, width: 300, height: 40 });
  expect(r.nodes.a.rect).toEqual({ x: 0, y: 0, width: 100, height: 20 });
  expect(r.nodes.b.rect).toEqual({ x: 110, y: 0, width: 150, height: 20 });
  expect(r.nodes.c.rect).toEqual({ x: 250, y: 0, width: 50, height: 20 });
});
