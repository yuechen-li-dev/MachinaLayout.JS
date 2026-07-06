import { describe, expect, it } from "vitest";
import {
  serializeCanvasObjectToml,
  serializeCanvasRenderSvg,
} from "../../apps/machina-canvas/src/canvasExport";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import {
  applyCanvasCommands,
  updateSpriteFrameRect,
} from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import { hitTestSpriteFrameAtPoint } from "../../apps/machina-canvas/src/spriteFrameEditor";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
} from "../../apps/machina-canvas/src/spriteSidecar";

const toml = `
[atlas]
image = "tinytown_sprite_alpha.png"
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
kind = "villager"
display_name = "Maya"

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

const image: ImageObject = {
  id: "sheet",
  name: "Sheet",
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
    name: "Sprite Doc",
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
  const spec = parseSpriteSidecarToml(toml, {
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

describe("MachinaCanvas sprite subgrids", () => {
  it("normalizes SpriteForge grids into first-class subgrid regions", () => {
    const sidecar = getSidecar(createDocument());
    expect(sidecar.spec.grids).toEqual([
      expect.objectContaining({
        kind: "spriteSubgridRegion",
        id: "villagers_down",
        width: 360,
        height: 480,
      }),
    ]);
  });

  it("prioritizes exact frames over parent grid frames during hit-testing", () => {
    const sidecar = getSidecar(createDocument());
    const hit = hitTestSpriteFrameAtPoint(sidecar, image, { x: 115, y: 55 });
    expect(hit?.frameId).toBe("maya.down.idle_exact");
  });

  it("renders subgrid boundaries and distinct exact-frame classes", () => {
    const document = applyCanvasCommands(createDocument(), [
      {
        kind: "setSpriteOverlayDisplayMode",
        sidecarId: "sidecar",
        mode: "debug",
      },
    ]).document;
    const svg = serializeCanvasRenderSvg(document);
    expect(svg).toContain("canvas-sprite-subgrid");
    expect(svg).toContain("canvas-sprite-subgrid-label");
    expect(svg).toContain("canvas-sprite-frame sprite-frame--exact sprite-frame--selected");
    expect(svg).toContain('data-canvas-sprite-source-kind="exact"');
  });

  it("keeps parent subgrid context in selected-only mode", () => {
    const document = applyCanvasCommands(createDocument(), [
      {
        kind: "setSpriteOverlayOption",
        sidecarId: "sidecar",
        option: "selectedOnly",
        value: true,
      },
    ]).document;

    const svg = serializeCanvasRenderSvg(document);
    expect(svg).toContain('data-canvas-sprite-subgrid-id="villagers_down"');
    expect(svg).toContain('data-canvas-sprite-frame-id="maya.down.idle_exact"');
    expect(svg).not.toContain('data-canvas-sprite-frame-id="maya.down_exact.1"');
  });

  it("preserves edited grid-derived frames as explicit manual overrides on export and reparse", () => {
    const updated = updateSpriteFrameRect(createDocument(), "sidecar", "maya.down_exact.1", {
      x: 130,
      y: 4,
      width: 90,
      height: 110,
    });

    const sidecar = getSidecar(updated);
    const edited = sidecar.spec.frames.find((frame) => frame.id === "maya.down_exact.1");
    expect(edited).toEqual(
      expect.objectContaining({
        sourceKind: "manual",
        sourceGridId: "villagers_down",
        sourceRow: 0,
        sourceColumn: 1,
      }),
    );

    const text = serializeCanvasObjectToml(sidecar);
    expect(text).toContain('[frames."maya.down_exact.1"]');
    expect(text).toContain('source_kind = "manual"');

    const reparsed = parseSpriteSidecarToml(text, {
      id: sidecar.id,
      name: sidecar.name,
      targetId: image.id,
    });
    expect(reparsed.frames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "maya.down_exact.1",
          x: 130,
          y: 4,
          width: 90,
          height: 110,
          sourceKind: "manual",
        }),
      ]),
    );
  });
});
