import { describe, expect, it } from "vitest";
import { serializeCanvasRenderSvg } from "../../apps/machina-canvas/src/canvasExport";
import { getDefaultCanvasAidToggles } from "../../apps/machina-canvas/src/canvasViewAids";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import {
  applyCanvasCommands,
  resizeSpriteFrame,
  updateSpriteFrameRect,
} from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  createSpriteOverlayRenderPlan,
  shouldRenderSpriteFrameLabel,
} from "../../apps/machina-canvas/src/spriteOverlay";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
} from "../../apps/machina-canvas/src/spriteSidecar";

const spriteToml = `
[atlas]
image = "tinytown_sprite_alpha.png"
width = 1440
height = 720

[grids.villagers_down]
origin_x = 0
origin_y = 0
columns = 3
rows = 1
cell_width = 120
cell_height = 120

[grids.villagers_left]
origin_x = 360
origin_y = 0
columns = 3
rows = 1
cell_width = 120
cell_height = 120

[sprites.maya]
display_name = "Maya"

[sprites.maya.animations.down]
grid = "villagers_down"
row = 0
frames = ["maya.down.idle_exact", 1, 2]

[sprites.maya.animations.left]
grid = "villagers_left"
row = 0
frames = [0, 1, 2]

[frames."maya.down.idle_exact"]
x = 24
y = 8
width = 72
height = 104
`;

const image: ImageObject = {
  id: "sheet",
  name: "TinyTown sheet",
  kind: "image",
  layerId: "sprites",
  visible: true,
  x: 100,
  y: 50,
  width: 720,
  height: 360,
  src: "/assets/tinytown_sprite.png",
  role: "image",
  intrinsicWidth: 1440,
  intrinsicHeight: 720,
  fit: "fill",
};

function createDocument() {
  const document: CanvasDocument = {
    id: "doc",
    name: "Sprite Focus Doc",
    width: 960,
    height: 540,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [
      { id: "sprites", name: "Sprites", visible: true, objectIds: [image.id] },
      { id: "sprite-overlays", name: "Sprite Overlays", visible: true, objectIds: [] },
    ],
    objects: { [image.id]: image },
    selectedObjectId: image.id,
  };
  const spec = parseSpriteSidecarToml(spriteToml, {
    id: "sidecar",
    name: "Sprite sidecar",
    targetId: image.id,
  });
  const sidecar = createSpriteSidecarObject(image, spec);
  return applyCanvasCommands(document, [
    { kind: "addSpriteSidecarObject", object: sidecar, attach: true },
    { kind: "select", id: sidecar.id },
    { kind: "selectSpriteFrame", sidecarId: sidecar.id, frameId: "maya.down.idle_exact" },
  ]).document;
}

function getSidecar(document: CanvasDocument) {
  const sidecar = document.objects.sidecar;
  if (sidecar?.kind !== "spriteSidecar") throw new Error("Expected sprite sidecar.");
  return sidecar;
}

function countRenderedFrameLabels(svg: string) {
  return [...svg.matchAll(/class="canvas-sprite-label(?:\s[^"]*)?"/g)].length;
}

describe("MachinaCanvas sprite focus UX", () => {
  it("defaults sprite overlays to focus mode", () => {
    expect(getSidecar(createDocument()).spec.overlay.displayMode).toBe("focus");
  });

  it("hides label soup in focus mode while keeping the selected label", () => {
    const document = createDocument();
    const sidecar = getSidecar(document);
    const plan = createSpriteOverlayRenderPlan(sidecar);
    const selected = sidecar.spec.frames.find((frame) => frame.id === sidecar.spec.selectedFrameId);
    const unselected = sidecar.spec.frames.find(
      (frame) => frame.id !== sidecar.spec.selectedFrameId,
    );
    if (!selected || !unselected) throw new Error("Expected selected and unselected frames.");

    expect(shouldRenderSpriteFrameLabel(selected, plan)).toBe(true);
    expect(shouldRenderSpriteFrameLabel(unselected, plan)).toBe(false);
    expect(countRenderedFrameLabels(serializeCanvasRenderSvg(document))).toBe(1);
  });

  it("renders a hovered label without enabling all labels", () => {
    const sidecar = getSidecar(createDocument());
    const hovered = sidecar.spec.frames.find((frame) => frame.id === "maya.left.0");
    if (!hovered) throw new Error("Expected hovered frame.");
    const plan = createSpriteOverlayRenderPlan(sidecar, { hoveredFrameId: hovered.id });

    expect(shouldRenderSpriteFrameLabel(hovered, plan)).toBe(true);
    expect(plan.framePresentations.get(hovered.id)?.emphasis).toBe("hovered");
  });

  it("renders every frame label in debug mode", () => {
    const document = applyCanvasCommands(createDocument(), [
      {
        kind: "setSpriteOverlayDisplayMode",
        sidecarId: "sidecar",
        mode: "debug",
      },
    ]).document;
    const sidecar = getSidecar(document);
    const plan = createSpriteOverlayRenderPlan(sidecar);

    for (const frame of sidecar.spec.frames) {
      expect(shouldRenderSpriteFrameLabel(frame, plan)).toBe(true);
    }
    expect(countRenderedFrameLabels(serializeCanvasRenderSvg(document))).toBe(
      sidecar.spec.frames.length,
    );
  });

  it("keeps the selected frame dominant and its parent subgrid contextual", () => {
    const sidecar = getSidecar(createDocument());
    const plan = createSpriteOverlayRenderPlan(sidecar);

    expect(plan.framePresentations.get("maya.down.idle_exact")?.emphasis).toBe("selected");
    expect(plan.subgridPresentations.get("villagers_down")?.emphasis).toBe("context");
    expect(plan.subgridPresentations.get("villagers_left")?.emphasis).toBe("hidden");
  });

  it("shows all frame rectangles but not all labels in cut edit mode", () => {
    const document = applyCanvasCommands(createDocument(), [
      {
        kind: "setSpriteOverlayDisplayMode",
        sidecarId: "sidecar",
        mode: "cutEdit",
      },
    ]).document;
    const sidecar = getSidecar(document);
    const plan = createSpriteOverlayRenderPlan(sidecar);
    const unselected = sidecar.spec.frames.find((frame) => frame.id === "maya.left.1");
    if (!unselected) throw new Error("Expected unselected frame.");

    expect(
      sidecar.spec.frames.every((frame) => plan.framePresentations.get(frame.id)?.showRect),
    ).toBe(true);
    expect(shouldRenderSpriteFrameLabel(unselected, plan)).toBe(false);
  });

  it("shows subgrid boundaries in grid edit mode", () => {
    const document = applyCanvasCommands(createDocument(), [
      {
        kind: "setSpriteOverlayDisplayMode",
        sidecarId: "sidecar",
        mode: "gridEdit",
      },
    ]).document;
    const sidecar = getSidecar(document);
    const plan = createSpriteOverlayRenderPlan(sidecar);

    expect(
      sidecar.spec.grids.every((grid) => plan.subgridPresentations.get(grid.id)?.showRect),
    ).toBe(true);
  });

  it("surfaces audit-highlighted frames in audit mode", () => {
    const outOfBounds = updateSpriteFrameRect(createDocument(), "sidecar", "maya.left.0", {
      x: 1400,
      y: 700,
      width: 80,
      height: 80,
    });
    const document = applyCanvasCommands(outOfBounds, [
      {
        kind: "setSpriteOverlayDisplayMode",
        sidecarId: "sidecar",
        mode: "audit",
      },
    ]).document;
    const sidecar = getSidecar(document);
    const plan = createSpriteOverlayRenderPlan(sidecar);

    expect(plan.auditFrameIds.has("maya.left.0")).toBe(true);
    expect(plan.framePresentations.get("maya.left.0")?.emphasis).toBe("audit");
    expect(plan.subgridPresentations.get("villagers_left")?.emphasis).toBe("context");
  });

  it("keeps reference grid off by default in sprite mode", () => {
    expect(getDefaultCanvasAidToggles("sprites").showReferenceGrid).toBe(false);
  });

  it("keeps selected frames editable after mode changes", () => {
    const document = applyCanvasCommands(createDocument(), [
      {
        kind: "setSpriteOverlayDisplayMode",
        sidecarId: "sidecar",
        mode: "debug",
      },
      {
        kind: "setSpriteOverlayDisplayMode",
        sidecarId: "sidecar",
        mode: "focus",
      },
      {
        kind: "updateSpriteFrameRect",
        sidecarId: "sidecar",
        frameId: "maya.down.idle_exact",
        rect: { x: 40, y: 12, width: 80, height: 100 },
      },
    ]).document;

    expect(
      getSidecar(document).spec.frames.find((frame) => frame.id === "maya.down.idle_exact"),
    ).toEqual(expect.objectContaining({ x: 40, y: 12, width: 80, height: 100 }));
  });

  it("keeps resize edits working in focus mode", () => {
    const resized = resizeSpriteFrame(createDocument(), "sidecar", "maya.down.idle_exact", 8, 6);
    expect(
      getSidecar(resized).spec.frames.find((frame) => frame.id === "maya.down.idle_exact"),
    ).toEqual(expect.objectContaining({ width: 80, height: 110 }));
  });
});
