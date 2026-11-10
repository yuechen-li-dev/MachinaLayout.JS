import { describe, expect, it } from "vitest";
import type { AsyncTaskDiagnostic } from "../../src/async";
import type { MachinaAtlasValidationDiagnostic } from "../../src/atlas";
import type { BatchDiagnostic } from "../../src/batch";
import type { CaptureDiagnostic } from "../../src/capture";
import type { ArtifactDiagnostic, Assert, Extends } from "../../src/comptime";
import type { ConceptDiagnostic } from "../../src/concept";
import { formatConceptDiagnostics, T } from "../../src/concept";
import { D, type MachinaDiagnostic } from "../../src/diagnostics";
import type { IterDiagnostic, WorkflowDiagnostic } from "../../src/iter";
import type { TableQueryDiagnostic } from "../../src/query";
import type { StaticMachineDiagnostic } from "../../src/static";
import type { MachinaStyleDiagnostic } from "../../src/style";
import type { TableDiagnostic } from "../../src/table";
import { Table, type TableError } from "../../src/table";
import type { MachinaTextDiagnostic } from "../../src/text";
import { parseMachinaText } from "../../src/text";

// Every module's diagnostic is a MachinaDiagnostic: no adapters needed.
type _all = Assert<
  Extends<
    | AsyncTaskDiagnostic
    | MachinaAtlasValidationDiagnostic
    | BatchDiagnostic
    | CaptureDiagnostic
    | ArtifactDiagnostic
    | ConceptDiagnostic
    | IterDiagnostic
    | WorkflowDiagnostic
    | TableQueryDiagnostic
    | StaticMachineDiagnostic
    | MachinaStyleDiagnostic
    | TableDiagnostic
    | MachinaTextDiagnostic,
    MachinaDiagnostic
  >
>;

const Order = T.concept({ id: "Order", fields: { id: T.string(), total: T.number() } });

describe("unified diagnostics", () => {
  it("combines modules without adapters and keeps module-specific fields", () => {
    const concept = T.validate(Order, { id: "o-1", totl: 3 });
    let table: readonly TableDiagnostic[] = [];
    try {
      Table.define({ id: "t", columns: { a: [1, 2], b: [1] } });
    } catch (error) {
      table = (error as TableError).diagnostics;
    }
    expect(table.map((d) => d.code)).toContain("ColumnLengthMismatch");
    const all = D.collect(D.within("orders[0]", concept), table);

    const first = all[0];
    expect(first).toMatchObject({ code: "MissingConceptField", path: "orders[0].total" });
    // fix travels with its path when re-based
    expect(first && "fix" in first && first.fix).toEqual({
      op: "rename",
      path: "orders[0].totl",
      to: "total",
    });
    expect(all.some((d) => d.code !== "MissingConceptField")).toBe(true);
  });

  it("formats any mix with one engine", () => {
    const concept = D.from(T.validate(Order, { id: "o-1" }), { source: "concept" });
    const text = parseMachinaText("## ok\n\n<b>no html</b>").diagnostics;
    expect(D.format(D.collect(concept, text), { style: "line", includeSource: true })).toBe(
      [
        "[error] MissingConceptField at total (concept): missing required number [fix: add total: number]",
        ...text.map((d) => `[error] ${d.code} at ${d.path} (text): ${d.message}`),
      ].join("\n"),
    );
  });

  it("module formatters are views of the same engine", () => {
    const diagnostics = T.validate(Order, {});
    expect(formatConceptDiagnostics(diagnostics)).toBe(
      D.format(diagnostics, { style: "line", empty: "No concept diagnostics." }),
    );
  });

  it("D.from is lossless and only fills a missing source", () => {
    const [diagnostic] = D.from(T.validate(Order, { id: "x" }), { source: "concept" });
    expect(diagnostic).toMatchObject({ source: "concept", concept: "Order", expected: "number" });
    const [kept] = D.from([{ ...diagnostic!, source: "custom" }], { source: "concept" });
    expect(kept?.source).toBe("custom");
  });
});
