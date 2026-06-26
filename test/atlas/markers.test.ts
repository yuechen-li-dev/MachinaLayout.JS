import { describe, expect, it } from "vitest";
import { parseMachinaSectionMarkers } from "../../src/atlas";

describe("parseMachinaSectionMarkers", () => {
  it("handles no markers and empty source", () => {
    expect(parseMachinaSectionMarkers("")).toEqual([]);
    expect(parseMachinaSectionMarkers("const x = 1;")).toEqual([]);
  });

  it("parses line and block markers with positions", () => {
    expect(parseMachinaSectionMarkers("  // @machina-section Front Page")).toEqual([
      { name: "Front Page", line: 1, column: 6, raw: "  // @machina-section Front Page" },
    ]);
    expect(parseMachinaSectionMarkers("/* @machina-section Shared Shell */")[0].name).toBe(
      "Shared Shell",
    );
  });

  it("preserves order, strips trailing block close, and ignores empty markers", () => {
    const markers = parseMachinaSectionMarkers(
      "// @machina-section A\n// @machina-section \n/* @machina-section B */",
    );
    expect(markers.map((m) => m.name)).toEqual(["A", "B"]);
  });

  it("only accepts comment-starting lines", () => {
    expect(parseMachinaSectionMarkers('const s = "@machina-section Not a marker";')).toEqual([]);
  });
});
