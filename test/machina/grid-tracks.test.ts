import { describe, expect, it } from "vitest";
import { MachinaAuthoringError, trackFill, trackFixed } from "../../src/machina";

function expectCode(fn: () => unknown, code: string) {
  expect(fn).toThrow(MachinaAuthoringError);
  try {
    fn();
  } catch (error) {
    expect((error as MachinaAuthoringError).code).toBe(code);
  }
}

describe("machina grid tracks", () => {
  it("creates fixed and fill tracks", () => {
    expect(trackFixed(100)).toEqual({ kind: "fixed", size: 100 });
    expect(trackFill()).toEqual({ kind: "fill", weight: 1 });
    expect(trackFill(2)).toEqual({ kind: "fill", weight: 2 });
  });

  it("rejects invalid tracks", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expectCode(() => trackFixed(value), "InvalidGridTrack");
      expectCode(() => trackFill(value), "InvalidGridTrack");
    }
  });
});
