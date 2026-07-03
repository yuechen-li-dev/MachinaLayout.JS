import { describe, expect, it } from "vitest";
import { resolveLayoutRows } from "../../src";
import { fill, fixed, hstack, root, space, vstack } from "../../src/machina";

describe("machina stack", () => {
  it("lowers stacks and children", () => {
    expect(vstack("v", { gap: 8 }).rows()[0]).toMatchObject({
      frame: { kind: "fill", weight: 1 },
      arrange: { kind: "stack", axis: "vertical", gap: 8 },
    });
    expect(hstack("h", {}, [fill("f", 2, "View")]).rows()[1]).toMatchObject({
      id: "f",
      parent: "h",
      frame: { kind: "fill", weight: 2 },
      view: "View",
    });
  });
  it("fixed is axis aware", () => {
    expect(
      root("r", { arrange: { kind: "stack", axis: "vertical" } }, [fixed("f", 10)]).rows()[1].frame,
    ).toEqual({ kind: "fixed", height: 10 });
    expect(
      root("r", { arrange: { kind: "stack", axis: "horizontal" } }, [fixed("f", 10)]).rows()[1]
        .frame,
    ).toEqual({ kind: "fixed", width: 10 });
    expect(() => fixed("f", 10).rows()).toThrow();
  });
  it("axis-aware fixed rows resolve in stacks", () => {
    const vertical = root("r", { arrange: { kind: "stack", axis: "vertical" } }, [
      fixed("header", 64, "Header"),
    ]).rows();
    expect(
      resolveLayoutRows(vertical, { x: 0, y: 0, width: 320, height: 240 }).nodes.header.rect,
    ).toEqual({ x: 0, y: 0, width: 320, height: 64 });

    const horizontal = root("r", { arrange: { kind: "stack", axis: "horizontal" } }, [
      fixed("sidebar", 280, "Sidebar"),
    ]).rows();
    expect(
      resolveLayoutRows(horizontal, { x: 0, y: 0, width: 320, height: 240 }).nodes.sidebar.rect,
    ).toEqual({ x: 0, y: 0, width: 280, height: 240 });
  });
  it("normalizes partial stack padding objects", () => {
    expect(vstack("v", { padding: { left: 8 } }).rows()[0].arrange).toMatchObject({
      kind: "stack",
      axis: "vertical",
      padding: { top: 0, right: 0, bottom: 0, left: 8 },
    });
    expect(hstack("h", { padding: { right: 4, bottom: 2 } }).rows()[0].arrange).toMatchObject({
      kind: "stack",
      axis: "horizontal",
      padding: { top: 0, right: 4, bottom: 2, left: 0 },
    });
  });
  it("preserves full and numeric stack padding behavior", () => {
    expect(
      vstack("v", { padding: { top: 1, right: 2, bottom: 3, left: 4 } }).rows()[0].arrange,
    ).toMatchObject({
      padding: { top: 1, right: 2, bottom: 3, left: 4 },
    });
    expect(vstack("v", { padding: 16 }).rows()[0].arrange).toMatchObject({ padding: 16 });
  });
  it("rejects invalid stack padding edges", () => {
    expect(() => vstack("v", { padding: { left: Number.NaN } }).rows()).toThrow();
    expect(() => vstack("v", { padding: { left: -1 } }).rows()).toThrow();
  });
  it("space is deterministic fill", () =>
    expect(space("s", 3).rows()).toEqual([{ id: "s", frame: { kind: "fill", weight: 3 } }]));
  it("preserves options and nested stack axis", () => {
    const row = vstack("outer", {}, [
      hstack("inner", {}, [fixed("x", 7, { slot: "a", debugLabel: "X", layer: "l", z: 1 })]),
    ]).rows()[2];
    expect(row).toMatchObject({
      parent: "inner",
      frame: { kind: "fixed", width: 7 },
      slot: "a",
      debugLabel: "X",
      layer: "l",
      z: 1,
    });
  });
  it("rejects invalid sizes", () => {
    expect(() => fixed("f", Number.NaN)).toThrow();
    expect(() => fill("f", -1)).toThrow();
  });
});
