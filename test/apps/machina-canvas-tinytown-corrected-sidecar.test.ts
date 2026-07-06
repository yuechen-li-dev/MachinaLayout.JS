import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { serializeCanvasObjectToml } from "../../apps/machina-canvas/src/canvasExport";
import type { ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
} from "../../apps/machina-canvas/src/spriteSidecar";

const artifactPath = join(
  process.cwd(),
  "apps",
  "machina-canvas",
  "artifacts",
  "tinytown_sprite_alpha.corrected.spriteforge.toml",
);

const image: ImageObject = {
  id: "tinytown-sheet",
  name: "TinyTown sheet",
  kind: "image",
  layerId: "sprites",
  visible: true,
  x: 0,
  y: 0,
  width: 1440,
  height: 720,
  src: "/assets/tinytown_sprite_alpha.png",
  role: "image",
  intrinsicWidth: 1440,
  intrinsicHeight: 720,
  fit: "fill",
};

describe("TinyTown corrected sidecar artifact", () => {
  it("parses, preserves multiple semantic subgrids, and keeps the Maya exact crop explicit", () => {
    const text = readFileSync(artifactPath, "utf8");
    const spec = parseSpriteSidecarToml(text, {
      id: "tinytown-corrected",
      name: "TinyTown corrected",
      targetId: image.id,
      sourceName: "tinytown_sprite_alpha.corrected.spriteforge.toml",
    });

    expect(spec.diagnostics).toEqual([]);
    expect(spec.grids).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "characters_down" }),
        expect.objectContaining({ id: "characters_left" }),
        expect.objectContaining({ id: "characters_right" }),
        expect.objectContaining({ id: "characters_up" }),
        expect.objectContaining({ id: "props_top" }),
        expect.objectContaining({ id: "props_bottom" }),
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
        }),
        expect.objectContaining({ id: "maya.left.1", sourceKind: "exact" }),
        expect.objectContaining({ id: "nia.up.2", sourceKind: "exact" }),
      ]),
    );
    expect(spec.animations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          spriteId: "maya",
          id: "down_exact",
          frameIds: ["maya.down.idle_exact", "maya.down.1", "maya.down.2"],
        }),
      ]),
    );
  });

  it("round-trips through the current sidecar object serializer without losing the corrected regions", () => {
    const text = readFileSync(artifactPath, "utf8");
    const spec = parseSpriteSidecarToml(text, {
      id: "tinytown-corrected",
      name: "TinyTown corrected",
      targetId: image.id,
      sourceName: "tinytown_sprite_alpha.corrected.spriteforge.toml",
    });
    const sidecar = createSpriteSidecarObject(image, spec);
    const exported = serializeCanvasObjectToml(sidecar);
    const reparsed = parseSpriteSidecarToml(exported, {
      id: "tinytown-corrected",
      name: "TinyTown corrected",
      targetId: image.id,
      sourceName: "tinytown_sprite_alpha.corrected.spriteforge.toml",
    });

    expect(exported).toContain('[grids."characters_down"]');
    expect(exported).toContain('[grids."props_top"]');
    expect(exported).toContain('[frames."maya.down.idle_exact"]');
    expect(reparsed.diagnostics).toEqual([]);
    expect(reparsed.grids).toHaveLength(spec.grids.length);
    expect(reparsed.frames).toHaveLength(spec.frames.length);
  });
});
