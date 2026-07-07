import { describe, expect, it } from "vitest";
import { createCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExport";
import {
  createGuideSidecarObject,
  parseGuideSidecarToml,
} from "../../apps/machina-canvas/src/guideSidecar";
import {
  applyCanvasCommands,
  snapSpriteFrameToDatum,
  snapSpriteFrameToNearestDatum,
} from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import {
  DEFAULT_SPRITE_FRAME_DATUM_SNAP_DISTANCE,
  findDatumSnapTargetsForSpriteFrame,
  snapSpriteFrameRectToDatum,
} from "../../apps/machina-canvas/src/spriteGuideDatums";
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
  src: "/sheet.png",
  intrinsicWidth: 64,
  intrinsicHeight: 64,
};

const spriteToml = `
[atlas]
width = 64
height = 64

[frames."hero.idle"]
x = 5
y = 8
width = 14
height = 16
`;

const guideToml = `
[guide]
id = "sheet-guide"
target = "sheet"
units = "px"

[[regions]]
id = "hero"
kind = "sprite-region"
x = 4
y = 6
width = 24
height = 24

[[regions]]
id = "other"
kind = "sprite-region"
x = 36
y = 6
width = 20
height = 20

[[datums]]
id = "hero_left"
kind = "vertical"
x = 4
region = "hero"

[[datums]]
id = "hero_center"
kind = "vertical"
x = 12
region = "hero"

[[datums]]
id = "hero_right"
kind = "vertical"
x = 20
region = "hero"

[[datums]]
id = "global_left"
kind = "vertical"
x = 4

[[datums]]
id = "other_left"
kind = "vertical"
x = 36
region = "other"

[[datums]]
id = "tie_b"
kind = "vertical"
x = 10

[[datums]]
id = "tie_a"
kind = "vertical"
x = 10

[[datums]]
id = "hero_top"
kind = "horizontal"
y = 6
region = "hero"

[[datums]]
id = "hero_middle"
kind = "horizontal"
y = 16
region = "hero"

[[datums]]
id = "hero_bottom"
kind = "horizontal"
y = 26
region = "hero"

[[datums]]
id = "hero_point"
kind = "point"
x = 12
y = 16
region = "hero"
`;

function createDatumDocument(options?: { withGuide?: boolean }) {
  const base: CanvasDocument = {
    id: "doc",
    name: "Datum Doc",
    width: 128,
    height: 128,
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
  const sidecar = createSpriteSidecarObject(image, spec);
  const commands = [
    { kind: "addSpriteSidecarObject", object: sidecar, attach: true },
    { kind: "select", id: sidecar.id },
    { kind: "selectSpriteFrame", sidecarId: sidecar.id, frameId: "hero.idle" },
  ] as const;
  const withGuide = options?.withGuide !== false;
  return applyCanvasCommands(
    base,
    withGuide
      ? [
          commands[0],
          {
            kind: "addGuideSidecarObject" as const,
            object: createGuideSidecarObject(image, parseGuideSidecarToml(guideToml)),
            attach: true,
          },
          commands[1],
          commands[2],
        ]
      : commands,
  ).document;
}

function getFrame(document: CanvasDocument) {
  const sidecar = document.objects["sheet-sidecar"];
  if (sidecar?.kind !== "spriteSidecar") throw new Error("Expected sprite sidecar.");
  const frame = sidecar.spec.frames.find((candidate) => candidate.id === "hero.idle");
  if (!frame) throw new Error("Expected hero.idle frame.");
  return frame;
}

describe("MachinaCanvas guide datum snapping", () => {
  it("finds vertical datum targets for left, right, and centerX", () => {
    const targets = findDatumSnapTargetsForSpriteFrame(createDatumDocument(), {
      spriteSidecarId: "sheet-sidecar",
      frameId: "hero.idle",
      options: { maxDistance: 8 },
    }).filter((target) => target.datumKind === "vertical");

    expect(targets.some((target) => target.anchor === "left")).toBe(true);
    expect(targets.some((target) => target.anchor === "right")).toBe(true);
    expect(targets.some((target) => target.anchor === "centerX")).toBe(true);
  });

  it("finds horizontal datum targets for top, bottom, and centerY", () => {
    const targets = findDatumSnapTargetsForSpriteFrame(createDatumDocument(), {
      spriteSidecarId: "sheet-sidecar",
      frameId: "hero.idle",
      options: { maxDistance: 8 },
    }).filter((target) => target.datumKind === "horizontal");

    expect(targets.some((target) => target.anchor === "top")).toBe(true);
    expect(targets.some((target) => target.anchor === "bottom")).toBe(true);
    expect(targets.some((target) => target.anchor === "centerY")).toBe(true);
  });

  it("sorts targets by distance", () => {
    const targets = findDatumSnapTargetsForSpriteFrame(createDatumDocument(), {
      spriteSidecarId: "sheet-sidecar",
      frameId: "hero.idle",
      options: { maxDistance: 8 },
    });

    expect(targets[0]?.distance).toBeLessThanOrEqual(
      targets[1]?.distance ?? Number.POSITIVE_INFINITY,
    );
  });

  it("respects maxDistance", () => {
    const targets = findDatumSnapTargetsForSpriteFrame(createDatumDocument(), {
      spriteSidecarId: "sheet-sidecar",
      frameId: "hero.idle",
      options: { maxDistance: 0 },
    });

    expect(targets.every((target) => target.distance <= 0)).toBe(true);
  });

  it("prefers same-region datums when restrictToRegion is true", () => {
    const targets = findDatumSnapTargetsForSpriteFrame(createDatumDocument(), {
      spriteSidecarId: "sheet-sidecar",
      frameId: "hero.idle",
      options: { maxDistance: 8, restrictToRegion: true },
    });

    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((target) => target.regionId === "hero")).toBe(true);
  });

  it("returns empty when no guide sidecar is attached", () => {
    expect(
      findDatumSnapTargetsForSpriteFrame(createDatumDocument({ withGuide: false }), {
        spriteSidecarId: "sheet-sidecar",
        frameId: "hero.idle",
      }),
    ).toEqual([]);
  });

  it("uses deterministic ordering for ties", () => {
    const targets = findDatumSnapTargetsForSpriteFrame(createDatumDocument(), {
      spriteSidecarId: "sheet-sidecar",
      frameId: "hero.idle",
      options: { maxDistance: 100, restrictToRegion: false },
    }).filter((target) => target.datumId === "tie_a" || target.datumId === "tie_b");

    expect(targets.slice(0, 2).map((target) => target.datumId)).toEqual(["tie_a", "tie_b"]);
  });

  it("uses the default snap distance when options are omitted", () => {
    const targets = findDatumSnapTargetsForSpriteFrame(createDatumDocument(), {
      spriteSidecarId: "sheet-sidecar",
      frameId: "hero.idle",
    });

    expect(
      targets.every((target) => target.distance <= DEFAULT_SPRITE_FRAME_DATUM_SNAP_DISTANCE),
    ).toBe(true);
  });

  it("snaps rect edges and centers to datum coordinates", () => {
    const rect = { x: 5, y: 8, width: 14, height: 16 };

    expect(
      snapSpriteFrameRectToDatum(rect, {
        guideSidecarId: "g",
        guideId: "guide",
        datumId: "hero_left",
        datumKind: "vertical",
        anchor: "left",
        coordinate: 4,
        distance: 1,
      }),
    ).toEqual({ x: 4, y: 8, width: 14, height: 16 });
    expect(
      snapSpriteFrameRectToDatum(rect, {
        guideSidecarId: "g",
        guideId: "guide",
        datumId: "hero_right",
        datumKind: "vertical",
        anchor: "right",
        coordinate: 20,
        distance: 1,
      }),
    ).toEqual({ x: 6, y: 8, width: 14, height: 16 });
    expect(
      snapSpriteFrameRectToDatum(rect, {
        guideSidecarId: "g",
        guideId: "guide",
        datumId: "hero_center",
        datumKind: "vertical",
        anchor: "centerX",
        coordinate: 12,
        distance: 0,
      }),
    ).toEqual({ x: 5, y: 8, width: 14, height: 16 });
    expect(
      snapSpriteFrameRectToDatum(rect, {
        guideSidecarId: "g",
        guideId: "guide",
        datumId: "hero_top",
        datumKind: "horizontal",
        anchor: "top",
        coordinate: 6,
        distance: 2,
      }),
    ).toEqual({ x: 5, y: 6, width: 14, height: 16 });
    expect(
      snapSpriteFrameRectToDatum(rect, {
        guideSidecarId: "g",
        guideId: "guide",
        datumId: "hero_bottom",
        datumKind: "horizontal",
        anchor: "bottom",
        coordinate: 26,
        distance: 2,
      }),
    ).toEqual({ x: 5, y: 10, width: 14, height: 16 });
    expect(
      snapSpriteFrameRectToDatum(rect, {
        guideSidecarId: "g",
        guideId: "guide",
        datumId: "hero_middle",
        datumKind: "horizontal",
        anchor: "centerY",
        coordinate: 16,
        distance: 0,
      }),
    ).toEqual({ x: 5, y: 8, width: 14, height: 16 });
  });

  it("supports simple point datum snapping by moving the frame center", () => {
    expect(
      snapSpriteFrameRectToDatum(
        { x: 1, y: 2, width: 9, height: 7 },
        {
          guideSidecarId: "g",
          guideId: "guide",
          datumId: "hero_point",
          datumKind: "point",
          anchor: "centerX",
          coordinate: 12,
          coordinateY: 16,
          distance: 0,
        },
      ),
    ).toEqual({ x: 8, y: 13, width: 9, height: 7 });
  });

  it("rounds snapped positions to integer pixels", () => {
    expect(
      snapSpriteFrameRectToDatum(
        { x: 0, y: 0, width: 9, height: 7 },
        {
          guideSidecarId: "g",
          guideId: "guide",
          datumId: "hero_point",
          datumKind: "point",
          anchor: "centerX",
          coordinate: 12.4,
          coordinateY: 16.6,
          distance: 0,
        },
      ),
    ).toEqual({ x: 8, y: 13, width: 9, height: 7 });
  });

  it("updates the scene when snapping to the nearest datum", () => {
    const moved = applyCanvasCommands(createDatumDocument(), [
      {
        kind: "updateSpriteFrameRect",
        sidecarId: "sheet-sidecar",
        frameId: "hero.idle",
        rect: { x: 7, y: 9, width: 14, height: 15 },
      },
    ]).document;

    const next = snapSpriteFrameToNearestDatum(moved, {
      sidecarId: "sheet-sidecar",
      frameId: "hero.idle",
      anchor: "right",
    });

    expect(getFrame(next)).toEqual(expect.objectContaining({ x: 6, y: 9, width: 14, height: 15 }));
  });

  it("updates the scene when snapping to an explicit datum and anchor", () => {
    const next = snapSpriteFrameToDatum(createDatumDocument(), {
      sidecarId: "sheet-sidecar",
      frameId: "hero.idle",
      anchor: "left",
      datumId: "hero_left",
    });

    expect(getFrame(next)).toEqual(expect.objectContaining({ x: 4, y: 8, width: 14, height: 16 }));
  });

  it("reports a no-op when a matching datum target cannot be found", () => {
    const result = applyCanvasCommands(createDatumDocument(), [
      {
        kind: "snapSpriteFrameToDatum",
        sidecarId: "sheet-sidecar",
        frameId: "hero.idle",
        anchor: "left",
        datumId: "missing_datum",
      },
    ]);

    expect(result.results[0]?.message).toContain("No matching datum target found");
  });

  it("applies guide-region clamp after snapping when enabled", () => {
    const next = snapSpriteFrameToDatum(createDatumDocument(), {
      sidecarId: "sheet-sidecar",
      frameId: "hero.idle",
      anchor: "left",
      datumId: "global_left",
      constrainToGuideRegion: true,
      restrictToRegion: false,
      maxDistance: 8,
    });

    expect(getFrame(next)).toEqual(expect.objectContaining({ x: 4, y: 8, width: 14, height: 16 }));
  });

  it("exports snapped frame rects to sprite TOML while keeping datums in guide TOML only", () => {
    const next = snapSpriteFrameToDatum(createDatumDocument(), {
      sidecarId: "sheet-sidecar",
      frameId: "hero.idle",
      anchor: "left",
      datumId: "hero_left",
    });
    const bundle = createCanvasExportBundle(next);
    const spriteFile = bundle.files.find((file) => file.path.endsWith(".sprite.toml"));
    const guideFile = bundle.files.find((file) => file.path.endsWith(".guide.toml"));

    expect(spriteFile?.text).toContain("x = 4");
    expect(spriteFile?.text).not.toContain("[[datums]]");
    expect(guideFile?.text).toContain("[[datums]]");
  });
});
