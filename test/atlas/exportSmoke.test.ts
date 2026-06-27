import { describe, expect, it } from "vitest";
import * as root from "../../src/index";
import {
  defineMachinaAtlas,
  extractMachinaSection,
  formatMachinaAtlasSummary,
  parseMachinaSectionMarkers,
} from "../../src/atlas";

describe("atlas exports", () => {
  it("exports atlas helpers from the atlas subpath", () => {
    const atlas = defineMachinaAtlas({ app: "App" });
    expect(formatMachinaAtlasSummary(atlas)).toContain("MachinaAtlas: App");
    expect(parseMachinaSectionMarkers("// @machina-section A")).toHaveLength(1);
    expect(extractMachinaSection("// @machina-section A", "A").name).toBe("A");
  });

  it("does not root-export atlas helpers", () => {
    expect("defineMachinaAtlas" in root).toBe(false);
  });
});
