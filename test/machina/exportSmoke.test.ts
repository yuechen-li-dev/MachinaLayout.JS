import { describe, expect, it } from "vitest";
import {
  M,
  anchor,
  area,
  cell,
  edge,
  fill,
  fixed,
  grid,
  gridRows,
  guide,
  hstack,
  onLayer,
  defineLayers,
  root,
  rows,
  skip,
  trackFill,
  trackFixed,
  screen,
  text,
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
        M.edge,
        edge,
        M.guide,
        guide,
        M.text,
        text,
        M.onLayer,
        onLayer,
        M.defineLayers,
        defineLayers,
        M.screen,
        screen,
      ].every((fn) => typeof fn === "function"),
    ).toBe(true);
    const rootPackage = await import("../../src");
    expect("M" in rootPackage).toBe(false);
  });
});
