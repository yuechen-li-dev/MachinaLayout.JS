import { describe, expect, it } from "vitest";
import { createCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExport";
import {
  createGuideSidecarObject,
  parseGuideSidecarToml,
} from "../../apps/machina-canvas/src/guideSidecar";
import {
  applyCanvasCommands,
  clampSpriteFrameToGuideRegion,
  updateSpriteFrameRect,
} from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  buildSpriteAuditReport,
  formatSpriteAuditReport,
} from "../../apps/machina-canvas/src/spriteAudit";
import {
  clampSpriteFrameRectToGuideRegion,
  collectGuideRegionDiagnosticsForSpriteSidecar,
  findGuideRegionForSpriteFrame,
} from "../../apps/machina-canvas/src/spriteGuideRegions";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
} from "../../apps/machina-canvas/src/spriteSidecar";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";

const image: ImageObject = {
  id: "sheet",
  name: "Sheet",
  kind: "image",
  layerId: "sprites",
  visible: true,
  x: 0,
  y: 0,
  width: 144,
  height: 144,
  src: "/sheet.png",
  intrinsicWidth: 144,
  intrinsicHeight: 144,
};

const spriteToml = `
[atlas]
width = 144
height = 144

[frames."hero.idle"]
x = 8
y = 8
width = 20
height = 20
`;

const guideToml = `
[guide]
id = "sheet-guide"
target = "sheet"
units = "px"

[[regions]]
id = "outer"
kind = "sprite-region"
x = 0
y = 0
width = 64
height = 64

[[regions]]
id = "inner"
kind = "sprite-region"
x = 8
y = 8
width = 24
height = 24

[[regions]]
id = "right"
kind = "sprite-region"
x = 80
y = 0
width = 48
height = 48
`;

function createGuideRegionDocument() {
  const base: CanvasDocument = {
    id: "doc",
    name: "Guide Region Doc",
    width: 256,
    height: 256,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [{ id: "sprites", name: "Sprites", visible: true, objectIds: [image.id] }],
    objects: { [image.id]: image },
    selectedObjectId: image.id,
  };
  const spec = parseSpriteSidecarToml(spriteToml, {
    id: "sheet-sidecar",
    name: "Sheet sidecar",
    targetId: image.id,
  });
  const guide = parseGuideSidecarToml(guideToml);
  const sidecar = createSpriteSidecarObject(image, spec);
  const guideObject = createGuideSidecarObject(image, { ...guide, rawToml: undefined });
  return applyCanvasCommands(base, [
    { kind: "addSpriteSidecarObject", object: sidecar, attach: true },
    { kind: "addGuideSidecarObject", object: guideObject, attach: true },
    { kind: "select", id: sidecar.id },
    { kind: "selectSpriteFrame", sidecarId: sidecar.id, frameId: "hero.idle" },
  ]).document;
}

function getSidecar(document: CanvasDocument) {
  const sidecar = document.objects["sheet-sidecar"];
  if (sidecar?.kind !== "spriteSidecar") throw new Error("Expected sprite sidecar.");
  return sidecar;
}

describe("MachinaCanvas guide-region sprite editing", () => {
  it("finds the smallest containing guide region deterministically", () => {
    const document = createGuideRegionDocument();
    const context = findGuideRegionForSpriteFrame(document, {
      spriteSidecarId: "sheet-sidecar",
      frameId: "hero.idle",
    });

    expect(context?.relation).toBe("contains");
    expect(context?.regionId).toBe("inner");
    expect(context?.deltaToRegion).toEqual({ left: 0, top: 0, right: 4, bottom: 4 });
  });

  it("chooses the largest intersecting region when none fully contain", () => {
    const document = updateSpriteFrameRect(
      createGuideRegionDocument(),
      "sheet-sidecar",
      "hero.idle",
      { x: 40, y: 40, width: 40, height: 40 },
    );

    const context = findGuideRegionForSpriteFrame(document, {
      spriteSidecarId: "sheet-sidecar",
      frameId: "hero.idle",
    });
    expect(context?.relation).toBe("intersects");
    expect(context?.regionId).toBe("outer");
  });

  it("returns undefined when no guide sidecar is attached", () => {
    const base = applyCanvasCommands(
      {
        id: "doc",
        name: "No Guide",
        width: 256,
        height: 256,
        unit: "px",
        unitSystem: createCanvasUnitSystem("px"),
        layers: [{ id: "sprites", name: "Sprites", visible: true, objectIds: [image.id] }],
        objects: { [image.id]: image },
        selectedObjectId: image.id,
      },
      [
        {
          kind: "addSpriteSidecarObject",
          object: createSpriteSidecarObject(
            image,
            parseSpriteSidecarToml(spriteToml, {
              id: "sheet-sidecar",
              name: "Sheet sidecar",
              targetId: image.id,
            }),
          ),
          attach: true,
        },
      ],
    ).document;

    expect(
      findGuideRegionForSpriteFrame(base, {
        spriteSidecarId: "sheet-sidecar",
        frameId: "hero.idle",
      }),
    ).toBeUndefined();
  });

  it("clamps frame rects to guide regions", () => {
    expect(
      clampSpriteFrameRectToGuideRegion(
        { x: -5.4, y: 10.2, width: 40.8, height: 40.1 },
        { id: "r", kind: "sprite-region", x: 8, y: 8, width: 24, height: 24 },
      ),
    ).toEqual({ x: 8, y: 8, width: 24, height: 24 });
    expect(
      clampSpriteFrameRectToGuideRegion(
        { x: 10, y: 10, width: 20, height: 20 },
        { id: "r", kind: "sprite-region", x: 8, y: 8, width: 24, height: 24 },
      ),
    ).toEqual({ x: 10, y: 10, width: 20, height: 20 });
  });

  it("honors the constrain option during edits and leaves behavior unchanged when disabled", () => {
    const constrained = updateSpriteFrameRect(
      createGuideRegionDocument(),
      "sheet-sidecar",
      "hero.idle",
      { x: 20, y: 20, width: 24, height: 24 },
      { spriteFrameEditSettings: { constrainFrameEditsToGuideRegion: true } },
    );
    const constrainedFrame = getSidecar(constrained).spec.frames[0];
    expect(constrainedFrame).toEqual(
      expect.objectContaining({ x: 8, y: 8, width: 24, height: 24 }),
    );

    const unconstrained = updateSpriteFrameRect(
      createGuideRegionDocument(),
      "sheet-sidecar",
      "hero.idle",
      { x: 20, y: 20, width: 24, height: 24 },
      { spriteFrameEditSettings: { constrainFrameEditsToGuideRegion: false } },
    );
    const unconstrainedFrame = getSidecar(unconstrained).spec.frames[0];
    expect(unconstrainedFrame).toEqual(
      expect.objectContaining({ x: 20, y: 20, width: 24, height: 24 }),
    );
  });

  it("clamps a selected frame explicitly and reports no-op when no guide region exists", () => {
    const document = updateSpriteFrameRect(
      createGuideRegionDocument(),
      "sheet-sidecar",
      "hero.idle",
      { x: 70, y: 10, width: 20, height: 20 },
    );
    const clamped = clampSpriteFrameToGuideRegion(document, "sheet-sidecar", "hero.idle");
    expect(getSidecar(clamped).spec.frames[0]).toEqual(
      expect.objectContaining({ x: 80, y: 10, width: 20, height: 20 }),
    );

    const noGuideDocument = applyCanvasCommands(
      {
        id: "doc",
        name: "No Guide",
        width: 256,
        height: 256,
        unit: "px",
        unitSystem: createCanvasUnitSystem("px"),
        layers: [{ id: "sprites", name: "Sprites", visible: true, objectIds: [image.id] }],
        objects: { [image.id]: image },
        selectedObjectId: image.id,
      },
      [
        {
          kind: "addSpriteSidecarObject",
          object: createSpriteSidecarObject(
            image,
            parseSpriteSidecarToml(spriteToml, {
              id: "sheet-sidecar",
              name: "Sheet sidecar",
              targetId: image.id,
            }),
          ),
          attach: true,
        },
      ],
    ).document;
    const result = applyCanvasCommands(noGuideDocument, [
      { kind: "clampSpriteFrameToGuideRegion", sidecarId: "sheet-sidecar", frameId: "hero.idle" },
    ]);
    expect(result.results[0]?.message).toContain("No guide region found");
  });

  it("produces guide-region diagnostics without spamming scenes that have no guides", () => {
    const document = updateSpriteFrameRect(
      createGuideRegionDocument(),
      "sheet-sidecar",
      "hero.idle",
      { x: 70, y: 10, width: 60, height: 60 },
    );
    const sidecar = getSidecar(document);
    const guideDiagnostics = collectGuideRegionDiagnosticsForSpriteSidecar(document, sidecar);
    expect(guideDiagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "SpriteFrameOutsideGuideRegion",
        "SpriteFrameIntersectsGuideRegion",
        "SpriteFrameLargerThanGuideRegion",
      ]),
    );

    const report = buildSpriteAuditReport(sidecar, image, { document });
    expect(formatSpriteAuditReport(report)).toContain("## Guide-region constraints");
    expect(
      report.findings.some((finding) => finding.code === "SpriteFrameOutsideGuideRegion"),
    ).toBe(true);
  });

  it("keeps guide regions out of sprite TOML exports while preserving guide TOML", () => {
    const document = updateSpriteFrameRect(
      createGuideRegionDocument(),
      "sheet-sidecar",
      "hero.idle",
      { x: 20, y: 20, width: 24, height: 24 },
      { spriteFrameEditSettings: { constrainFrameEditsToGuideRegion: true } },
    );
    const bundle = createCanvasExportBundle(document);
    const spriteFile = bundle.files.find((file) => file.path.endsWith(".sprite.toml"));
    const guideFile = bundle.files.find((file) => file.path.endsWith(".guide.toml"));

    expect(spriteFile?.text).toContain('[frames."hero.idle"]');
    expect(spriteFile?.text).not.toContain("[[regions]]");
    expect(guideFile?.text).toContain("[[regions]]");
  });
});
