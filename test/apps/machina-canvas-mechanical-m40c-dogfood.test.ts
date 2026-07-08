import { describe, expect, it } from "vitest";
import { serializeCanvasRenderSvg } from "../../apps/machina-canvas/src/canvasExport";
import {
  createMechanicalExerciseM40cBlockoutScene,
  createMechanicalExerciseM40cDogfoodReport,
  createMechanicalExerciseM40cGuideScene,
  createMechanicalExerciseM40cProcessNotes,
  createMechanicalExerciseM40cScene,
  MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS,
} from "../../apps/machina-canvas/scripts/create-mechanical-exercise-m40c";

describe("MachinaCanvas mechanical M40c dogfood", () => {
  it("declares the expected guide, blockout, scene, render, and report artifacts", () => {
    expect(MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.guideToml).toMatch(
      /mechanical-exercise-m40c\.guide\.toml$/,
    );
    expect(MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.blockoutToml).toMatch(
      /mechanical-exercise-m40c\.blockout\.toml$/,
    );
    expect(MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.scene).toMatch(
      /mechanical-exercise-m40c\.mcanvas\.json$/,
    );
    expect(MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.svg).toMatch(
      /mechanical-exercise-m40c\.render\.svg$/,
    );
    expect(MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.report).toMatch(
      /mechanical-exercise-m40c\.dogfood-report\.md$/,
    );
  });

  it("guide scene includes construction masks and a guide sidecar", () => {
    const scene = createMechanicalExerciseM40cGuideScene();
    const svg = serializeCanvasRenderSvg(scene);
    expect(svg).toContain('data-canvas-object-id="m40c-guide-overall-bounds"');
    expect(svg).toContain('data-canvas-object-id="m40c-guide-top-arc-cue"');
    expect(scene.objects["m40c-guide-sidecar"].kind).toBe("guideSidecar");
  });

  it("blockout scene includes feature boxes and blockout cue records", () => {
    const scene = createMechanicalExerciseM40cBlockoutScene();
    const svg = serializeCanvasRenderSvg(scene);
    expect(svg).toContain('data-canvas-object-id="m40c-blockout-main-boss"');
    expect(svg).toContain('data-canvas-object-id="m40c-blockout-lower-slot"');
    expect(svg).toContain('data-canvas-object-id="m40c-blockout-right-shoulder-cue"');
    expect(scene.objects["m40c-blockout-sidecar"].kind).toBe("blockoutSidecar");
  });

  it("final scene creates a filled profile with explicit void outlines and hidden guide layer", () => {
    const scene = createMechanicalExerciseM40cScene();
    const body = scene.objects["m40c-filled-body-profile"];
    expect(body.kind).toBe("path");
    if (body.kind !== "path") return;
    expect(body.fillRule).toBe("evenodd");
    expect(body.fill).toBe("#68bfe9");
    expect(body.d.match(/ A /g)?.length).toBeGreaterThanOrEqual(5);
    expect(scene.layers.find((layer) => layer.id === "guides")?.visible).toBe(false);
    expect(
      Object.values(scene.objects).some((object) => object.tags?.includes("mechanical-void")),
    ).toBe(true);
  });

  it("report and process notes call out authoring frictions explicitly", () => {
    const report = createMechanicalExerciseM40cDogfoodReport();
    const notes = createMechanicalExerciseM40cProcessNotes();
    expect(report).toContain("Guide authoring felt awkward");
    expect(report).toContain("Blockout authoring");
    expect(report).toContain("Arc helpers were sufficient");
    expect(report).toContain("Annotation placement is still too manual");
    expect(report).toContain("Export/view workflow is functional but clumsy");
    expect(notes).toContain("## Guide decisions");
    expect(notes).toContain("## Blockout decisions");
    expect(notes).toContain("## Assumptions");
  });
});
