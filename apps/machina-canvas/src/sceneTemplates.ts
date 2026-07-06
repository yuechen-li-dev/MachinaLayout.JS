import { resolveCanvasDocumentFrames } from "./canvasFrames";
import { createCanvasUnitSystem } from "./canvasUnits";
import { createInitialCanvasDocument } from "./sceneDocument";
import type { CanvasDocument, CanvasObject } from "./sceneModel";

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
        objectIds: [],
      },
      {
        id: "sprite-overlays",
        name: "Sprite Overlays",
        visible: true,
        objectIds: [],
      },
    ],
    objects: {},
  });
}
