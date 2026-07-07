import { describe, expect, it } from "vitest";
import { createCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExport";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import {
  nextZoomStep,
  panCanvasViewport,
  createCanvasViewport,
  fitCanvasViewport,
  getCanvasViewportViewBox,
  normalizeCanvasZoom,
  viewportForGridRef,
  viewportForGridSpan,
  viewportForObject,
  viewportForSpriteFrame,
} from "../../apps/machina-canvas/src/canvasViewport";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  getObjectsInViewport,
  summarizeViewport,
} from "../../apps/machina-canvas/src/viewportSummary";

const document: CanvasDocument = {
  id: "viewport-demo",
  name: "Viewport Demo",
  width: 600,
  height: 400,
  unit: "px",
  unitSystem: createCanvasUnitSystem("px"),
  selectedObjectId: "headline",
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
      id: "background",
      name: "Background",
      visible: true,
      objectIds: ["bg", "hidden-object"],
    },
    {
      id: "foreground",
      name: "Foreground",
      visible: true,
      objectIds: ["headline", "badge"],
    },
    {
      id: "hidden-layer",
      name: "Hidden Layer",
      visible: false,
      objectIds: ["hidden-layer-object"],
    },
  ],
  objects: {
    bg: {
      id: "bg",
      name: "Background",
      kind: "rect",
      layerId: "background",
      visible: true,
      x: 0,
      y: 0,
      width: 600,
      height: 400,
      fill: "#ffffff",
    },
    "hidden-object": {
      id: "hidden-object",
      name: "Hidden Object",
      kind: "rect",
      layerId: "background",
      visible: false,
      x: 260,
      y: 180,
      width: 40,
      height: 40,
      fill: "#ff0000",
    },
    headline: {
      id: "headline",
      name: "Headline",
      kind: "text",
      layerId: "foreground",
      visible: true,
      x: 90,
      y: 120,
      width: 140,
      height: 44,
      fill: "#111111",
      text: "Inspect me",
      fontSize: 24,
    },
    badge: {
      id: "badge",
      name: "Badge",
      kind: "ellipse",
      layerId: "foreground",
      visible: true,
      x: 430,
      y: 290,
      width: 60,
      height: 40,
      fill: "#eeeeff",
    },
    "hidden-layer-object": {
      id: "hidden-layer-object",
      name: "Hidden Layer Object",
      kind: "rect",
      layerId: "hidden-layer",
      visible: true,
      x: 260,
      y: 180,
      width: 40,
      height: 40,
      fill: "#00ff00",
    },
  },
};

const spriteImage: ImageObject = {
  id: "sheet",
  name: "Sheet",
  kind: "image",
  layerId: "foreground",
  visible: true,
  x: 100,
  y: 60,
  width: 120,
  height: 120,
  src: "/sheet.png",
  intrinsicWidth: 120,
  intrinsicHeight: 120,
};

describe("MachinaCanvas viewport", () => {
  it("creates a default viewport centered on the document at zoom 1", () => {
    expect(createCanvasViewport(document)).toEqual({
      zoom: 1,
      centerX: 300,
      centerY: 200,
      focus: { kind: "canvas" },
    });
  });

  it("clamps zoom values", () => {
    expect(normalizeCanvasZoom(0.1)).toBe(0.25);
    expect(normalizeCanvasZoom(20)).toBe(8);
    expect(normalizeCanvasZoom(Number.NaN)).toBe(1);
  });

  it("zooms in to the next higher stepped level", () => {
    expect(nextZoomStep(1, 1)).toBe(1.5);
    expect(nextZoomStep(1.1, 1)).toBe(1.5);
  });

  it("zooms out to the next lower stepped level", () => {
    expect(nextZoomStep(1, -1)).toBe(0.75);
    expect(nextZoomStep(1.6, -1)).toBe(1.5);
  });

  it("clamps zoom steps at the min and max levels", () => {
    expect(nextZoomStep(8, 1)).toBe(8);
    expect(nextZoomStep(0.25, -1)).toBe(0.25);
  });

  it("returns the full document viewBox at zoom 1", () => {
    expect(getCanvasViewportViewBox(document, fitCanvasViewport(document))).toEqual({
      x: 0,
      y: 0,
      width: 600,
      height: 400,
    });
  });

  it("halves the visible viewBox dimensions at zoom 2", () => {
    expect(getCanvasViewportViewBox(document, createCanvasViewport(document, { zoom: 2 }))).toEqual(
      {
        x: 150,
        y: 100,
        width: 300,
        height: 200,
      },
    );
  });

  it("centers the viewport on an object", () => {
    expect(viewportForObject(document, "headline")).toMatchObject({
      zoom: 4,
      centerX: 160,
      centerY: 142,
      focus: { kind: "object", objectId: "headline" },
    });
  });

  it("centers the viewport on a grid point ref", () => {
    expect(viewportForGridRef(document, "D3.ne")).toMatchObject({
      zoom: 4,
      centerX: 400,
      centerY: 200,
      focus: { kind: "gridRef", ref: "D3.ne" },
    });
  });

  it("centers the viewport on a grid span", () => {
    expect(viewportForGridSpan(document, "A2-C3")).toMatchObject({
      zoom: 3,
      centerX: 150,
      centerY: 200,
      focus: { kind: "gridSpan", span: "A2-C3" },
    });
  });

  it("rejects invalid grid viewport targets", () => {
    expect(() => viewportForGridRef(document, "Z9")).toThrow(/outside/);
    expect(() => viewportForGridSpan(document, "A2-C3.ne")).toThrow(/whole cell/);
  });

  it("finds visible objects intersecting the viewport", () => {
    const viewport = createCanvasViewport(document, { zoom: 4, centerX: 160, centerY: 142 });
    const objects = getObjectsInViewport(document, viewport).map((object) => object.id);

    expect(objects).toContain("headline");
    expect(objects).not.toContain("badge");
  });

  it("respects hidden objects and layers", () => {
    const viewport = createCanvasViewport(document, { zoom: 4, centerX: 280, centerY: 200 });
    const objects = getObjectsInViewport(document, viewport).map((object) => object.id);

    expect(objects).not.toContain("hidden-object");
    expect(objects).not.toContain("hidden-layer-object");
  });

  it("summarizes zoom, visible objects, and selection status", () => {
    const viewport = viewportForObject(document, "headline");
    const summary = summarizeViewport(document, viewport);

    expect(summary).toContain("Viewport: 400%");
    expect(summary).toContain("headline");
    expect(summary).toContain("Selected headline is visible");
  });

  it("includes viewport metadata in handoff.toml when provided", () => {
    const bundle = createCanvasExportBundle(document, {
      viewport: viewportForGridRef(document, "D3"),
    });
    const handoff = bundle.files.find((file) => file.path === "handoff.toml")?.text ?? "";

    expect(handoff).toContain("[viewport]");
    expect(handoff).toContain("zoom = 4");
    expect(handoff).toContain("center_x = 350");
    expect(handoff).toContain('focus_kind = "gridRef"');
    expect(handoff).toContain('focus_value = "D3"');
  });

  it("pans the viewport predictably from a document-space delta", () => {
    expect(
      panCanvasViewport(createCanvasViewport(document, { centerX: 300, centerY: 200 }), {
        dx: 24,
        dy: -10,
      }),
    ).toMatchObject({
      centerX: 276,
      centerY: 210,
    });
  });

  it("computes a viewport target for a selected sprite frame", () => {
    const viewport = viewportForSpriteFrame(document, spriteImage, {
      sidecarId: "sheet-sidecar",
      frame: {
        id: "hero.idle",
        label: "Hero Idle",
        x: 10,
        y: 20,
        width: 18,
        height: 20,
      },
    });

    expect(viewport.centerX).toBe(119);
    expect(viewport.centerY).toBe(90);
    expect(viewport.focus).toEqual({
      kind: "spriteFrame",
      sidecarId: "sheet-sidecar",
      frameId: "hero.idle",
    });
  });
});
