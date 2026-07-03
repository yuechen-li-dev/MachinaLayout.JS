import { describe, expect, it } from "vitest";
import * as root from "../../src/index";
import {
  defineMachinaAtlas,
  extractMachinaSection,
  formatMachinaAtlasSummary,
  formatMachinaAtlasValidationReport,
  parseMachinaSectionMarkers,
  validateMachinaAtlas,
} from "../../src/atlas";

describe("atlas exports", () => {
  it("exports atlas helpers from the atlas subpath", () => {
    const atlas = defineMachinaAtlas({ app: "App" });
    expect(formatMachinaAtlasSummary(atlas)).toContain("MachinaAtlas: App");
    expect(parseMachinaSectionMarkers("// @machina-section A")).toHaveLength(1);
    expect(extractMachinaSection("// @machina-section A", "A").name).toBe("A");
    const validation = validateMachinaAtlas({ atlas, sourceText: "" });
    expect(formatMachinaAtlasValidationReport(validation)).toContain("MachinaAtlas validation");
  });

  it("does not root-export atlas helpers", () => {
    expect("defineMachinaAtlas" in root).toBe(false);
  });
});
