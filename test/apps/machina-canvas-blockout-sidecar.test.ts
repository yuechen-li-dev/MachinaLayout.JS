import { describe, expect, it } from "vitest";
import {
  createBlockoutSidecarObject,
  createUnattachedBlockoutSidecarObject,
  parseBlockoutSidecarToml,
  stringifyBlockoutSidecarToml,
  validateBlockoutSidecar,
} from "../../apps/machina-canvas/src/blockoutSidecar";
import {
  createCanvasExportBundle,
  serializeCanvasObjectToml,
  serializeCanvasRenderSvg,
} from "../../apps/machina-canvas/src/canvasExport";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import { collectCanvasExportArtifacts } from "../../apps/machina-canvas/src/exportCart";
import { buildCanvasLayerTree } from "../../apps/machina-canvas/src/layerTree";
import { attachBlockoutSidecarToObject } from "../../apps/machina-canvas/src/sceneCommands";
import type {
  CanvasDocument,
  CanvasObject,
  ImageObject,
} from "../../apps/machina-canvas/src/sceneModel";
import { summarizeScene } from "../../apps/machina-canvas/src/sceneSummary";

const minimalBlockoutToml = `
[blockout]
id = "exercise-features"
name = "Exercise features"

[[boxes]]
id = "body"
kind = "bodyRegion"
x = 10
y = 20
width = 40
height = 30
`;

const richBlockoutToml = `
[blockout]
id = "exercise-features"
name = "Exercise 354 feature blockout"
description = "Green feature/component blockout mask"

[[boxes]]
id = "large-boss"
kind = "boss"
role = "solid"
x = 20
y = 20
width = 60
height = 60
label = "Boss"

[[boxes]]
id = "large-hole"
kind = "hole"
role = "void"
x = 32
y = 32
width = 40
height = 40
label = "Large hole"

[[points]]
id = "boss-center"
kind = "center"
x = 50
y = 50
label = "Boss center"

[[curves]]
id = "lower-sweep-cue"
kind = "arcCue"
points = [[55, 120], [95, 110], [130, 85]]
role = "construction"
label = "Lower sweep"
`;

function createImage(): ImageObject {
  return {
    id: "source-image",
    name: "Source image",
    kind: "image",
    layerId: "foreground",
    visible: true,
    x: 0,
    y: 0,
    width: 200,
    height: 120,
    src: "/exercise.png",
    intrinsicWidth: 200,
    intrinsicHeight: 120,
  };
}

function createDocument(
  objects: Record<string, CanvasObject>,
  selectedObjectId?: string,
): CanvasDocument {
  return {
    id: "blockout-doc",
    name: "Blockout doc",
    width: 200,
    height: 120,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [
      {
        id: "foreground",
        name: "Foreground",
        visible: true,
        objectIds: Object.keys(objects),
      },
    ],
    layerGroups: [
      {
        id: "main",
        title: "Main",
        objectIds: Object.keys(objects),
      },
    ],
    objects,
    selectedObjectId,
  };
}

describe("MachinaCanvas blockout sidecar", () => {
  it("parses minimal blockout TOML", () => {
    const blockout = parseBlockoutSidecarToml(minimalBlockoutToml);
    expect(blockout.id).toBe("exercise-features");
    expect(blockout.boxes).toHaveLength(1);
    expect(blockout.points).toHaveLength(0);
    expect(blockout.curves).toHaveLength(0);
  });

  it("parses boxes, points, and curves", () => {
    const blockout = parseBlockoutSidecarToml(richBlockoutToml);
    expect(blockout.boxes).toHaveLength(2);
    expect(blockout.points).toHaveLength(1);
    expect(blockout.curves).toHaveLength(1);
    expect(blockout.curves[0]?.kind).toBe("arcCue");
  });

  it("validates duplicate ids, invalid sizes, and invalid curves", () => {
    const diagnostics = validateBlockoutSidecar({
      kind: "canvasBlockoutSidecar",
      id: "",
      boxes: [
        { id: "dup", kind: "bodyRegion", x: 0, y: 0, width: 0, height: 12 },
        { id: "dup", kind: "hole", x: 2, y: 2, width: 6, height: 6, role: "void" },
      ],
      points: [],
      curves: [{ id: "curve", kind: "pathCue", points: [[0, 0]], label: "bad" }],
    });
    expect(diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "InvalidBlockoutId",
        "DuplicateBlockoutItemId",
        "InvalidBlockoutBoxSize",
        "InvalidBlockoutCurve",
      ]),
    );
  });

  it("stringifies and round-trips blockout TOML", () => {
    const parsed = parseBlockoutSidecarToml(richBlockoutToml);
    const toml = stringifyBlockoutSidecarToml({ ...parsed, rawToml: undefined });
    const reparsed = parseBlockoutSidecarToml(toml);
    expect(reparsed.boxes).toHaveLength(2);
    expect(reparsed.points).toHaveLength(1);
    expect(reparsed.curves).toHaveLength(1);
    expect(
      serializeCanvasObjectToml(createBlockoutSidecarObject(createImage(), reparsed)),
    ).toContain("[blockout]");
  });

  it("attaches blockout sidecars to objects and nests them in the layer tree", () => {
    const image = createImage();
    const blockout = createUnattachedBlockoutSidecarObject(
      parseBlockoutSidecarToml(richBlockoutToml),
      {
        layerId: "foreground",
        name: "exercise.blockout.toml",
      },
    );
    const document = createDocument(
      {
        [image.id]: image,
        [blockout.id]: blockout,
      },
      blockout.id,
    );
    const attached = attachBlockoutSidecarToObject(document, image.id, blockout.id);
    const sidecar = attached.objects[blockout.id];
    expect(sidecar.kind).toBe("blockoutSidecar");
    if (sidecar.kind !== "blockoutSidecar") return;
    expect(sidecar.targetObjectId).toBe(image.id);

    const tree = buildCanvasLayerTree(attached);
    expect(tree[0]?.children?.[0]?.children?.some((child) => child.badge === "BLOCK")).toBe(true);
    expect(
      tree[0]?.children?.[0]?.children?.find((child) => child.badge === "BLOCK")?.subtitle,
    ).toContain("Blockout mask");
  });

  it("shows unattached blockouts clearly", () => {
    const image = createImage();
    const blockout = createUnattachedBlockoutSidecarObject(
      parseBlockoutSidecarToml(minimalBlockoutToml),
      {
        layerId: "foreground",
      },
    );
    const tree = buildCanvasLayerTree(
      createDocument({
        [image.id]: image,
        [blockout.id]: blockout,
      }),
    );
    const unattached = tree.find((item) => item.title === "Unattached Sidecars");
    expect(unattached?.children?.some((child) => child.objectId === blockout.id)).toBe(true);
  });

  it("summarizes blockout selection counts", () => {
    const image = createImage();
    const sidecar = createBlockoutSidecarObject(image, parseBlockoutSidecarToml(richBlockoutToml));
    const summary = summarizeScene(
      createDocument(
        {
          [image.id]: image,
          [sidecar.id]: sidecar,
        },
        sidecar.id,
      ),
    );
    expect(summary).toContain("Blockout sidecar has 2 boxes, 1 points, and 1 curves.");
  });

  it("renders visible blockout overlays, respects visibility, and preserves opacity", () => {
    const image = createImage();
    const sidecar = {
      ...createBlockoutSidecarObject(image, parseBlockoutSidecarToml(richBlockoutToml)),
      opacity: 0.5,
    };
    const visibleSvg = serializeCanvasRenderSvg(
      createDocument({
        [image.id]: image,
        [sidecar.id]: sidecar,
      }),
    );
    expect(visibleSvg).toContain("canvas-blockout-overlay");
    expect(visibleSvg).toContain('opacity="0.5"');
    expect(visibleSvg).toContain("canvas-blockout-box");

    const hiddenSvg = serializeCanvasRenderSvg(
      createDocument({
        [image.id]: image,
        [sidecar.id]: { ...sidecar, visible: false },
      }),
    );
    expect(hiddenSvg).not.toContain("canvas-blockout-overlay");
  });

  it("preserves blockout records in export bundle and export cart", () => {
    const image = createImage();
    const sidecar = createBlockoutSidecarObject(image, parseBlockoutSidecarToml(richBlockoutToml));
    const document = createDocument({
      [image.id]: image,
      [sidecar.id]: sidecar,
    });
    const bundle = createCanvasExportBundle(document);
    expect(bundle.files.some((file) => file.path.endsWith(".blockout.toml"))).toBe(true);

    const artifacts = collectCanvasExportArtifacts({ scene: document });
    expect(artifacts.some((artifact) => artifact.kind === "blockoutToml")).toBe(true);
  });
});
