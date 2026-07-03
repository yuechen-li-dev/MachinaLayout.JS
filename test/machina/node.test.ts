import { describe, expect, it } from "vitest";
import { MachinaAuthoringError, node, root } from "../../src/machina";

describe("machina node/root", () => {
  it("lowers root and injects nested parents", () => {
    const layout = root("app", { arrange: { kind: "stack", axis: "vertical" } }, [
      node("child", { frame: { kind: "fill" } }, [node("grand", { frame: { kind: "fill" } })]),
    ]);
    expect(layout.rows()).toEqual([
      { id: "app", arrange: { kind: "stack", axis: "vertical" }, frame: { kind: "root" } },
      { id: "child", parent: "app", frame: { kind: "fill" } },
      { id: "grand", parent: "child", frame: { kind: "fill" } },
    ]);
  });
  it("preserves explicit parent", () =>
    expect(
      root("r", {}, [node("c", { parent: "x", frame: { kind: "fill" } })]).rows()[1].parent,
    ).toBe("x"));
  it("returns fresh rows", () => {
    const n = root("r");
    expect(n.rows()[0]).not.toBe(n.rows()[0]);
  });
  it("rejects duplicate and invalid ids", () => {
    expect(() => root("r", {}, [node("r", { frame: { kind: "fill" } })]).rows()).toThrow(
      MachinaAuthoringError,
    );
    expect(() => root(" ")).toThrow(MachinaAuthoringError);
  });
  it("rejects root with parent context", () =>
    expect(() => root("r").lower({ parentId: "p" })).toThrow(MachinaAuthoringError));
});
