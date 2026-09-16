import { describe, expect, it } from "vitest";

import { clientPointToViewport, panViewport, zoomViewport } from "../src/viewport2d";

describe("viewport2d", () => {
  it("converts client coordinates into model coordinates", () => {
    expect(
      clientPointToViewport(
        { left: 100, top: 50, width: 400, height: 200 },
        { x: 20, y: 10, width: 800, height: 400 },
        300,
        150,
      ),
    ).toEqual({ x: 420, y: 210 });
  });

  it("zooms about the viewport center and clamps width", () => {
    expect(
      zoomViewport(
        { x: 0, y: 0, width: 900, height: 600 },
        0.5,
        { minWidth: 80, maxWidth: 3600 },
      ),
    ).toEqual({ x: 225, y: 150, width: 450, height: 300 });
  });

  it("pans in model coordinates", () => {
    expect(
      panViewport(
        { x: 0, y: 0, width: 900, height: 600 },
        { left: 0, top: 0, width: 900, height: 600 },
        90,
        -60,
      ),
    ).toEqual({ x: -90, y: 60, width: 900, height: 600 });
  });
});
