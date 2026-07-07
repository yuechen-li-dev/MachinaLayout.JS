import { describe, expect, it } from "vitest";
import {
  buildSpriteAuditReport,
  createSpriteAuditScreenshotDocument,
  formatSpriteAuditReport,
} from "../../apps/machina-canvas/src/spriteAudit";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
} from "../../apps/machina-canvas/src/spriteSidecar";

const image: ImageObject = {
  id: "sheet",
  name: "Sheet",
  kind: "image",
  layerId: "sprites",
  visible: true,
  x: 0,
  y: 0,
  width: 64,
  height: 64,
  src: "/sheet.svg",
  role: "image",
  intrinsicWidth: 64,
  intrinsicHeight: 64,
  fit: "fill",
};

const cleanGridToml = `
[atlas]
image = "sheet.png"
width = 64
height = 64

[grids.base]
origin_x = 0
origin_y = 0
columns = 4
rows = 4
cell_width = 16
cell_height = 16

[sprites.hero]
kind = "actor"
display_name = "Hero"

[sprites.hero.animations.walk]
grid = "base"
row = 0
frames = [0, 1, 2, 3]
fps = 8
loop = true
`;

const suspiciousToml = `
[atlas]
image = "sheet.png"
width = 80
height = 64

[grids.base]
origin_x = 0
origin_y = 0
columns = 4
rows = 4
cell_width = 16
cell_height = 16

[sprites.hero]
kind = "actor"
display_name = "Hero"

[sprites.hero.animations.walk]
grid = "base"
row = 0
frames = ["hero.walk.bad_exact", 1, "hero.walk.bad_exact"]
fps = 8
loop = true

[frames."hero.walk.bad_exact"]
x = 17
y = 1
width = 15
height = 16
display_name = "Hero Exact"

[frames."hero.walk.dup_rect"]
x = 17
y = 1
width = 15
height = 16
display_name = "Hero Exact"

[frames."hero.walk.edge"]
x = 56
y = 56
width = 16
height = 16
display_name = "Edge"
grid = "base"
`;

const tinytownExactToml = `
[atlas]
image = "sheet.png"
width = 1440
height = 720

[grids.villagers_down]
origin_x = 0
origin_y = 0
columns = 3
rows = 4
cell_width = 120
cell_height = 120

[sprites.maya]
display_name = "Maya"

[sprites.maya.animations.down]
grid = "villagers_down"
row = 0
frames = [0, 1, 2]

[sprites.maya.animations.down_exact]
grid = "villagers_down"
row = 0
frames = ["maya.down.idle_exact", 1, 2]

[frames."maya.down.idle_exact"]
x = 24
y = 8
width = 72
height = 104
`;

function createSidecar(toml: string) {
  const spec = parseSpriteSidecarToml(toml, {
    id: "sheet-sidecar",
    name: "Sheet sidecar",
    targetId: image.id,
    sourceName: "sheet.spriteforge.toml",
  });
  return createSpriteSidecarObject(image, spec);
}

function createDocument(toml: string) {
  const sidecar = createSidecar(toml);
  return {
    id: "doc",
    name: "Sprite Doc",
    width: 64,
    height: 64,
    unit: "px" as const,
    unitSystem: createCanvasUnitSystem("px"),
    layers: [
      { id: "sprites", name: "Sprites", visible: true, objectIds: [image.id] },
      { id: "sprite-overlays", name: "Sprite Overlays", visible: true, objectIds: [sidecar.id] },
    ],
    objects: {
      [image.id]: { ...image, spriteSidecarId: sidecar.id },
      [sidecar.id]: { ...sidecar, layerId: "sprite-overlays" },
    },
    selectedObjectId: image.id,
  } satisfies CanvasDocument;
}

describe("MachinaCanvas sprite audit", () => {
  it("returns no findings on a clean regular grid fixture", () => {
    const report = buildSpriteAuditReport(createSidecar(cleanGridToml), image);
    expect(report.findings).toEqual([]);
    expect(report.summary.totalFindings).toBe(0);
  });

  it("keeps hard geometry errors while treating custom cuts as softer findings", () => {
    const report = buildSpriteAuditReport(createSidecar(suspiciousToml), image);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "FrameOutOfBounds", frameId: "hero.walk.edge" }),
        expect.objectContaining({
          code: "CustomFrameNearGrid",
          frameId: "hero.walk.bad_exact",
          severity: "note",
        }),
      ]),
    );
  });

  it("detects duplicate rects and duplicate labels", () => {
    const report = buildSpriteAuditReport(createSidecar(suspiciousToml), image);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "DuplicateRect", frameId: "hero.walk.dup_rect" }),
        expect.objectContaining({ code: "DuplicateLabel", frameId: "hero.walk.dup_rect" }),
      ]),
    );
  });

  it("detects animation mix notes and repeated frames", () => {
    const report = buildSpriteAuditReport(createSidecar(suspiciousToml), image);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "AnimationMixedGridAndExactFrames",
          animationId: "walk",
          spriteId: "hero",
          severity: "note",
        }),
        expect.objectContaining({
          code: "RepeatedAnimationFrame",
          frameId: "hero.walk.bad_exact",
        }),
      ]),
    );
  });

  it("detects atlas and image dimension mismatches", () => {
    const report = buildSpriteAuditReport(createSidecar(suspiciousToml), image);
    expect(report.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "AtlasImageDimensionMismatch" })]),
    );
  });

  it("supports selected-frame-only scope", () => {
    const sidecar = createSidecar(suspiciousToml);
    const selectedOnlySidecar = {
      ...sidecar,
      spec: {
        ...sidecar.spec,
        selectedFrameId: "hero.walk.bad_exact",
      },
    };
    const report = buildSpriteAuditReport(selectedOnlySidecar, image, {
      scope: "selectedFrame",
    });

    expect(report.frames).toHaveLength(1);
    expect(report.frames[0]?.frameId).toBe("hero.walk.bad_exact");
  });

  it("treats a TinyTown-style exact crop inside its parent grid cell as a note", () => {
    const report = buildSpriteAuditReport(createSidecar(tinytownExactToml), {
      ...image,
      intrinsicWidth: 1440,
      intrinsicHeight: 720,
      width: 1440,
      height: 720,
    });
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ExactCropInsideGridCell",
          frameId: "maya.down.idle_exact",
          severity: "note",
        }),
        expect.objectContaining({
          code: "ExactCropOverlapsParentGrid",
          frameId: "maya.down.idle_exact",
          severity: "note",
        }),
        expect.objectContaining({
          code: "AnimationMixedGridAndExactFrames",
          animationId: "down_exact",
          severity: "note",
        }),
      ]),
    );
  });

  it("formats summary counts, frame entries, and explanation sections", () => {
    const report = buildSpriteAuditReport(createSidecar(suspiciousToml), image);
    const text = formatSpriteAuditReport(report);

    expect(text).toContain("# Sprite Audit Report");
    expect(text).toContain("total diagnostics / suspicious findings");
    expect(text).toContain("## Subgrids");
    expect(text).toContain("| Grid | X | Y | Cell | Rows | Cols | Frames |");
    expect(text).toContain("## Stackframes");
    expect(text).toContain(
      "| Frame | Source | Grid | Row | Col | Stackframe | Stack Index | Sprite | Animation | X | Y | W | H | Flags |",
    );
    expect(text).toContain("## Alpha-aware cut analysis");
    expect(text).toContain("hero.walk.bad_exact");
    expect(text).toContain("## Why previous cuts were probably wrong");
    expect(text).toContain("## What to adjust next");
  });

  it("forces overlay bounds and selected-only scope in screenshot documents", () => {
    const document = createDocument(suspiciousToml);
    const screenshotDocument = createSpriteAuditScreenshotDocument(
      document,
      "sheet-sidecar",
      "selectedFrame",
    );
    const sidecar = screenshotDocument.objects["sheet-sidecar"];
    if (sidecar.kind !== "spriteSidecar") {
      throw new Error("Expected sprite sidecar.");
    }

    expect(screenshotDocument.selectedObjectId).toBe("sheet-sidecar");
    expect(sidecar.visible).toBe(true);
    expect(sidecar.spec.overlay.displayMode).toBe("audit");
    expect(sidecar.spec.overlay.showBounds).toBe(true);
    expect(sidecar.spec.overlay.showLabels).toBe(false);
    expect(sidecar.spec.overlay.selectedOnly).toBe(true);
  });
});
