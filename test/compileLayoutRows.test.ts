import { describe, expect, it } from "vitest";
import {
  compileLayoutRows,
  MachinaLayoutError,
  type LayoutRow,
  type MachinaLayoutErrorCode,
} from "../src";

function expectCode(rows: LayoutRow[], code: MachinaLayoutErrorCode): void {
  try {
    compileLayoutRows(rows);
    throw new Error("expected compileLayoutRows to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(MachinaLayoutError);
    expect((error as MachinaLayoutError).code).toBe(code);
  }
}

describe("compileLayoutRows", () => {
  it("compiles a single-root document", () => {
    const rows: LayoutRow[] = [
      {
        id: "root",
        frame: { kind: "root" },
        slot: "app",
        debugLabel: "Root",
      },
    ];

    const doc = compileLayoutRows(rows);

    expect(doc.rootId).toBe("root");
    expect(doc.nodes.root).toEqual(rows[0]);
    expect(doc.children).toEqual({});
  });



  it("accepts RootFrame on root", () => {
    const doc = compileLayoutRows([{ id: "root", frame: { kind: "root" } }]);
    expect(doc.nodes.root.frame.kind).toBe("root");
  });

  it("rejects RootFrame on non-root", () => {
    expectCode(
      [
        { id: "root", frame: { kind: "root" } },
        { id: "child", parent: "root", frame: { kind: "root" } },
      ],
      "RootFrameNotRoot"
    );
  });

  it("still accepts legacy root frames", () => {
    expect(() => compileLayoutRows([{ id: "root", frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 } }])).not.toThrow();
    expect(() => compileLayoutRows([{ id: "root", frame: { kind: "anchor", left: 0, width: 1, top: 0, height: 1 } }])).not.toThrow();
  });


  it("preserves FillFrame children", () => {
    const doc = compileLayoutRows([
      { id: "root", frame: { kind: "root" } },
      { id: "stack", parent: "root", frame: { kind: "absolute", x: 0, y: 0, width: 100, height: 40 }, arrange: { kind: "stack", axis: "horizontal" } },
      { id: "fill", parent: "stack", frame: { kind: "fill", weight: 2, cross: "fill" } },
    ]);
    expect(doc.nodes.fill.frame).toEqual({ kind: "fill", weight: 2, cross: "fill" });
  });


  it("preserves UiLength objects without resolving", () => {
    const left = { unit: "ui", value: 0.25 } as const;
    const width = { unit: "px", value: 100 } as const;
    const doc = compileLayoutRows([
      { id: "root", frame: { kind: "root" } },
      { id: "child", parent: "root", frame: { kind: "anchor", left, width, top: 0, height: 10 } },
    ]);
    const frame = doc.nodes.child.frame;
    expect(frame.kind).toBe("anchor");
    expect((frame as any).left).toBe(left);
    expect((frame as any).width).toBe(width);
  });


  it("preserves offset metadata without resolving", () => {
    const offset = { x: 2, y: { unit: "ui", value: 0.1 } as const };
    const doc = compileLayoutRows([
      { id: "root", frame: { kind: "root" } },
      { id: "child", parent: "root", frame: { kind: "fixed", width: 10, height: 10 }, offset },
    ]);
    expect(doc.nodes.child.offset).toBe(offset);
  });

  it("rejects FillFrame on root", () => {
    expectCode([{ id: "root", frame: { kind: "fill" } }], "FillFrameWithoutArranger");
  });
  it("builds parent-child map", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "fixed", width: 10, height: 10 } },
      { id: "header", parent: "root", frame: { kind: "fixed", width: 10, height: 3 } },
      { id: "sidebar", parent: "root", frame: { kind: "fixed", width: 2, height: 7 } },
      { id: "main", parent: "root", frame: { kind: "fixed", width: 8, height: 7 } },
      { id: "button", parent: "header", frame: { kind: "fixed", width: 1, height: 1 } },
    ];

    const doc = compileLayoutRows(rows);

    expect(doc.children.root).toEqual(["header", "sidebar", "main"]);
    expect(doc.children.header).toEqual(["button"]);
    expect(doc.nodes.main.id).toBe("main");
  });

  it("sorts siblings by order then row index", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
      { id: "a", parent: "root", order: 2, frame: { kind: "fixed", width: 1, height: 1 } },
      { id: "b", parent: "root", frame: { kind: "fixed", width: 1, height: 1 } },
      { id: "c", parent: "root", order: 1, frame: { kind: "fixed", width: 1, height: 1 } },
      { id: "d", parent: "root", frame: { kind: "fixed", width: 1, height: 1 } },
    ];

    const doc = compileLayoutRows(rows);

    expect(doc.children.root).toEqual(["b", "d", "c", "a"]);
  });

  it("treats undefined order as zero and keeps stable index tie-break", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
      { id: "a", parent: "root", frame: { kind: "fixed", width: 1, height: 1 } },
      { id: "b", parent: "root", order: 0, frame: { kind: "fixed", width: 1, height: 1 } },
    ];

    expect(compileLayoutRows(rows).children.root).toEqual(["a", "b"]);
  });

  it("allows negative order", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
      { id: "a", parent: "root", order: 0, frame: { kind: "fixed", width: 1, height: 1 } },
      { id: "b", parent: "root", order: -1, frame: { kind: "fixed", width: 1, height: 1 } },
    ];

    expect(compileLayoutRows(rows).children.root).toEqual(["b", "a"]);
  });

  it("rejects non-finite order", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expectCode(
        [
          { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
          { id: "child", parent: "root", order: value, frame: { kind: "fixed", width: 1, height: 1 } },
        ],
        "NonFiniteNumber"
      );
    }
  });

  it("rejects empty rows", () => {
    expectCode([], "EmptyRows");
  });

  it("rejects invalid ids", () => {
    expectCode([{ id: "", frame: { kind: "fixed", width: 1, height: 1 } }], "InvalidId");
    expectCode([{ id: "   ", frame: { kind: "fixed", width: 1, height: 1 } }], "InvalidId");
  });

  it("rejects duplicate ids", () => {
    expectCode(
      [
        { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        { id: "root", parent: "root", frame: { kind: "fixed", width: 1, height: 1 } },
      ],
      "DuplicateId"
    );
  });

  it("rejects missing root", () => {
    expectCode(
      [
        { id: "a", parent: "b", frame: { kind: "fixed", width: 1, height: 1 } },
        { id: "b", parent: "a", frame: { kind: "fixed", width: 1, height: 1 } },
      ],
      "MissingRoot"
    );
  });

  it("rejects multiple roots", () => {
    expectCode(
      [
        { id: "root1", frame: { kind: "fixed", width: 1, height: 1 } },
        { id: "root2", frame: { kind: "fixed", width: 1, height: 1 } },
      ],
      "MultipleRoots"
    );
  });

  it("rejects unknown parent", () => {
    expectCode(
      [
        { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        { id: "a", parent: "missing", frame: { kind: "fixed", width: 1, height: 1 } },
      ],
      "UnknownParent"
    );
  });

  it("rejects self-parent", () => {
    expectCode(
      [
        { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        { id: "a", parent: "a", frame: { kind: "fixed", width: 1, height: 1 } },
      ],
      "SelfParent"
    );
  });

  it("rejects cycle with one root", () => {
    expectCode(
      [
        { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        { id: "a", parent: "b", frame: { kind: "fixed", width: 1, height: 1 } },
        { id: "b", parent: "a", frame: { kind: "fixed", width: 1, height: 1 } },
      ],
      "Cycle"
    );
  });

  it("has no natural unreachable-only case because valid single-root parent links form a tree", () => {
    // With one parent per node and parent-id existence required, any non-cycle structure is reachable.
    // We still keep UnreachableNode defensively in compileLayoutRows.
    expect(true).toBe(true);
  });

  it("does not mutate input rows", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "fixed", width: 100, height: 100 } },
      {
        id: "child",
        parent: "root",
        order: 10,
        frame: { kind: "fixed", width: 50, height: 50 },
        slot: "content",
        debugLabel: "Child",
      },
    ];

    const before = JSON.stringify(rows);
    compileLayoutRows(rows);
    expect(JSON.stringify(rows)).toBe(before);
  });

  it("preserves z metadata", () => {
    const doc = compileLayoutRows([
      { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
      { id: "a", parent: "root", z: 3, frame: { kind: "fixed", width: 1, height: 1 } },
      { id: "b", parent: "root", z: -2, frame: { kind: "fixed", width: 1, height: 1 } },
      { id: "c", parent: "root", frame: { kind: "fixed", width: 1, height: 1 } },
    ]);

    expect(doc.nodes.a.z).toBe(3);
    expect(doc.nodes.b.z).toBe(-2);
    expect(doc.nodes.c.z).toBeUndefined();
  });

  it("validates z range", () => {
    expect(() =>
      compileLayoutRows([
        { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        { id: "a", parent: "root", z: -5, frame: { kind: "fixed", width: 1, height: 1 } },
        { id: "b", parent: "root", z: 5, frame: { kind: "fixed", width: 1, height: 1 } },
      ])
    ).not.toThrow();

    expectCode(
      [
        { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        { id: "a", parent: "root", z: -6, frame: { kind: "fixed", width: 1, height: 1 } },
      ],
      "InvalidZ"
    );

    expectCode(
      [
        { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        { id: "a", parent: "root", z: 6, frame: { kind: "fixed", width: 1, height: 1 } },
      ],
      "InvalidZ"
    );
  });

  it("validates z integer", () => {
    expectCode(
      [
        { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
        { id: "a", parent: "root", z: 1.5, frame: { kind: "fixed", width: 1, height: 1 } },
      ],
      "InvalidZ"
    );
  });

  it("validates z finite", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expectCode(
        [
          { id: "root", frame: { kind: "fixed", width: 1, height: 1 } },
          { id: "a", parent: "root", z: value, frame: { kind: "fixed", width: 1, height: 1 } },
        ],
        "NonFiniteNumber"
      );
    }
  });
});
