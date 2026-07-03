import { describe, expect, it } from "vitest";
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
