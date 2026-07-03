import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExport";
import {
  createCanvasUnitSystem,
  formatCanvasMeasurement,
  pixelsToUnits,
  unitsToPixels,
} from "../../apps/machina-canvas/src/canvasUnits";
import {
  getSelectedObjectMeasurements,
  measureAlignmentDelta,
  measureCenterDistance,
  measureObjectGap,
  measureObjectSize,
} from "../../apps/machina-canvas/src/sceneMeasurement";
import { getObjectBoundsSummary, summarizeScene } from "../../apps/machina-canvas/src/sceneSummary";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";

const document: CanvasDocument = {
  id: "measure-demo",
  name: "Measure Demo",
  width: 300,
  height: 200,
  unit: "px",
  unitSystem: createCanvasUnitSystem("px"),
  selectedObjectId: "a",
  layers: [{ id: "main", name: "Main", visible: true, objectIds: ["a", "b", "c"] }],
  objects: {
    a: {
      id: "a",
      name: "A",
      kind: "rect",
      layerId: "main",
      visible: true,
      x: 10,
      y: 20,
      width: 40,
      height: 30,
    },
    b: {
      id: "b",
      name: "B",
      kind: "rect",
      layerId: "main",
      visible: true,
      x: 70,
      y: 25,
      width: 50,
      height: 35,
    },
    c: {
      id: "c",
      name: "C",
      kind: "ellipse",
      layerId: "main",
      visible: true,
      x: 35,
      y: 75,
      width: 30,
      height: 20,
    },
  },
};

describe("MachinaCanvas units and measurements", () => {
  it("creates built-in unit systems and safe overrides", () => {
    expect(createCanvasUnitSystem()).toMatchObject({
      unit: "px",
      label: "px",
      pixelsPerUnit: 1,
      precision: 0,
    });
    expect(createCanvasUnitSystem("mm").pixelsPerUnit).toBeGreaterThan(0);
    expect(createCanvasUnitSystem("cu", { label: "tile", pixelsPerUnit: 8 })).toMatchObject({
      unit: "cu",
      label: "tile",
      pixelsPerUnit: 8,
    });
    expect(() => createCanvasUnitSystem("px", { pixelsPerUnit: 0 })).toThrow(/pixelsPerUnit/);
  });

  it("formats and converts measurements by document unit", () => {
    const px = createCanvasUnitSystem("px");
    const mm = createCanvasUnitSystem("mm");

    expect(formatCanvasMeasurement(12.4, px)).toBe("12 px");
    expect(formatCanvasMeasurement(12.345, mm)).toBe("12.35 mm");
    expect(pixelsToUnits(unitsToPixels(42, mm), mm)).toBeCloseTo(42);
  });

  it("measures object size, centers, gaps, and alignment deltas", () => {
    const a = document.objects.a;
    const b = document.objects.b;
    const c = document.objects.c;

    expect(measureObjectSize(document, a).map((measurement) => measurement.value)).toEqual([
      40, 30,
    ]);
    expect(measureCenterDistance(document, a, b).value).toBeCloseTo(Math.hypot(95 - 30, 42.5 - 35));
    expect(measureObjectGap(document, a, b, "horizontal").value).toBe(20);
    expect(measureObjectGap(document, a, c, "horizontal").value).toBe(-15);
    expect(measureObjectGap(document, a, c, "vertical").value).toBe(25);
    expect(measureAlignmentDelta(document, a, b, "left").value).toBe(60);
    expect(measureAlignmentDelta(document, a, b, "centerX").value).toBe(65);
    expect(measureAlignmentDelta(document, a, b, "top").value).toBe(5);
  });

  it("reports selected-object and document measurements", () => {
    expect(getSelectedObjectMeasurements(document).map((measurement) => measurement.label)).toEqual(
      ["a width", "a height", "a x", "a y", "a center x", "a center y"],
    );

    const unselected = { ...document, selectedObjectId: undefined };
    expect(
      getSelectedObjectMeasurements(unselected).map((measurement) => measurement.label),
    ).toEqual(["document width", "document height"]);
  });

  it("includes formatted units in summaries and exports", () => {
    expect(summarizeScene(document)).toContain("300 px x 200 px");
    expect(getObjectBoundsSummary(document.objects.a, document)).toContain("w=40 h=30 px");

    const bundle = createCanvasExportBundle(document);
    const documentJson = JSON.parse(
      bundle.files.find((file) => file.path === "document.json")?.text ?? "",
    ) as { document: { unitSystem?: unknown } };
    const handoffToml = bundle.files.find((file) => file.path === "handoff.toml")?.text ?? "";

    expect(documentJson.document.unitSystem).toEqual({
      unit: "px",
      label: "px",
      unitsPerInch: 96,
      pixelsPerUnit: 1,
      precision: 0,
    });
    expect(handoffToml).toContain("[unit_system]");
  });

  it("keeps fixture unit metadata checked in", () => {
    const fixtureRoot = join(
      process.cwd(),
      "apps",
      "machina-canvas",
      "fixtures",
      "demo-poster.mcanvas",
    );
    const documentJson = JSON.parse(readFileSync(join(fixtureRoot, "document.json"), "utf8")) as {
      document: { unitSystem?: unknown };
    };
    const handoffToml = readFileSync(join(fixtureRoot, "handoff.toml"), "utf8");

    expect(documentJson.document.unitSystem).toEqual({
      unit: "px",
      label: "px",
      unitsPerInch: 96,
      pixelsPerUnit: 1,
      precision: 0,
    });
    expect(handoffToml).toContain("[unit_system]");
  });
});
