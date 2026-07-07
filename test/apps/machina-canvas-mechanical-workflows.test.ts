import { describe, expect, it } from "vitest";
import {
  createDefaultMechanicalSheetMetadata,
  createLinearDimensionFromGeometryRefs,
  createMechanicalAnnotationSet,
  createMechanicalAnnotationSidecarObject,
  getMechanicalInspectorSummary,
  getMechanicalSheetDimensions,
  resolveMechanicalGeometryAnchor,
  validateMechanicalAnnotations,
  validateMechanicalAnnotationsForScene,
  type MechanicalGeometryReference,
} from "../../apps/machina-canvas/src/mechanicalAnnotations";
import { serializeCanvasRenderSvg } from "../../apps/machina-canvas/src/canvasExport";
import {
  CANVAS_EXPORT_PRESETS,
  applyExportPreset,
  collectCanvasExportArtifacts,
} from "../../apps/machina-canvas/src/exportCart";
import {
  getMechanicalA4LandscapeLayout,
  MECHANICAL_A4_LANDSCAPE_MM,
  MECHANICAL_A4_PRINT_MARGIN_MM,
} from "../../apps/machina-canvas/src/mechanicalSheet";
import { buildCanvasLayerTree } from "../../apps/machina-canvas/src/layerTree";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import type { CanvasDocument, CanvasObject } from "../../apps/machina-canvas/src/sceneModel";
import { createMechanicalDraftingScene } from "../../apps/machina-canvas/src/sceneTemplates";

function createMechanicalWorkflowDocument(): CanvasDocument {
  const plate: Extract<CanvasObject, { kind: "rect" }> = {
    id: "plate",
    name: "Plate",
    kind: "rect",
    layerId: "geometry",
    visible: true,
    x: 20,
    y: 20,
    width: 100,
    height: 60,
    fill: "transparent",
    stroke: "#111111",
  };
  const centerImage: Extract<CanvasObject, { kind: "image" }> = {
    id: "photo-ref",
    name: "Photo ref",
    kind: "image",
    layerId: "geometry",
    visible: true,
    x: 140,
    y: 20,
    width: 40,
    height: 30,
    src: "/plate.png",
  };
  return {
    id: "mechanical-workflow",
    name: "Mechanical workflow",
    width: 240,
    height: 160,
    unit: "mm",
    unitSystem: createCanvasUnitSystem("mm"),
    layers: [
      { id: "geometry", name: "Geometry", visible: true, objectIds: [plate.id, centerImage.id] },
      { id: "annotations", name: "Annotations", visible: true, objectIds: ["mech"] },
    ],
    layerGroups: [{ id: "sheet", title: "Mechanical sheet", objectIds: [plate.id] }],
    objects: {
      [plate.id]: plate,
      [centerImage.id]: centerImage,
    },
    selectedObjectId: "mech",
  };
}

function createReferenceSidecar(scene: CanvasDocument) {
  const dimension = createLinearDimensionFromGeometryRefs({
    id: "plate-width",
    scene,
    from: { objectId: "plate", anchor: "bottomLeft" },
    to: { objectId: "plate", anchor: "bottomRight" },
    axis: "horizontal",
    offset: 18,
    label: "100 mm",
  });
  if (!dimension) {
    throw new Error("Expected dimension from geometry references.");
  }
  return createMechanicalAnnotationSidecarObject({
    id: "mech",
    layerId: "annotations",
    x: 0,
    y: 0,
    width: scene.width,
    height: scene.height,
    targetObjectId: "plate",
    annotations: createMechanicalAnnotationSet({
      id: "mech-annotations",
      units: "mm",
      scale: "1:1",
      sheet: {
        size: "A4",
        orientation: "landscape",
        units: "mm",
        scale: "1:1",
        drawingNumber: "DWG-001",
        title: "Plate detail",
        revision: "A",
      },
      dimensions: [dimension],
      notes: [{ id: "note-1", kind: "note", at: [150, 60], text: "Check finish" }],
      datums: [{ id: "datum-a", label: "A", at: [10, 50], target: [20, 50] }],
      blocks: [
        {
          id: "title-block",
          kind: "titleBlock",
          x: 130,
          y: 110,
          width: 90,
          height: 36,
          fields: {
            Title: "Plate detail",
            Drawing: "DWG-001",
            Rev: "A",
            Scale: "1:1",
            Units: "mm",
          },
        },
      ],
    }),
  });
}

describe("MachinaCanvas mechanical workflows", () => {
  it("exposes A4 landscape constants and content layout", () => {
    expect(MECHANICAL_A4_LANDSCAPE_MM).toEqual({ width: 297, height: 210 });
    expect(MECHANICAL_A4_PRINT_MARGIN_MM).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
    expect(getMechanicalA4LandscapeLayout()).toEqual({
      widthMm: 297,
      heightMm: 210,
      marginMm: { top: 10, right: 10, bottom: 10, left: 10 },
      contentBoxMm: { x: 10, y: 10, width: 277, height: 190 },
    });
  });

  it("validates mechanical sheet metadata", () => {
    const annotations = createMechanicalAnnotationSet({
      id: "sheet-ok",
      units: "mm",
      sheet: { size: "A4", orientation: "landscape", units: "mm", scale: "1:1" },
    });
    expect(validateMechanicalAnnotations(annotations)).toEqual([]);
    expect(getMechanicalSheetDimensions(annotations.sheet!)).toEqual([297, 210]);
  });

  it("creates default mechanical sheet metadata as A4 landscape", () => {
    expect(createDefaultMechanicalSheetMetadata()).toEqual({
      size: "A4",
      orientation: "landscape",
      units: "mm",
    });
  });

  it("requires positive custom sheet width and height", () => {
    const annotations = createMechanicalAnnotationSet({
      id: "sheet-bad",
      units: "mm",
      sheet: { size: "Custom", orientation: "portrait", units: "mm", width: 0, height: -1 },
    });
    const diagnostics = validateMechanicalAnnotations(annotations);
    expect(diagnostics.some((entry) => entry.path === "annotations.sheet.width")).toBe(true);
    expect(diagnostics.some((entry) => entry.path === "annotations.sheet.height")).toBe(true);
  });

  it("accepts geometry references with object id and anchor", () => {
    const reference: MechanicalGeometryReference = { objectId: "plate", anchor: "topRight" };
    expect(reference.objectId).toBe("plate");
    expect(reference.anchor).toBe("topRight");
  });

  it("resolves rectangle-like anchors from existing scene geometry", () => {
    const scene = createMechanicalWorkflowDocument();
    expect(resolveMechanicalGeometryAnchor(scene, { objectId: "plate", anchor: "center" })).toEqual(
      [70, 50],
    );
    expect(
      resolveMechanicalGeometryAnchor(scene, { objectId: "plate", anchor: "bottomRight" }),
    ).toEqual([120, 80]);
  });

  it("resolves image-like anchors when dimensions are available", () => {
    const scene = createMechanicalWorkflowDocument();
    expect(
      resolveMechanicalGeometryAnchor(scene, { objectId: "photo-ref", anchor: "topLeft" }),
    ).toEqual([140, 20]);
  });

  it("returns undefined for unsupported anchors without crashing", () => {
    const scene = createMechanicalWorkflowDocument();
    expect(
      resolveMechanicalGeometryAnchor(scene, { objectId: "plate", anchor: "start" }),
    ).toBeUndefined();
  });

  it("creates a linear dimension from geometry references", () => {
    const scene = createMechanicalWorkflowDocument();
    const dimension = createLinearDimensionFromGeometryRefs({
      id: "width",
      scene,
      from: { objectId: "plate", anchor: "left" },
      to: { objectId: "plate", anchor: "right" },
      axis: "horizontal",
      label: "100 mm",
    });
    expect(dimension).toMatchObject({
      id: "width",
      kind: "linear",
      axis: "horizontal",
      references: [
        { objectId: "plate", anchor: "left" },
        { objectId: "plate", anchor: "right" },
      ],
    });
  });

  it("reports missing referenced objects as diagnostics", () => {
    const scene = createMechanicalWorkflowDocument();
    const sidecar = createMechanicalAnnotationSidecarObject({
      id: "mech",
      layerId: "annotations",
      x: 0,
      y: 0,
      width: scene.width,
      height: scene.height,
      annotations: createMechanicalAnnotationSet({
        id: "mech-annotations",
        units: "mm",
        dimensions: [
          {
            id: "missing-ref",
            kind: "linear",
            axis: "horizontal",
            from: [0, 0],
            to: [10, 0],
            references: [
              { objectId: "missing-1", anchor: "left" },
              { objectId: "missing-2", anchor: "right" },
            ],
          },
        ],
      }),
    });
    const diagnostics = validateMechanicalAnnotationsForScene(scene, sidecar);
    expect(diagnostics.some((entry) => entry.code === "MissingMechanicalReferenceObject")).toBe(
      true,
    );
  });

  it("reports mismatched explicit points against referenced geometry", () => {
    const scene = createMechanicalWorkflowDocument();
    const sidecar = createMechanicalAnnotationSidecarObject({
      id: "mech",
      layerId: "annotations",
      x: 0,
      y: 0,
      width: scene.width,
      height: scene.height,
      annotations: createMechanicalAnnotationSet({
        id: "mech-annotations",
        units: "mm",
        dimensions: [
          {
            id: "mismatch",
            kind: "linear",
            axis: "horizontal",
            from: [0, 0],
            to: [10, 0],
            references: [
              { objectId: "plate", anchor: "left" },
              { objectId: "plate", anchor: "right" },
            ],
          },
        ],
      }),
    });
    const diagnostics = validateMechanicalAnnotationsForScene(scene, sidecar);
    expect(diagnostics.some((entry) => entry.code === "MechanicalDimensionReferenceMismatch")).toBe(
      true,
    );
  });

  it("mechanical mode template includes existing geometry objects and reference-backed dimensions", () => {
    const scene = createMechanicalDraftingScene();
    expect(
      Object.values(scene.objects).filter(
        (object) => object.kind === "rect" || object.kind === "ellipse",
      ),
    ).toHaveLength(2);
    const sidecar = scene.objects["mechanical-annotations"];
    if (sidecar.kind !== "mechanicalAnnotationSidecar") {
      throw new Error("Expected mechanical annotation sidecar.");
    }
    expect(sidecar.annotations.sheet).toMatchObject({
      size: "A4",
      orientation: "landscape",
      units: "mm",
    });
    expect(sidecar.annotations.dimensions.some((dimension) => dimension.references?.length)).toBe(
      true,
    );
  });

  it("mechanical mode template validates cleanly against the scene", () => {
    const scene = createMechanicalDraftingScene();
    const sidecar = scene.objects["mechanical-annotations"];
    if (sidecar.kind !== "mechanicalAnnotationSidecar") {
      throw new Error("Expected mechanical annotation sidecar.");
    }
    expect(validateMechanicalAnnotationsForScene(scene, sidecar)).toEqual([]);
  });

  it("layer tree subtitle and child rows reflect mechanical drafting context", () => {
    const scene = createMechanicalWorkflowDocument();
    const sidecar = createReferenceSidecar(scene);
    scene.objects[sidecar.id] = sidecar;
    const tree = buildCanvasLayerTree(scene);
    const owner = tree[0]?.children?.[0];
    const attachment = owner?.children?.find((child) => child.objectId === sidecar.id);
    expect(attachment?.subtitle).toContain("Sheet annotations");
    expect(attachment?.subtitle).toContain("Attached to Plate");
    expect(attachment?.children?.map((child) => child.title)).toEqual(
      expect.arrayContaining(["DIM 100 mm", "NOTE Check finish", "DATUM A", "BLOCK title block"]),
    );
  });

  it("inspector summary exposes sheet metadata, counts, and reference diagnostics", () => {
    const scene = createMechanicalWorkflowDocument();
    const sidecar = createReferenceSidecar(scene);
    const summary = getMechanicalInspectorSummary(scene, sidecar);
    expect(summary.sheetSize).toBe("A4");
    expect(summary.orientation).toBe("landscape");
    expect(summary.sheetTarget).toBe("A4 landscape");
    expect(summary.sheetSizeLabel).toBe("297 × 210 mm");
    expect(summary.printMarginLabel).toBe("10 mm");
    expect(summary.units).toBe("mm");
    expect(summary.scale).toBe("1:1");
    expect(summary.drawingNumber).toBe("DWG-001");
    expect(summary.dimensionCount).toBe(1);
    expect(summary.noteCount).toBe(1);
    expect(summary.datumCount).toBe(1);
    expect(summary.blockCount).toBe(1);
    expect(summary.diagnosticsCount).toBe(0);
    expect(summary.referenceDiagnosticCount).toBe(0);
    expect(summary.dimensionReferenceSummaries[0]?.references[0]?.resolved).toBe(true);
  });

  it("render/export includes geometry plus mechanical annotations", () => {
    const scene = createMechanicalDraftingScene();
    const svg = serializeCanvasRenderSvg(scene);
    expect(svg).toContain('width="297mm"');
    expect(svg).toContain('height="210mm"');
    expect(svg).toContain("canvas-mechanical-sheet-boundary");
    expect(svg).toContain("canvas-mechanical-sheet-margin");
    expect(svg).toContain('data-canvas-kind="rect"');
    expect(svg).toContain('data-canvas-kind="ellipse"');
    expect(svg).toContain("canvas-mechanical-overlay");
    expect(svg).toContain("canvas-mechanical-note");
  });

  it("export cart wording includes mechanical visual review and mechanical drawing source", () => {
    const scene = createMechanicalDraftingScene();
    const artifacts = collectCanvasExportArtifacts({ scene });
    expect(artifacts.find((artifact) => artifact.id === "render-svg")?.title).toBe(
      "A4 mechanical visual review",
    );
    expect(artifacts.find((artifact) => artifact.id === "render-svg")?.description).toContain(
      "A4 landscape office paper",
    );
    expect(artifacts.find((artifact) => artifact.kind === "mechanicalJson")?.title).toBe(
      "Mechanical drawing source",
    );
    expect(artifacts.find((artifact) => artifact.kind === "mechanicalJson")?.description).toContain(
      "Mechanical annotation data",
    );
    expect(
      applyExportPreset(
        artifacts,
        CANVAS_EXPORT_PRESETS.find((candidate) => candidate.id === "full-archive")!,
      ).selectedArtifactIds.some((id) => id.startsWith("mechanical-json:")),
    ).toBe(true);
  });

  it("warns when a mechanical block extends outside the sheet", () => {
    const scene = createMechanicalWorkflowDocument();
    const sidecar = createReferenceSidecar(scene);
    const invalid = {
      ...sidecar,
      annotations: {
        ...sidecar.annotations,
        blocks: [
          ...sidecar.annotations.blocks,
          {
            id: "offsheet-rev",
            kind: "revisionTable" as const,
            x: 260,
            y: 180,
            columns: ["Rev"],
            rows: [{ Rev: "C" }],
          },
        ],
      },
    };
    const diagnostics = validateMechanicalAnnotationsForScene(scene, invalid);
    expect(diagnostics.some((entry) => entry.code === "MechanicalBlockOutsideSheet")).toBe(true);
  });

  it("warns when non-A4 sheet metadata appears in mechanical mode", () => {
    const scene = createMechanicalWorkflowDocument();
    const sidecar = createReferenceSidecar(scene);
    const invalid = {
      ...sidecar,
      annotations: {
        ...sidecar.annotations,
        sheet: {
          size: "Letter" as const,
          orientation: "portrait" as const,
          units: "mm" as const,
          scale: "1:1",
        },
      },
    };
    const diagnostics = validateMechanicalAnnotationsForScene(scene, invalid);
    expect(diagnostics.some((entry) => entry.code === "MechanicalSheetNotA4Landscape")).toBe(true);
  });
});
