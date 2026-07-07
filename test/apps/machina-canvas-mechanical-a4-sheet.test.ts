import { describe, expect, it } from "vitest";
import { serializeCanvasRenderSvg } from "../../apps/machina-canvas/src/canvasExport";
import { collectCanvasExportArtifacts } from "../../apps/machina-canvas/src/exportCart";
import {
  getMechanicalInspectorSummary,
  validateMechanicalAnnotationsForScene,
} from "../../apps/machina-canvas/src/mechanicalAnnotations";
import {
  getMechanicalA4LandscapeLayout,
  MECHANICAL_A4_LANDSCAPE_MM,
  MECHANICAL_A4_PRINT_MARGIN_MM,
} from "../../apps/machina-canvas/src/mechanicalSheet";
import { createMechanicalDraftingScene } from "../../apps/machina-canvas/src/sceneTemplates";

describe("MachinaCanvas mechanical A4 sheet", () => {
  it("uses A4 landscape constants and 10 mm print margins", () => {
    expect(MECHANICAL_A4_LANDSCAPE_MM.width).toBe(297);
    expect(MECHANICAL_A4_LANDSCAPE_MM.height).toBe(210);
    expect(MECHANICAL_A4_PRINT_MARGIN_MM).toEqual({
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
  });

  it("computes the A4 landscape content box correctly", () => {
    expect(getMechanicalA4LandscapeLayout().contentBoxMm).toEqual({
      x: 10,
      y: 10,
      width: 277,
      height: 190,
    });
  });

  it("keeps the mechanical template on an A4 landscape sheet with bottom-right title block", () => {
    const scene = createMechanicalDraftingScene();
    const sidecar = scene.objects["mechanical-annotations"];
    if (sidecar.kind !== "mechanicalAnnotationSidecar") {
      throw new Error("Expected mechanical annotation sidecar.");
    }
    const titleBlock = sidecar.annotations.blocks.find((block) => block.id === "sheet-title-block");
    if (!titleBlock || titleBlock.kind !== "titleBlock") {
      throw new Error("Expected title block.");
    }
    expect(sidecar.annotations.sheet).toMatchObject({
      size: "A4",
      orientation: "landscape",
      units: "mm",
    });
    expect(titleBlock.x).toBeGreaterThan(190);
    expect(titleBlock.y).toBeGreaterThan(160);
  });

  it("exports print-friendly SVG sheet boundary, margin box, title block, and geometry", () => {
    const svg = serializeCanvasRenderSvg(createMechanicalDraftingScene());
    expect(svg).toContain('viewBox="0 0 297 210"');
    expect(svg).toContain('width="297mm"');
    expect(svg).toContain('height="210mm"');
    expect(svg).toContain("canvas-mechanical-sheet-boundary");
    expect(svg).toContain("canvas-mechanical-sheet-margin");
    expect(svg).toContain('data-canvas-mechanical-id="sheet-title-block"');
    expect(svg).toContain('data-canvas-kind="rect"');
    expect(svg).toContain("canvas-mechanical-note");
  });

  it("surfaces A4 metadata in the inspector summary", () => {
    const scene = createMechanicalDraftingScene();
    const sidecar = scene.objects["mechanical-annotations"];
    if (sidecar.kind !== "mechanicalAnnotationSidecar") {
      throw new Error("Expected mechanical annotation sidecar.");
    }
    const summary = getMechanicalInspectorSummary(scene, sidecar);
    expect(summary.sheetTarget).toBe("A4 landscape");
    expect(summary.sheetSizeLabel).toBe("297 × 210 mm");
    expect(summary.printMarginLabel).toBe("10 mm");
    expect(summary.diagnosticsCount).toBe(0);
  });

  it("labels export-cart artifacts as A4 mechanical review/source outputs when appropriate", () => {
    const artifacts = collectCanvasExportArtifacts({ scene: createMechanicalDraftingScene() });
    expect(artifacts.find((artifact) => artifact.id === "render-svg")?.title).toBe(
      "A4 mechanical visual review",
    );
    expect(artifacts.find((artifact) => artifact.id === "render-svg")?.description).toContain(
      "A4 landscape office paper",
    );
    expect(artifacts.find((artifact) => artifact.kind === "mechanicalJson")?.title).toBe(
      "Mechanical drawing source",
    );
  });

  it("warns when a key mechanical annotation falls outside the print margin", () => {
    const scene = createMechanicalDraftingScene();
    const sidecar = scene.objects["mechanical-annotations"];
    if (sidecar.kind !== "mechanicalAnnotationSidecar") {
      throw new Error("Expected mechanical annotation sidecar.");
    }
    const invalid = {
      ...sidecar,
      annotations: {
        ...sidecar.annotations,
        notes: [
          ...sidecar.annotations.notes,
          {
            id: "outside-margin-note",
            kind: "note" as const,
            at: [295, 18] as const,
            text: "Outside print margin",
          },
        ],
      },
    };
    const diagnostics = validateMechanicalAnnotationsForScene(scene, invalid);
    expect(
      diagnostics.some(
        (diagnostic) => diagnostic.code === "MechanicalAnnotationOutsidePrintMargin",
      ),
    ).toBe(true);
  });
});
