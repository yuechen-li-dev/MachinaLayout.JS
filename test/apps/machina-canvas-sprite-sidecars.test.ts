import { describe, expect, it } from "vitest";
import {
  createCanvasExportBundle,
  serializeCanvasDocumentJson,
  serializeCanvasObjectToml,
  serializeCanvasRenderSvg,
} from "../../apps/machina-canvas/src/canvasExport";
import { validateCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExportValidation";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import {
  applyCanvasCommands,
  validateCanvasCommands,
} from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
} from "../../apps/machina-canvas/src/spriteSidecar";

const tinytownSpriteForgeToml = `
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
default_pivot = "bottom_center"

[grids.props]
origin_x = 0
origin_y = 480
columns = 12
rows = 2
cell_width = 120
cell_height = 120
default_pivot = "bottom_center"

[sprites.maya]
kind = "villager"
display_name = "Maya"

[sprites.maya.animations.down]
grid = "villagers_down"
row = 0
frames = [0, 1, 2]
fps = 6
loop = true

[sprites.maya.animations.down_exact]
grid = "villagers_down"
row = 0
frames = ["maya.down.idle_exact", 1, 2]
fps = 6
loop = true

[sprites.well]
kind = "destination"
display_name = "Well"
grid = "props"
row = 0
col = 0
scale = 1.0
pivot = "bottom_center"

[frames."maya.down.idle_exact"]
x = 24
y = 8
width = 72
height = 104
pivot = "bottom_center"
offset_x = 0
offset_y = -4
scale = 1.0
`;

const image: ImageObject = {
  id: "tinytown-sheet",
  name: "TinyTown sprite sheet",
  kind: "image",
  layerId: "sprites",
  visible: true,
  x: 0,
  y: 0,
  width: 720,
  height: 360,
  src: "/assets/tinytown_sprite.png",
  role: "image",
  intrinsicWidth: 1440,
  intrinsicHeight: 720,
  fit: "fill",
};

const document: CanvasDocument = {
  id: "tinytown-slicer",
  name: "TinyTown Slicer",
  width: 720,
  height: 360,
  unit: "px",
  unitSystem: createCanvasUnitSystem("px"),
  layers: [{ id: "sprites", name: "Sprites", visible: true, objectIds: [image.id] }],
  objects: { [image.id]: image },
};

function createDocumentWithSidecar() {
  const spec = parseSpriteSidecarToml(tinytownSpriteForgeToml, {
    id: "tinytown-sidecar",
    name: "TinyTown sprite sidecar",
    targetId: image.id,
    sourceName: "tinytown_sprite_alpha.spriteforge.toml",
  });
  const sidecar = createSpriteSidecarObject(image, spec);
  return applyCanvasCommands(document, [
    { kind: "addSpriteSidecarObject", object: sidecar, attach: true },
  ]).document;
}

describe("MachinaCanvas sprite sidecars", () => {
  it("parses TinyTown-style SpriteForge grids, animations, props, and exact frames", () => {
    const spec = parseSpriteSidecarToml(tinytownSpriteForgeToml, {
      id: "tinytown-sidecar",
      name: "TinyTown sprite sidecar",
      targetId: image.id,
      sourceName: "tinytown_sprite_alpha.spriteforge.toml",
    });

    expect(spec.dialect).toBe("spriteforge");
    expect(spec.atlasWidth).toBe(1440);
    expect(spec.atlasHeight).toBe(720);
    expect(spec.grids).toHaveLength(2);
    expect(spec.grids[0]).toEqual(
      expect.objectContaining({
        kind: "spriteSubgridRegion",
        width: 360,
        height: 480,
        source: "spriteforgeGrid",
      }),
    );
    expect(spec.animations).toHaveLength(2);
    expect(spec.frames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "maya.down.idle_exact",
          x: 24,
          y: 8,
          width: 72,
          height: 104,
          sourceKind: "exact",
          sourceGridId: "villagers_down",
          sourceRow: 0,
          sourceColumn: 0,
        }),
        expect.objectContaining({
          id: "maya.down.0",
          x: 0,
          y: 0,
          width: 120,
          height: 120,
          row: 0,
          column: 0,
          sourceKind: "grid",
          sourceGridId: "villagers_down",
          sourceRow: 0,
          sourceColumn: 0,
        }),
        expect.objectContaining({
          id: "well",
          x: 0,
          y: 480,
          width: 120,
          height: 120,
          row: 0,
          column: 0,
          sourceKind: "grid",
        }),
      ]),
    );
  });

  it("adds, attaches, toggles, and selects sprite sidecars through commands", () => {
    const spec = parseSpriteSidecarToml(tinytownSpriteForgeToml, {
      id: "tinytown-sidecar",
      name: "TinyTown sprite sidecar",
      targetId: image.id,
    });
    const sidecar = createSpriteSidecarObject(image, spec);

    expect(
      validateCanvasCommands(document, {
        kind: "addSpriteSidecarObject",
        object: sidecar,
        attach: true,
      }).ok,
    ).toBe(true);

    const added = applyCanvasCommands(document, [
      { kind: "addSpriteSidecarObject", object: sidecar, attach: true },
    ]).document;
    const addedImage = added.objects[image.id];
    expect(addedImage.kind === "image" ? addedImage.spriteSidecarId : "").toBe(sidecar.id);

    const selectedOnly = applyCanvasCommands(added, [
      {
        kind: "setSpriteOverlayOption",
        sidecarId: sidecar.id,
        option: "selectedOnly",
        value: true,
      },
      { kind: "selectSpriteFrame", sidecarId: sidecar.id, frameId: "well" },
    ]).document;
    const updatedSidecar = selectedOnly.objects[sidecar.id];
    expect(
      updatedSidecar.kind === "spriteSidecar" ? updatedSidecar.spec.overlay.selectedOnly : "",
    ).toBe(true);
    expect(updatedSidecar.kind === "spriteSidecar" ? updatedSidecar.spec.selectedFrameId : "").toBe(
      "well",
    );
  });

  it("exports sprite sidecar relations, sidecar TOML, handoff entries, and render overlays", () => {
    const withSidecar = createDocumentWithSidecar();
    const sidecar = withSidecar.objects["tinytown-sidecar"];
    const imageWithSidecar = withSidecar.objects[image.id];
    if (sidecar.kind !== "spriteSidecar" || imageWithSidecar.kind !== "image") {
      throw new Error("Expected sprite sidecar test objects.");
    }

    const documentJson = JSON.parse(serializeCanvasDocumentJson(withSidecar)) as {
      relations: Array<Record<string, string>>;
      objects: Record<string, { asset: string }>;
    };
    const sidecarToml = serializeCanvasObjectToml(sidecar);
    const imageToml = serializeCanvasObjectToml(imageWithSidecar);
    const svg = serializeCanvasRenderSvg(withSidecar);
    const bundle = createCanvasExportBundle(withSidecar);
    const handoff = bundle.files.find((file) => file.path === "handoff.toml")?.text;

    expect(documentJson.relations).toContainEqual({
      kind: "spriteSidecarFor",
      sourceId: image.id,
      sidecarId: "tinytown-sidecar",
    });
    expect(documentJson.objects["tinytown-sidecar"].asset).toBe(
      "objects/tinytown-sidecar.sprite.toml",
    );
    expect(sidecarToml).toContain("[grids.villagers_down]");
    expect(imageToml).toContain('sprite_sidecar_id = "tinytown-sidecar"');
    expect(handoff).toContain("[[sprite_sidecar]]");
    expect(svg).toContain('class="canvas-sprite-overlay"');
    expect(svg).toContain("canvas-sprite-subgrid");
    expect(svg).toContain('data-canvas-sprite-frame-id="maya.down.0"');
    expect(svg).toContain('data-canvas-sprite-source-kind="exact"');
    expect(validateCanvasExportBundle(bundle).ok).toBe(true);
  });
});
