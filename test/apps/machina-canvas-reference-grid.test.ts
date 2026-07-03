import { describe, expect, it } from "vitest";
import { createCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExport";
import { validateCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExportValidation";
import {
  boundsToGridRef,
  createReferenceGridConfig,
  getColumnLabel,
  objectToGridRef,
  pointToGridRef,
} from "../../apps/machina-canvas/src/referenceGrid";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import { getObjectBoundsSummary, summarizeScene } from "../../apps/machina-canvas/src/sceneSummary";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";

const document: CanvasDocument = {
  id: "grid-demo",
  name: "Grid Demo",
  width: 600,
  height: 400,
  unit: "px",
  unitSystem: createCanvasUnitSystem("px"),
  selectedObjectId: "feature-chip-1",
  referenceGrid: {
    columns: 6,
    rows: 4,
    columnStart: "A",
    rowStart: 1,
    showBorder: true,
    showLines: false,
    showLabels: true,
  },
  layers: [
    {
      id: "foreground",
      name: "Foreground",
      visible: true,
      objectIds: ["feature-chip-1"],
    },
  ],
  objects: {
    "feature-chip-1": {
      id: "feature-chip-1",
      name: "Feature chip",
      kind: "rect",
      layerId: "foreground",
      visible: true,
      x: 90,
      y: 290,
      width: 130,
      height: 34,
      fill: "#ffffff",
      radius: 17,
    },
  },
};

describe("MachinaCanvas reference grid", () => {
  it("creates the default grid config", () => {
    expect(createReferenceGridConfig()).toEqual({
      columns: 6,
      rows: 4,
      columnStart: "A",
      rowStart: 1,
      showBorder: true,
      showLines: false,
      showLabels: true,
    });
  });

  it("rejects invalid columns and rows", () => {
    expect(() => createReferenceGridConfig({ columns: 0 })).toThrow(/columns/);
    expect(() => createReferenceGridConfig({ rows: 1.5 })).toThrow(/rows/);
  });

  it("formats spreadsheet-style column labels", () => {
    expect(getColumnLabel(0)).toBe("A");
    expect(getColumnLabel(25)).toBe("Z");
    expect(getColumnLabel(26)).toBe("AA");
    expect(getColumnLabel(27)).toBe("AB");
  });

  it("converts points to clamped grid refs with subcells", () => {
    expect(pointToGridRef(0, 0, 600, 400).ref).toBe("A1.nw");
    expect(pointToGridRef(350, 250, 600, 400).ref).toBe("D3.c");
    expect(pointToGridRef(-20, -10, 600, 400).ref).toBe("A1.nw");
    expect(pointToGridRef(900, 900, 600, 400).ref).toBe("F4.se");
    expect(pointToGridRef(375, 225, 600, 400).subcell).toBe("ne");
  });

  it("converts bounds to same-cell and multi-cell spans", () => {
    expect(boundsToGridRef(10, 10, 50, 40, 600, 400).span).toBe("A1");
    expect(boundsToGridRef(90, 90, 30, 30, 600, 400).span).toBe("A1-B2");
    expect(boundsToGridRef(0, 0, 100, 100, 600, 400).span).toBe("A1");
  });

  it("converts canvas objects through the document dimensions", () => {
    const grid = objectToGridRef(document.objects["feature-chip-1"], document);

    expect(grid.span).toBe("A3-C4");
    expect(grid.center.ref).toBe("B4.n");
  });

  it("includes grid refs in scene summaries", () => {
    expect(getObjectBoundsSummary(document.objects["feature-chip-1"], document)).toContain("A3-C4");
    expect(summarizeScene(document)).toContain("center B4.n");
  });

  it("exports reference grid metadata in document.json and handoff.toml", () => {
    const bundle = createCanvasExportBundle(document);
    const documentJson = JSON.parse(
      bundle.files.find((file) => file.path === "document.json")?.text ?? "",
    ) as {
      referenceGrid: {
        columns: number;
        rows: number;
        columnLabels: string[];
        rowLabels: string[];
      };
    };
    const handoffToml = bundle.files.find((file) => file.path === "handoff.toml")?.text ?? "";

    expect(documentJson.referenceGrid).toEqual({
      columns: 6,
      rows: 4,
      columnLabels: ["A", "B", "C", "D", "E", "F"],
      rowLabels: ["1", "2", "3", "4"],
    });
    expect(handoffToml).toContain("[reference_grid]");
    expect(handoffToml).toContain('columns_label = "A-F"');
    expect(handoffToml).toContain('rows_label = "1-4"');
    expect(validateCanvasExportBundle(bundle).ok).toBe(true);
  });
});
