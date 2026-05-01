import { describe, expect, it } from "vitest";
import { normalizePadding } from "../src";

describe("normalizePadding", () => {
  it("returns zero edges for undefined", () => {
    expect(normalizePadding()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("expands numbers to all edges", () => {
    expect(normalizePadding(8)).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });

  it("copies object values without mutating input", () => {
    const input = { top: 1, right: 2, bottom: 3, left: 4 };
    const result = normalizePadding(input);

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(input).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
  });

  it("rejects negative edges with NegativePadding", () => {
    expect(() => normalizePadding({ top: -1, right: 0, bottom: 0, left: 0 })).toThrowError(
      expect.objectContaining({ code: "NegativePadding" })
    );
  });

  it("rejects non-finite edges with NonFiniteNumber", () => {
    expect(() =>
      normalizePadding({ top: Number.NaN, right: 0, bottom: 0, left: 0 })
    ).toThrowError(expect.objectContaining({ code: "NonFiniteNumber" }));
  });
});
