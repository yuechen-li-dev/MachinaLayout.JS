import { describe, expect, it } from "vitest";
import { M, anchor, fill, fixed, hstack, root, rows, vstack } from "../../src/machina";

describe("machina exports", () => {
  it("exports M and named helpers", async () => {
    expect(
      [M.root, root, vstack, hstack, fixed, fill, anchor, rows].every(
        (fn) => typeof fn === "function",
      ),
    ).toBe(true);
    const rootPackage = await import("../../src");
    expect("M" in rootPackage).toBe(false);
  });
});
