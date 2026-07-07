import { describe, expect, it } from "vitest";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import {
  addObjectToLayerGroup,
  attachAlphaMapToImage,
  attachSketchOverlayToImage,
  attachSpriteSidecarToImage,
  createLayerGroup,
  detachAttachment,
} from "../../apps/machina-canvas/src/sceneCommands";
import { buildCanvasLayerTree } from "../../apps/machina-canvas/src/layerTree";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";

function expectImage(document: CanvasDocument, id: string) {
  const object = document.objects[id];
  if (object.kind !== "image") {
    throw new Error(`Expected image ${id}.`);
  }
  return object;
}

function expectSprite(document: CanvasDocument, id: string) {
  const object = document.objects[id];
  if (object.kind !== "spriteSidecar") {
    throw new Error(`Expected sprite sidecar ${id}.`);
  }
  return object;
}

function expectSketch(document: CanvasDocument, id: string) {
  const object = document.objects[id];
  if (object.kind !== "sketchOverlay") {
    throw new Error(`Expected sketch overlay ${id}.`);
  }
  return object;
}

function createLayerTreeDocument(): CanvasDocument {
  return {
    id: "layer-tree-doc",
    name: "Layer Tree Doc",
    width: 800,
    height: 600,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [
      {
        id: "sheet",
        name: "Sprite Sheet",
        visible: true,
        objectIds: ["sheet-image", "sheet-alpha", "title", "widget", "box"],
      },
      {
        id: "overlays",
        name: "Overlays",
        visible: true,
        objectIds: ["sheet-sprite", "sheet-sketch", "orphan-sprite"],
      },
    ],
    layerGroups: [
      {
        id: "sprite-sheet",
        title: "Sprite Sheet",
        objectIds: ["sheet-image", "title", "widget", "box"],
      },
    ],
    objects: {
      "sheet-image": {
        id: "sheet-image",
        name: "Sheet image",
        kind: "image",
        layerId: "sheet",
        visible: true,
        x: 10,
        y: 10,
        width: 320,
        height: 160,
        src: "/assets/tinytown_sprite_alpha.png",
        intrinsicWidth: 1440,
        intrinsicHeight: 720,
        alphaMapId: "sheet-alpha",
        spriteSidecarId: "sheet-sprite",
        sketchOverlayId: "sheet-sketch",
      },
      "sheet-alpha": {
        id: "sheet-alpha",
        name: "Sheet alpha",
        kind: "image",
        layerId: "sheet",
        visible: false,
        x: 10,
        y: 10,
        width: 320,
        height: 160,
        src: "/assets/tinytown_alpha.png",
        intrinsicWidth: 1440,
        intrinsicHeight: 720,
        role: "alphaMap",
      },
      "sheet-sprite": {
        id: "sheet-sprite",
        name: "TinyTown sidecar",
        kind: "spriteSidecar",
        layerId: "overlays",
        visible: true,
        x: 10,
        y: 10,
        width: 320,
        height: 160,
        targetId: "sheet-image",
        spec: {
          id: "sheet-sprite",
          name: "TinyTown sidecar",
          dialect: "spriteforge",
          targetId: "sheet-image",
          frames: [{ id: "frame-1", label: "frame-1", x: 0, y: 0, width: 16, height: 16 }],
          grids: [],
          animations: [],
          diagnostics: [{ severity: "warning", code: "Audit", message: "needs review" }],
          overlay: {
            displayMode: "focus",
            showBounds: true,
            showLabels: true,
            selectedOnly: false,
            showSubgrids: true,
            showExactFrames: true,
          },
        },
      },
      "sheet-sketch": {
        id: "sheet-sketch",
        name: "Corrections sketch",
        kind: "sketchOverlay",
        layerId: "overlays",
        visible: true,
        x: 10,
        y: 10,
        width: 320,
        height: 160,
        targetId: "sheet-image",
        spec: {
          id: "sheet-sketch",
          name: "Corrections sketch",
          dialect: "sketch",
          targetId: "sheet-image",
          primitives: [
            { kind: "label", id: "note", text: "Fix edge", ref: { kind: "gridRef", ref: "A1.c" } },
          ],
        },
      },
      title: {
        id: "title",
        name: "Headline",
        kind: "text",
        layerId: "sheet",
        visible: true,
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        text: "Title",
        fontSize: 16,
      },
      widget: {
        id: "widget",
        name: "Hero card",
        kind: "uiComponent",
        layerId: "sheet",
        visible: true,
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        componentId: "HeroCard",
        props: {},
      },
      box: {
        id: "box",
        name: "Background",
        kind: "rect",
        layerId: "sheet",
        visible: true,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      "orphan-sprite": {
        id: "orphan-sprite",
        name: "Orphan sidecar",
        kind: "spriteSidecar",
        layerId: "overlays",
        visible: true,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        spec: {
          id: "orphan-sprite",
          name: "Orphan sidecar",
          dialect: "sprite",
          frames: [],
          grids: [],
          animations: [],
          diagnostics: [],
          overlay: {
            displayMode: "focus",
            showBounds: true,
            showLabels: true,
            selectedOnly: false,
            showSubgrids: true,
            showExactFrames: true,
          },
        },
      },
    },
    selectedObjectId: "sheet-sprite",
  };
}

describe("MachinaCanvas layer tree", () => {
  it("nests sprite sidecars, alpha maps, and sketch overlays under their image", () => {
    const tree = buildCanvasLayerTree(createLayerTreeDocument());
    const spriteSheet = tree[0];
    const imageItem = spriteSheet.children?.[0];

    expect(spriteSheet.title).toBe("Sprite Sheet");
    expect(imageItem?.title).toBe("tinytown_sprite_alpha.png");
    expect(imageItem?.children?.map((child) => child.badge)).toEqual(["ALPHA", "SPRITE", "SKETCH"]);
  });

  it("places unattached sprite sidecars under Unattached Sidecars", () => {
    const tree = buildCanvasLayerTree(createLayerTreeDocument());
    const unattached = tree.find((item) => item.title === "Unattached Sidecars");

    expect(unattached?.children?.map((child) => child.objectId)).toEqual(["orphan-sprite"]);
    expect(unattached?.children?.[0]?.warning).toContain("No image owner");
  });

  it("keeps standalone text, ui, and rect objects in their group", () => {
    const tree = buildCanvasLayerTree(createLayerTreeDocument());
    const spriteSheet = tree[0];

    expect(spriteSheet.children?.map((child) => child.badge)).toEqual([
      "IMG",
      "TEXT",
      "UI",
      "RECT",
    ]);
  });

  it("reports group counts and preserves object order", () => {
    const tree = buildCanvasLayerTree(createLayerTreeDocument());
    const spriteSheet = tree[0];

    expect(spriteSheet.count).toBe(4);
    expect(spriteSheet.children?.map((child) => child.objectId)).toEqual([
      "sheet-image",
      "title",
      "widget",
      "box",
    ]);
  });
});

describe("MachinaCanvas layer group and attachment commands", () => {
  it("creates groups and adds objects to them", () => {
    const document = createLayerTreeDocument();
    const grouped = createLayerGroup(document, "Exports");
    const groupId = grouped.layerGroups?.at(-1)?.id;
    expect(groupId).toBeTruthy();

    const updated = addObjectToLayerGroup(grouped, groupId as string, "orphan-sprite");
    expect(updated.layerGroups?.at(-1)?.objectIds).toContain("orphan-sprite");
  });

  it("attaches sprite, alpha, and sketch sidecars through helpers", () => {
    const document = createLayerTreeDocument();
    const image = expectImage(document, "sheet-image");
    const sprite = expectSprite(document, "sheet-sprite");
    const sketch = expectSketch(document, "sheet-sketch");
    const withoutLinks: CanvasDocument = {
      ...document,
      objects: {
        ...document.objects,
        "sheet-image": {
          ...image,
          spriteSidecarId: undefined,
          alphaMapId: undefined,
          sketchOverlayId: undefined,
        },
        "sheet-sprite": {
          ...sprite,
          targetId: undefined,
          spec: { ...sprite.spec, targetId: undefined },
        },
        "sheet-sketch": {
          ...sketch,
          targetId: undefined,
          spec: { ...sketch.spec, targetId: undefined },
        },
      },
    };

    const withSprite = attachSpriteSidecarToImage(withoutLinks, "sheet-image", "sheet-sprite");
    const withAlpha = attachAlphaMapToImage(withSprite, "sheet-image", "sheet-alpha");
    const withSketch = attachSketchOverlayToImage(withAlpha, "sheet-image", "sheet-sketch");

    expect(expectImage(withSketch, "sheet-image").spriteSidecarId).toBe("sheet-sprite");
    expect(expectImage(withSketch, "sheet-image").alphaMapId).toBe("sheet-alpha");
    expect(expectImage(withSketch, "sheet-image").sketchOverlayId).toBe("sheet-sketch");
    expect(expectSprite(withSketch, "sheet-sprite").targetId).toBe("sheet-image");
    expect(expectSketch(withSketch, "sheet-sketch").targetId).toBe("sheet-image");
  });

  it("detaches attachments when requested", () => {
    const document = createLayerTreeDocument();
    const withoutSprite = detachAttachment(document, {
      kind: "spriteSidecar",
      imageId: "sheet-image",
    });
    const withoutAlpha = detachAttachment(withoutSprite, {
      kind: "alphaMap",
      imageId: "sheet-image",
    });
    const withoutSketch = detachAttachment(withoutAlpha, {
      kind: "sketchOverlay",
      imageId: "sheet-image",
    });

    expect(expectImage(withoutSketch, "sheet-image").spriteSidecarId).toBeUndefined();
    expect(expectImage(withoutSketch, "sheet-image").alphaMapId).toBeUndefined();
    expect(expectImage(withoutSketch, "sheet-image").sketchOverlayId).toBeUndefined();
    expect(expectSprite(withoutSketch, "sheet-sprite").targetId).toBeUndefined();
    expect(expectSketch(withoutSketch, "sheet-sketch").targetId).toBeUndefined();
  });
});
