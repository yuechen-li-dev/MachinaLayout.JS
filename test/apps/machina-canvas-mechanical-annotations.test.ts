import { describe, expect, it } from "vitest";
import {
  serializeCanvasRenderSvg,
  createCanvasExportBundle,
} from "../../apps/machina-canvas/src/canvasExport";
import { collectCanvasExportArtifacts } from "../../apps/machina-canvas/src/exportCart";
import { buildCanvasLayerTree } from "../../apps/machina-canvas/src/layerTree";
import {
  createDefaultMechanicalSheetMetadata,
  createMechanicalAnnotationSet,
  createMechanicalAnnotationSidecarObject,
  serializeMechanicalAnnotationOverlayContent,
  validateMechanicalAnnotations,
} from "../../apps/machina-canvas/src/mechanicalAnnotations";
import {
  addMechanicalBlock,
  addMechanicalDatum,
  addMechanicalDimension,
  addMechanicalNote,
  createMechanicalAnnotationSidecar,
} from "../../apps/machina-canvas/src/sceneCommands";
import { createMechanicalDraftingScene } from "../../apps/machina-canvas/src/sceneTemplates";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import type { CanvasDocument, CanvasObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  CANVAS_EDITOR_MODE_TEMPLATES,
  getCanvasEditorModeTemplate,
} from "../../apps/machina-canvas/src/editorModes";

function createDocument(): CanvasDocument {
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
  return {
    id: "mechanical-doc",
    name: "Mechanical Doc",
    width: 240,
    height: 160,
    unit: "mm",
    unitSystem: createCanvasUnitSystem("mm"),
    layers: [
      { id: "geometry", name: "Geometry", visible: true, objectIds: [plate.id] },
      { id: "annotations", name: "Mechanical Drafting", visible: true, objectIds: [] },
    ],
    layerGroups: [{ id: "mechanical", title: "Mechanical Drafting", objectIds: [plate.id] }],
    objects: { [plate.id]: plate },
    selectedObjectId: plate.id,
  };
}

function createSidecar() {
  return createMechanicalAnnotationSidecarObject({
    id: "mechanical-sidecar",
    name: "drawing annotations",
    layerId: "annotations",
    x: 0,
    y: 0,
    width: 240,
    height: 160,
    targetObjectId: "plate",
    annotations: createMechanicalAnnotationSet({
      id: "drawing-annotations",
      units: "mm",
      scale: "1:1",
      sheet: {
        ...createDefaultMechanicalSheetMetadata(),
        scale: "1:1",
        drawingNumber: "BRKT-001",
        title: "Bracket",
        revision: "A",
      },
      dimensions: [
        {
          id: "width",
          kind: "linear",
          axis: "horizontal",
          from: [20, 80],
          to: [120, 80],
          offset: 18,
          label: "100",
          tolerance: "+/-0.1",
        },
      ],
      notes: [
        {
          id: "note-1",
          kind: "callout",
          at: [140, 42],
          leaderTo: [120, 42],
          text: "Break sharp edges",
        },
      ],
      datums: [{ id: "datum-a", label: "A", at: [10, 48], target: [20, 48] }],
      blocks: [
        {
          id: "title-block",
          kind: "titleBlock",
          x: 130,
          y: 114,
          width: 90,
          height: 36,
          fields: {
            Title: "Bracket",
            Drawing: "BRKT-001",
            Rev: "A",
            Scale: "1:1",
            Units: "mm",
          },
        },
        {
          id: "revision-table",
          kind: "revisionTable",
          x: 130,
          y: 70,
          columns: ["Rev", "Desc"],
          rows: [
            { Rev: "A", Desc: "Initial" },
            { Rev: "", Desc: "" },
          ],
        },
        {
          id: "bom-table",
          kind: "bomTable",
          x: 16,
          y: 92,
          columns: ["Item", "Part", "Qty"],
          rows: [
            { Item: "1", Part: "Plate", Qty: "1" },
            { Item: "2", Part: "", Qty: "" },
          ],
        },
      ],
    }),
  });
}

describe("MachinaCanvas mechanical annotations", () => {
  it("creates a mechanical annotation set", () => {
    const annotations = createMechanicalAnnotationSet({ id: "test-set", units: "mm" });
    expect(annotations.kind).toBe("mechanicalAnnotationSet");
    expect(annotations.units).toBe("mm");
  });

  it("validates valid dimensions and accepts tolerance strings", () => {
    const diagnostics = validateMechanicalAnnotations(createSidecar().annotations);
    expect(diagnostics).toEqual([]);
  });

  it("rejects duplicate annotation ids", () => {
    const annotations = createMechanicalAnnotationSet({
      id: "dupes",
      units: "mm",
      dimensions: [
        { id: "dup", kind: "linear", axis: "horizontal", from: [0, 0], to: [10, 0], label: "10" },
      ],
      notes: [{ id: "dup", kind: "note", at: [0, 0], text: "duplicate" }],
    });
    expect(
      validateMechanicalAnnotations(annotations).some(
        (item) => item.code === "DuplicateMechanicalAnnotationId",
      ),
    ).toBe(true);
  });

  it("rejects invalid units", () => {
    const annotations = { ...createMechanicalAnnotationSet(), units: "pt" as never };
    expect(
      validateMechanicalAnnotations(annotations).some(
        (item) => item.code === "InvalidMechanicalUnits",
      ),
    ).toBe(true);
  });

  it("rejects invalid dimension points", () => {
    const annotations = createMechanicalAnnotationSet({
      id: "bad-points",
      units: "mm",
      dimensions: [
        {
          id: "width",
          kind: "linear",
          axis: "horizontal",
          from: [Number.NaN, 0],
          to: [10, 0],
        },
      ],
    });
    expect(
      validateMechanicalAnnotations(annotations).some(
        (item) => item.code === "InvalidMechanicalDimensionPoints",
      ),
    ).toBe(true);
  });

  it("validates note/callout, datum, title block, and revision/BOM tables", () => {
    const diagnostics = validateMechanicalAnnotations(createSidecar().annotations);
    expect(diagnostics.some((item) => item.code === "InvalidMechanicalNote")).toBe(false);
    expect(diagnostics.some((item) => item.code === "InvalidMechanicalDatum")).toBe(false);
    expect(diagnostics.some((item) => item.code === "InvalidMechanicalBlock")).toBe(false);
    expect(diagnostics.some((item) => item.code === "InvalidMechanicalTable")).toBe(false);
  });

  it("renders dimension, note/callout, datum, and table markup", () => {
    const markup = serializeMechanicalAnnotationOverlayContent(createSidecar());
    expect(markup).toContain("canvas-mechanical-sheet-boundary");
    expect(markup).toContain("canvas-mechanical-sheet-margin");
    expect(markup).toContain("canvas-mechanical-dimension");
    expect(markup).toContain("canvas-mechanical-note");
    expect(markup).toContain("canvas-mechanical-datum-box");
    expect(markup).toContain("canvas-mechanical-table");
  });

  it("renders title blocks and tables without undefined text", () => {
    const markup = serializeMechanicalAnnotationOverlayContent(createSidecar());
    expect(markup).not.toContain("undefined");
  });

  it("scene can contain a mechanical annotation sidecar and scene command helpers append records", () => {
    let document = createMechanicalAnnotationSidecar(createDocument(), createSidecar());
    document = addMechanicalDimension(document, "mechanical-sidecar", {
      id: "height",
      kind: "linear",
      axis: "vertical",
      from: [120, 20],
      to: [120, 80],
      label: "60",
    });
    document = addMechanicalNote(document, "mechanical-sidecar", {
      id: "note-2",
      kind: "note",
      at: [140, 60],
      text: "Paint after machining",
    });
    document = addMechanicalDatum(document, "mechanical-sidecar", {
      id: "datum-b",
      label: "B",
      at: [60, 12],
      target: [60, 20],
    });
    document = addMechanicalBlock(document, "mechanical-sidecar", {
      id: "extra-bom",
      kind: "bomTable",
      x: 16,
      y: 88,
      columns: ["Item"],
      rows: [{ Item: "2" }],
    });

    const sidecar = document.objects["mechanical-sidecar"];
    if (sidecar.kind !== "mechanicalAnnotationSidecar")
      throw new Error("Expected mechanical sidecar.");
    expect(sidecar.annotations.dimensions).toHaveLength(2);
    expect(sidecar.annotations.notes).toHaveLength(2);
    expect(sidecar.annotations.datums).toHaveLength(2);
    expect(sidecar.annotations.blocks).toHaveLength(4);
  });

  it("mechanical mode template exists and creates a valid scene", () => {
    expect(CANVAS_EDITOR_MODE_TEMPLATES.some((template) => template.id === "mechanical")).toBe(
      true,
    );
    const document = getCanvasEditorModeTemplate("mechanical").createScene();
    expect(document.selectedObjectId).toBe("mechanical-annotations");
    expect(
      Object.values(document.objects).some(
        (object) => object.kind === "mechanicalAnnotationSidecar",
      ),
    ).toBe(true);
    const bodyProfile = document.objects["draft-plate-filled-profile"];
    expect(bodyProfile.kind).toBe("path");
    if (bodyProfile.kind !== "path") return;
    expect(bodyProfile.tags).toEqual(expect.arrayContaining(["mechanical-body-profile"]));
    expect(bodyProfile.fillRule).toBe("evenodd");
    expect(bodyProfile.fill).not.toBe("transparent");
  });

  it("layer tree includes the mechanical annotation sidecar", () => {
    const document = createMechanicalAnnotationSidecar(createDocument(), createSidecar());
    const tree = buildCanvasLayerTree(document);
    const owner = tree[0]?.children?.[0];
    expect(owner?.children?.some((child) => child.badge === "ANNO")).toBe(true);
  });

  it("export svg includes mechanical annotations and export cart exposes a mechanical json artifact", () => {
    const document = createMechanicalAnnotationSidecar(createDocument(), createSidecar());
    const svg = serializeCanvasRenderSvg(document);
    expect(svg).toContain('data-canvas-kind="mechanicalAnnotationSidecar"');
    expect(svg).toContain("canvas-mechanical-note");

    const artifacts = collectCanvasExportArtifacts({ scene: document });
    expect(artifacts.some((artifact) => artifact.kind === "mechanicalJson")).toBe(true);
  });

  it("mechanical drafting scene exports cleanly", () => {
    const bundle = createCanvasExportBundle(createMechanicalDraftingScene());
    expect(bundle.files.some((file) => file.path.endsWith(".mechanical.json"))).toBe(true);
    expect(bundle.files.find((file) => file.path === "render.svg")?.text).toContain(
      "canvas-mechanical-overlay",
    );
  });
});
