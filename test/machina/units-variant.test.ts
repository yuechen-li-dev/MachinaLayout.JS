import { describe, expect, it } from "vitest";
import { px, ui, when } from "../../src/machina";

describe("machina units and variants", () => {
  it("creates lengths", () => {
    expect(px(4)).toEqual({ unit: "px", value: 4 });
    expect(ui(0.5)).toEqual({ unit: "ui", value: 0.5 });
  });
  it("rejects invalid lengths", () => {
    expect(() => px(Infinity)).toThrow();
    expect(() => ui(Number.NaN)).toThrow();
  });
  it("creates and validates variants", () => {
    expect(when({ minWidth: 1 }, { view: "A" })).toEqual({ when: { minWidth: 1 }, view: "A" });
    expect(() => when({ maxHeight: NaN }, {})).toThrow();
  });
});
