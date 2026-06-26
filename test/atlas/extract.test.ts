import { describe, expect, it } from "vitest";
import {
  defineMachinaAtlas,
  extractMachinaAtlasSection,
  extractMachinaSection,
  extractMachinaSections,
} from "../../src/atlas";

const source =
  "// @machina-section Front Page\nfunction Front() {}\n// @machina-section Shared Shell\nfunction Shell() {}";

describe("MachinaAtlas extraction", () => {
  it("extracts all sections with inclusive line ranges and marker text", () => {
    const sections = extractMachinaSections(source);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ name: "Front Page", startLine: 1, endLine: 2 });
    expect(sections[0].text).toContain("// @machina-section Front Page");
    expect(sections[1]).toMatchObject({ name: "Shared Shell", startLine: 3, endLine: 4 });
  });

  it("extracts by exact name and case-insensitive fallback", () => {
    expect(extractMachinaSection(source, "Front Page").startLine).toBe(1);
    expect(extractMachinaSection(source, "shared shell").startLine).toBe(3);
  });

  it("throws coded marker errors", () => {
    expect(() => extractMachinaSection(source, "Missing")).toThrowError(/Unknown section marker/);
    expect(() =>
      extractMachinaSection("// @machina-section One\n// @machina-section one", "ONE"),
    ).toThrowError(/Ambiguous section marker/);
  });

  it("extracts through atlas marker and name fallback", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [
        { key: "front", name: "Front", marker: "Front Page" },
        { key: "shared", name: "Shared Shell" },
      ],
    });
    expect(extractMachinaAtlasSection(source, atlas, "front").name).toBe("Front Page");
    expect(extractMachinaAtlasSection(source, atlas, "shared").name).toBe("Shared Shell");
  });

  it("returns no sections for empty source", () => {
    expect(extractMachinaSections("")).toEqual([]);
  });
});
