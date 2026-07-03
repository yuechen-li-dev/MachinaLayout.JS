import { describe, expect, it } from "vitest";
import { anchor, fixed, stackArrange, when } from "../../src/machina";

describe("machina anchor", () => {
  it("lowers anchor and injects child parent", () =>
    expect(
      anchor("a", { left: 0, top: 0, width: 10, height: 10 }, [anchor("b", { width: 1 })]).rows()[1]
        .parent,
    ).toBe("a"));
  it("preserves explicit parent and fields", () => {
    const variants = [when({ minWidth: 10 }, { view: "Wide" })];
    expect(
      anchor("a", {
        parent: "p",
        width: 1,
        view: "V",
        slot: "s",
        debugLabel: "d",
        layer: "l",
        z: 2,
        variants,
      }).rows()[0],
    ).toMatchObject({
      parent: "p",
      view: "V",
      slot: "s",
      debugLabel: "d",
      layer: "l",
      z: 2,
      variants,
    });
  });
  it("propagates stack axis through arrange", () =>
    expect(
      anchor("a", { arrange: stackArrange("vertical") }, [fixed("f", 5)]).rows()[1].frame,
    ).toEqual({ kind: "fixed", height: 5 }));
});
