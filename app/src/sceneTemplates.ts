import { resolveCanvasDocumentFrames } from "./canvasFrames";
import { createCanvasUnitSystem } from "./canvasUnits";
import { DRAFTING_COORDINATES, IMAGE_COORDINATES, SCREEN_COORDINATES } from "./coordinateProfiles";
import {
  createDefaultMechanicalSheetMetadata,
  createLinearDimensionFromGeometryRefs,
  createMechanicalAnnotationSet,
  createMechanicalAnnotationSidecarObject,
} from "./mechanicalAnnotations";
import { getMechanicalA4LandscapeLayout } from "./mechanicalSheet";
import { createInitialCanvasDocument } from "./sceneDocument";
import type { CanvasDocument, CanvasObject, ImageObject } from "./sceneModel";
import { createSpriteSidecarObject, parseSpriteSidecarToml } from "./spriteSidecar";

const spriteFixtureToml = `
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
frames = [0, 1, 2]
fps = 6
loop = true

[grids.villagers_left]
origin_x = 360
origin_y = 0
columns = 3
rows = 4
cell_width = 120
cell_height = 120

[sprites.maya.animations.left]
grid = "villagers_left"
row = 0
frames = [0, 1, 2]
fps = 6
loop = true

[grids.villagers_right]
origin_x = 720
origin_y = 0
columns = 3
rows = 4
cell_width = 120
cell_height = 120

[sprites.maya.animations.right]
grid = "villagers_right"
row = 0
frames = [0, 1, 2]
fps = 6
loop = true

[grids.villagers_up]
origin_x = 1080
origin_y = 0
columns = 3
rows = 4
cell_width = 120
cell_height = 120

[sprites.maya.animations.up]
grid = "villagers_up"
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

[sprites.theo]
kind = "villager"
display_name = "Theo"

[sprites.theo.animations.down]
grid = "villagers_down"
row = 1
frames = [0, 1, 2]
fps = 6
loop = true

[sprites.theo.animations.left]
grid = "villagers_left"
row = 1
frames = [0, 1, 2]
fps = 6
loop = true

[sprites.theo.animations.right]
grid = "villagers_right"
row = 1
frames = [0, 1, 2]
fps = 6
loop = true

[sprites.theo.animations.up]
grid = "villagers_up"
row = 1
frames = [0, 1, 2]
fps = 6
loop = true

[sprites.lina]
kind = "villager"
display_name = "Lina"

[sprites.lina.animations.down]
grid = "villagers_down"
row = 2
frames = [0, 1, 2]
fps = 6
loop = true

[sprites.lina.animations.left]
grid = "villagers_left"
row = 2
frames = [0, 1, 2]
fps = 6
loop = true

[sprites.lina.animations.right]
grid = "villagers_right"
row = 2
frames = [0, 1, 2]
fps = 6
loop = true

[sprites.lina.animations.up]
grid = "villagers_up"
row = 2
frames = [0, 1, 2]
fps = 6
loop = true

[sprites.nia]
kind = "villager"
display_name = "Nia"

[sprites.nia.animations.down]
grid = "villagers_down"
row = 3
frames = [0, 1, 2]
fps = 6
loop = true

[sprites.nia.animations.left]
grid = "villagers_left"
row = 3
frames = [0, 1, 2]
fps = 6
loop = true

[sprites.nia.animations.right]
grid = "villagers_right"
row = 3
frames = [0, 1, 2]
fps = 6
loop = true

[sprites.nia.animations.up]
grid = "villagers_up"
row = 3
frames = [0, 1, 2]
fps = 6
loop = true

[grids.props]
origin_x = 0
origin_y = 480
columns = 12
rows = 2
cell_width = 120
cell_height = 120

[sprites.well]
kind = "destination"
display_name = "Well"
grid = "props"
row = 0
col = 0

[sprites.market]
kind = "destination"
display_name = "Market"
grid = "props"
row = 0
col = 1

[sprites.garden]
kind = "destination"
display_name = "Garden"
grid = "props"
row = 0
col = 2

[sprites.home]
kind = "destination"
display_name = "Home"
grid = "props"
row = 0
col = 3

[sprites.social]
kind = "destination"
display_name = "Social"
grid = "props"
row = 0
col = 4

[sprites.signpost]
kind = "prop"
display_name = "Signpost"
grid = "props"
row = 0
col = 5

[sprites.mailbox]
kind = "prop"
display_name = "Mailbox"
grid = "props"
row = 0
col = 6

[sprites.streetlamp]
kind = "prop"
display_name = "Streetlamp"
grid = "props"
row = 0
col = 7

[sprites.crate]
kind = "prop"
display_name = "Crate"
grid = "props"
row = 0
col = 8

[sprites.barrel]
kind = "prop"
display_name = "Barrel"
grid = "props"
row = 0
col = 9

[sprites.flowers]
kind = "prop"
display_name = "Flowers"
grid = "props"
row = 0
col = 10

[sprites.tree]
kind = "prop"
display_name = "Tree"
grid = "props"
row = 0
col = 11

[sprites.campfire]
kind = "prop"
display_name = "Campfire"
grid = "props"
row = 1
col = 0

[sprites.table]
kind = "prop"
display_name = "Table"
grid = "props"
row = 1
col = 1

[sprites.bucket]
kind = "prop"
display_name = "Bucket"
grid = "props"
row = 1
col = 2

[sprites.basket]
kind = "prop"
display_name = "Basket"
grid = "props"
row = 1
col = 3

[sprites.sack]
kind = "prop"
display_name = "Sack"
grid = "props"
row = 1
col = 4

[sprites.bush]
kind = "prop"
display_name = "Bush"
grid = "props"
row = 1
col = 5

[sprites.fence]
kind = "prop"
display_name = "Fence"
grid = "props"
row = 1
col = 6

[sprites.arch]
kind = "prop"
display_name = "Archway"
grid = "props"
row = 1
col = 7

[sprites.stone]
kind = "prop"
display_name = "Stone Slab"
grid = "props"
row = 1
col = 8

[sprites.fountain]
kind = "prop"
display_name = "Fountain"
grid = "props"
row = 1
col = 9

[sprites.heart]
kind = "ui"
display_name = "Heart"
grid = "props"
row = 1
col = 10

[sprites.speech_bubble]
kind = "ui"
display_name = "Speech Bubble"
grid = "props"
row = 1
col = 11

[frames."maya.down.idle_exact"]
x = 24
y = 8
width = 72
height = 104
`;

function cloneDocument(document: CanvasDocument): CanvasDocument {
  return resolveCanvasDocumentFrames(structuredClone(document));
}

function pickObjects(
  document: CanvasDocument,
  predicate: (object: CanvasObject) => boolean,
  options: {
    id: string;
    name: string;
    selectedObjectId?: string;
  },
): CanvasDocument {
  const objects = Object.fromEntries(
    Object.entries(document.objects).filter(([, object]) => predicate(object)),
  );
  const layers = document.layers
    .map((layer) => ({
      ...layer,
      objectIds: layer.objectIds.filter((objectId) => objects[objectId] !== undefined),
    }))
    .filter((layer) => layer.objectIds.length > 0);

  return cloneDocument({
    ...document,
    id: options.id,
    name: options.name,
    selectedObjectId:
      options.selectedObjectId && objects[options.selectedObjectId] !== undefined
        ? options.selectedObjectId
        : undefined,
    layers,
    objects,
  });
}

export function createBlankCanvasScene(): CanvasDocument {
  return cloneDocument({
    id: "blank-canvas",
    name: "Blank Canvas",
    width: 960,
    height: 640,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    coordinateProfileId: SCREEN_COORDINATES.id,
    referenceGrid: {
      columns: 6,
      rows: 4,
      columnStart: "A",
      rowStart: 1,
      showBorder: true,
      showLines: true,
      showLabels: true,
    },
    layers: [
      {
        id: "background",
        name: "Background",
        visible: true,
        objectIds: [],
      },
      {
        id: "foreground",
        name: "Foreground",
        visible: true,
        objectIds: [],
      },
    ],
    objects: {},
  });
}

export function createGraphicsDemoScene(): CanvasDocument {
  const document = createInitialCanvasDocument();
  return {
    ...pickObjects(document, (object) => object.kind !== "uiComponent", {
      id: "graphics-demo",
      name: "Graphics Editing Demo",
      selectedObjectId: "headline",
    }),
    coordinateProfileId: SCREEN_COORDINATES.id,
  };
}

export function createWebUiDemoScene(): CanvasDocument {
  const document = createInitialCanvasDocument();
  return {
    ...pickObjects(
      document,
      (object) =>
        object.kind === "uiComponent" ||
        object.id === "poster-bg" ||
        object.id === "logo" ||
        object.id === "headline",
      {
        id: "web-ui-demo",
        name: "Web UI Editing Demo",
        selectedObjectId: "ui-hero-card",
      },
    ),
    coordinateProfileId: SCREEN_COORDINATES.id,
  };
}

export function createSpriteSheetScene(): CanvasDocument {
  const image: ImageObject = {
    id: "tinytown-sheet",
    name: "TinyTown alpha sprite sheet",
    kind: "image",
    layerId: "sprite-sheet",
    visible: true,
    x: 120,
    y: 140,
    width: 720,
    height: 360,
    src: "/assets/tinytown_sprite_alpha.png",
    role: "image",
    intrinsicWidth: 1440,
    intrinsicHeight: 720,
    fit: "fill",
    notes:
      "Real TinyTown alpha sprite sheet copied from the Dominatus sample for audit smoke coverage.",
  };
  const sidecarSpec = parseSpriteSidecarToml(spriteFixtureToml, {
    id: "tinytown-sidecar",
    name: "TinyTown sprite sidecar",
    targetId: image.id,
    sourceName: "tinytown_sprite_alpha.spriteforge.toml",
  });
  const sidecar = {
    ...createSpriteSidecarObject(image, sidecarSpec),
    layerId: "sprite-overlays",
    x: image.x,
    y: image.y,
    width: image.width,
    height: image.height,
  };

  return cloneDocument({
    id: "sprite-sheet-canvas",
    name: "Sprite Sheet Editing",
    width: 960,
    height: 640,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    coordinateProfileId: IMAGE_COORDINATES.id,
    referenceGrid: {
      columns: 12,
      rows: 8,
      columnStart: "A",
      rowStart: 1,
      showBorder: true,
      showLines: true,
      showLabels: true,
    },
    layers: [
      {
        id: "sprite-sheet",
        name: "Sprite Sheet",
        visible: true,
        objectIds: [image.id],
      },
      {
        id: "sprite-overlays",
        name: "Sprite Overlays",
        visible: true,
        objectIds: [sidecar.id],
      },
    ],
    objects: {
      [image.id]: { ...image, spriteSidecarId: sidecar.id },
      [sidecar.id]: sidecar,
    },
    layerGroups: [
      {
        id: "sprite-sheet-group",
        title: "Sprite Sheet",
        description: "Atlas image with attached sidecars.",
        objectIds: [image.id],
      },
    ],
    selectedObjectId: sidecar.id,
  });
}

export function createMechanicalDraftingScene(): CanvasDocument {
  const layout = getMechanicalA4LandscapeLayout();
  const plate: Extract<CanvasObject, { kind: "rect" }> = {
    id: "draft-plate",
    name: "Base plate",
    kind: "rect",
    layerId: "geometry",
    visible: true,
    x: 46,
    y: 52,
    width: 132,
    height: 76,
    fill: "transparent",
    stroke: "#1c2430",
    radius: 2,
    notes: "Existing scene geometry reused as the drawing substrate for drafting annotations.",
  };
  const hole: Extract<CanvasObject, { kind: "ellipse" }> = {
    id: "draft-hole",
    name: "Mounting hole",
    kind: "ellipse",
    layerId: "geometry",
    visible: true,
    x: 108,
    y: 82,
    width: 18,
    height: 18,
    fill: "transparent",
    stroke: "#1c2430",
    notes: "Simple existing geometry object used as a referenced annotation target.",
  };
  const bodyProfile: Extract<CanvasObject, { kind: "path" }> = {
    id: "draft-plate-filled-profile",
    name: "Filled plate body profile",
    kind: "path",
    layerId: "geometry",
    visible: true,
    x: 0,
    y: 0,
    width: layout.widthMm,
    height: layout.heightMm,
    fill: "#68bfe9",
    stroke: "none",
    strokeWidth: 0,
    fillRule: "evenodd",
    d: [
      `M ${plate.x + 2} ${plate.y}`,
      `L ${plate.x + plate.width - 2} ${plate.y}`,
      `A 2 2 0 0 1 ${plate.x + plate.width} ${plate.y + 2}`,
      `L ${plate.x + plate.width} ${plate.y + plate.height - 2}`,
      `A 2 2 0 0 1 ${plate.x + plate.width - 2} ${plate.y + plate.height}`,
      `L ${plate.x + 2} ${plate.y + plate.height}`,
      `A 2 2 0 0 1 ${plate.x} ${plate.y + plate.height - 2}`,
      `L ${plate.x} ${plate.y + 2}`,
      `A 2 2 0 0 1 ${plate.x + 2} ${plate.y}`,
      "Z",
      `M ${hole.x} ${hole.y + hole.height / 2}`,
      `A ${hole.width / 2} ${hole.height / 2} 0 1 0 ${hole.x + hole.width} ${
        hole.y + hole.height / 2
      }`,
      `A ${hole.width / 2} ${hole.height / 2} 0 1 0 ${hole.x} ${hole.y + hole.height / 2}`,
      "Z",
    ].join(" "),
    tags: ["mechanical-body-profile", "filled-profile"],
    notes:
      "Mechanical mode defaults to topology-first filled profile rendering; the hole subpath is an even-odd void.",
  };
  const sheet = {
    ...createDefaultMechanicalSheetMetadata(),
    scale: "1:1",
    drawingNumber: "MC-PLATE-001",
    title: "Mounting plate bracket",
    revision: "B",
  };
  const sheetWidth = layout.widthMm;
  const sheetHeight = layout.heightMm;
  const geometryScene: CanvasDocument = {
    id: "drafting-geometry-refs",
    name: "Drafting geometry refs",
    width: sheetWidth,
    height: sheetHeight,
    unit: "mm",
    unitSystem: createCanvasUnitSystem("mm"),
    coordinateProfileId: DRAFTING_COORDINATES.id,
    layers: [{ id: "geometry", name: "Geometry", visible: true, objectIds: [plate.id, hole.id] }],
    objects: { [plate.id]: plate, [hole.id]: hole },
  };
  const annotations = createMechanicalAnnotationSet({
    id: "draft-plate-annotations",
    units: "mm",
    scale: "1:1",
    sheet,
    dimensions: [
      createLinearDimensionFromGeometryRefs({
        id: "plate-width",
        scene: geometryScene,
        from: { objectId: plate.id, anchor: "bottomLeft" },
        to: { objectId: plate.id, anchor: "bottomRight" },
        axis: "horizontal",
        offset: 14,
        label: "132 mm",
        tolerance: "+/-0.2",
      }),
      createLinearDimensionFromGeometryRefs({
        id: "plate-height",
        scene: geometryScene,
        from: { objectId: plate.id, anchor: "topRight" },
        to: { objectId: plate.id, anchor: "bottomRight" },
        axis: "vertical",
        offset: 12,
        label: "76 mm",
      }),
      createLinearDimensionFromGeometryRefs({
        id: "hole-offset-x",
        scene: geometryScene,
        from: { objectId: plate.id, anchor: "left" },
        to: { objectId: hole.id, anchor: "center" },
        axis: "horizontal",
        offset: 34,
        label: "71 mm",
      }),
      createLinearDimensionFromGeometryRefs({
        id: "hole-offset-y",
        scene: geometryScene,
        from: { objectId: plate.id, anchor: "top" },
        to: { objectId: hole.id, anchor: "center" },
        axis: "vertical",
        offset: 24,
        label: "39 mm",
      }),
      {
        id: "hole-diameter",
        kind: "diameter" as const,
        center: [hole.x + hole.width / 2, hole.y + hole.height / 2] as const,
        diameter: hole.width,
        label: "⌀18 mm",
      },
    ].filter((dimension): dimension is NonNullable<typeof dimension> => dimension !== undefined),
    notes: [
      {
        id: "material-note",
        kind: "callout",
        at: [188, 56],
        leaderTo: [plate.x + plate.width - 8, plate.y + 18],
        text: "Deburr and break sharp edges",
      },
    ],
    datums: [
      {
        id: "datum-a",
        label: "A",
        at: [plate.x - 12, plate.y + plate.height / 2],
        target: [plate.x, plate.y + plate.height / 2],
      },
    ],
    blocks: [
      {
        id: "sheet-title-block",
        kind: "titleBlock",
        x: 197,
        y: 165,
        width: 90,
        height: 35,
        fields: {
          Title: sheet.title,
          Drawing: sheet.drawingNumber,
          Rev: sheet.revision,
          Scale: sheet.scale,
          Units: sheet.units,
        },
      },
      {
        id: "sheet-revisions",
        kind: "revisionTable",
        x: 197,
        y: 132,
        columns: ["Rev", "Desc", "By"],
        rows: [
          { Rev: "A", Desc: "Initial issue", By: "MC" },
          { Rev: "B", Desc: "Hole location updated", By: "YC" },
        ],
      },
      {
        id: "sheet-bom",
        kind: "bomTable",
        x: 167,
        y: 103,
        columns: ["Item", "Part", "Qty", "Material"],
        rows: [
          { Item: "1", Part: "Base plate", Qty: "1", Material: "Mild steel" },
          { Item: "2", Part: "Mounting hole", Qty: "1", Material: "Drill to size" },
        ],
      },
    ],
  });
  const sidecar = createMechanicalAnnotationSidecarObject({
    id: "mechanical-annotations",
    name: "drawing annotations",
    layerId: "annotations",
    x: 0,
    y: 0,
    width: sheetWidth,
    height: sheetHeight,
    targetObjectId: plate.id,
    annotations,
  });

  return cloneDocument({
    id: "mechanical-drafting",
    name: "Mechanical Drafting",
    width: sheetWidth,
    height: sheetHeight,
    unit: "mm",
    unitSystem: createCanvasUnitSystem("mm"),
    coordinateProfileId: DRAFTING_COORDINATES.id,
    referenceGrid: {
      columns: 6,
      rows: 4,
      columnStart: "A",
      rowStart: 1,
      showBorder: false,
      showLines: false,
      showLabels: false,
    },
    layers: [
      {
        id: "geometry",
        name: "Geometry",
        visible: true,
        objectIds: [bodyProfile.id, plate.id, hole.id],
      },
      {
        id: "annotations",
        name: "Mechanical Drafting",
        visible: true,
        objectIds: [sidecar.id],
      },
    ],
    layerGroups: [
      {
        id: "mechanical-drafting",
        title: "Mechanical Drafting",
        description: "Filled profile scene geometry with semantic mechanical drafting overlays.",
        objectIds: [bodyProfile.id, plate.id, hole.id],
      },
    ],
    objects: {
      [bodyProfile.id]: bodyProfile,
      [plate.id]: plate,
      [hole.id]: hole,
      [sidecar.id]: sidecar,
    },
    selectedObjectId: sidecar.id,
  });
}
