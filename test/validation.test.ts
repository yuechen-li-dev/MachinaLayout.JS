import { describe, expect, it } from "vitest";
import {
  assertFiniteNumber,
  assertNonNegativeGap,
  assertNonNegativePadding,
  assertNonNegativeSize,
} from "../src";

describe("assertFiniteNumber", () => {
  it("accepts finite values", () => {
    expect(() => assertFiniteNumber(0, "value")).not.toThrow();
    expect(() => assertFiniteNumber(42.5, "value")).not.toThrow();
  });

  it("rejects NaN and infinities with NonFiniteNumber", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => assertFiniteNumber(bad, "value")).toThrowError(
        expect.objectContaining({ code: "NonFiniteNumber" })
      );
    }
  });
});

describe("assertNonNegativeSize", () => {
  it("accepts zero and positive values", () => {
    expect(() => assertNonNegativeSize(0, "size")).not.toThrow();
    expect(() => assertNonNegativeSize(1, "size")).not.toThrow();
  });

  it("rejects negative values with NegativeSize", () => {
    expect(() => assertNonNegativeSize(-1, "size")).toThrowError(
      expect.objectContaining({ code: "NegativeSize" })
    );
  });

  it("rejects non-finite values with NonFiniteNumber", () => {
    expect(() => assertNonNegativeSize(Number.NaN, "size")).toThrowError(
      expect.objectContaining({ code: "NonFiniteNumber" })
    );
  });
});

describe("assertNonNegativeGap", () => {
  it("accepts zero and positive values", () => {
    expect(() => assertNonNegativeGap(0)).not.toThrow();
    expect(() => assertNonNegativeGap(3)).not.toThrow();
  });

  it("rejects negative values with NegativeGap", () => {
    expect(() => assertNonNegativeGap(-1)).toThrowError(
      expect.objectContaining({ code: "NegativeGap" })
    );
  });

  it("rejects non-finite values with NonFiniteNumber", () => {
    expect(() => assertNonNegativeGap(Number.POSITIVE_INFINITY)).toThrowError(
      expect.objectContaining({ code: "NonFiniteNumber" })
    );
  });
});

describe("assertNonNegativePadding", () => {
  it("accepts zero and positive values", () => {
    expect(() => assertNonNegativePadding(0)).not.toThrow();
    expect(() => assertNonNegativePadding(3)).not.toThrow();
  });

  it("rejects negative values with NegativePadding", () => {
    expect(() => assertNonNegativePadding(-1)).toThrowError(
      expect.objectContaining({ code: "NegativePadding" })
    );
  });

  it("rejects non-finite values with NonFiniteNumber", () => {
    expect(() => assertNonNegativePadding(Number.NEGATIVE_INFINITY)).toThrowError(
      expect.objectContaining({ code: "NonFiniteNumber" })
    );
  });
});
