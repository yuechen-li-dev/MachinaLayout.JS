import { describe, expect, it } from "vitest";
import { serializeCanvasObjectToml } from "../../apps/machina-canvas/src/canvasExport";
import type { ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
  updateSpriteFrameRectInSpec,
} from "../../apps/machina-canvas/src/spriteSidecar";
import { parseTomlDocument, stringifyTomlDocument } from "../../apps/machina-canvas/src/tomlSyntax";

const spriteForgeToml = `
id = "tinytown-sidecar"
kind = "spriteSidecar"
name = "TinyTown sprite sidecar"
target_id = "tinytown-sheet"
dialect = "spriteforge"
visible = true

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
aliases = ["idle", "walk", "run"]

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
grid = "villagers_down"
row = 1
col = 0
pivot = "bottom_center"

[frames."maya.down.idle_exact"]
x = 24
y = 8
width = 72
height = 104
pivot = "bottom_center"
tags = ["exact", "custom"]
`;

const roughCutToml = `
[atlas]
image = "tinytown_sprite_alpha.png"
width = 1440
height = 720

[cut_grids.props_top]
x = 24
y = 600
cell_width = 144
cell_height = 144
columns = 3
rows = 1
kind = "prop"
prefix = "prop"
start_index = 0
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

function createParsedSpec() {
  return parseSpriteSidecarToml(spriteForgeToml, {
    id: "tinytown-sidecar",
    name: "TinyTown sprite sidecar",
    targetId: image.id,
    sourceName: "tinytown_sprite_alpha.spriteforge.toml",
  });
}

describe("MachinaCanvas TOML syntax adapter", () => {
  it("parses SpriteForge-style TOML through the syntax library", () => {
    const parsed = parseTomlDocument(spriteForgeToml) as Record<string, unknown>;

    expect(parsed.atlas).toEqual(
      expect.objectContaining({
        image: "tinytown_sprite_alpha.png",
        width: 1440,
        height: 720,
      }),
    );
    expect(parsed.grids).toEqual(
      expect.objectContaining({
        villagers_down: expect.objectContaining({
          origin_x: 0,
          columns: 3,
          aliases: ["idle", "walk", "run"],
        }),
      }),
    );
    expect(parsed.sprites).toEqual(
      expect.objectContaining({
        maya: expect.objectContaining({
          animations: expect.objectContaining({
            down: expect.objectContaining({
              grid: "villagers_down",
              row: 0,
              frames: [0, 1, 2],
            }),
            down_exact: expect.objectContaining({
              frames: ["maya.down.idle_exact", 1, 2],
            }),
          }),
        }),
      }),
    );
    expect(parsed.frames).toEqual(
      expect.objectContaining({
        "maya.down.idle_exact": expect.objectContaining({
          x: 24,
          y: 8,
          tags: ["exact", "custom"],
        }),
      }),
    );
  });

  it("normalizes parsed TOML into existing sprite sidecar records", () => {
    const spec = createParsedSpec();

    expect(spec.dialect).toBe("spriteforge");
    expect(spec.atlasImage).toBe("tinytown_sprite_alpha.png");
    expect(spec.grids).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "villagers_down",
          x: 0,
          y: 0,
          columns: 3,
          rows: 4,
          cellWidth: 120,
          cellHeight: 120,
        }),
      ]),
    );
    expect(spec.animations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "down_exact",
          spriteId: "maya",
          gridId: "villagers_down",
          row: 0,
          frameIds: ["maya.down.idle_exact", "maya.down_exact.1", "maya.down_exact.2"],
        }),
      ]),
    );
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
        }),
        expect.objectContaining({
          id: "well",
          row: 1,
          column: 0,
          sourceKind: "grid",
        }),
      ]),
    );
  });

  it("wraps invalid TOML syntax in a clean MachinaCanvas error", () => {
    expect(() =>
      parseSpriteSidecarToml(
        `
[frames."maya.down.idle_exact]
x = 24
`,
        {
          id: "broken",
          name: "Broken sprite sidecar",
          targetId: image.id,
        },
      ),
    ).toThrowError(/InvalidTomlSyntax:/);
  });

  it("serializes edited sprite frames through the TOML adapter and reparses cleanly", () => {
    const spec = updateSpriteFrameRectInSpec(createParsedSpec(), "maya.down.idle_exact", {
      x: 40,
      y: 12,
      width: 80,
      height: 100,
    });
    const sidecar = createSpriteSidecarObject(image, spec);
    const text = serializeCanvasObjectToml(sidecar);
    const reparsedToml = parseTomlDocument(text) as Record<string, unknown>;
    const reparsedSpec = parseSpriteSidecarToml(text, {
      id: sidecar.id,
      name: sidecar.name,
      targetId: image.id,
    });

    expect(text).toContain('[frames."maya.down.idle_exact"]');
    expect(text).toContain("x = 40");
    expect(text).toContain("width = 80");
    expect(reparsedToml.frames).toEqual(
      expect.objectContaining({
        "maya.down.idle_exact": expect.objectContaining({
          x: 40,
          y: 12,
          width: 80,
          height: 100,
        }),
      }),
    );
    expect(reparsedSpec.frames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "maya.down.idle_exact",
          x: 40,
          y: 12,
          width: 80,
          height: 100,
          sourceKind: "exact",
        }),
      ]),
    );
  });

  it("stringifies nested TOML shapes with quoted keys without hand-escaped breakage", () => {
    const text = stringifyTomlDocument({
      frames: {
        "maya.down.idle_exact": {
          x: 24,
          y: 8,
          width: 72,
          height: 104,
        },
      },
      sprites: {
        maya: {
          animations: {
            down_exact: {
              grid: "villagers_down",
              row: 0,
              frames: ["maya.down.idle_exact", 1, 2],
            },
          },
        },
      },
    });

    expect(text).toContain('[frames."maya.down.idle_exact"]');
    expect(text).toContain("[sprites.maya.animations.down_exact]");
    expect(parseTomlDocument(text)).toEqual(
      expect.objectContaining({
        frames: expect.objectContaining({
          "maya.down.idle_exact": expect.objectContaining({ width: 72 }),
        }),
      }),
    );
  });

  it("parses and re-exports rough cut grids without losing their source semantics", () => {
    const spec = parseSpriteSidecarToml(roughCutToml, {
      id: "rough-cut",
      name: "Rough cut",
      targetId: image.id,
    });
    const sidecar = createSpriteSidecarObject(image, spec);
    const text = serializeCanvasObjectToml(sidecar);
    const reparsed = parseSpriteSidecarToml(text, {
      id: "rough-cut",
      name: "Rough cut",
      targetId: image.id,
    });

    expect(spec.grids).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "props_top",
          source: "roughCutGrid",
          framePrefix: "prop",
        }),
      ]),
    );
    expect(spec.frames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "prop.0", sourceKind: "grid", sourceGridId: "props_top" }),
      ]),
    );
    expect(text).toContain("[cut_grids.props_top]");
    expect(reparsed.grids).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "props_top", source: "roughCutGrid" }),
      ]),
    );
  });
});
