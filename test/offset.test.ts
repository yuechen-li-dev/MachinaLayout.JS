import { describe, expect, it } from "vitest";
import { applyOffset } from "../src";

describe("applyOffset", () => {
  it("applies numeric offsets", () => {
    const parent = { x: 100, y: 200, width: 800, height: 600 };
    const rect = { x: 120, y: 240, width: 50, height: 30 };
    expect(applyOffset(rect, parent, { x: 10, y: -5 })).toEqual({ x: 130, y: 235, width: 50, height: 30 });
  });

  it("supports px and ui objects and does not mutate input", () => {
    const parent = { x: 100, y: 200, width: 800, height: 600 };
    const rect = { x: 120, y: 240, width: 50, height: 30 };
    const offset = { x: { unit: "ui", value: 0.1 } as const, y: { unit: "ui", value: 0.1 } as const };
    const before = JSON.stringify({ parent, rect, offset });
    expect(applyOffset(rect, parent, offset)).toEqual({ x: 200, y: 300, width: 50, height: 30 });
    expect(applyOffset(rect, parent, { x: { unit: "px", value: 8 }, y: { unit: "px", value: -4 } })).toEqual({ x: 128, y: 236, width: 50, height: 30 });
    expect(JSON.stringify({ parent, rect, offset })).toBe(before);
  });
});
