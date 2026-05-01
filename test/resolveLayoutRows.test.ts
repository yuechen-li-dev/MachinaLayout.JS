import { describe, expect, it } from "vitest";
import { MachinaLayoutError, resolveLayoutRows, type LayoutRow } from "../src";

describe("resolveLayoutRows", () => {
  it("compiles rows and resolves rectangles", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "fixed", width: 999, height: 999 } },
      { id: "child", parent: "root", frame: { kind: "absolute", x: 10, y: 20, width: 300, height: 40 } },
    ];

    const rootRect = { x: 100, y: 200, width: 800, height: 600 };
    const beforeRows = JSON.stringify(rows);
    const beforeRoot = JSON.stringify(rootRect);
    const resolved = resolveLayoutRows(rows, rootRect);

    expect(resolved.rootId).toBe("root");
    expect(resolved.children.root).toEqual(["child"]);
    expect(resolved.nodes.child.rect).toEqual({ x: 110, y: 220, width: 300, height: 40 });
    expect(JSON.stringify(rows)).toBe(beforeRows);
    expect(JSON.stringify(rootRect)).toBe(beforeRoot);
  });
});


it("rejects FillFrame under non-arranging parent", () => {
  const rows: LayoutRow[] = [
    { id: "root", frame: { kind: "fixed", width: 100, height: 100 } },
    { id: "child", parent: "root", frame: { kind: "fill" } },
  ];
  expect(() => resolveLayoutRows(rows, { x: 0, y: 0, width: 100, height: 100 })).toThrowError(MachinaLayoutError);
  try { resolveLayoutRows(rows, { x: 0, y: 0, width: 100, height: 100 }); } catch (e) {
    expect((e as MachinaLayoutError).code).toBe("FillFrameWithoutArranger");
  }
});
