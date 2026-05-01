import { describe, expect, it } from "vitest";
import { MachinaLayoutError } from "../src";

describe("MachinaLayoutError", () => {
  it("has stable name, code, and message", () => {
    const error = new MachinaLayoutError("NegativeGap", "gap must be non-negative");

    expect(error.name).toBe("MachinaLayoutError");
    expect(error.code).toBe("NegativeGap");
    expect(error.message).toBe("gap must be non-negative");
  });
});
