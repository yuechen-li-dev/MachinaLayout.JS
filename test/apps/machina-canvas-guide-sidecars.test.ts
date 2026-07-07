import { describe, expect, it } from "vitest";
import { createCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExport";
import {
  createGuideSidecarObject,
  createUnattachedGuideSidecarObject,
  parseGuideSidecarToml,
  stringifyGuideSidecarToml,
  validateGuideSidecar,
} from "../../apps/machina-canvas/src/guideSidecar";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";

const sampleToml = `
[guide]
id = "tinytown_sprite_alpha"
target = "tinytown-sheet"
units = "px"
description = "Authoring guides for TinyTown sprite atlas."

[[regions]]
id = "characters_down"
kind = "sprite-region"
x = 24
y = 24
width = 432
height = 576
description = "Down-facing character frames."

[regions.grid]
cell_width = 144
cell_height = 144
columns = 3
rows = 4

[[datums]]
id = "characters_top"
kind = "horizontal"
y = 24
label = "Character top"

[[datums]]
id = "characters_left"
kind = "vertical"
x = 24
label = "Character left"

[[datums]]
id = "atlas_origin"
kind = "point"
x = 24
y = 24
label = "Atlas origin"

[[dimensions]]
id = "character_cell_width"
kind = "linear"
from = [24, 24]
to = [168, 24]
label = "144 px"
units = "px"

[[alignment_marks]]
id = "atlas_origin_mark"
target = "tinytown-sheet"
kind = "point"
x = 24
y = 24
label = "Atlas origin"
`;

const image: ImageObject = {
  id: "tinytown-sheet",
  name: "TinyTown",
  kind: "image",
  layerId: "sprites",
  visible: true,
  x: 10,
  y: 20,
  width: 720,
  height: 360,
  src: "/tinytown.png",
  intrinsicWidth: 1440,
  intrinsicHeight: 720,
};

function createGuideDocument() {
  const guide = parseGuideSidecarToml(sampleToml);
  const object = createGuideSidecarObject(image, guide);
  return {
    id: "guide-doc",
    name: "Guide Doc",
    width: 1440,
    height: 720,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [{ id: "sprites", name: "Sprites", visible: true, objectIds: [image.id, object.id] }],
    objects: {
      [image.id]: image,
      [object.id]: object,
    },
    selectedObjectId: object.id,
  } satisfies CanvasDocument;
}

describe("MachinaCanvas guide sidecars", () => {
  it("parses guide, regions, datums, dimensions, and alignment marks", () => {
    const guide = parseGuideSidecarToml(sampleToml);
    expect(guide.id).toBe("tinytown_sprite_alpha");
    expect(guide.units).toBe("px");
    expect(guide.regions[0]?.grid).toEqual({
      cellWidth: 144,
      cellHeight: 144,
      columns: 3,
      rows: 4,
    });
    expect(guide.datums.map((datum) => datum.kind)).toEqual(["horizontal", "vertical", "point"]);
    expect(guide.dimensions[0]?.from).toEqual([24, 24]);
    expect(guide.alignmentMarks[0]?.kind).toBe("point");
  });

  it("stringifies guide TOML and reparses it", () => {
    const guide = parseGuideSidecarToml(sampleToml);
    const text = stringifyGuideSidecarToml({ ...guide, rawToml: undefined });
    const reparsed = parseGuideSidecarToml(text);
    expect(reparsed).toMatchObject({
      id: guide.id,
      target: guide.target,
      units: guide.units,
    });
    expect(reparsed.regions).toHaveLength(guide.regions.length);
    expect(reparsed.dimensions).toHaveLength(guide.dimensions.length);
  });

  it("validates duplicate ids, bad rectangles, bounds, grids, dimensions, and alignment marks", () => {
    const diagnostics = validateGuideSidecar(
      {
        kind: "canvasGuideSidecar",
        id: "",
        units: "",
        regions: [
          { id: "dup", kind: "region", x: -1, y: 0, width: 0, height: 10 },
          {
            id: "dup",
            kind: "region",
            x: 0,
            y: 0,
            width: 20,
            height: 20,
            grid: { cellWidth: 3, cellHeight: 4, columns: 3, rows: 4 },
          },
        ],
        datums: [
          { id: "datum", kind: "point", x: 40, y: 40, region: "missing" },
          { id: "datum", kind: "vertical", x: 999, region: "dup" },
        ],
        dimensions: [
          { id: "dim", kind: "linear", label: "", region: "missing" },
          { id: "dim", kind: "radius", label: "R8" },
        ],
        alignmentMarks: [
          { id: "mark", kind: "point", x: 0, y: 0, region: "missing" },
          { id: "mark", kind: "point", x: Number.NaN, y: 1 },
        ],
      },
      { imageWidth: 16, imageHeight: 16 },
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "InvalidGuideId",
        "InvalidGuideUnits",
        "DuplicateGuideRegionId",
        "InvalidGuideRegionRect",
        "GuideRegionOutOfBounds",
        "GuideRegionGridSizeMismatch",
        "DuplicateGuideDatumId",
        "GuideReferenceMissingRegion",
        "GuideDatumOutsideRegion",
        "DuplicateGuideDimensionId",
        "InvalidGuideDimension",
        "DuplicateGuideAlignmentMarkId",
        "InvalidGuideAlignmentMark",
      ]),
    );
  });

  it("creates attached and unattached guide sidecar scene objects", () => {
    const guide = parseGuideSidecarToml(sampleToml);
    const attached = createGuideSidecarObject(image, guide);
    const unattached = createUnattachedGuideSidecarObject(guide, { layerId: "sprites" });

    expect(attached.targetId).toBe(image.id);
    expect(attached.guide.target).toBe(image.id);
    expect(unattached.targetId).toBe(image.id);
    expect(unattached.tags).toContain("unattached");
  });

  it("creates a basic guide document fixture", () => {
    const document = createGuideDocument();
    expect(document.objects.tinytown_sprite_alpha.kind).toBe("guideSidecar");
  });

  it("exports guide sidecars as .guide.toml and includes guide overlay svg markup", () => {
    const document = createGuideDocument();
    const bundle = createCanvasExportBundle(document);
    const guideFile = bundle.files.find((file) => file.path.endsWith(".guide.toml"));
    expect(guideFile?.text).toContain("[guide]");
    expect(guideFile?.path).toBe("objects/tinytown_sprite_alpha.guide.toml");
    expect(bundle.files.find((file) => file.path === "render.svg")?.text).toContain(
      "canvas-guide-region",
    );
  });
});
