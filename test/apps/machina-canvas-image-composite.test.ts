import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createCanvasExportBundle,
  serializeCanvasCommandsToml,
  serializeCanvasDocumentJson,
  serializeCanvasHandoffToml,
  serializeCanvasObjectToml,
  serializeCanvasRenderSvg,
} from "../../apps/machina-canvas/src/canvasExport";
import { validateCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExportValidation";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import {
  applyCanvasCommands,
  validateCanvasCommands,
  type CanvasCommand,
} from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";
import { getObjectBoundsSummary } from "../../apps/machina-canvas/src/sceneSummary";

const document: CanvasDocument = {
  id: "image-composite-demo",
  name: "Image Composite Demo",
  width: 400,
  height: 260,
  unit: "px",
  unitSystem: createCanvasUnitSystem("px"),
  layers: [
    {
      id: "main",
      name: "Main",
      visible: true,
      objectIds: ["source", "alpha", "visible-alpha", "shape"],
    },
  ],
  objects: {
    source: {
      id: "source",
      name: "Source image",
      kind: "image",
      layerId: "main",
      visible: true,
      x: 40,
      y: 30,
      width: 160,
      height: 180,
      src: "/assets/generated-product.svg",
      role: "image",
      alphaMapId: "alpha",
      opacity: 0.8,
      blendMode: "normal",
      fit: "contain",
      intrinsicWidth: 512,
      intrinsicHeight: 512,
    },
    alpha: {
      id: "alpha",
      name: "Alpha map",
      kind: "image",
      layerId: "main",
      visible: false,
      x: 40,
      y: 30,
      width: 160,
      height: 180,
      src: "/assets/generated-product-alpha.svg",
      role: "alphaMap",
      fit: "contain",
    },
    "visible-alpha": {
      id: "visible-alpha",
      name: "Visible alpha map",
      kind: "image",
      layerId: "main",
      visible: true,
      x: 220,
      y: 30,
      width: 80,
      height: 90,
      src: "/assets/generated-product-alpha.svg",
      role: "alphaMap",
      fit: "fill",
    },
    shape: {
      id: "shape",
      name: "Shape",
      kind: "rect",
      layerId: "main",
      visible: true,
      x: 20,
      y: 20,
      width: 30,
      height: 30,
      fill: "#ffffff",
    },
  },
};

describe("MachinaCanvas image alpha-map composition", () => {
  it("models image objects with roles and alpha-map relationships", () => {
    expect(document.objects.source.kind).toBe("image");
    expect(document.objects.source.kind === "image" ? document.objects.source.alphaMapId : "").toBe(
      "alpha",
    );
  });

  it("renders image objects, mask defs, and hidden alpha maps correctly", () => {
    const svg = serializeCanvasRenderSvg(document);

    expect(svg).toContain('data-canvas-object-id="source"');
    expect(svg).toContain('data-canvas-kind="image"');
    expect(svg).toContain('<mask id="mask-source"');
    expect(svg).toContain('mask="url(#mask-source)"');
    expect(svg).toContain('href="assets/generated-product.svg"');
    expect(svg).not.toContain('data-canvas-object-id="alpha"');
    expect(svg).toContain('data-canvas-object-id="visible-alpha"');
  });

  it("validates attachAlphaMap command inputs", () => {
    expect(
      validateCanvasCommands(document, {
        kind: "attachAlphaMap",
        sourceId: "source",
        alphaId: "alpha",
      }).ok,
    ).toBe(true);
    expect(
      validateCanvasCommands(document, {
        kind: "attachAlphaMap",
        sourceId: "missing",
        alphaId: "alpha",
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "MissingObject" }));
    expect(
      validateCanvasCommands(document, {
        kind: "attachAlphaMap",
        sourceId: "shape",
        alphaId: "alpha",
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidImageObject" }));
    expect(
      validateCanvasCommands(document, {
        kind: "attachAlphaMap",
        sourceId: "source",
        alphaId: "missing",
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "MissingObject" }));
    expect(
      validateCanvasCommands(document, {
        kind: "attachAlphaMap",
        sourceId: "source",
        alphaId: "shape",
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidAlphaMap" }));
    expect(
      validateCanvasCommands(document, {
        kind: "attachAlphaMap",
        sourceId: "source",
        alphaId: "source",
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidCompositeRelation" }));
  });

  it("rejects alpha objects with a normal image role", () => {
    const alpha = document.objects.alpha;
    if (alpha.kind !== "image") throw new Error("Expected alpha image fixture.");
    const normalAlphaDocument: CanvasDocument = {
      ...document,
      objects: {
        ...document.objects,
        alpha: { ...alpha, role: "image" },
      },
    };

    expect(
      validateCanvasCommands(normalAlphaDocument, {
        kind: "attachAlphaMap",
        sourceId: "source",
        alphaId: "alpha",
      }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "InvalidAlphaMap" }));
  });

  it("applies attach and detach without mutating the original document", () => {
    const detached: CanvasDocument = {
      ...document,
      objects: {
        ...document.objects,
        source:
          document.objects.source.kind === "image"
            ? { ...document.objects.source, alphaMapId: undefined }
            : document.objects.source,
      },
    };
    const before = JSON.stringify(detached);
    const attached = applyCanvasCommands(detached, [
      { kind: "attachAlphaMap", sourceId: "source", alphaId: "alpha" },
    ]);
    const nextSource = attached.document.objects.source;

    expect(nextSource.kind === "image" ? nextSource.alphaMapId : "").toBe("alpha");
    expect(attached.results[0].message).toBe("Attached alpha map alpha to source.");
    expect(JSON.stringify(detached)).toBe(before);

    const detachedAgain = applyCanvasCommands(attached.document, [
      { kind: "detachAlphaMap", sourceId: "source" },
    ]);
    const finalSource = detachedAgain.document.objects.source;

    expect(finalSource.kind === "image" ? finalSource.alphaMapId : "still-present").toBeUndefined();
    expect(detachedAgain.results[0].message).toBe("Detached alpha map from source.");
  });

  it("exports image TOML, document relations, handoff composites, render masks, and command TOML", () => {
    const imageToml = serializeCanvasObjectToml(document.objects.source);
    const alphaToml = serializeCanvasObjectToml(document.objects.alpha);
    const documentJson = JSON.parse(serializeCanvasDocumentJson(document));
    const handoff = serializeCanvasHandoffToml(document);
    const commands: CanvasCommand[] = [
      { kind: "attachAlphaMap", sourceId: "source", alphaId: "alpha" },
      { kind: "detachAlphaMap", sourceId: "source" },
    ];
    const commandToml = serializeCanvasCommandsToml("Composite commands", commands);

    expect(imageToml).toContain("[image]");
    expect(imageToml).toContain('alpha_map_id = "alpha"');
    expect(imageToml).toContain("[composite]");
    expect(alphaToml).toContain('color_space = "alpha"');
    expect(documentJson.relations).toEqual([
      { kind: "alphaMapFor", sourceId: "source", alphaId: "alpha" },
    ]);
    expect(handoff).toContain("[[composite]]");
    expect(handoff).toContain('source_id = "source"');
    expect(serializeCanvasRenderSvg(document)).toContain('mask="url(#mask-source)"');
    expect(commandToml).toContain(
      'kind = "attachAlphaMap"\nsource_id = "source"\nalpha_id = "alpha"',
    );
    expect(commandToml).toContain('kind = "detachAlphaMap"\nsource_id = "source"');
  });

  it("validates invalid composite relations and missing render masks", () => {
    const bundle = createCanvasExportBundle(document);
    const invalidRelationBundle = {
      ...bundle,
      files: bundle.files.map((file) =>
        file.path === "document.json"
          ? {
              ...file,
              text: file.text.replace('"sourceId": "source"', '"sourceId": "shape"'),
            }
          : file,
      ),
    };
    const missingMaskBundle = {
      ...bundle,
      files: bundle.files.map((file) =>
        file.path === "render.svg"
          ? { ...file, text: file.text.replaceAll("mask-source", "missing-mask") }
          : file,
      ),
    };

    expect(validateCanvasExportBundle(bundle).ok).toBe(true);
    expect(validateCanvasExportBundle(invalidRelationBundle).diagnostics).toContainEqual(
      expect.objectContaining({ severity: "error", code: "InvalidCompositeRelation" }),
    );
    expect(validateCanvasExportBundle(missingMaskBundle).diagnostics).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "MissingCompositeMask" }),
    );
  });

  it("summarizes image alpha-map relations", () => {
    expect(getObjectBoundsSummary(document.objects.source, document)).toContain(
      "uses alpha map alpha",
    );
  });
});

describe("MachinaCanvas image composite fixture", () => {
  const fixtureRoot = join(
    process.cwd(),
    "apps",
    "machina-canvas",
    "fixtures",
    "demo-poster.mcanvas",
  );

  it("contains relation, mask output, and placeholder assets", () => {
    const documentJson = JSON.parse(readFileSync(join(fixtureRoot, "document.json"), "utf8"));
    const renderSvg = readFileSync(join(fixtureRoot, "render.svg"), "utf8");

    expect(documentJson.relations).toContainEqual({
      kind: "alphaMapFor",
      sourceId: "generated-product-image",
      alphaId: "generated-product-alpha",
    });
    expect(renderSvg).toContain('id="mask-generated-product-image"');
    expect(renderSvg).toContain('mask="url(#mask-generated-product-image)"');
    expect(existsSync(join(fixtureRoot, "assets", "generated-product.svg"))).toBe(true);
    expect(existsSync(join(fixtureRoot, "assets", "generated-product-alpha.svg"))).toBe(true);
  });
});
