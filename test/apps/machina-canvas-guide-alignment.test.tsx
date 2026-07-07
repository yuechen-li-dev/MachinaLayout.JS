/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { executeCanvasTerminalCommand } from "../../apps/machina-canvas/src/canvasCommandsTerminal";
import { createCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExport";
import {
  computeGuideAlignmentTranslation,
  resolveGuideAlignmentMarks,
  validateGuideAlignmentMarks,
} from "../../apps/machina-canvas/src/guideAlignment";
import {
  createGuideSidecarObject,
  parseGuideSidecarToml,
} from "../../apps/machina-canvas/src/guideSidecar";
import {
  alignObjectByGuideMarks,
  applyCanvasCommands,
} from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
} from "../../apps/machina-canvas/src/spriteSidecar";

afterEach(() => {
  cleanup();
});

const sourceImage: ImageObject = {
  id: "source-image",
  name: "Source Image",
  kind: "image",
  layerId: "art",
  visible: true,
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  src: "/assets/source.png",
  intrinsicWidth: 200,
  intrinsicHeight: 100,
};

const targetImage: ImageObject = {
  id: "target-image",
  name: "Target Image",
  kind: "image",
  layerId: "art",
  visible: true,
  x: 200,
  y: 300,
  width: 80,
  height: 40,
  src: "/assets/target.png",
  intrinsicWidth: 160,
  intrinsicHeight: 80,
};

const alphaImage: ImageObject = {
  id: "alpha-image",
  name: "Alpha Image",
  kind: "image",
  layerId: "art",
  visible: false,
  x: 12,
  y: 18,
  width: 100,
  height: 50,
  src: "/assets/alpha.png",
  intrinsicWidth: 200,
  intrinsicHeight: 100,
  role: "alphaMap",
};

const sourceGuideToml = `
[guide]
id = "source-guide"
target = "source-image"
units = "px"

[[alignment_marks]]
id = "source_origin"
kind = "point"
x = 20
y = 40
label = "Source origin"

[[alignment_marks]]
id = "alpha_origin"
target = "alpha-image"
kind = "point"
x = 20
y = 40
label = "Alpha origin"
`;

const targetGuideToml = `
[guide]
id = "target-guide"
target = "target-image"
units = "px"

[[alignment_marks]]
id = "target_origin"
target = "target-image"
kind = "point"
x = 50
y = 10
label = "Target origin"

[[alignment_marks]]
id = "source_by_id"
target = "source-image"
kind = "point"
x = 0
y = 0
label = "Source by id"
`;

const unresolvedGuideToml = `
[guide]
id = "bad-guide"
target = "source-image"
units = "px"

[[alignment_marks]]
id = "missing_target"
target = "ghost-image"
kind = "point"
x = 4
y = 4
label = "Missing target"
`;

const duplicateGuideToml = `
[guide]
id = "duplicate-guide"
target = "source-image"
units = "px"

[[alignment_marks]]
id = "source_origin"
kind = "point"
x = 30
y = 20
label = "Duplicate source origin"
`;

const spriteToml = `
[atlas]
width = 200
height = 100

[frames."hero.idle"]
x = 0
y = 0
width = 16
height = 16
`;

function createAlignmentDocument(options?: {
  includeUnresolvedGuide?: boolean;
  includeDuplicateGuide?: boolean;
  selectedObjectId?: string;
}) {
  const sourceGuide = createGuideSidecarObject(
    sourceImage,
    parseGuideSidecarToml(sourceGuideToml),
    {
      id: "source-guide-sidecar",
      name: "source.guide.toml",
    },
  );
  const targetGuide = createGuideSidecarObject(
    targetImage,
    parseGuideSidecarToml(targetGuideToml),
    {
      id: "target-guide-sidecar",
      name: "target.guide.toml",
    },
  );
  const spriteSidecar = createSpriteSidecarObject(
    sourceImage,
    parseSpriteSidecarToml(spriteToml, {
      id: "source-sprite-sidecar",
      name: "source sprite sidecar",
      targetId: sourceImage.id,
    }),
  );

  const objectIds = [
    sourceImage.id,
    alphaImage.id,
    targetImage.id,
    sourceGuide.id,
    targetGuide.id,
    spriteSidecar.id,
  ];
  const objects: CanvasDocument["objects"] = {
    [sourceImage.id]: {
      ...sourceImage,
      alphaMapId: alphaImage.id,
      spriteSidecarId: spriteSidecar.id,
    },
    [targetImage.id]: targetImage,
    [alphaImage.id]: alphaImage,
    [sourceGuide.id]: sourceGuide,
    [targetGuide.id]: targetGuide,
    [spriteSidecar.id]: spriteSidecar,
  };

  if (options?.includeUnresolvedGuide) {
    const unresolvedGuide = createGuideSidecarObject(
      sourceImage,
      parseGuideSidecarToml(unresolvedGuideToml),
      { id: "bad-guide-sidecar", name: "bad.guide.toml" },
    );
    objects[unresolvedGuide.id] = unresolvedGuide;
    objectIds.push(unresolvedGuide.id);
  }

  if (options?.includeDuplicateGuide) {
    const duplicateGuide = createGuideSidecarObject(
      sourceImage,
      parseGuideSidecarToml(duplicateGuideToml),
      { id: "duplicate-guide-sidecar", name: "duplicate.guide.toml" },
    );
    objects[duplicateGuide.id] = duplicateGuide;
    objectIds.push(duplicateGuide.id);
  }

  return {
    id: "alignment-doc",
    name: "Alignment Doc",
    width: 640,
    height: 480,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [{ id: "art", name: "Art", visible: true, objectIds }],
    objects,
    selectedObjectId: options?.selectedObjectId ?? sourceImage.id,
  } satisfies CanvasDocument;
}

describe("MachinaCanvas guide alignment", () => {
  it("resolves guide alignment marks for attached images with deterministic ordering", () => {
    const marks = resolveGuideAlignmentMarks(createAlignmentDocument());

    expect(
      marks.map((mark) => `${mark.targetObjectId}:${mark.markId}:${mark.guideSidecarId}`),
    ).toEqual([
      "alpha-image:alpha_origin:source-guide-sidecar",
      "source-image:source_by_id:target-guide-sidecar",
      "source-image:source_origin:source-guide-sidecar",
      "target-image:target_origin:target-guide-sidecar",
    ]);
  });

  it("resolves omitted targets to the attached guide image and explicit object ids to scene objects", () => {
    const marks = resolveGuideAlignmentMarks(createAlignmentDocument());

    expect(marks.find((mark) => mark.markId === "source_origin")?.targetObjectId).toBe(
      "source-image",
    );
    expect(marks.find((mark) => mark.markId === "source_by_id")?.targetObjectId).toBe(
      "source-image",
    );
  });

  it("skips unresolved targets from the resolved mark list and reports diagnostics", () => {
    const document = createAlignmentDocument({ includeUnresolvedGuide: true });
    const marks = resolveGuideAlignmentMarks(document);
    const diagnostics = validateGuideAlignmentMarks(document);

    expect(marks.some((mark) => mark.markId === "missing_target")).toBe(false);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "UnresolvedGuideAlignmentTarget",
    );
  });

  it("converts local image coordinates to scene coordinates", () => {
    const marks = resolveGuideAlignmentMarks(createAlignmentDocument());
    const sourceMark = marks.find((mark) => mark.markId === "source_origin");
    const targetMark = marks.find((mark) => mark.markId === "target_origin");

    expect(sourceMark?.scene).toEqual({ x: 20, y: 40 });
    expect(targetMark?.scene).toEqual({ x: 225, y: 305 });
  });

  it("computes translation from source and target marks", () => {
    const marks = resolveGuideAlignmentMarks(createAlignmentDocument());
    const translation = computeGuideAlignmentTranslation({
      sourceMark: marks.find((mark) => mark.markId === "source_origin")!,
      targetMark: marks.find((mark) => mark.markId === "target_origin")!,
    });

    expect(translation).toMatchObject({ kind: "translation", dx: 205, dy: 265 });
  });

  it("returns zero translation for already aligned marks", () => {
    const mark = resolveGuideAlignmentMarks(createAlignmentDocument()).find(
      (candidate) => candidate.markId === "source_origin",
    )!;

    expect(
      computeGuideAlignmentTranslation({
        sourceMark: mark,
        targetMark: mark,
      }),
    ).toMatchObject({ dx: 0, dy: 0 });
  });

  it("moves the source object so its source mark lands on the target mark", () => {
    const next = applyCanvasCommands(createAlignmentDocument(), [
      {
        kind: "alignObjectByGuideMarks",
        sourceObjectId: "source-image",
        sourceMarkId: "source_origin",
        targetObjectId: "target-image",
        targetMarkId: "target_origin",
      },
    ]).document;

    expect(next.objects["source-image"]).toMatchObject({ x: 215, y: 285 });
    const marks = resolveGuideAlignmentMarks(next);
    expect(marks.find((mark) => mark.markId === "source_origin")?.scene).toEqual(
      marks.find((mark) => mark.markId === "target_origin")?.scene,
    );
  });

  it("reports missing and ambiguous marks clearly", () => {
    expect(
      alignObjectByGuideMarks(createAlignmentDocument(), {
        sourceObjectId: "source-image",
        sourceMarkId: "missing",
        targetObjectId: "target-image",
        targetMarkId: "target_origin",
      }).message,
    ).toContain("MissingGuideAlignmentMark");

    expect(
      alignObjectByGuideMarks(createAlignmentDocument({ includeDuplicateGuide: true }), {
        sourceObjectId: "source-image",
        sourceMarkId: "source_origin",
        targetObjectId: "target-image",
        targetMarkId: "target_origin",
      }).message,
    ).toContain("AmbiguousGuideAlignmentMark");
  });

  it("returns a no-op message when marks are already aligned", () => {
    expect(
      alignObjectByGuideMarks(createAlignmentDocument(), {
        sourceObjectId: "source-image",
        sourceMarkId: "source_origin",
        targetObjectId: "source-image",
        targetMarkId: "source_origin",
      }).message,
    ).toContain("GuideAlignmentNoop");
  });

  it("returns an unsupported-transform error for alpha masks", () => {
    expect(
      alignObjectByGuideMarks(createAlignmentDocument(), {
        sourceObjectId: "alpha-image",
        sourceMarkId: "alpha_origin",
        targetObjectId: "target-image",
        targetMarkId: "target_origin",
      }).message,
    ).toContain("UnsupportedGuideAlignmentTransform");
  });

  it("lists alignment marks in the terminal", () => {
    expect(
      executeCanvasTerminalCommand("list-alignment-marks", {
        document: createAlignmentDocument(),
      }).logEntry?.message,
    ).toContain("source-image:source_origin");
  });

  it("aligns by mark from the terminal and uses the selected object shortcut", () => {
    const direct = executeCanvasTerminalCommand(
      "align-by-mark source-image source_origin target-image target_origin",
      { document: createAlignmentDocument() },
    );
    const directNext = direct.commands
      ? applyCanvasCommands(createAlignmentDocument(), direct.commands).document
      : createAlignmentDocument();
    expect(directNext.objects["source-image"]).toMatchObject({ x: 215, y: 285 });

    const selected = executeCanvasTerminalCommand(
      "align-selected-by-mark source_origin target-image target_origin",
      { document: createAlignmentDocument({ selectedObjectId: "source-image" }) },
    );
    const selectedNext = selected.commands
      ? applyCanvasCommands(
          createAlignmentDocument({ selectedObjectId: "source-image" }),
          selected.commands,
        ).document
      : createAlignmentDocument({ selectedObjectId: "source-image" });
    expect(selectedNext.objects["source-image"]).toMatchObject({ x: 215, y: 285 });
  });

  it("returns terminal errors for invalid alignment args", () => {
    expect(
      executeCanvasTerminalCommand("align-by-mark source-image", {
        document: createAlignmentDocument(),
      }).logEntry?.kind,
    ).toBe("error");
  });

  it("preserves alignment marks in guide TOML, excludes them from sprite TOML, and exports moved object geometry", () => {
    const aligned = applyCanvasCommands(createAlignmentDocument(), [
      {
        kind: "alignObjectByGuideMarks",
        sourceObjectId: "source-image",
        sourceMarkId: "source_origin",
        targetObjectId: "target-image",
        targetMarkId: "target_origin",
      },
    ]).document;
    const bundle = createCanvasExportBundle(aligned);
    const guideFile = bundle.files.find((file) => file.path.endsWith(".guide.toml"));
    const spriteFile = bundle.files.find((file) => file.path.endsWith(".sprite.toml"));
    const imageFile = bundle.files.find((file) => file.path === "objects/source-image.toml");

    expect(guideFile?.text).toContain("[[alignment_marks]]");
    expect(spriteFile?.text).not.toContain("alignment_marks");
    expect(imageFile?.text).toContain("x = 215");
    expect(imageFile?.text).toContain("y = 285");
  });
});
