import { describe, expect, it } from "vitest";
import * as root from "../../src/index";
import {
  Atlas,
  defineAtlasFromTable,
  defineMachinaAtlas,
  describeAtlasSections,
  extractMachinaSection,
  formatMachinaAtlasSummary,
  formatMachinaAtlasValidationReport,
  parseMachinaSectionMarkers,
  sectionTableSchema,
  sectionsFromTable,
  validateMachinaAtlas,
  validateAtlasSectionTable,
} from "../../src/atlas";
import { Table } from "../../src/table";

describe("atlas exports", () => {
  it("exports atlas helpers from the atlas subpath", () => {
    const atlas = defineMachinaAtlas({ app: "App" });
    const table = Table.define({
      id: "atlas",
      columns: {
        key: ["front-page"],
        name: ["Front Page"],
        kind: ["page"],
      },
    });
    expect(formatMachinaAtlasSummary(atlas)).toContain("MachinaAtlas: App");
    expect(parseMachinaSectionMarkers("// @machina-section A")).toHaveLength(1);
    expect(extractMachinaSection("// @machina-section A", "A").name).toBe("A");
    const validation = validateMachinaAtlas({ atlas, sourceText: "" });
    expect(formatMachinaAtlasValidationReport(validation)).toContain("MachinaAtlas validation");
    expect(Atlas.sectionTableSchema).toBeTypeOf("function");
    expect(sectionTableSchema()).toMatchObject({ kind: "tableSchema" });
    expect(sectionsFromTable(table)[0]?.key).toBe("front-page");
    expect(validateAtlasSectionTable(table)).toEqual([]);
    expect(
      defineAtlasFromTable({
        app: "App",
        sections: table,
      }).sections,
    ).toHaveLength(1);
    expect(describeAtlasSections(sectionsFromTable(table), "atlas").sectionCount).toBe(1);
  });

  it("does not root-export atlas helpers", () => {
    expect("defineMachinaAtlas" in root).toBe(false);
    expect("Atlas" in root).toBe(false);
  });
});
