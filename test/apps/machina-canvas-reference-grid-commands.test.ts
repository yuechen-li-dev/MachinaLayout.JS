import { describe, expect, it } from "vitest";
import {
  gridPointRefToCanvasPoint,
  gridSpanRefToCanvasRect,
  parseGridPointRef,
  parseGridSpanRef,
} from "../../apps/machina-canvas/src/referenceGrid";
import {
  applyCanvasCommands,
  validateCanvasCommands,
  type CanvasCommand,
} from "../../apps/machina-canvas/src/sceneCommands";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";

const document: CanvasDocument = {
  id: "grid-command-demo",
  name: "Grid Command Demo",
  width: 600,
  height: 400,
  unit: "px",
  unitSystem: createCanvasUnitSystem("px"),
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
      id: "main",
      name: "Main",
      visible: true,
      objectIds: ["a", "b", "c"],
    },
  ],
  objects: {
    a: {
      id: "a",
      name: "A",
      kind: "rect",
      layerId: "main",
      visible: true,
      x: 10,
      y: 20,
      width: 20,
      height: 10,
      fill: "#ffffff",
    },
    b: {
      id: "b",
      name: "B",
      kind: "rect",
      layerId: "main",
      visible: true,
      x: 80,
      y: 90,
      width: 30,
      height: 20,
      fill: "#eeeeee",
    },
    c: {
      id: "c",
      name: "C",
      kind: "ellipse",
      layerId: "main",
      visible: true,
      x: 300,
      y: 200,
      width: 40,
      height: 40,
      fill: "#dddddd",
    },
  },
};

describe("MachinaCanvas reference grid command refs", () => {
  it("parses point refs", () => {
    expect(parseGridPointRef("A1")).toMatchObject({
      cell: "A1",
      columnLabel: "A",
      rowLabel: "1",
      col: 0,
      row: 0,
    });
    expect(parseGridPointRef("D3.ne")).toMatchObject({
      cell: "D3",
      subcell: "ne",
      col: 3,
      row: 2,
    });
    expect(parseGridPointRef("B4@0.5,0.25")).toMatchObject({
      cell: "B4",
      localX: 0.5,
      localY: 0.25,
    });
  });

  it("rejects invalid point refs", () => {
    expect(() => parseGridPointRef("11")).toThrow(/Invalid grid point ref/);
    expect(() => parseGridPointRef("A5", { rows: 4 })).toThrow(/outside/);
    expect(() => parseGridPointRef("A1@1.2,0.5")).toThrow(/between 0 and 1/);
  });

  it("parses and normalizes spans", () => {
    expect(parseGridSpanRef("A2-C3")).toMatchObject({
      start: { cell: "A2", col: 0, row: 1 },
      end: { cell: "C3", col: 2, row: 2 },
      span: "A2-C3",
    });
    expect(parseGridSpanRef("C3-A2").span).toBe("A2-C3");
    expect(parseGridSpanRef("D3").span).toBe("D3");
    expect(() => parseGridSpanRef("A1.ne-B2")).toThrow(/whole cell/);
  });

  it("converts refs back to canvas coordinates", () => {
    expect(gridPointRefToCanvasPoint("A1", 600, 400)).toEqual({ x: 50, y: 50 });
    expect(gridPointRefToCanvasPoint("D3.ne", 600, 400)).toEqual({ x: 400, y: 200 });
    expect(gridPointRefToCanvasPoint("B4@0.5,0.25", 600, 400)).toEqual({
      x: 150,
      y: 325,
    });
    expect(gridSpanRefToCanvasRect("A2-C3", 600, 400)).toEqual({
      x: 0,
      y: 100,
      width: 300,
      height: 200,
    });
  });

  it("validates grid-aware commands", () => {
    const valid: CanvasCommand[] = [
      { kind: "moveToGrid", id: "a", ref: "B2.c" },
      { kind: "alignToGrid", ids: ["a"], axis: "left", ref: "A1.w" },
      { kind: "resizeToGridSpan", id: "b", span: "D2-E3" },
      {
        kind: "setFrame",
        id: "c",
        frame: { kind: "referenceGrid", ref: "D3.c", width: 40, height: 40 },
      },
    ];

    expect(validateCanvasCommands(document, valid).ok).toBe(true);
    expect(
      validateCanvasCommands(document, { kind: "moveToGrid", id: "a", ref: "Z1" }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidGridRef" }));
    expect(
      validateCanvasCommands(document, {
        kind: "moveToGrid",
        id: "a",
        ref: "A1",
        anchor: "middle",
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidAnchor" }));
    expect(
      validateCanvasCommands(document, {
        kind: "alignToGrid",
        ids: ["a"],
        axis: "left",
        ref: "A9",
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidGridRef" }));
    expect(
      validateCanvasCommands(document, { kind: "resizeToGridSpan", id: "b", span: "A1.ne-B2" })
        .diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidGridSpan" }));
    expect(
      validateCanvasCommands(document, {
        kind: "setFrame",
        id: "c",
        frame: { kind: "anchor", left: 10, width: 20, height: 30 },
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidFrame" }));
    expect(
      validateCanvasCommands(document, {
        kind: "setFrame",
        id: "c",
        frame: { kind: "referenceGrid", ref: "Z1", width: 40, height: 40 },
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidFrameReference" }));
  });

  it("applies moveToGrid without mutating the original document", () => {
    const before = JSON.stringify(document);
    const center = applyCanvasCommands(document, [{ kind: "moveToGrid", id: "a", ref: "B2.c" }]);
    const topLeft = applyCanvasCommands(document, [
      { kind: "moveToGrid", id: "a", ref: "A1.nw", anchor: "topLeft" },
    ]);

    expect(center.document.objects.a).toMatchObject({ x: 140, y: 145 });
    expect(center.results[0].message).toBe("Moved a center to B2.c.");
    expect(topLeft.document.objects.a).toMatchObject({ x: 0, y: 0 });
    expect(JSON.stringify(document)).toBe(before);
  });

  it("applies alignToGrid and resizeToGridSpan", () => {
    const applied = applyCanvasCommands(document, [
      { kind: "alignToGrid", ids: ["a", "b"], axis: "left", ref: "A1.w" },
      { kind: "alignToGrid", ids: ["c"], axis: "centerY", ref: "D3.c" },
      { kind: "resizeToGridSpan", id: "b", span: "D2-E3" },
    ]);

    expect(applied.document.objects.a.x).toBe(0);
    expect(applied.document.objects.b).toMatchObject({
      x: 300,
      y: 100,
      width: 200,
      height: 200,
    });
    expect(applied.document.objects.c.y).toBe(230);
    expect(applied.results[0].message).toBe("Aligned 2 objects left to A1.w.");
    expect(applied.results[1].changes).toContainEqual(
      expect.objectContaining({ objectId: "c", field: "y", before: 200, after: 230 }),
    );
    expect(applied.results[2].changes.map((change) => change.field)).toEqual([
      "x",
      "y",
      "width",
      "height",
    ]);
  });

  it("applies setFrame and records frame plus resolved geometry changes", () => {
    const absolute = applyCanvasCommands(document, [
      {
        kind: "setFrame",
        id: "a",
        frame: { kind: "absolute", x: 5, y: 6, width: 70, height: 80 },
      },
    ]);
    const anchor = applyCanvasCommands(document, [
      {
        kind: "setFrame",
        id: "a",
        frame: { kind: "anchor", right: 10, bottom: 20, width: 70, height: 80 },
      },
    ]);
    const grid = applyCanvasCommands(document, [
      {
        kind: "setFrame",
        id: "a",
        frame: { kind: "referenceGrid", ref: "B2.c", width: 20, height: 10 },
      },
    ]);

    expect(absolute.document.objects.a).toMatchObject({ x: 5, y: 6, width: 70, height: 80 });
    expect(absolute.document.objects.a.frame).toEqual({
      kind: "absolute",
      x: 5,
      y: 6,
      width: 70,
      height: 80,
    });
    expect(anchor.document.objects.a).toMatchObject({ x: 520, y: 300, width: 70, height: 80 });
    expect(grid.document.objects.a).toMatchObject({ x: 140, y: 145, width: 20, height: 10 });
    expect(grid.results[0].changes.map((change) => change.field)).toEqual(["frame", "x", "y"]);
    expect(grid.results[0].message).toBe("Set a frame to referenceGrid.");
  });
});
