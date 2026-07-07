import { describe, expect, it } from "vitest";
import { serializeCanvasRenderSvg } from "../../apps/machina-canvas/src/canvasExport";
import {
  createMechanicalExercise354BlockoutFeatureScene,
  createMechanicalExercise354BlockoutGlobalScene,
  createMechanicalExercise354BlockoutProcessNotes,
  createMechanicalExercise354BlockoutScene,
  MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS,
} from "../../apps/machina-canvas/scripts/create-mechanical-exercise-354-blockout";
import { createMechanicalExercise354Scene } from "../../apps/machina-canvas/scripts/create-mechanical-exercise-354";

const requiredProcessSections = [
  "## What I tried",
  "## What the global mask clarified",
  "## What the feature blockout clarified",
  "## How I lowered boxes into geometry",
  "## Where the method helped",
  "## Where I still guessed",
  "## What MachinaCanvas should formalize later",
  "## Suggested future schema",
  "## Deferred gaps",
] as const;

describe("MachinaCanvas mechanical Exercise 354 blockout dogfood", () => {
  it("generator declares the required blockout artifact paths", () => {
    expect(MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.globalSvg).toMatch(
      /mechanical-exercise-354-blockout-global\.svg$/,
    );
    expect(MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.featuresSvg).toMatch(
      /mechanical-exercise-354-blockout-features\.svg$/,
    );
    expect(MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.blockoutToml).toMatch(
      /mechanical-exercise-354\.blockout\.toml$/,
    );
    expect(MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.svg).toMatch(
      /mechanical-exercise-354-blockout\.render\.svg$/,
    );
    expect(MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.processNotes).toMatch(
      /mechanical-exercise-354-blockout-process-notes\.md$/,
    );
  });

  it("generator creates a global mask SVG with bounding and datum elements", () => {
    const svg = serializeCanvasRenderSvg(createMechanicalExercise354BlockoutGlobalScene());
    expect(svg).toContain('data-canvas-object-id="exercise-354-global-bounding-box"');
    expect(svg).toContain('data-canvas-object-id="exercise-354-global-datum-horizontal"');
    expect(svg).toContain('data-canvas-object-id="exercise-354-global-datum-bore-vertical"');
    expect(svg).toContain("global bounding");
    expect(svg).toContain("datum");
  });

  it("generator creates a feature blockout SVG with boss, hole, slot, and small-hole boxes", () => {
    const svg = serializeCanvasRenderSvg(createMechanicalExercise354BlockoutFeatureScene());
    expect(svg).toContain('data-canvas-object-id="exercise-354-feature-box-boss"');
    expect(svg).toContain('data-canvas-object-id="exercise-354-feature-box-large-hole"');
    expect(svg).toContain('data-canvas-object-id="exercise-354-feature-box-slot"');
    expect(svg).toContain('data-canvas-object-id="exercise-354-feature-box-left-small-hole"');
    expect(svg).toContain('data-canvas-object-id="exercise-354-feature-box-right-small-hole"');
    expect(svg).toContain("#00d92f");
  });

  it("generator creates a final render SVG with filled profile, voids, and annotations", () => {
    const svg = serializeCanvasRenderSvg(createMechanicalExercise354BlockoutScene());
    expect(svg).toContain('data-canvas-object-id="exercise-354-blockout-filled-body-profile"');
    expect(svg).toContain('fill="#68bfe9"');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('data-canvas-object-id="exercise-354-blockout-rounded-slot"');
    expect(svg).toContain('data-canvas-object-id="exercise-354-blockout-large-hole"');
    expect(svg).toContain('data-canvas-mechanical-id="exercise-354-blockout-title-block"');
    expect(svg).toContain("M39g blockout authored");
  });

  it("generator creates process notes markdown with all required sections", () => {
    const notes = createMechanicalExercise354BlockoutProcessNotes();
    expect(notes).toContain("# Exercise 354 Blockout Process Notes");
    for (const section of requiredProcessSections) {
      expect(notes).toContain(section);
    }
  });

  it("final scene includes construction, guide, and blockout layer records", () => {
    const scene = createMechanicalExercise354BlockoutScene();
    expect(scene.layers.map((layer) => layer.id)).toEqual(
      expect.arrayContaining(["guides", "construction"]),
    );
    expect(scene.objects["exercise-354-blockout-guide-sidecar"].kind).toBe("guideSidecar");
    expect(scene.objects["exercise-354-blockout-sidecar"].kind).toBe("blockoutSidecar");
    expect(scene.layers.find((layer) => layer.id === "guides")?.objectIds).toContain(
      "exercise-354-global-bounding-box",
    );
    expect(scene.layers.find((layer) => layer.id === "construction")?.objectIds).toContain(
      "exercise-354-blockout-bore-centerline-x",
    );
  });

  it("final scene includes a filled body profile with void subpaths", () => {
    const scene = createMechanicalExercise354BlockoutScene();
    const body = scene.objects["exercise-354-blockout-filled-body-profile"];
    expect(body.kind).toBe("path");
    if (body.kind !== "path") return;
    expect(body.tags).toEqual(expect.arrayContaining(["mechanical-body-profile"]));
    expect(body.fillRule).toBe("evenodd");
    expect(body.d.match(/ A /g)?.length).toBeGreaterThanOrEqual(7);
  });

  it("final scene keeps void hole and slot outline objects above the filled topology", () => {
    const scene = createMechanicalExercise354BlockoutScene();
    const voidIds = Object.values(scene.objects)
      .filter((object) => object.tags?.includes("mechanical-void"))
      .map((object) => object.id);
    expect(voidIds).toEqual(
      expect.arrayContaining([
        "exercise-354-blockout-large-hole",
        "exercise-354-blockout-rounded-slot",
        "exercise-354-blockout-left-small-hole",
        "exercise-354-blockout-right-small-hole",
      ]),
    );
  });

  it("feature guide and blockout sidecar records include boss, large hole, slot, and small holes", () => {
    const scene = createMechanicalExercise354BlockoutScene();
    const sidecar = scene.objects["exercise-354-blockout-guide-sidecar"];
    expect(sidecar.kind).toBe("guideSidecar");
    if (sidecar.kind !== "guideSidecar") return;
    const regionIds = sidecar.guide.regions.map((region) => region.id);
    expect(regionIds).toEqual(
      expect.arrayContaining([
        "exercise-354-feature-box-boss",
        "exercise-354-feature-box-large-hole",
        "exercise-354-feature-box-slot",
        "exercise-354-feature-box-left-small-hole",
        "exercise-354-feature-box-right-small-hole",
      ]),
    );
    const blockout = scene.objects["exercise-354-blockout-sidecar"];
    expect(blockout.kind).toBe("blockoutSidecar");
    if (blockout.kind !== "blockoutSidecar") return;
    expect(blockout.blockout.boxes.map((box) => box.id)).toEqual(
      expect.arrayContaining([
        "exercise-354-feature-box-boss",
        "exercise-354-feature-box-large-hole",
        "exercise-354-feature-box-slot",
      ]),
    );
  });

  it("process notes mention where the method helped and where Codex still guessed", () => {
    const notes = createMechanicalExercise354BlockoutProcessNotes();
    expect(notes).toContain("The method reduced composition mistakes");
    expect(notes).toContain("I still guessed tangent continuity");
    expect(notes).toMatch(/manual judgement/i);
  });

  it("process notes include a suggested future schema and non-goal boundaries", () => {
    const notes = createMechanicalExercise354BlockoutProcessNotes();
    expect(notes).toContain("type CanvasGuideSidecar");
    expect(notes).toContain("type CanvasBlockoutSidecar");
    expect(notes).toContain("automatic image-to-CAD extraction");
    expect(notes).toContain("CAD kernel");
    expect(notes).toContain("parametric sketch solver");
  });

  it("existing M39 mechanical Exercise 354 scene still creates filled topology", () => {
    const scene = createMechanicalExercise354Scene();
    const body = scene.objects["exercise-354-filled-body-profile"];
    expect(body.kind).toBe("path");
    if (body.kind !== "path") return;
    expect(body.fill).toBe("#68bfe9");
    expect(body.fillRule).toBe("evenodd");
  });
});
