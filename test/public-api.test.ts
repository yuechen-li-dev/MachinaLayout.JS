import { describe, expect, it } from "vitest";
import { resolveUiLength } from "../src";
import type { FillFrame, LayoutNode, LayoutRow, OffsetSpec, ResolvedLayoutNode, ResolvedLayoutTree, RootFrame, UiLength } from "../src";
import { normalizePadding } from "../src";

describe("public API", () => {
  it("imports from index and types a LayoutRow", () => {
    const rootFrame: RootFrame = { kind: "root" };
    const offset: OffsetSpec = { x: 2, y: { unit: "ui", value: 0.1 } };
    const row: LayoutRow = {
      id: "root",
      z: 1,
      frame: rootFrame,
      offset,
    };

    const fillFrame: FillFrame = { kind: "fill", weight: 1 };
    const node: LayoutNode = { id: "n", z: -1, frame: { kind: "fixed", width: 10, height: 10 } };
    const resolvedNode: ResolvedLayoutNode = {
      id: "rn",
      z: 2,
      rect: { x: 0, y: 0, width: 10, height: 10 },
      frame: { kind: "fixed", width: 10, height: 10 },
    };
    const tree: ResolvedLayoutTree = {
      id: "rt",
      z: 0,
      rect: { x: 0, y: 0, width: 10, height: 10 },
      frame: { kind: "fixed", width: 10, height: 10 },
      children: [],
    };

    const fillRow: LayoutRow = { id: "fill", parent: "root", frame: fillFrame };

    expect(row.id).toBe("root");
    expect(fillRow.frame.kind).toBe("fill");
    expect(node.z).toBe(-1);
    expect(resolvedNode.z).toBe(2);
    expect(tree.z).toBe(0);
    const uiLeft: UiLength = { unit: "ui", value: 0.25 };
    const pxWidth: UiLength = { unit: "px", value: 100 };
    const anchorRow: LayoutRow = { id: "anchor", parent: "root", frame: { kind: "anchor", left: uiLeft, width: pxWidth, top: 0, height: 10 } };

    expect(anchorRow.frame.kind).toBe("anchor");
    expect(resolveUiLength(uiLeft, 800)).toBe(200);
    expect(normalizePadding(2)).toEqual({ top: 2, right: 2, bottom: 2, left: 2 });
  });
});
