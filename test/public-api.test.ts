import { describe, expect, it } from "vitest";
import type { LayoutRow } from "../src";
import { normalizePadding } from "../src";

describe("public API", () => {
  it("imports from index and types a LayoutRow", () => {
    const row: LayoutRow = {
      id: "root",
      frame: { kind: "fixed", width: 100, height: 100 },
    };

    expect(row.id).toBe("root");
    expect(normalizePadding(2)).toEqual({ top: 2, right: 2, bottom: 2, left: 2 });
  });
});
