import { resolveCanvasDocumentFrames } from "./canvasFrames";
import { createCanvasUnitSystem } from "./canvasUnits";
import {
  createMechanicalAnnotationSet,
  createMechanicalAnnotationSidecarObject,
} from "./mechanicalAnnotations";
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
  return pickObjects(document, (object) => object.kind !== "uiComponent", {
    id: "graphics-demo",
    name: "Graphics Editing Demo",
    selectedObjectId: "headline",
  });
}

export function createWebUiDemoScene(): CanvasDocument {
  const document = createInitialCanvasDocument();
  return pickObjects(
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
  );
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
  const plate: Extract<CanvasObject, { kind: "rect" }> = {
    id: "draft-plate",
    name: "Base plate",
    kind: "rect",
    layerId: "geometry",
    visible: true,
    x: 48,
    y: 40,
    width: 132,
    height: 76,
    fill: "transparent",
    stroke: "#1c2430",
    radius: 2,
    notes: "Simple plate geometry for the first annotation-first drafting mode.",
  };
  const annotations = createMechanicalAnnotationSet({
    id: "draft-plate-annotations",
    units: "mm",
    scale: "1:1",
    dimensions: [
      {
        id: "plate-width",
        kind: "linear",
        axis: "horizontal",
        from: [plate.x, plate.y + plate.height],
        to: [plate.x + plate.width, plate.y + plate.height],
        offset: 22,
        label: "132 mm",
        tolerance: "+/-0.2",
      },
      {
        id: "plate-height",
        kind: "linear",
        axis: "vertical",
        from: [plate.x + plate.width, plate.y],
        to: [plate.x + plate.width, plate.y + plate.height],
        offset: 18,
        label: "76 mm",
      },
    ],
    notes: [
      {
        id: "material-note",
        kind: "callout",
        at: [212, 70],
        leaderTo: [plate.x + plate.width, plate.y + 18],
        text: "Mild steel plate, deburr all edges",
      },
    ],
    datums: [
      {
        id: "datum-a",
        label: "A",
        at: [plate.x - 18, plate.y + plate.height / 2],
        target: [plate.x, plate.y + plate.height / 2],
      },
    ],
    blocks: [
      {
        id: "sheet-title-block",
        kind: "titleBlock",
        x: 182,
        y: 148,
        width: 100,
        height: 48,
        fields: {
          Title: "Plate detail",
          Scale: "1:1",
          Units: "mm",
          Rev: "A",
        },
      },
      {
        id: "sheet-revisions",
        kind: "revisionTable",
        x: 182,
        y: 90,
        columns: ["Rev", "Desc", "By"],
        rows: [{ Rev: "A", Desc: "Initial issue", By: "MC" }],
      },
      {
        id: "sheet-bom",
        kind: "bomTable",
        x: 14,
        y: 148,
        columns: ["Item", "Part", "Qty"],
        rows: [{ Item: "1", Part: "Base plate", Qty: "1" }],
      },
    ],
  });
  const sidecar = createMechanicalAnnotationSidecarObject({
    id: "mechanical-annotations",
    name: "drawing annotations",
    layerId: "annotations",
    x: 0,
    y: 0,
    width: 297,
    height: 210,
    targetObjectId: plate.id,
    annotations,
  });

  return cloneDocument({
    id: "mechanical-drafting",
    name: "Mechanical Drafting",
    width: 297,
    height: 210,
    unit: "mm",
    unitSystem: createCanvasUnitSystem("mm"),
    referenceGrid: {
      columns: 6,
      rows: 4,
      columnStart: "A",
      rowStart: 1,
      showBorder: true,
      showLines: false,
      showLabels: true,
    },
    layers: [
      {
        id: "geometry",
        name: "Geometry",
        visible: true,
        objectIds: [plate.id],
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
        description: "Annotation-first 2D drafting with semantic overlays.",
        objectIds: [plate.id],
      },
    ],
    objects: {
      [plate.id]: plate,
      [sidecar.id]: sidecar,
    },
    selectedObjectId: sidecar.id,
  });
}
