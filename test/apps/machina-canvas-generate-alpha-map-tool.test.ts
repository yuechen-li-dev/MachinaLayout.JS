import { describe, expect, it } from "vitest";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import {
  createAlphaMapObjectFromAsset,
  deriveAlphaMapPixels,
  generateAlphaMapTool,
  type PixelImage,
} from "../../apps/machina-canvas/src/tools/generateAlphaMap";
import { applyCanvasCommands } from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import type { LoadedImageAsset } from "../../apps/machina-canvas/src/imageAssets";
import { getObjectBoundsSummary } from "../../apps/machina-canvas/src/sceneSummary";

function rgbaGrid(
  width: number,
  height: number,
  fill: [number, number, number, number],
): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = fill[0];
    data[index + 1] = fill[1];
    data[index + 2] = fill[2];
    data[index + 3] = fill[3];
  }
  return { width, height, data };
}

function setPixel(
  image: PixelImage,
  x: number,
  y: number,
  color: [number, number, number, number],
) {
  const offset = (y * image.width + x) * 4;
  image.data[offset] = color[0];
  image.data[offset + 1] = color[1];
  image.data[offset + 2] = color[2];
  image.data[offset + 3] = color[3];
}

function alphaAt(image: PixelImage, x: number, y: number): number {
  return image.data[(y * image.width + x) * 4];
}

function createDocument(): CanvasDocument {
  return {
    id: "alpha-tool-demo",
    name: "Alpha Tool Demo",
    width: 100,
    height: 100,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    selectedObjectId: "source",
    layers: [{ id: "main", name: "Main", visible: true, objectIds: ["source"] }],
    objects: {
      source: {
        id: "source",
        name: "Source",
        kind: "image",
        layerId: "main",
        visible: true,
        x: 10,
        y: 12,
        width: 40,
        height: 30,
        src: "data:image/png;base64,source",
        role: "image",
        intrinsicWidth: 8,
        intrinsicHeight: 8,
        fit: "contain",
      },
    },
  };
}

describe("MachinaCanvas generate alpha map tool", () => {
  it("derives a grayscale alpha map with matching dimensions and soft edges", () => {
    const source = rgbaGrid(5, 5, [255, 255, 255, 255]);
    setPixel(source, 2, 2, [0, 80, 180, 255]);

    const alpha = deriveAlphaMapPixels(source);

    expect(alpha.width).toBe(5);
    expect(alpha.height).toBe(5);
    expect(alphaAt(alpha, 0, 0)).toBe(0);
    expect(alphaAt(alpha, 2, 2)).toBe(220);
    expect(alphaAt(alpha, 2, 1)).toBe(48);
    for (let index = 0; index < alpha.data.length; index += 4) {
      expect(alpha.data[index]).toBe(alpha.data[index + 1]);
      expect(alpha.data[index]).toBe(alpha.data[index + 2]);
      expect(alpha.data[index + 3]).toBe(255);
    }
  });

  it("creates an alpha-map object and can attach it through existing commands", () => {
    const document = createDocument();
    const source = document.objects.source as ImageObject;
    const asset: LoadedImageAsset = {
      id: "source-alpha-map",
      name: "Source alpha map",
      fileName: "source-alpha-map.png",
      mimeType: "image/png",
      src: "data:image/png;base64,alpha",
      intrinsicWidth: 8,
      intrinsicHeight: 8,
    };

    const alphaObject = createAlphaMapObjectFromAsset(document, source, asset);
    const result = applyCanvasCommands(document, [
      { kind: "addImageObject", object: alphaObject },
      { kind: "attachAlphaMap", sourceId: source.id, alphaId: alphaObject.id },
    ]);
    const nextSource = result.document.objects.source;

    expect(alphaObject.role).toBe("alphaMap");
    expect(alphaObject.visible).toBe(false);
    expect(alphaObject.x).toBe(source.x);
    expect(alphaObject.y).toBe(source.y);
    expect(nextSource.kind === "image" ? nextSource.alphaMapId : undefined).toBe(alphaObject.id);
    expect(result.document.layers[0].objectIds).toContain(alphaObject.id);
    expect(getObjectBoundsSummary(nextSource, result.document)).toContain("uses alpha map");
  });

  it("exposes a reusable image-object tool definition", () => {
    expect(generateAlphaMapTool.id).toBe("generate-alpha-map");
    expect(generateAlphaMapTool.label).toBe("Generate Alpha Map");
    expect(generateAlphaMapTool.targetKind).toBe("image-object");
  });
});
