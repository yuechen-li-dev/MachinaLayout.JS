import { describe, expect, it } from "vitest";
import { createCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExport";
import {
  getRasterExportFileName,
  lowerCanvasDocumentToRasterBlob,
  lowerSvgToRasterBlob,
  normalizeRasterExportOptions,
} from "../../apps/machina-canvas/src/rasterExport";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";

const document: CanvasDocument = {
  id: "raster-demo",
  name: "Raster Demo",
  width: 120,
  height: 80,
  unit: "px",
  unitSystem: createCanvasUnitSystem("px"),
  layers: [
    {
      id: "foreground",
      name: "Foreground",
      visible: true,
      objectIds: ["box"],
    },
  ],
  objects: {
    box: {
      id: "box",
      name: "Box",
      kind: "rect",
      layerId: "foreground",
      visible: true,
      x: 10,
      y: 12,
      width: 40,
      height: 24,
      fill: "#111111",
    },
  },
};

describe("MachinaCanvas raster export helpers", () => {
  it("normalizes raster export defaults to PNG, 1x, and transparent background", () => {
    expect(normalizeRasterExportOptions()).toEqual({
      mimeType: "image/png",
      scale: 1,
      background: "transparent",
    });
  });

  it("rejects invalid scale and clamps scale to the supported range", () => {
    expect(() => normalizeRasterExportOptions({ scale: 0 })).toThrow(/scale/);
    expect(() => normalizeRasterExportOptions({ scale: Number.NaN })).toThrow(/scale/);
    expect(normalizeRasterExportOptions({ scale: 0.1 }).scale).toBe(0.25);
    expect(normalizeRasterExportOptions({ scale: 12 }).scale).toBe(8);
  });

  it("validates quality when supplied", () => {
    expect(normalizeRasterExportOptions({ quality: 0 }).quality).toBe(0);
    expect(normalizeRasterExportOptions({ quality: 1 }).quality).toBe(1);
    expect(() => normalizeRasterExportOptions({ quality: -0.1 })).toThrow(/quality/);
    expect(() => normalizeRasterExportOptions({ quality: 1.1 })).toThrow(/quality/);
  });

  it("uses an opaque white background for JPEG transparency requests", () => {
    expect(
      normalizeRasterExportOptions({
        mimeType: "image/jpeg",
        background: "transparent",
      }).background,
    ).toBe("#ffffff");
  });

  it("formats raster export filenames by type and scale", () => {
    expect(getRasterExportFileName("render")).toBe("render.png");
    expect(getRasterExportFileName("render", { scale: 2 })).toBe("render@2x.png");
    expect(getRasterExportFileName("render", { scale: 4 })).toBe("render@4x.png");
    expect(getRasterExportFileName("render", { mimeType: "image/jpeg" })).toBe("render.jpg");
    expect(getRasterExportFileName("render", { mimeType: "image/webp" })).toBe("render.webp");
  });

  it("exports helper functions for browser-local SVG lowering", () => {
    expect(typeof lowerSvgToRasterBlob).toBe("function");
    expect(typeof lowerCanvasDocumentToRasterBlob).toBe("function");
  });

  it("adds lossy PNG lowering metadata to handoff TOML when raster options are provided", () => {
    const bundle = createCanvasExportBundle(document, {
      rasterArtifactPath: "render@2x.png",
      rasterOptions: normalizeRasterExportOptions({
        scale: 2,
        background: "transparent",
      }),
    });
    const handoff = bundle.files.find((file) => file.path === "handoff.toml")?.text ?? "";

    expect(bundle.files.some((file) => file.path === "render@2x.png")).toBe(false);
    expect(handoff).toContain('[rendered_artifacts]\nsvg = "render.svg"\npng = "render@2x.png"');
    expect(handoff).toContain(
      '[lowering]\ntarget = "png"\nscale = 2\nbackground = "transparent"\nlossy = true',
    );
  });
});
