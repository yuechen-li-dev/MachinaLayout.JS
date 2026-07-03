import { describe, expect, it } from "vitest";
import {
  M,
  anchor,
  area,
  cell,
  fill,
  fixed,
  grid,
  gridRows,
  hstack,
  root,
  rows,
  skip,
  trackFill,
  trackFixed,
  vstack,
} from "../../src/machina";

describe("machina exports", () => {
  it("exports M and named helpers", async () => {
    expect(
      [
        M.root,
        root,
        vstack,
        hstack,
        fixed,
        fill,
        anchor,
        rows,
        grid,
        gridRows,
        area,
        skip,
        cell,
        trackFixed,
        trackFill,
      ].every((fn) => typeof fn === "function"),
    ).toBe(true);
    const rootPackage = await import("../../src");
    expect("M" in rootPackage).toBe(false);
  });
});
