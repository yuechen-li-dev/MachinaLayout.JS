import { describe, expect, it } from "vitest";
import { edge, fixed, guide, stackArrange, when } from "../../src/machina";

const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
    throw new Error("expected throw");
  } catch (error) {
    expect((error as { code?: string }).code).toBe(code);
  }
};

describe("machina guide", () => {
  it("creates edge refs and validates runtime inputs", () => {
    expect(edge("trigger", "bottom", 4)).toEqual({ ref: "trigger", edge: "bottom", offset: 4 });
    expectCode(() => edge("", "left"), "InvalidGuideEdge");
    expectCode(() => edge("a", "bad" as any), "InvalidGuideEdge");
  });

  it("lowers guide frame and preserves edge refs", () => {
    const row = guide("dropdown", {
      left: edge("trigger", "left"),
      right: edge("trigger", "right"),
      top: edge("trigger", "bottom", 4),
      height: 240,
    }).rows()[0];
    expect(row.frame).toEqual({
      kind: "guide",
      left: { ref: "trigger", edge: "left" },
      right: { ref: "trigger", edge: "right" },
      top: { ref: "trigger", edge: "bottom", offset: 4 },
      bottom: undefined,
      width: undefined,
      height: 240,
    });
  });

  it("injects parents, preserves explicit parent, and propagates stack axis", () => {
    const rows = guide("outer", { arrange: stackArrange("vertical") }, [
      guide("inner", { parent: "explicit", width: 10 }),
      fixed("f", 5),
    ]).rows();
    expect(rows[1].parent).toBe("explicit");
    expect(rows[2].parent).toBe("outer");
    expect(rows[2].frame).toEqual({ kind: "fixed", height: 5 });
  });

  it("preserves metadata, variants, and returns fresh rows", () => {
    const variants = [when({ minWidth: 10 }, { view: "Wide" })];
    const node = guide("g", {
      left: 0,
      top: 0,
      width: 10,
      height: 10,
      view: "V",
      slot: "s",
      debugLabel: "d",
      layer: "overlay",
      z: 10,
      variants,
    });
    expect(node.rows()[0]).toMatchObject({
      view: "V",
      slot: "s",
      debugLabel: "d",
      layer: "overlay",
      z: 10,
      variants,
    });
    expect(node.rows()[0]).not.toBe(node.rows()[0]);
  });
});
