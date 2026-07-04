import { describe, expect, it } from "vitest";
import {
  createCanvasExportBundle,
  serializeCanvasCommandsToml,
  serializeCanvasObjectToml,
  serializeCanvasRenderSvg,
} from "../../apps/machina-canvas/src/canvasExport";
import { validateCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExportValidation";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import {
  createImageObjectFromAsset,
  makeUniqueObjectId,
  type LoadedImageAsset,
} from "../../apps/machina-canvas/src/imageAssets";
import {
  applyCanvasCommands,
  validateCanvasCommands,
  type CanvasCommand,
} from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";

const dataUrl =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSIyMCI+PC9zdmc+";

const asset: LoadedImageAsset = {
  id: "image-product",
  name: "Product",
  fileName: "product.svg",
  mimeType: "image/svg+xml",
  src: dataUrl,
  intrinsicWidth: 40,
  intrinsicHeight: 20,
};

function createDocument(): CanvasDocument {
  return {
    id: "image-loading-demo",
    name: "Image Loading Demo",
    width: 400,
    height: 300,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    selectedObjectId: "source",
    layers: [
      {
        id: "foreground",
        name: "Foreground",
        visible: true,
        objectIds: ["source", "alpha"],
      },
    ],
    objects: {
      source: {
        id: "source",
        name: "Source",
        kind: "image",
        layerId: "foreground",
        visible: true,
        x: 20,
        y: 20,
        width: 100,
        height: 80,
        src: "/assets/generated-product.svg",
        role: "image",
        alphaMapId: "alpha",
      },
      alpha: {
        id: "alpha",
        name: "Alpha",
        kind: "image",
        layerId: "foreground",
        visible: false,
        x: 20,
        y: 20,
        width: 100,
        height: 80,
        src: "/assets/generated-product-alpha.svg",
        role: "alphaMap",
      },
    },
  };
}

describe("MachinaCanvas local image loading", () => {
  it("creates deterministic unique object ids", () => {
    const document = createDocument();

    expect(makeUniqueObjectId("loaded", document)).toBe("loaded");
    expect(makeUniqueObjectId("source", document)).toBe("source-2");
    expect(
      makeUniqueObjectId("source", {
        ...document,
        objects: {
          ...document.objects,
          "source-2": { ...document.objects.source, id: "source-2" },
        },
      }),
    ).toBe("source-3");
  });

  it("creates centered scaled image objects from loaded assets", () => {
    const document = createDocument();
    const object = createImageObjectFromAsset(asset, {
      id: "image-product",
      layerId: "foreground",
      document,
    });

    expect(object.kind).toBe("image");
    expect(object.visible).toBe(true);
    expect(object.role).toBe("image");
    expect(object.width).toBe(40);
    expect(object.height).toBe(20);
    expect(object.x).toBe(180);
    expect(object.y).toBe(140);
    expect(object.frame).toEqual({ kind: "absolute", x: 180, y: 140, width: 40, height: 20 });
    expect(object.tags).toEqual(["loaded", "image"]);
    expect(object.notes).toContain("product.svg");
  });

  it("creates alpha-map image objects hidden by default", () => {
    const object = createImageObjectFromAsset(asset, {
      id: "alpha-product",
      layerId: "foreground",
      role: "alphaMap",
      document: createDocument(),
    });

    expect(object.visible).toBe(false);
    expect(object.role).toBe("alphaMap");
    expect(object.tags).toEqual(["loaded", "alpha-map"]);
  });

  it("validates addImageObject commands", () => {
    const document = createDocument();
    const object = createImageObjectFromAsset(asset, {
      id: "image-product",
      layerId: "foreground",
      document,
    });

    expect(validateCanvasCommands(document, { kind: "addImageObject", object }).ok).toBe(true);
    expect(
      validateCanvasCommands(document, {
        kind: "addImageObject",
        object: { ...object, id: "source" },
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "DuplicateObjectId" }));
    expect(
      validateCanvasCommands(document, {
        kind: "addImageObject",
        object: { ...object, src: "" },
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidImageAsset" }));
  });

  it("applies addImageObject without mutating the original document", () => {
    const document = createDocument();
    const before = JSON.stringify(document);
    const object = createImageObjectFromAsset(asset, {
      id: "image-product",
      layerId: "foreground",
      document,
    });
    const result = applyCanvasCommands(document, [{ kind: "addImageObject", object }]);

    expect(result.document.objects["image-product"]).toEqual(object);
    expect(result.document.layers[0].objectIds).toContain("image-product");
    expect(result.document.selectedObjectId).toBe("image-product");
    expect(JSON.stringify(document)).toBe(before);
  });

  it("validates removeObject commands with alpha reference warnings", () => {
    const result = validateCanvasCommands(createDocument(), { kind: "removeObject", id: "alpha" });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "RemovingAlphaMapReference" }),
    );
  });

  it("removes objects, clears selection, detaches alpha references, and keeps the original document", () => {
    const document = createDocument();
    const before = JSON.stringify(document);
    const result = applyCanvasCommands(document, [{ kind: "removeObject", id: "alpha" }]);
    const source = result.document.objects.source;

    expect(result.document.objects.alpha).toBeUndefined();
    expect(result.document.layers[0].objectIds).toEqual(["source"]);
    expect(source.kind === "image" ? source.alphaMapId : "still-present").toBeUndefined();
    expect(result.document.selectedObjectId).toBe("source");
    expect(JSON.stringify(document)).toBe(before);

    const selectedRemoved = applyCanvasCommands(result.document, [
      { kind: "removeObject", id: "source" },
    ]);
    expect(selectedRemoved.document.selectedObjectId).toBeUndefined();
  });

  it("exports and validates data URL image src values", () => {
    const document = createDocument();
    const object = createImageObjectFromAsset(asset, {
      id: "image-product",
      layerId: "foreground",
      document,
    });
    const next = applyCanvasCommands(document, [{ kind: "addImageObject", object }]).document;
    const objectToml = serializeCanvasObjectToml(next.objects["image-product"]);
    const renderSvg = serializeCanvasRenderSvg(next);
    const bundle = createCanvasExportBundle(next);

    expect(objectToml).toContain(`src = "${dataUrl}"`);
    expect(renderSvg).toContain(`href="${dataUrl}"`);
    expect(validateCanvasExportBundle(bundle).ok).toBe(true);
  });

  it("omits addImageObject commands from session command TOML and keeps removeObject", () => {
    const object = createImageObjectFromAsset(asset, {
      id: "image-product",
      layerId: "foreground",
      document: createDocument(),
    });
    const commands: CanvasCommand[] = [
      { kind: "addImageObject", object },
      { kind: "removeObject", id: "image-product" },
    ];
    const toml = serializeCanvasCommandsToml("Image commands", commands);

    expect(toml).not.toContain("addImageObject");
    expect(toml).not.toContain(dataUrl);
    expect(toml).toContain('kind = "removeObject"\nid = "image-product"');
  });
});
