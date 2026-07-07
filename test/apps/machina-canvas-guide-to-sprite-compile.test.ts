import { describe, expect, it } from "vitest";
import {
  serializeCompiledRuntimeSpriteToml,
  serializeCanvasSpriteToml,
} from "../../apps/machina-canvas/src/canvasExport";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import {
  createGuideSidecarObject,
  type CanvasGuideSidecar,
} from "../../apps/machina-canvas/src/guideSidecar";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  compileGuideRegionsToSpriteFrames,
  compileSpriteRuntimeSidecar,
  formatSpriteGuideCompileReport,
} from "../../apps/machina-canvas/src/spriteGuideCompiler";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
} from "../../apps/machina-canvas/src/spriteSidecar";
import {
  collectCanvasExportArtifacts,
  applyExportPreset,
  CANVAS_EXPORT_PRESETS,
} from "../../apps/machina-canvas/src/exportCart";

const image: ImageObject = {
  id: "sheet",
  name: "Sheet",
  kind: "image",
  layerId: "sprites",
  visible: true,
  x: 0,
  y: 0,
  width: 64,
  height: 32,
  src: "/sheet.png",
  intrinsicWidth: 64,
  intrinsicHeight: 32,
};

const spriteToml = `
[atlas]
image = "sheet.png"
width = 64
height = 32

[cut_grids.legacy]
x = 0
y = 0
columns = 2
rows = 1
cell_width = 16
cell_height = 16

[sprites.hero]
kind = "actor"
display_name = "Hero"

[sprites.hero.animations.idle]
frames = ["body.0.0", "body.0.1"]
fps = 6
loop = true

[sprites.prop]
kind = "prop"
display_name = "Prop"
frame = "exact.prop"

[frames."body.0.1"]
x = 18
y = 0
width = 14
height = 16
source_kind = "manual"
source_grid = "body"
source_row = 0
source_column = 1

[frames."exact.prop"]
x = 32
y = 0
width = 16
height = 16
source_kind = "exact"
`;

function createGuide(): CanvasGuideSidecar {
  return {
    kind: "canvasGuideSidecar",
    id: "sheet-guide",
    target: image.id,
    units: "px",
    regions: [
      {
        id: "body",
        kind: "sprite-region",
        x: 0,
        y: 0,
        width: 32,
        height: 16,
        grid: { columns: 2, rows: 1, cellWidth: 16, cellHeight: 16 },
      },
      {
        id: "nogrid",
        kind: "sprite-region",
        x: 0,
        y: 16,
        width: 16,
        height: 16,
      },
    ],
    datums: [{ id: "axis", kind: "vertical", x: 8 }],
    dimensions: [{ id: "w", kind: "linear", from: [0, 0], to: [32, 0], label: "32 px" }],
    alignmentMarks: [{ id: "origin", kind: "point", x: 0, y: 0 }],
  };
}

function createSidecar() {
  return createSpriteSidecarObject(
    image,
    parseSpriteSidecarToml(spriteToml, {
      id: "sheet-sidecar",
      name: "Sheet sidecar",
      targetId: image.id,
    }),
  );
}

function createScene(): CanvasDocument {
  const sidecar = createSidecar();
  const guide = createGuideSidecarObject(image, createGuide());
  return {
    id: "doc",
    name: "Compile doc",
    width: 128,
    height: 64,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [
      {
        id: "sprites",
        name: "Sprites",
        visible: true,
        objectIds: [image.id, sidecar.id, guide.id],
      },
    ],
    objects: {
      [image.id]: { ...image, spriteSidecarId: sidecar.id },
      [sidecar.id]: sidecar,
      [guide.id]: guide,
    },
    selectedObjectId: sidecar.id,
  };
}

describe("MachinaCanvas guide-to-sprite compile", () => {
  it("compiles guide-region grids into deterministic frame candidates and skips non-grid regions", () => {
    const sidecar = createSidecar();
    const result = compileGuideRegionsToSpriteFrames({
      spriteSidecar: sidecar.spec,
      guideSidecar: createGuide(),
    });

    expect(result.frames).toEqual([
      expect.objectContaining({
        frameId: "body.0.0",
        rect: { x: 0, y: 0, width: 16, height: 16 },
      }),
      expect.objectContaining({
        frameId: "body.0.1",
        rect: { x: 16, y: 0, width: 16, height: 16 },
      }),
    ]);
    expect(result.report.generatedFrameCount).toBe(2);
    expect(result.report.skippedRegionCount).toBe(1);
    expect(
      result.report.findings.some((finding) => finding.code === "GuideRegionSkippedNoGrid"),
    ).toBe(true);
  });

  it("reports duplicate generated frame ids", () => {
    const sidecar = createSidecar();
    const guide: CanvasGuideSidecar = {
      ...createGuide(),
      regions: [
        {
          id: "dup",
          kind: "sprite-region",
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          grid: { columns: 1, rows: 1, cellWidth: 16, cellHeight: 16 },
        },
        {
          id: "dup",
          kind: "sprite-region",
          x: 16,
          y: 0,
          width: 16,
          height: 16,
          grid: { columns: 1, rows: 1, cellWidth: 16, cellHeight: 16 },
        },
      ],
    };
    const result = compileGuideRegionsToSpriteFrames({
      spriteSidecar: sidecar.spec,
      guideSidecar: guide,
    });

    expect(
      result.report.findings.some((finding) => finding.code === "DuplicateGeneratedFrameId"),
    ).toBe(true);
  });

  it("preserves exact/manual frames and lets authored overrides beat generated frames", () => {
    const compiled = compileSpriteRuntimeSidecar({
      spriteSidecar: createSidecar().spec,
      guideSidecar: createGuide(),
      options: { mode: "runtime" },
    });

    expect(compiled.spriteSidecar.frames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "body.0.0",
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          sourceKind: "grid",
        }),
        expect.objectContaining({
          id: "body.0.1",
          x: 18,
          y: 0,
          width: 14,
          height: 16,
          sourceKind: "manual",
        }),
        expect.objectContaining({
          id: "exact.prop",
          x: 32,
          y: 0,
          width: 16,
          height: 16,
          sourceKind: "exact",
        }),
      ]),
    );
    expect(compiled.report.overrideFrameCount).toBe(1);
    expect(compiled.report.preservedFrameCount).toBeGreaterThanOrEqual(1);
  });

  it("keeps animation references and reports missing animation frames", () => {
    const brokenSpec = parseSpriteSidecarToml(
      `${spriteToml}\n[sprites.hero.animations.broken]\nframes = ["missing.frame"]\n`,
      { id: "broken", name: "Broken", targetId: image.id },
    );
    const compiled = compileSpriteRuntimeSidecar({
      spriteSidecar: brokenSpec,
      guideSidecar: createGuide(),
      options: { mode: "runtime" },
    });

    expect(
      compiled.spriteSidecar.animations.find((animation) => animation.id === "idle")?.frameIds,
    ).toEqual(["body.0.0", "body.0.1"]);
    expect(
      compiled.report.findings.some((finding) => finding.code === "AnimationMissingFrame"),
    ).toBe(true);
  });

  it("serializes runtime TOML without guide scaffolding or legacy cut grids and parses again", () => {
    const scene = createScene();
    const sidecar = scene.objects["sheet-sidecar"];
    const guide = scene.objects["sheet-guide"];
    if (sidecar.kind !== "spriteSidecar" || guide.kind !== "guideSidecar") {
      throw new Error("Expected sidecars.");
    }

    const runtimeToml = serializeCompiledRuntimeSpriteToml({
      spriteSidecar: sidecar,
      guideSidecar: guide,
    });

    expect(runtimeToml).toContain("[atlas]");
    expect(runtimeToml).toContain('[frames."body.0.0"]');
    expect(runtimeToml).toContain('[frames."exact.prop"]');
    expect(runtimeToml).not.toContain("cut_grids");
    expect(runtimeToml).not.toContain("[[regions]]");
    expect(runtimeToml).not.toContain("[[datums]]");
    expect(runtimeToml).not.toContain("[[dimensions]]");
    expect(runtimeToml).not.toContain("[[alignment_marks]]");
    expect(runtimeToml).not.toContain("[overlay]");

    const reparsed = parseSpriteSidecarToml(runtimeToml, {
      id: "runtime",
      name: "Runtime",
      targetId: image.id,
    });
    expect(reparsed.frames.map((frame) => frame.id)).toEqual(
      expect.arrayContaining(["body.0.0", "body.0.1", "exact.prop"]),
    );
    expect(reparsed.animations.find((animation) => animation.id === "idle")?.frameIds).toEqual([
      "body.0.0",
      "body.0.1",
    ]);
  });

  it("keeps authoring export behavior for legacy cut grids", () => {
    const sidecar = createSidecar();
    const authoringToml = serializeCanvasSpriteToml(sidecar, { mode: "authoring" });
    expect(authoringToml).toContain("[cut_grids.legacy]");
  });

  it("formats compile reports with the required sections and counts", () => {
    const compiled = compileSpriteRuntimeSidecar({
      spriteSidecar: createSidecar().spec,
      guideSidecar: createGuide(),
      options: { mode: "runtime" },
    });
    const report = formatSpriteGuideCompileReport(compiled.report);

    expect(report).toContain("# Sprite compile report");
    expect(report).toContain("## Summary");
    expect(report).toContain("## Generated frames");
    expect(report).toContain("## Preserved exact/manual frames");
    expect(report).toContain("## Overrides");
    expect(report).toContain("## Findings");
    expect(report).toContain("generated frames: 2");
  });

  it("uses compiled sprite TOML and compile reports in sprite handoff while leaving guide TOML for full archive", () => {
    const artifacts = collectCanvasExportArtifacts({ scene: createScene() });
    const spriteHandoff = applyExportPreset(
      artifacts,
      CANVAS_EXPORT_PRESETS.find((preset) => preset.id === "sprite-handoff")!,
    );
    const fullArchive = applyExportPreset(
      artifacts,
      CANVAS_EXPORT_PRESETS.find((preset) => preset.id === "full-archive")!,
    );

    expect(spriteHandoff.selectedArtifactIds.some((id) => id.startsWith("sprite-toml:"))).toBe(
      true,
    );
    expect(
      spriteHandoff.selectedArtifactIds.some((id) => id.startsWith("sprite-compile-report:")),
    ).toBe(true);
    expect(spriteHandoff.selectedArtifactIds.some((id) => id.startsWith("guide-toml:"))).toBe(
      false,
    );
    expect(fullArchive.selectedArtifactIds.some((id) => id.startsWith("guide-toml:"))).toBe(true);

    expect(artifacts.find((artifact) => artifact.id.startsWith("sprite-toml:"))?.title).toBe(
      "Compiled sprite TOML",
    );
    expect(artifacts.find((artifact) => artifact.id.startsWith("guide-toml:"))?.title).toBe(
      "Guide TOML (authoring)",
    );
    expect(
      artifacts.find((artifact) => artifact.id.startsWith("sprite-compile-report:"))?.title,
    ).toBe("Sprite compile report");
  });
});
