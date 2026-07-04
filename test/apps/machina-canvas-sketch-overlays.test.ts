import { describe, expect, it } from "vitest";
import {
  createCanvasExportBundle,
  serializeCanvasDocumentJson,
  serializeCanvasObjectToml,
  serializeCanvasRenderSvg,
} from "../../apps/machina-canvas/src/canvasExport";
import { validateCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExportValidation";
import { initialSceneDocument } from "../../apps/machina-canvas/src/sceneDocument";
import {
  applyCanvasCommands,
  validateCanvasCommands,
} from "../../apps/machina-canvas/src/sceneCommands";
import {
  resolveSketchRefToPoint,
  resolveSketchRefToRect,
  resolveSketchSpec,
} from "../../apps/machina-canvas/src/sketchOverlay";

describe("MachinaCanvas sketch overlays", () => {
  it("includes a demo sketch overlay attached to the generated product image", () => {
    const overlay = initialSceneDocument.objects["generated-product-sketch"];
    const image = initialSceneDocument.objects["generated-product-image"];

    expect(overlay.kind).toBe("sketchOverlay");
    expect(image.kind).toBe("image");
    if (overlay.kind !== "sketchOverlay" || image.kind !== "image") {
      throw new Error("Expected sketch overlay demo objects.");
    }

    expect(image.sketchOverlayId).toBe("generated-product-sketch");
    expect(overlay.targetId).toBe(image.id);
  });

  it("resolves absolute and grid-based sketch refs", () => {
    expect(
      resolveSketchRefToPoint(initialSceneDocument, {
        kind: "absolutePoint",
        x: 10,
        y: 20,
      }),
    ).toEqual({ x: 10, y: 20 });

    expect(
      resolveSketchRefToPoint(initialSceneDocument, {
        kind: "absoluteRect",
        x: 10,
        y: 20,
        width: 40,
        height: 30,
      }),
    ).toEqual({ x: 30, y: 35 });

    expect(
      resolveSketchRefToPoint(initialSceneDocument, {
        kind: "gridRef",
        ref: "D3.c",
      }),
    ).toEqual({ x: 560, y: 400 });

    expect(
      resolveSketchRefToRect(initialSceneDocument, {
        kind: "gridSpan",
        span: "D2-E4",
      }),
    ).toEqual({ x: 480, y: 160, width: 320, height: 480 });
  });

  it("resolves the sketch overlay spec into renderable primitives", () => {
    const overlay = initialSceneDocument.objects["generated-product-sketch"];
    if (overlay.kind !== "sketchOverlay") {
      throw new Error("Expected sketch overlay object.");
    }

    expect(resolveSketchSpec(initialSceneDocument, overlay.spec)).toEqual([
      expect.objectContaining({
        kind: "box",
        id: "silhouette-box",
        rect: { x: 480, y: 160, width: 320, height: 480 },
      }),
      expect.objectContaining({
        kind: "line",
        id: "highlight-callout",
        from: { x: 640, y: 400 },
        to: { x: 640, y: 240 },
      }),
      expect.objectContaining({
        kind: "point",
        id: "focus-point",
        point: { x: 560, y: 400 },
      }),
      expect.objectContaining({
        kind: "label",
        id: "main-note",
        text: "Generated product silhouette",
        point: { x: 560, y: 160 },
      }),
    ]);
  });

  it("throws stable errors for invalid sketch refs", () => {
    expect(() =>
      resolveSketchRefToRect(initialSceneDocument, {
        kind: "absolutePoint",
        x: 1,
        y: 2,
      }),
    ).toThrow("Sketch overlay absolutePoint cannot resolve to a rect.");
  });

  it("validates attachSketchOverlay command inputs", () => {
    expect(
      validateCanvasCommands(initialSceneDocument, {
        kind: "attachSketchOverlay",
        sourceId: "generated-product-image",
        overlayId: "generated-product-sketch",
      }).ok,
    ).toBe(true);

    expect(
      validateCanvasCommands(initialSceneDocument, {
        kind: "attachSketchOverlay",
        sourceId: "product-highlight",
        overlayId: "generated-product-sketch",
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidImageObject" }));

    expect(
      validateCanvasCommands(initialSceneDocument, {
        kind: "attachSketchOverlay",
        sourceId: "generated-product-image",
        overlayId: "product-highlight",
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidSketchOverlayRelation" }));
  });

  it("detaches and toggles sketch overlays immutably", () => {
    const before = JSON.stringify(initialSceneDocument);
    const detached = applyCanvasCommands(initialSceneDocument, [
      {
        kind: "detachSketchOverlay",
        sourceId: "generated-product-image",
      },
    ]);
    const detachedImage = detached.document.objects["generated-product-image"];
    expect(
      detachedImage.kind === "image" ? detachedImage.sketchOverlayId : undefined,
    ).toBeUndefined();
    expect(detached.results[0].message).toBe(
      "Detached sketch overlay from generated-product-image.",
    );

    const hidden = applyCanvasCommands(detached.document, [
      {
        kind: "setSketchOverlayVisible",
        overlayId: "generated-product-sketch",
        visible: false,
      },
    ]);
    const overlay = hidden.document.objects["generated-product-sketch"];
    expect(overlay.kind === "sketchOverlay" ? overlay.visible : true).toBe(false);
    expect(JSON.stringify(initialSceneDocument)).toBe(before);
  });

  it("exports sketch overlay relations, sidecars, and image metadata", () => {
    const overlay = initialSceneDocument.objects["generated-product-sketch"];
    const image = initialSceneDocument.objects["generated-product-image"];
    if (overlay.kind !== "sketchOverlay" || image.kind !== "image") {
      throw new Error("Expected sketch overlay demo objects.");
    }

    const documentJson = JSON.parse(serializeCanvasDocumentJson(initialSceneDocument)) as {
      relations: Array<Record<string, string>>;
      objects: Record<string, { asset: string }>;
    };
    const overlayToml = serializeCanvasObjectToml(overlay);
    const imageToml = serializeCanvasObjectToml(image);
    const handoff = createCanvasExportBundle(initialSceneDocument).files.find(
      (file) => file.path === "handoff.toml",
    )?.text;

    expect(documentJson.relations).toContainEqual({
      kind: "sketchOverlayFor",
      sourceId: "generated-product-image",
      overlayId: "generated-product-sketch",
    });
    expect(documentJson.objects["generated-product-sketch"].asset).toBe(
      "objects/generated-product-sketch.sketch.toml",
    );
    expect(overlayToml).toContain('dialect = "sketch"');
    expect(overlayToml).toContain("[[box]]");
    expect(overlayToml).toContain("[[line]]");
    expect(overlayToml).toContain("[[point]]");
    expect(overlayToml).toContain("[[label]]");
    expect(imageToml).toContain('sketch_overlay_id = "generated-product-sketch"');
    expect(handoff).toContain("[[sketch_overlay]]");
    expect(handoff).toContain('path = "objects/generated-product-sketch.sketch.toml"');
  });

  it("renders visible sketch overlays into render.svg and excludes hidden ones", () => {
    const visibleSvg = serializeCanvasRenderSvg(initialSceneDocument);
    expect(visibleSvg).toContain('class="canvas-sketch-overlay"');
    expect(visibleSvg).toContain('class="canvas-sketch-box"');
    expect(visibleSvg).toContain('class="canvas-sketch-line"');
    expect(visibleSvg).toContain('class="canvas-sketch-point"');
    expect(visibleSvg).toContain('class="canvas-sketch-label"');

    const hiddenDocument = applyCanvasCommands(initialSceneDocument, [
      {
        kind: "setSketchOverlayVisible",
        overlayId: "generated-product-sketch",
        visible: false,
      },
    ]).document;
    const hiddenSvg = serializeCanvasRenderSvg(hiddenDocument);
    expect(hiddenSvg).not.toContain('class="canvas-sketch-overlay"');
  });

  it("validates invalid sketch overlay relations in document.json", () => {
    const bundle = createCanvasExportBundle(initialSceneDocument);
    const invalidBundle = {
      ...bundle,
      files: bundle.files.map((file) =>
        file.path === "document.json"
          ? {
              ...file,
              text: file.text.replace(
                '"overlayId": "generated-product-sketch"',
                '"overlayId": "product-highlight"',
              ),
            }
          : file,
      ),
    };

    expect(validateCanvasExportBundle(bundle).ok).toBe(true);
    expect(validateCanvasExportBundle(invalidBundle).diagnostics).toContainEqual(
      expect.objectContaining({ code: "InvalidSketchOverlayRelation" }),
    );
  });
});
