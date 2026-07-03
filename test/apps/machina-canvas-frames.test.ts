import { describe, expect, it } from "vitest";
import {
  applyCanvasObjectFrame,
  resolveCanvasDocumentFrames,
  resolveCanvasFrame,
  resolveCanvasObjectFrame,
} from "../../apps/machina-canvas/src/canvasFrames";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";

const document: CanvasDocument = {
  id: "frame-demo",
  name: "Frame Demo",
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
  layers: [{ id: "main", name: "Main", visible: true, objectIds: ["a", "b"] }],
  objects: {
    a: {
      id: "a",
      name: "A",
      kind: "rect",
      layerId: "main",
      visible: true,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      frame: { kind: "anchor", left: 20, top: 30, width: 50, height: 60 },
    },
    b: {
      id: "b",
      name: "B",
      kind: "ellipse",
      layerId: "main",
      visible: true,
      x: 100,
      y: 110,
      width: 70,
      height: 80,
    },
  },
};

describe("MachinaCanvas canvas frames", () => {
  it("resolves absolute frames directly", () => {
    expect(
      resolveCanvasFrame({ kind: "absolute", x: 1, y: 2, width: 3, height: 4 }, { document }),
    ).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });

  it("resolves anchor left/top/width/height", () => {
    expect(
      resolveCanvasFrame(
        { kind: "anchor", left: 12, top: 16, width: 80, height: 40 },
        { document },
      ),
    ).toEqual({ x: 12, y: 16, width: 80, height: 40 });
  });

  it("resolves anchor right/bottom/width/height", () => {
    expect(
      resolveCanvasFrame(
        { kind: "anchor", right: 12, bottom: 16, width: 80, height: 40 },
        { document },
      ),
    ).toEqual({ x: 508, y: 344, width: 80, height: 40 });
  });

  it("resolves anchor left/right/top/bottom", () => {
    expect(
      resolveCanvasFrame(
        { kind: "anchor", left: 12, right: 18, top: 20, bottom: 30 },
        { document },
      ),
    ).toEqual({ x: 12, y: 20, width: 570, height: 350 });
  });

  it("rejects invalid anchor exact-two rules", () => {
    expect(() =>
      resolveCanvasFrame({ kind: "anchor", left: 12, width: 80, height: 40 }, { document }),
    ).toThrow(/exactly two vertical/);
    expect(() =>
      resolveCanvasFrame(
        { kind: "anchor", left: 12, right: 18, width: 80, top: 20, height: 30 },
        { document },
      ),
    ).toThrow(/exactly two horizontal/);
  });

  it("resolves referenceGrid frames with anchor and size", () => {
    expect(
      resolveCanvasFrame(
        { kind: "referenceGrid", ref: "B2.c", anchor: "center", width: 40, height: 20 },
        { document },
      ),
    ).toEqual({ x: 130, y: 140, width: 40, height: 20 });
  });

  it("resolves referenceGridSpan frames", () => {
    expect(resolveCanvasFrame({ kind: "referenceGridSpan", span: "A2-C3" }, { document })).toEqual({
      x: 0,
      y: 100,
      width: 300,
      height: 200,
    });
  });

  it("resolves and applies object frames without mutating the object", () => {
    const object = document.objects.a;
    const before = JSON.stringify(object);

    expect(resolveCanvasObjectFrame(object, { document })).toEqual({
      x: 20,
      y: 30,
      width: 50,
      height: 60,
    });

    const applied = applyCanvasObjectFrame(object, { document });
    expect(applied).toMatchObject({ x: 20, y: 30, width: 50, height: 60 });
    expect(applied.frame).toEqual(object.frame);
    expect(JSON.stringify(object)).toBe(before);
  });

  it("resolves document frames without mutating the document", () => {
    const before = JSON.stringify(document);
    const resolved = resolveCanvasDocumentFrames(document);

    expect(resolved).not.toBe(document);
    expect(resolved.objects.a).toMatchObject({ x: 20, y: 30, width: 50, height: 60 });
    expect(resolved.objects.b).toBe(document.objects.b);
    expect(JSON.stringify(document)).toBe(before);
  });
});
