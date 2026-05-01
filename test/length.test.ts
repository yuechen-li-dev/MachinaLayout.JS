import { describe, expect, it } from "vitest";
import { MachinaLayoutError, resolveUiLength, type UiLength } from "../src";

function expectCode(run: () => unknown, code: string): void {
  try { run(); throw new Error('expected throw'); } catch (error) {
    expect(error).toBeInstanceOf(MachinaLayoutError);
    expect((error as MachinaLayoutError).code).toBe(code);
  }
}

describe("resolveUiLength", () => {
  it("resolves px number and objects", () => {
    expect(resolveUiLength(12, 100)).toBe(12);
    expect(resolveUiLength({ unit: "px", value: 12 }, 100)).toBe(12);
  });

  it("resolves ui units", () => {
    expect(resolveUiLength({ unit: "ui", value: 0.25 }, 800)).toBe(200);
    expect(resolveUiLength({ unit: "ui", value: -0.1 }, 800)).toBe(-80);
    expect(resolveUiLength({ unit: "ui", value: 1.25 }, 800)).toBe(1000);
    expect(resolveUiLength({ unit: "ui", value: 1 / 3 }, 300)).toBeCloseTo(100);
  });

  it("rejects non-finite numbers", () => {
    expectCode(() => resolveUiLength(Number.NaN, 100), "NonFiniteNumber");
    expectCode(() => resolveUiLength({ unit: "px", value: Infinity }, 100), "NonFiniteNumber");
    expectCode(() => resolveUiLength({ unit: "ui", value: -Infinity }, 100), "NonFiniteNumber");
    expectCode(() => resolveUiLength(10, Number.NaN), "NonFiniteNumber");
    expectCode(() => resolveUiLength(10, Infinity), "NonFiniteNumber");
  });

  it("rejects invalid units and malformed objects", () => {
    expectCode(() => resolveUiLength({ unit: "percent", value: 0.5 } as unknown as UiLength, 100), "InvalidLengthUnit");
    expectCode(() => resolveUiLength({ unit: "ui" } as unknown as UiLength, 100), "InvalidLengthUnit");
    expectCode(() => resolveUiLength({ value: 0.5 } as unknown as UiLength, 100), "InvalidLengthUnit");
    expectCode(() => resolveUiLength({} as unknown as UiLength, 100), "InvalidLengthUnit");
  });
});
