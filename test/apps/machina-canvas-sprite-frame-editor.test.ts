import { describe, expect, it } from "vitest";
import {
  createCanvasExportBundle,
  serializeCanvasObjectToml,
  serializeCanvasRenderSvg,
} from "../../apps/machina-canvas/src/canvasExport";
import {
  applyCanvasCommands,
  resizeSpriteFrame,
  updateSpriteFrameRect,
  validateCanvasCommands,
} from "../../apps/machina-canvas/src/sceneCommands";
import type {
  CanvasDocument,
  ImageObject,
  SpriteSidecarObject,
} from "../../apps/machina-canvas/src/sceneModel";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import { hitTestSpriteFrameAtPoint } from "../../apps/machina-canvas/src/spriteFrameEditor";
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
rows = 4
cell_width = 120
cell_height = 120

[sprites.maya]
kind = "villager"
display_name = "Maya"

[sprites.maya.animations.down]
grid = "villagers_down"
row = 0
frames = ["maya.down.idle_exact", 1, 2]
fps = 6
loop = true

[frames."maya.down.idle_exact"]
x = 24
y = 8
width = 72
height = 104
`;

const image: ImageObject = {
  id: "tinytown-sheet",
  name: "TinyTown sprite sheet",
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

function createDocumentWithSidecar() {
  const document: CanvasDocument = {
    id: "tinytown-slicer",
    name: "TinyTown Slicer",
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
    id: "tinytown-sidecar",
    name: "TinyTown sprite sidecar",
    targetId: image.id,
    sourceName: "tinytown.spriteforge.toml",
  });
  const sidecar = createSpriteSidecarObject(image, spec);
  return applyCanvasCommands(document, [
    { kind: "addSpriteSidecarObject", object: sidecar, attach: true },
    { kind: "select", id: sidecar.id },
    { kind: "selectSpriteFrame", sidecarId: sidecar.id, frameId: "maya.down.idle_exact" },
  ]).document;
}

function getSidecar(document: CanvasDocument) {
  const sidecar = document.objects["tinytown-sidecar"];
  if (sidecar?.kind !== "spriteSidecar") throw new Error("Expected sprite sidecar.");
  return sidecar;
}

describe("MachinaCanvas sprite frame editor", () => {
  it("updates the selected sprite frame rect", () => {
    const updated = updateSpriteFrameRect(
      createDocumentWithSidecar(),
      "tinytown-sidecar",
      "maya.down.idle_exact",
      { x: 40, y: 12, width: 80, height: 100 },
    );

    const frame = getSidecar(updated).spec.frames.find(
      (entry) => entry.id === "maya.down.idle_exact",
    );
    expect(frame).toEqual(
      expect.objectContaining({
        x: 40,
        y: 12,
        width: 80,
        height: 100,
        sourceKind: "exact",
      }),
    );
  });

  it("nudges a selected sprite frame", () => {
    const updated = applyCanvasCommands(createDocumentWithSidecar(), [
      {
        kind: "nudgeSpriteFrame",
        sidecarId: "tinytown-sidecar",
        frameId: "maya.down.idle_exact",
        dx: 2,
        dy: 3,
      },
    ]).document;

    const frame = getSidecar(updated).spec.frames.find(
      (entry) => entry.id === "maya.down.idle_exact",
    );
    expect(frame).toEqual(expect.objectContaining({ x: 26, y: 11 }));
  });

  it("resizes a selected sprite frame", () => {
    const updated = resizeSpriteFrame(
      createDocumentWithSidecar(),
      "tinytown-sidecar",
      "maya.down.idle_exact",
      10,
      6,
    );

    const frame = getSidecar(updated).spec.frames.find(
      (entry) => entry.id === "maya.down.idle_exact",
    );
    expect(frame).toEqual(expect.objectContaining({ width: 82, height: 110 }));
  });

  it("rejects invalid rect input during validation", () => {
    const validation = validateCanvasCommands(createDocumentWithSidecar(), {
      kind: "updateSpriteFrameRect",
      sidecarId: "tinytown-sidecar",
      frameId: "maya.down.idle_exact",
      rect: { x: -1, y: 4, width: 0, height: 10 },
    });

    expect(validation.ok).toBe(false);
  });

  it("produces out-of-bounds diagnostics after an edit", () => {
    const updated = updateSpriteFrameRect(
      createDocumentWithSidecar(),
      "tinytown-sidecar",
      "maya.down.idle_exact",
      { x: 1400, y: 680, width: 80, height: 80 },
    );

    expect(getSidecar(updated).spec.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "SpriteFrameOutOfBounds" })]),
    );
  });

  it("exports edited frame rects to sidecar TOML", () => {
    const updated = updateSpriteFrameRect(
      createDocumentWithSidecar(),
      "tinytown-sidecar",
      "maya.down.idle_exact",
      { x: 40, y: 12, width: 80, height: 100 },
    );

    expect(serializeCanvasObjectToml(getSidecar(updated))).toContain(
      '[frames."maya.down.idle_exact"]',
    );
    expect(serializeCanvasObjectToml(getSidecar(updated))).toContain("x = 40");
    expect(serializeCanvasObjectToml(getSidecar(updated))).toContain("width = 80");
  });

  it("marks edited grid-derived frames as manual overrides when they leave the source cell", () => {
    const updated = updateSpriteFrameRect(
      createDocumentWithSidecar(),
      "tinytown-sidecar",
      "maya.down.1",
      { x: 140, y: 4, width: 100, height: 112 },
    );

    const frame = getSidecar(updated).spec.frames.find((entry) => entry.id === "maya.down.1");
    expect(frame).toEqual(
      expect.objectContaining({
        sourceKind: "manual",
        sourceGridId: "villagers_down",
        sourceRow: 0,
        sourceColumn: 1,
      }),
    );
  });

  it("hit-tests sprite frames against canvas coordinates", () => {
    const document = createDocumentWithSidecar();
    const sidecar = getSidecar(document);
    const hit = hitTestSpriteFrameAtPoint(sidecar, image, { x: 115, y: 55 });

    expect(hit?.frameId).toBe("maya.down.idle_exact");
  });

  it("chooses the smallest overlapping frame deterministically", () => {
    const overlappingSidecar: SpriteSidecarObject = {
      ...getSidecar(createDocumentWithSidecar()),
      spec: {
        ...getSidecar(createDocumentWithSidecar()).spec,
        frames: [
          {
            id: "large",
            label: "Large",
            x: 0,
            y: 0,
            width: 120,
            height: 120,
          },
          {
            id: "small",
            label: "Small",
            x: 10,
            y: 10,
            width: 20,
            height: 20,
          },
        ],
      },
    };

    const hit = hitTestSpriteFrameAtPoint(overlappingSidecar, image, { x: 112, y: 62 });
    expect(hit?.frameId).toBe("small");
  });

  it("selected-only overlays still render the selected frame after edits", () => {
    const document = applyCanvasCommands(createDocumentWithSidecar(), [
      {
        kind: "setSpriteOverlayOption",
        sidecarId: "tinytown-sidecar",
        option: "selectedOnly",
        value: true,
      },
      {
        kind: "updateSpriteFrameRect",
        sidecarId: "tinytown-sidecar",
        frameId: "maya.down.idle_exact",
        rect: { x: 40, y: 12, width: 80, height: 100 },
      },
    ]).document;

    const svg = serializeCanvasRenderSvg(document);
    expect(svg).toContain('data-canvas-sprite-frame-id="maya.down.idle_exact"');
    expect(svg).not.toContain('data-canvas-sprite-frame-id="maya.down.1"');
  });

  it("bounds and label toggles keep working after frame edits", () => {
    const document = applyCanvasCommands(createDocumentWithSidecar(), [
      {
        kind: "updateSpriteFrameRect",
        sidecarId: "tinytown-sidecar",
        frameId: "maya.down.idle_exact",
        rect: { x: 40, y: 12, width: 80, height: 100 },
      },
      {
        kind: "setSpriteOverlayOption",
        sidecarId: "tinytown-sidecar",
        option: "showBounds",
        value: false,
      },
      {
        kind: "setSpriteOverlayOption",
        sidecarId: "tinytown-sidecar",
        option: "showLabels",
        value: false,
      },
    ]).document;

    const svg = serializeCanvasRenderSvg(document);
    expect(svg).not.toContain('class="canvas-sprite-frame');
    expect(svg).not.toContain('class="canvas-sprite-label"');
  });

  it("edited sidecars remain exportable in bundles", () => {
    const document = updateSpriteFrameRect(
      createDocumentWithSidecar(),
      "tinytown-sidecar",
      "maya.down.idle_exact",
      { x: 40, y: 12, width: 80, height: 100 },
    );

    const bundle = createCanvasExportBundle(document);
    expect(bundle.files.some((file) => file.path.endsWith(".sprite.toml"))).toBe(true);
  });
});
