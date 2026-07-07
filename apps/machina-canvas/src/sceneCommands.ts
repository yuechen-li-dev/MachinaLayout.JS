import { createBlockoutSidecarObject } from "./blockoutSidecar";
import { resolveCanvasFrame } from "./canvasFrames";
import { addCanvasObjectToLayerGroup, createCanvasLayerGroup } from "./layerTree";
import { selectSpriteFrameInSpec, updateSpriteFrameRectInSpec } from "./spriteSidecar";
import {
  findDatumSnapTargetsForSpriteFrame,
  snapSpriteFrameRectToDatum,
  type SpriteFrameDatumAnchor,
  type SpriteFrameDatumSnapTarget,
} from "./spriteGuideDatums";
import {
  clampSpriteFrameRectToGuideRegion,
  collectGuideRegionDiagnosticsForSpriteSidecar,
  findGuideRegionForSpriteFrame,
} from "./spriteGuideRegions";
import {
  computeGuideAlignmentTranslation,
  resolveGuideAlignmentMarks,
  type GuideAlignmentTranslation,
  type ResolvedGuideAlignmentMark,
} from "./guideAlignment";
import type {
  MechanicalBlockAnnotation,
  MechanicalDatumAnnotation,
  MechanicalDimensionAnnotation,
  MechanicalNoteAnnotation,
  MechanicalAnnotationSidecarObject,
} from "./mechanicalAnnotations";
import { getCanvasUiComponentDefinition } from "./uiComponents/catalog";
import type { CanvasUiComponentDefinition } from "./uiComponents/catalog";
import type {
  CanvasDocument,
  CanvasFrame,
  CanvasObject,
  CanvasSpriteDiagnostics,
  CanvasSpriteFrame,
  CanvasUiPropValue,
  BlockoutSidecarObject,
  GuideSidecarObject,
  ImageObject,
  SpriteOverlayDisplayMode,
  SpriteSidecarObject,
} from "./sceneModel";
import {
  gridPointRefToCanvasPoint,
  gridSpanRefToCanvasRect,
  parseGridPointRef,
  parseGridSpanRef,
  type ReferenceGridConfig,
} from "./referenceGrid";

export type CanvasCommand =
  | { kind: "select"; id?: string }
  | { kind: "move"; id: string; dx: number; dy: number }
  | { kind: "resize"; id: string; width: number; height: number }
  | { kind: "setFill"; id: string; fill: string }
  | { kind: "setStroke"; id: string; stroke: string }
  | {
      kind: "align";
      ids: string[];
      axis: "left" | "centerX" | "right" | "top" | "centerY" | "bottom";
    }
  | {
      kind: "distribute";
      ids: string[];
      axis: "horizontal" | "vertical";
      gap?: number;
    }
  | {
      kind: "moveToGrid";
      id: string;
      ref: string;
      anchor?: "topLeft" | "center" | "bottomRight";
    }
  | {
      kind: "alignToGrid";
      ids: string[];
      axis: "left" | "centerX" | "right" | "top" | "centerY" | "bottom";
      ref: string;
    }
  | {
      kind: "resizeToGridSpan";
      id: string;
      span: string;
    }
  | {
      kind: "setFrame";
      id: string;
      frame: CanvasFrame;
    }
  | {
      kind: "setUiProp";
      id: string;
      prop: string;
      value: CanvasUiPropValue;
    }
  | {
      kind: "alignObjectByGuideMarks";
      sourceObjectId: string;
      sourceMarkId: string;
      targetObjectId: string;
      targetMarkId: string;
      sourceGuideSidecarId?: string;
      targetGuideSidecarId?: string;
    }
  | {
      kind: "addImageObject";
      object: ImageObject;
    }
  | {
      kind: "addSpriteSidecarObject";
      object: SpriteSidecarObject;
      attach?: boolean;
    }
  | {
      kind: "addGuideSidecarObject";
      object: GuideSidecarObject;
      attach?: boolean;
    }
  | {
      kind: "addBlockoutSidecarObject";
      object: BlockoutSidecarObject;
      attach?: boolean;
    }
  | {
      kind: "removeObject";
      id: string;
    }
  | {
      kind: "attachAlphaMap";
      sourceId: string;
      alphaId: string;
    }
  | {
      kind: "detachAlphaMap";
      sourceId: string;
    }
  | {
      kind: "attachSketchOverlay";
      sourceId: string;
      overlayId: string;
    }
  | {
      kind: "detachSketchOverlay";
      sourceId: string;
    }
  | {
      kind: "setSketchOverlayVisible";
      overlayId: string;
      visible: boolean;
    }
  | {
      kind: "attachGuideSidecar";
      sourceId: string;
      guideId: string;
    }
  | {
      kind: "detachGuideSidecar";
      guideId: string;
    }
  | {
      kind: "setGuideSidecarVisible";
      guideId: string;
      visible: boolean;
    }
  | {
      kind: "setGuideSidecarOpacity";
      guideId: string;
      opacity: number;
    }
  | {
      kind: "attachSpriteSidecar";
      sourceId: string;
      sidecarId: string;
    }
  | {
      kind: "detachSpriteSidecar";
      sourceId: string;
    }
  | {
      kind: "setSpriteSidecarVisible";
      sidecarId: string;
      visible: boolean;
    }
  | {
      kind: "attachBlockoutSidecar";
      targetObjectId: string;
      blockoutId: string;
    }
  | {
      kind: "detachBlockoutSidecar";
      blockoutId: string;
    }
  | {
      kind: "setBlockoutSidecarVisible";
      blockoutId: string;
      visible: boolean;
    }
  | {
      kind: "setBlockoutSidecarOpacity";
      blockoutId: string;
      opacity: number;
    }
  | {
      kind: "setSpriteOverlayOption";
      sidecarId: string;
      option: "showBounds" | "showLabels" | "selectedOnly" | "showSubgrids" | "showExactFrames";
      value: boolean;
    }
  | {
      kind: "setSpriteOverlayDisplayMode";
      sidecarId: string;
      mode: SpriteOverlayDisplayMode;
    }
  | {
      kind: "selectSpriteFrame";
      sidecarId: string;
      frameId?: string;
    }
  | {
      kind: "updateSpriteFrameRect";
      sidecarId: string;
      frameId: string;
      rect: Pick<CanvasSpriteFrame, "x" | "y" | "width" | "height">;
    }
  | {
      kind: "nudgeSpriteFrame";
      sidecarId: string;
      frameId: string;
      dx: number;
      dy: number;
    }
  | {
      kind: "resizeSpriteFrame";
      sidecarId: string;
      frameId: string;
      dw: number;
      dh: number;
    }
  | {
      kind: "clampSpriteFrameToGuideRegion";
      sidecarId: string;
      frameId: string;
    }
  | {
      kind: "snapSpriteFrameToDatum";
      sidecarId: string;
      frameId: string;
      anchor?: SpriteFrameDatumAnchor;
      datumId?: string;
      maxDistance?: number;
      constrainToGuideRegion?: boolean;
      restrictToRegion?: boolean;
    }
  | {
      kind: "snapSpriteFrameToNearestDatum";
      sidecarId: string;
      frameId: string;
      anchor?: SpriteFrameDatumAnchor;
      maxDistance?: number;
      constrainToGuideRegion?: boolean;
      restrictToRegion?: boolean;
    };

export type CanvasCommandValidationContext = {
  referenceGrid?: Partial<ReferenceGridConfig>;
};

export type CanvasCommandApplyContext = {
  referenceGrid?: Partial<ReferenceGridConfig>;
  spriteFrameEditSettings?: {
    constrainFrameEditsToGuideRegion?: boolean;
  };
};

export type CanvasCommandValidationDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  commandIndex?: number;
  objectId?: string;
};

export type CanvasCommandValidationResult = {
  ok: boolean;
  diagnostics: CanvasCommandValidationDiagnostic[];
};

export type CanvasCommandChange = {
  objectId: string;
  field: string;
  before: unknown;
  after: unknown;
};

export type CanvasCommandApplyResult = {
  document: CanvasDocument;
  command: CanvasCommand;
  changes: CanvasCommandChange[];
  message: string;
};

export type AlignObjectByGuideMarksResult = {
  readonly document: CanvasDocument;
  readonly ok: boolean;
  readonly message: string;
  readonly translation?: GuideAlignmentTranslation;
};

const alignAxes = new Set(["left", "centerX", "right", "top", "centerY", "bottom"]);
const distributeAxes = new Set(["horizontal", "vertical"]);
const gridAnchors = new Set(["topLeft", "center", "bottomRight"]);
type AlignAxis = Extract<CanvasCommand, { kind: "align" }>["axis"];
type GridAnchor = Extract<CanvasCommand, { kind: "moveToGrid" }>["anchor"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isCanvasUiPropValue(value: unknown): value is CanvasUiPropValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value !== "number" || Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every((item) => typeof item === "string") || value.every(isFiniteNumber);
  }

  return false;
}

function makeResult(
  diagnostics: CanvasCommandValidationDiagnostic[],
): CanvasCommandValidationResult {
  return {
    ok: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    diagnostics,
  };
}

function addDiagnostic(
  diagnostics: CanvasCommandValidationDiagnostic[],
  diagnostic: CanvasCommandValidationDiagnostic,
) {
  diagnostics.push(diagnostic);
}

function validateObjectId(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  objectId: unknown,
  commandIndex: number | undefined,
  fieldName = "id",
) {
  if (!isString(objectId) || objectId.length === 0) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidCommand",
      message: `Command requires a non-empty string ${fieldName}.`,
      commandIndex,
    });
    return;
  }

  if (document.objects[objectId] === undefined) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "MissingObject",
      message: `Object "${objectId}" does not exist.`,
      commandIndex,
      objectId,
    });
  }
}

function getSpriteSidecar(document: CanvasDocument, sidecarId: string) {
  const sidecar = document.objects[sidecarId];
  return sidecar?.kind === "spriteSidecar" ? sidecar : undefined;
}

function getSpriteFrame(sidecar: SpriteSidecarObject, frameId: string) {
  return sidecar.spec.frames.find((frame) => frame.id === frameId);
}

function mergeSpriteDiagnostics(
  baseDiagnostics: readonly CanvasSpriteDiagnostics[],
  guideDiagnostics: readonly CanvasSpriteDiagnostics[],
) {
  const merged = [...baseDiagnostics];
  const seen = new Set(
    baseDiagnostics.map((diagnostic) =>
      [
        diagnostic.severity,
        diagnostic.code,
        diagnostic.message,
        diagnostic.frameIds?.join(",") ?? "",
      ].join("|"),
    ),
  );
  for (const diagnostic of guideDiagnostics) {
    const key = [
      diagnostic.severity,
      diagnostic.code,
      diagnostic.message,
      diagnostic.frameIds?.join(",") ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(diagnostic);
  }
  return merged;
}

const GUIDE_REGION_DIAGNOSTIC_CODES = new Set([
  "SpriteFrameOutsideGuideRegion",
  "SpriteFrameIntersectsGuideRegion",
  "SpriteFrameLargerThanGuideRegion",
  "SpriteFrameMissingGuideRegion",
]);

function refreshSpriteGuideDiagnostics(document: CanvasDocument): CanvasDocument {
  let nextDocument = document;
  for (const object of Object.values(nextDocument.objects)) {
    if (object.kind !== "spriteSidecar") continue;
    const baseDiagnostics = object.spec.diagnostics.filter(
      (diagnostic) => !GUIDE_REGION_DIAGNOSTIC_CODES.has(diagnostic.code),
    );
    const guideDiagnostics = collectGuideRegionDiagnosticsForSpriteSidecar(nextDocument, object);
    const diagnostics = mergeSpriteDiagnostics(baseDiagnostics, guideDiagnostics);
    const diagnosticsChanged =
      diagnostics.length !== object.spec.diagnostics.length ||
      diagnostics.some((diagnostic, index) => diagnostic !== object.spec.diagnostics[index]);
    if (!diagnosticsChanged) continue;
    nextDocument = replaceObject(nextDocument, object.id, {
      ...object,
      spec: {
        ...object.spec,
        diagnostics,
      },
    });
  }
  return nextDocument;
}

function maybeConstrainSpriteFrameRect(
  document: CanvasDocument,
  sidecarId: string,
  frameId: string,
  rect: Pick<CanvasSpriteFrame, "x" | "y" | "width" | "height">,
  context?: CanvasCommandApplyContext,
  forceClamp = false,
) {
  if (!forceClamp && !context?.spriteFrameEditSettings?.constrainFrameEditsToGuideRegion) {
    return rect;
  }
  const guideContext = findGuideRegionForSpriteFrame(document, {
    spriteSidecarId: sidecarId,
    frameId,
  });
  if (!guideContext) return rect;
  return clampSpriteFrameRectToGuideRegion(rect, guideContext.region);
}

function getDatumSnapConstrainedRect(
  document: CanvasDocument,
  sidecarId: string,
  frameId: string,
  rect: Pick<CanvasSpriteFrame, "x" | "y" | "width" | "height">,
  context: CanvasCommandApplyContext | undefined,
  constrainToGuideRegion: boolean | undefined,
) {
  if (constrainToGuideRegion === false) {
    return rect;
  }
  return maybeConstrainSpriteFrameRect(
    document,
    sidecarId,
    frameId,
    rect,
    context,
    constrainToGuideRegion === true,
  );
}

function resolveDatumSnapTarget(
  document: CanvasDocument,
  command:
    | Extract<CanvasCommand, { kind: "snapSpriteFrameToDatum" }>
    | Extract<CanvasCommand, { kind: "snapSpriteFrameToNearestDatum" }>,
): SpriteFrameDatumSnapTarget | undefined {
  const targets = findDatumSnapTargetsForSpriteFrame(document, {
    spriteSidecarId: command.sidecarId,
    frameId: command.frameId,
    options: {
      maxDistance: command.maxDistance,
      restrictToRegion: command.restrictToRegion,
    },
  });
  const filteredTargets = command.anchor
    ? targets.filter(
        (target) =>
          target.anchor === command.anchor ||
          (target.datumKind === "point" &&
            (command.anchor === "centerX" || command.anchor === "centerY")),
      )
    : targets;
  if (command.kind === "snapSpriteFrameToNearestDatum") {
    return filteredTargets[0];
  }
  return filteredTargets.find(
    (target) =>
      (command.datumId === undefined || target.datumId === command.datumId) &&
      (command.anchor === undefined ||
        target.anchor === command.anchor ||
        (target.datumKind === "point" &&
          (command.anchor === "centerX" || command.anchor === "centerY"))),
  );
}

function validateNumber(
  diagnostics: CanvasCommandValidationDiagnostic[],
  value: unknown,
  field: string,
  commandIndex: number | undefined,
) {
  if (!isFiniteNumber(value)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidNumber",
      message: `${field} must be a finite number.`,
      commandIndex,
    });
  }
}

function validateSize(
  diagnostics: CanvasCommandValidationDiagnostic[],
  value: unknown,
  field: string,
  commandIndex: number | undefined,
) {
  if (!isFiniteNumber(value) || value <= 0) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSize",
      message: `${field} must be a positive finite number.`,
      commandIndex,
    });
  }
}

function validateObjectList(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  ids: unknown,
  commandIndex: number | undefined,
  minimumLength = 2,
) {
  if (!Array.isArray(ids) || ids.length < minimumLength || !ids.every(isString)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidObjectList",
      message: `ids must be an array of at least ${minimumLength} object ID${minimumLength === 1 ? "" : "s"}.`,
      commandIndex,
    });
    return;
  }

  for (const objectId of ids) {
    if (document.objects[objectId] === undefined) {
      addDiagnostic(diagnostics, {
        severity: "error",
        code: "MissingObject",
        message: `Object "${objectId}" does not exist.`,
        commandIndex,
        objectId,
      });
    }
  }
}

function validateGridRef(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  ref: unknown,
  commandIndex: number | undefined,
  context?: CanvasCommandValidationContext,
) {
  if (!isString(ref)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidGridRef",
      message: "ref must be a string grid reference.",
      commandIndex,
    });
    return;
  }

  try {
    parseGridPointRef(ref, context?.referenceGrid ?? document.referenceGrid);
  } catch (error) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidGridRef",
      message: error instanceof Error ? error.message : "Invalid grid reference.",
      commandIndex,
    });
  }
}

function validateGridSpan(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  span: unknown,
  commandIndex: number | undefined,
  context?: CanvasCommandValidationContext,
) {
  if (!isString(span)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidGridSpan",
      message: "span must be a string grid span.",
      commandIndex,
    });
    return;
  }

  try {
    parseGridSpanRef(span, context?.referenceGrid ?? document.referenceGrid);
  } catch (error) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidGridSpan",
      message: error instanceof Error ? error.message : "Invalid grid span.",
      commandIndex,
    });
  }
}

function validateCanvasFrameValue(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  frame: unknown,
  commandIndex: number | undefined,
  context?: CanvasCommandValidationContext,
) {
  if (!isRecord(frame) || !isString(frame.kind)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidFrame",
      message: "frame must be an object with a string kind.",
      commandIndex,
    });
    return;
  }

  if (!["absolute", "anchor", "referenceGrid", "referenceGridSpan"].includes(frame.kind)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidFrame",
      message: `Unknown frame kind "${frame.kind}".`,
      commandIndex,
    });
    return;
  }

  if (
    frame.kind === "referenceGrid" &&
    frame.anchor !== undefined &&
    (!isString(frame.anchor) || !gridAnchors.has(frame.anchor))
  ) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidFrame",
      message: "referenceGrid frame anchor must be topLeft, center, or bottomRight.",
      commandIndex,
    });
    return;
  }

  try {
    resolveCanvasFrame(frame as CanvasFrame, {
      document,
      referenceGrid: context?.referenceGrid ?? document.referenceGrid,
    });
  } catch (error) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code:
        frame.kind === "referenceGrid" || frame.kind === "referenceGridSpan"
          ? "InvalidFrameReference"
          : "InvalidFrame",
      message: error instanceof Error ? error.message : "Invalid canvas frame.",
      commandIndex,
    });
  }
}

function validateAddImageObjectCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  object: unknown,
  commandIndex: number | undefined,
) {
  if (!isRecord(object)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidImageAsset",
      message: "addImageObject requires an image object.",
      commandIndex,
    });
    return;
  }

  if (!isString(object.id) || object.id.length === 0) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidImageAsset",
      message: "Image object id must be a non-empty string.",
      commandIndex,
    });
  } else if (document.objects[object.id] !== undefined) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "DuplicateObjectId",
      message: `Object "${object.id}" already exists.`,
      commandIndex,
      objectId: object.id,
    });
  }

  if (object.kind !== "image") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidImageObject",
      message: "addImageObject only accepts objects with kind image.",
      commandIndex,
      objectId: isString(object.id) ? object.id : undefined,
    });
  }

  if (!isString(object.layerId) || !document.layers.some((layer) => layer.id === object.layerId)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "MissingLayer",
      message: `Image object layer "${String(object.layerId)}" does not exist.`,
      commandIndex,
      objectId: isString(object.id) ? object.id : undefined,
    });
  }

  if (!isString(object.src) || object.src.length === 0) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidImageAsset",
      message: "Image object src must be a non-empty string.",
      commandIndex,
      objectId: isString(object.id) ? object.id : undefined,
    });
  }
}

function validateAddSpriteSidecarCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  object: unknown,
  commandIndex: number | undefined,
) {
  if (!isRecord(object)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSpriteSidecar",
      message: "addSpriteSidecarObject requires a sprite sidecar object.",
      commandIndex,
    });
    return;
  }

  if (!isString(object.id) || object.id.length === 0) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSpriteSidecar",
      message: "Sprite sidecar id must be a non-empty string.",
      commandIndex,
    });
  } else if (document.objects[object.id] !== undefined) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "DuplicateObjectId",
      message: `Object "${object.id}" already exists.`,
      commandIndex,
      objectId: object.id,
    });
  }

  if (object.kind !== "spriteSidecar") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSpriteSidecar",
      message: "addSpriteSidecarObject only accepts objects with kind spriteSidecar.",
      commandIndex,
      objectId: isString(object.id) ? object.id : undefined,
    });
  }

  if (!isString(object.layerId) || !document.layers.some((layer) => layer.id === object.layerId)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "MissingLayer",
      message: `Sprite sidecar layer "${String(object.layerId)}" does not exist.`,
      commandIndex,
      objectId: isString(object.id) ? object.id : undefined,
    });
  }

  if (
    object.targetId !== undefined &&
    (!isString(object.targetId) || document.objects[object.targetId]?.kind !== "image")
  ) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSpriteSidecarRelation",
      message: `Sprite sidecar target "${String(object.targetId)}" must be an image object.`,
      commandIndex,
      objectId: isString(object.id) ? object.id : undefined,
    });
  }
}

function validateAddBlockoutSidecarCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  object: unknown,
  commandIndex: number | undefined,
) {
  if (!isRecord(object)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidBlockoutSidecar",
      message: "addBlockoutSidecarObject requires a blockout sidecar object.",
      commandIndex,
    });
    return;
  }

  if (!isString(object.id) || object.id.length === 0) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidBlockoutSidecar",
      message: "Blockout sidecar id must be a non-empty string.",
      commandIndex,
    });
  } else if (document.objects[object.id] !== undefined) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "DuplicateObjectId",
      message: `Object "${object.id}" already exists.`,
      commandIndex,
      objectId: object.id,
    });
  }

  if (object.kind !== "blockoutSidecar") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidBlockoutSidecar",
      message: "addBlockoutSidecarObject only accepts objects with kind blockoutSidecar.",
      commandIndex,
      objectId: isString(object.id) ? object.id : undefined,
    });
  }

  if (!isString(object.layerId) || !document.layers.some((layer) => layer.id === object.layerId)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "MissingLayer",
      message: `Blockout sidecar layer "${String(object.layerId)}" does not exist.`,
      commandIndex,
      objectId: isString(object.id) ? object.id : undefined,
    });
  }

  if (
    object.targetObjectId !== undefined &&
    (!isString(object.targetObjectId) || document.objects[object.targetObjectId] === undefined)
  ) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidBlockoutSidecarRelation",
      message: `Blockout sidecar target "${String(object.targetObjectId)}" must reference an existing scene object.`,
      commandIndex,
      objectId: isString(object.id) ? object.id : undefined,
    });
  }
}

function validateRemoveObjectCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  id: unknown,
  commandIndex: number | undefined,
) {
  validateObjectId(document, diagnostics, id, commandIndex);
  if (!isString(id) || document.objects[id] === undefined) return;

  const references = Object.values(document.objects).filter(
    (object) =>
      object.kind === "image" && (object.alphaMapId === id || object.spriteSidecarId === id),
  );
  if (references.length > 0) {
    addDiagnostic(diagnostics, {
      severity: "warning",
      code: "RemovingAlphaMapReference",
      message: `Removing "${id}" will detach it from ${references.length} image object${
        references.length === 1 ? "" : "s"
      }.`,
      commandIndex,
      objectId: id,
    });
  }
}

function validateSpriteSidecarCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  command: Record<string, unknown>,
  commandIndex: number | undefined,
) {
  validateObjectId(document, diagnostics, command.sourceId, commandIndex, "sourceId");
  validateObjectId(document, diagnostics, command.sidecarId, commandIndex, "sidecarId");

  if (!isString(command.sourceId) || !isString(command.sidecarId)) return;
  if (command.sourceId === command.sidecarId) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSpriteSidecarRelation",
      message: "sourceId and sidecarId must reference different objects.",
      commandIndex,
      objectId: command.sourceId,
    });
    return;
  }

  const source = document.objects[command.sourceId];
  const sidecar = document.objects[command.sidecarId];

  if (source !== undefined && source.kind !== "image") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidImageObject",
      message: `Source object "${source.id}" must be an image object.`,
      commandIndex,
      objectId: source.id,
    });
  }

  if (sidecar !== undefined && sidecar.kind !== "spriteSidecar") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSpriteSidecarRelation",
      message: `Sidecar object "${sidecar.id}" must be a sprite sidecar object.`,
      commandIndex,
      objectId: sidecar.id,
    });
  } else if (sidecar?.targetId !== undefined && sidecar.targetId !== command.sourceId) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSpriteSidecarRelation",
      message: `Sprite sidecar "${sidecar?.id}" must target image "${command.sourceId}".`,
      commandIndex,
      objectId: sidecar?.id,
    });
  }
}

function validateAlphaMapCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  command: Record<string, unknown>,
  commandIndex: number | undefined,
) {
  validateObjectId(document, diagnostics, command.sourceId, commandIndex, "sourceId");
  validateObjectId(document, diagnostics, command.alphaId, commandIndex, "alphaId");

  if (!isString(command.sourceId) || !isString(command.alphaId)) return;

  if (command.sourceId === command.alphaId) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidCompositeRelation",
      message: "sourceId and alphaId must reference different objects.",
      commandIndex,
      objectId: command.sourceId,
    });
    return;
  }

  const source = document.objects[command.sourceId];
  const alpha = document.objects[command.alphaId];

  if (source !== undefined && source.kind !== "image") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidImageObject",
      message: `Source object "${source.id}" must be an image object.`,
      commandIndex,
      objectId: source.id,
    });
  }

  if (alpha !== undefined && alpha.kind !== "image") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidAlphaMap",
      message: `Alpha map object "${alpha.id}" must be an image object.`,
      commandIndex,
      objectId: alpha.id,
    });
  } else if (
    alpha !== undefined &&
    alpha.kind === "image" &&
    alpha.role !== "alphaMap" &&
    alpha.role !== "mask"
  ) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidAlphaMap",
      message: `Alpha map object "${alpha.id}" must have role alphaMap or mask.`,
      commandIndex,
      objectId: alpha.id,
    });
  }
}

function validateSketchOverlayCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  command: Record<string, unknown>,
  commandIndex: number | undefined,
) {
  validateObjectId(document, diagnostics, command.sourceId, commandIndex, "sourceId");
  validateObjectId(document, diagnostics, command.overlayId, commandIndex, "overlayId");

  if (!isString(command.sourceId) || !isString(command.overlayId)) return;
  if (command.sourceId === command.overlayId) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSketchOverlayRelation",
      message: "sourceId and overlayId must reference different objects.",
      commandIndex,
      objectId: command.sourceId,
    });
    return;
  }

  const source = document.objects[command.sourceId];
  const overlay = document.objects[command.overlayId];

  if (source !== undefined && source.kind !== "image") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidImageObject",
      message: `Source object "${source.id}" must be an image object.`,
      commandIndex,
      objectId: source.id,
    });
  }

  if (overlay !== undefined && overlay.kind !== "sketchOverlay") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSketchOverlayRelation",
      message: `Overlay object "${overlay.id}" must be a sketch overlay object.`,
      commandIndex,
      objectId: overlay.id,
    });
  } else if (overlay?.targetId !== undefined && overlay.targetId !== command.sourceId) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSketchOverlayRelation",
      message: `Sketch overlay "${overlay?.id}" must target image "${command.sourceId}".`,
      commandIndex,
      objectId: overlay?.id,
    });
  }
}

function validateSetUiPropCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  command: Record<string, unknown>,
  commandIndex: number | undefined,
) {
  validateObjectId(document, diagnostics, command.id, commandIndex);
  if (!isString(command.id) || document.objects[command.id] === undefined) return;

  const object = document.objects[command.id];
  if (object.kind !== "uiComponent") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidObjectKind",
      message: `Object "${object.id}" is not a UI component object.`,
      commandIndex,
      objectId: object.id,
    });
    return;
  }

  if (!isString(command.prop) || command.prop.length === 0) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidCommand",
      message: "setUiProp requires a non-empty string prop.",
      commandIndex,
      objectId: object.id,
    });
    return;
  }

  let definition: CanvasUiComponentDefinition;
  try {
    definition = getCanvasUiComponentDefinition(object.componentId);
  } catch (error) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "UnknownUiComponent",
      message: error instanceof Error ? error.message : "Unknown UI component.",
      commandIndex,
      objectId: object.id,
    });
    return;
  }

  const propDefinition = definition.propSchema.find((prop) => prop.name === command.prop);
  if (!propDefinition) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "UnknownUiProp",
      message: `UI component "${object.componentId}" does not define prop "${command.prop}".`,
      commandIndex,
      objectId: object.id,
    });
    return;
  }

  if (!isCanvasUiPropValue(command.value)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidUiPropValue",
      message: `Prop "${command.prop}" must be a serializable UI prop value.`,
      commandIndex,
      objectId: object.id,
    });
    return;
  }

  if (propDefinition.kind === "string" && typeof command.value !== "string") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidUiPropValue",
      message: `Prop "${command.prop}" must be a string.`,
      commandIndex,
      objectId: object.id,
    });
  } else if (propDefinition.kind === "number" && typeof command.value !== "number") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidUiPropValue",
      message: `Prop "${command.prop}" must be a number.`,
      commandIndex,
      objectId: object.id,
    });
  } else if (propDefinition.kind === "boolean" && typeof command.value !== "boolean") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidUiPropValue",
      message: `Prop "${command.prop}" must be a boolean.`,
      commandIndex,
      objectId: object.id,
    });
  } else if (
    propDefinition.kind === "enum" &&
    (typeof command.value !== "string" || !propDefinition.options?.includes(command.value))
  ) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidUiPropValue",
      message: `Prop "${command.prop}" must be one of ${(propDefinition.options ?? []).join(", ")}.`,
      commandIndex,
      objectId: object.id,
    });
  }
}

function validateGuideAlignmentCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  command: Record<string, unknown>,
  commandIndex: number | undefined,
) {
  validateObjectId(document, diagnostics, command.sourceObjectId, commandIndex, "sourceObjectId");
  validateObjectId(document, diagnostics, command.targetObjectId, commandIndex, "targetObjectId");
  if (!isString(command.sourceMarkId) || command.sourceMarkId.trim().length === 0) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidCommand",
      message: "sourceMarkId must be a non-empty string.",
      commandIndex,
    });
  }
  if (!isString(command.targetMarkId) || command.targetMarkId.trim().length === 0) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidCommand",
      message: "targetMarkId must be a non-empty string.",
      commandIndex,
    });
  }
  if (
    command.sourceGuideSidecarId !== undefined &&
    (!isString(command.sourceGuideSidecarId) ||
      document.objects[command.sourceGuideSidecarId]?.kind !== "guideSidecar")
  ) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidGuideSidecarRelation",
      message: "sourceGuideSidecarId must reference a guide sidecar when present.",
      commandIndex,
      objectId: isString(command.sourceGuideSidecarId) ? command.sourceGuideSidecarId : undefined,
    });
  }
  if (
    command.targetGuideSidecarId !== undefined &&
    (!isString(command.targetGuideSidecarId) ||
      document.objects[command.targetGuideSidecarId]?.kind !== "guideSidecar")
  ) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidGuideSidecarRelation",
      message: "targetGuideSidecarId must reference a guide sidecar when present.",
      commandIndex,
      objectId: isString(command.targetGuideSidecarId) ? command.targetGuideSidecarId : undefined,
    });
  }
}

function validateDetachAlphaMapCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  sourceId: unknown,
  commandIndex: number | undefined,
) {
  validateObjectId(document, diagnostics, sourceId, commandIndex, "sourceId");
  if (!isString(sourceId)) return;
  const source = document.objects[sourceId];
  if (source !== undefined && source.kind !== "image") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidImageObject",
      message: `Source object "${source.id}" must be an image object.`,
      commandIndex,
      objectId: source.id,
    });
  }
}

function validateDetachSketchOverlayCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  sourceId: unknown,
  commandIndex: number | undefined,
) {
  validateObjectId(document, diagnostics, sourceId, commandIndex, "sourceId");
  if (!isString(sourceId)) return;
  const source = document.objects[sourceId];
  if (source !== undefined && source.kind !== "image") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidImageObject",
      message: `Source object "${source.id}" must be an image object.`,
      commandIndex,
      objectId: source.id,
    });
  }
}

function validateSetSketchOverlayVisibleCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  command: Record<string, unknown>,
  commandIndex: number | undefined,
) {
  validateObjectId(document, diagnostics, command.overlayId, commandIndex, "overlayId");
  if (!isString(command.overlayId)) return;
  const overlay = document.objects[command.overlayId];
  if (overlay !== undefined && overlay.kind !== "sketchOverlay") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSketchOverlayRelation",
      message: `Overlay object "${overlay.id}" must be a sketch overlay object.`,
      commandIndex,
      objectId: overlay.id,
    });
  }
  if (typeof command.visible !== "boolean") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidCommand",
      message: "visible must be a boolean.",
      commandIndex,
    });
  }
}

function validateDetachSpriteSidecarCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  sourceId: unknown,
  commandIndex: number | undefined,
) {
  validateObjectId(document, diagnostics, sourceId, commandIndex, "sourceId");
  if (!isString(sourceId)) return;
  const source = document.objects[sourceId];
  if (source !== undefined && source.kind !== "image") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidImageObject",
      message: `Source object "${source.id}" must be an image object.`,
      commandIndex,
      objectId: source.id,
    });
  }
}

function validateSpriteSidecarMutationCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  command: Record<string, unknown>,
  commandIndex: number | undefined,
) {
  validateObjectId(document, diagnostics, command.sidecarId, commandIndex, "sidecarId");
  if (!isString(command.sidecarId)) return;
  const sidecar = document.objects[command.sidecarId];
  if (sidecar !== undefined && sidecar.kind !== "spriteSidecar") {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidSpriteSidecarRelation",
      message: `Sidecar object "${sidecar.id}" must be a sprite sidecar object.`,
      commandIndex,
      objectId: sidecar.id,
    });
  }
}

function validateSpriteFrameMutationCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  command: Record<string, unknown>,
  commandIndex: number | undefined,
) {
  validateSpriteSidecarMutationCommand(document, diagnostics, command, commandIndex);

  if (!isString(command.frameId) || command.frameId.length === 0) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidCommand",
      message: "frameId must be a non-empty string.",
      commandIndex,
    });
    return;
  }

  if (!isString(command.sidecarId)) return;
  const sidecar = getSpriteSidecar(document, command.sidecarId);
  if (!sidecar) return;

  if (!getSpriteFrame(sidecar, command.frameId)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "MissingObject",
      message: `Sprite frame "${command.frameId}" does not exist on ${command.sidecarId}.`,
      commandIndex,
      objectId: command.sidecarId,
    });
  }
}

export function validateCanvasCommand(
  document: CanvasDocument,
  command: unknown,
  commandIndex?: number,
  context?: CanvasCommandValidationContext,
): CanvasCommandValidationResult {
  const diagnostics: CanvasCommandValidationDiagnostic[] = [];

  if (!isRecord(command) || !isString(command.kind)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidCommand",
      message: "Command must be an object with a string kind.",
      commandIndex,
    });
    return makeResult(diagnostics);
  }

  switch (command.kind) {
    case "select":
      if (command.id !== undefined)
        validateObjectId(document, diagnostics, command.id, commandIndex);
      break;
    case "move":
      validateObjectId(document, diagnostics, command.id, commandIndex);
      validateNumber(diagnostics, command.dx, "dx", commandIndex);
      validateNumber(diagnostics, command.dy, "dy", commandIndex);
      break;
    case "resize":
      validateObjectId(document, diagnostics, command.id, commandIndex);
      validateSize(diagnostics, command.width, "width", commandIndex);
      validateSize(diagnostics, command.height, "height", commandIndex);
      break;
    case "setFill":
      validateObjectId(document, diagnostics, command.id, commandIndex);
      if (!isString(command.fill)) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "fill must be a string.",
          commandIndex,
        });
      }
      break;
    case "setStroke":
      validateObjectId(document, diagnostics, command.id, commandIndex);
      if (!isString(command.stroke)) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "stroke must be a string.",
          commandIndex,
        });
      }
      break;
    case "align":
      validateObjectList(document, diagnostics, command.ids, commandIndex);
      if (!isString(command.axis) || !alignAxes.has(command.axis)) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidAxis",
          message: "align axis must be left, centerX, right, top, centerY, or bottom.",
          commandIndex,
        });
      }
      break;
    case "distribute":
      validateObjectList(document, diagnostics, command.ids, commandIndex);
      if (!isString(command.axis) || !distributeAxes.has(command.axis)) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidAxis",
          message: "distribute axis must be horizontal or vertical.",
          commandIndex,
        });
      }
      if (command.gap !== undefined && (!isFiniteNumber(command.gap) || command.gap < 0)) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidNumber",
          message: "gap must be a finite number greater than or equal to 0.",
          commandIndex,
        });
      }
      break;
    case "moveToGrid":
      validateObjectId(document, diagnostics, command.id, commandIndex);
      validateGridRef(document, diagnostics, command.ref, commandIndex, context);
      if (
        command.anchor !== undefined &&
        (!isString(command.anchor) || !gridAnchors.has(command.anchor))
      ) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidAnchor",
          message: "anchor must be topLeft, center, or bottomRight.",
          commandIndex,
        });
      }
      break;
    case "alignToGrid":
      validateObjectList(document, diagnostics, command.ids, commandIndex, 1);
      if (!isString(command.axis) || !alignAxes.has(command.axis)) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidAxis",
          message: "alignToGrid axis must be left, centerX, right, top, centerY, or bottom.",
          commandIndex,
        });
      }
      validateGridRef(document, diagnostics, command.ref, commandIndex, context);
      break;
    case "resizeToGridSpan":
      validateObjectId(document, diagnostics, command.id, commandIndex);
      validateGridSpan(document, diagnostics, command.span, commandIndex, context);
      break;
    case "setFrame":
      validateObjectId(document, diagnostics, command.id, commandIndex);
      validateCanvasFrameValue(document, diagnostics, command.frame, commandIndex, context);
      break;
    case "setUiProp":
      validateSetUiPropCommand(document, diagnostics, command, commandIndex);
      break;
    case "alignObjectByGuideMarks":
      validateGuideAlignmentCommand(document, diagnostics, command, commandIndex);
      break;
    case "addImageObject":
      validateAddImageObjectCommand(document, diagnostics, command.object, commandIndex);
      break;
    case "addSpriteSidecarObject":
      validateAddSpriteSidecarCommand(document, diagnostics, command.object, commandIndex);
      break;
    case "addGuideSidecarObject":
      if (
        "object" in command &&
        command.object &&
        typeof command.object === "object" &&
        "targetId" in command.object &&
        command.object.targetId !== undefined
      ) {
        validateObjectId(
          document,
          diagnostics,
          command.object.targetId,
          commandIndex,
          "object.targetId",
        );
      }
      break;
    case "addBlockoutSidecarObject":
      validateAddBlockoutSidecarCommand(document, diagnostics, command.object, commandIndex);
      break;
    case "removeObject":
      validateRemoveObjectCommand(document, diagnostics, command.id, commandIndex);
      break;
    case "attachAlphaMap":
      validateAlphaMapCommand(document, diagnostics, command, commandIndex);
      break;
    case "detachAlphaMap":
      validateDetachAlphaMapCommand(document, diagnostics, command.sourceId, commandIndex);
      break;
    case "attachSketchOverlay":
      validateSketchOverlayCommand(document, diagnostics, command, commandIndex);
      break;
    case "detachSketchOverlay":
      validateDetachSketchOverlayCommand(document, diagnostics, command.sourceId, commandIndex);
      break;
    case "setSketchOverlayVisible":
      validateSetSketchOverlayVisibleCommand(document, diagnostics, command, commandIndex);
      break;
    case "attachGuideSidecar":
      validateObjectId(document, diagnostics, command.sourceId, commandIndex, "sourceId");
      validateObjectId(document, diagnostics, command.guideId, commandIndex, "guideId");
      break;
    case "detachGuideSidecar":
      validateObjectId(document, diagnostics, command.guideId, commandIndex, "guideId");
      break;
    case "setGuideSidecarVisible":
      validateObjectId(document, diagnostics, command.guideId, commandIndex, "guideId");
      if (typeof command.visible !== "boolean") {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "visible must be a boolean.",
          commandIndex,
        });
      }
      break;
    case "setGuideSidecarOpacity":
      validateObjectId(document, diagnostics, command.guideId, commandIndex, "guideId");
      validateNumber(diagnostics, command.opacity, "opacity", commandIndex);
      break;
    case "attachSpriteSidecar":
      validateSpriteSidecarCommand(document, diagnostics, command, commandIndex);
      break;
    case "detachSpriteSidecar":
      validateDetachSpriteSidecarCommand(document, diagnostics, command.sourceId, commandIndex);
      break;
    case "setSpriteSidecarVisible":
      validateSpriteSidecarMutationCommand(document, diagnostics, command, commandIndex);
      if (typeof command.visible !== "boolean") {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "visible must be a boolean.",
          commandIndex,
        });
      }
      break;
    case "attachBlockoutSidecar":
      validateObjectId(
        document,
        diagnostics,
        command.targetObjectId,
        commandIndex,
        "targetObjectId",
      );
      validateObjectId(document, diagnostics, command.blockoutId, commandIndex, "blockoutId");
      break;
    case "detachBlockoutSidecar":
      validateObjectId(document, diagnostics, command.blockoutId, commandIndex, "blockoutId");
      break;
    case "setBlockoutSidecarVisible":
      validateObjectId(document, diagnostics, command.blockoutId, commandIndex, "blockoutId");
      if (typeof command.visible !== "boolean") {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "visible must be a boolean.",
          commandIndex,
        });
      }
      break;
    case "setBlockoutSidecarOpacity":
      validateObjectId(document, diagnostics, command.blockoutId, commandIndex, "blockoutId");
      validateNumber(diagnostics, command.opacity, "opacity", commandIndex);
      break;
    case "setSpriteOverlayOption":
      validateSpriteSidecarMutationCommand(document, diagnostics, command, commandIndex);
      if (
        !["showBounds", "showLabels", "selectedOnly", "showSubgrids", "showExactFrames"].includes(
          String(command.option),
        )
      ) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message:
            "option must be showBounds, showLabels, selectedOnly, showSubgrids, or showExactFrames.",
          commandIndex,
        });
      }
      if (typeof command.value !== "boolean") {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "value must be a boolean.",
          commandIndex,
        });
      }
      break;
    case "setSpriteOverlayDisplayMode":
      validateSpriteSidecarMutationCommand(document, diagnostics, command, commandIndex);
      if (!["focus", "cutEdit", "gridEdit", "audit", "debug"].includes(String(command.mode))) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "mode must be focus, cutEdit, gridEdit, audit, or debug.",
          commandIndex,
        });
      }
      break;
    case "selectSpriteFrame":
      validateSpriteSidecarMutationCommand(document, diagnostics, command, commandIndex);
      if (command.frameId !== undefined && !isString(command.frameId)) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "frameId must be a string when present.",
          commandIndex,
        });
      }
      break;
    case "updateSpriteFrameRect":
      validateSpriteFrameMutationCommand(document, diagnostics, command, commandIndex);
      if (!isRecord(command.rect)) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "rect must be an object with x, y, width, and height.",
          commandIndex,
        });
        break;
      }
      validateNumber(diagnostics, command.rect.x, "rect.x", commandIndex);
      validateNumber(diagnostics, command.rect.y, "rect.y", commandIndex);
      validateSize(diagnostics, command.rect.width, "rect.width", commandIndex);
      validateSize(diagnostics, command.rect.height, "rect.height", commandIndex);
      if (isFiniteNumber(command.rect.x) && command.rect.x < 0) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "rect.x must be greater than or equal to 0.",
          commandIndex,
        });
      }
      if (isFiniteNumber(command.rect.y) && command.rect.y < 0) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "rect.y must be greater than or equal to 0.",
          commandIndex,
        });
      }
      break;
    case "nudgeSpriteFrame":
      validateSpriteFrameMutationCommand(document, diagnostics, command, commandIndex);
      validateNumber(diagnostics, command.dx, "dx", commandIndex);
      validateNumber(diagnostics, command.dy, "dy", commandIndex);
      break;
    case "resizeSpriteFrame":
      validateSpriteFrameMutationCommand(document, diagnostics, command, commandIndex);
      validateNumber(diagnostics, command.dw, "dw", commandIndex);
      validateNumber(diagnostics, command.dh, "dh", commandIndex);
      if (isString(command.sidecarId) && isString(command.frameId)) {
        const sidecar = getSpriteSidecar(document, command.sidecarId);
        const frame = sidecar ? getSpriteFrame(sidecar, command.frameId) : undefined;
        if (
          frame &&
          isFiniteNumber(command.dw) &&
          isFiniteNumber(command.dh) &&
          frame.width + command.dw <= 0
        ) {
          addDiagnostic(diagnostics, {
            severity: "error",
            code: "InvalidSize",
            message: "resizeSpriteFrame would produce a non-positive width.",
            commandIndex,
          });
        }
        if (
          frame &&
          isFiniteNumber(command.dw) &&
          isFiniteNumber(command.dh) &&
          frame.height + command.dh <= 0
        ) {
          addDiagnostic(diagnostics, {
            severity: "error",
            code: "InvalidSize",
            message: "resizeSpriteFrame would produce a non-positive height.",
            commandIndex,
          });
        }
      }
      break;
    case "clampSpriteFrameToGuideRegion":
      validateSpriteFrameMutationCommand(document, diagnostics, command, commandIndex);
      break;
    case "snapSpriteFrameToDatum":
    case "snapSpriteFrameToNearestDatum":
      validateSpriteFrameMutationCommand(document, diagnostics, command, commandIndex);
      if (
        command.anchor !== undefined &&
        (!isString(command.anchor) ||
          !["left", "right", "centerX", "top", "bottom", "centerY"].includes(command.anchor))
      ) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "anchor must be left, right, centerX, top, bottom, or centerY.",
          commandIndex,
        });
      }
      if (
        command.kind === "snapSpriteFrameToDatum" &&
        command.datumId !== undefined &&
        !isString(command.datumId)
      ) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "datumId must be a string when present.",
          commandIndex,
        });
      }
      if (
        command.maxDistance !== undefined &&
        (!isFiniteNumber(command.maxDistance) || command.maxDistance < 0)
      ) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "maxDistance must be a non-negative finite number when present.",
          commandIndex,
        });
      }
      if (
        command.constrainToGuideRegion !== undefined &&
        typeof command.constrainToGuideRegion !== "boolean"
      ) {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "constrainToGuideRegion must be a boolean when present.",
          commandIndex,
        });
      }
      if (command.restrictToRegion !== undefined && typeof command.restrictToRegion !== "boolean") {
        addDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidCommand",
          message: "restrictToRegion must be a boolean when present.",
          commandIndex,
        });
      }
      break;
    default:
      addDiagnostic(diagnostics, {
        severity: "error",
        code: "UnknownCommandKind",
        message: `Unknown command kind "${command.kind}".`,
        commandIndex,
      });
  }

  return makeResult(diagnostics);
}

export function validateCanvasCommands(
  document: CanvasDocument,
  commands: unknown,
  context?: CanvasCommandValidationContext,
): CanvasCommandValidationResult {
  const commandList = Array.isArray(commands) ? commands : [commands];
  const diagnostics = commandList.flatMap(
    (command, index) => validateCanvasCommand(document, command, index, context).diagnostics,
  );
  return makeResult(diagnostics);
}

function replaceObject(
  document: CanvasDocument,
  objectId: string,
  nextObject: CanvasObject,
): CanvasDocument {
  return {
    ...document,
    objects: {
      ...document.objects,
      [objectId]: nextObject,
    },
  };
}

function changeField(
  changes: CanvasCommandChange[],
  object: CanvasObject,
  field: keyof CanvasObject | string,
  after: unknown,
) {
  const before = object[field as keyof CanvasObject];
  if (before !== after) {
    changes.push({
      objectId: object.id,
      field: String(field),
      before,
      after,
    });
  }
}

function getAlignValue(object: CanvasObject, axis: AlignAxis) {
  switch (axis) {
    case "left":
      return object.x;
    case "centerX":
      return object.x + object.width / 2;
    case "right":
      return object.x + object.width;
    case "top":
      return object.y;
    case "centerY":
      return object.y + object.height / 2;
    case "bottom":
      return object.y + object.height;
  }
}

function getAlignedPosition(object: CanvasObject, axis: AlignAxis, target: number) {
  switch (axis) {
    case "left":
      return { x: target, y: object.y };
    case "centerX":
      return { x: target - object.width / 2, y: object.y };
    case "right":
      return { x: target - object.width, y: object.y };
    case "top":
      return { x: object.x, y: target };
    case "centerY":
      return { x: object.x, y: target - object.height / 2 };
    case "bottom":
      return { x: object.x, y: target - object.height };
  }
}

function applyObjectPosition(
  document: CanvasDocument,
  changes: CanvasCommandChange[],
  object: CanvasObject,
  x: number,
  y: number,
) {
  changeField(changes, object, "x", x);
  changeField(changes, object, "y", y);
  if (object.x === x && object.y === y) return document;
  return replaceObject(document, object.id, { ...object, x, y });
}

function isGuideAlignmentMovableObject(object: CanvasObject): object is ImageObject {
  return object.kind === "image" && (object.role === undefined || object.role === "image");
}

function findGuideAlignmentMark(
  marks: readonly ResolvedGuideAlignmentMark[],
  input: {
    readonly objectId: string;
    readonly markId: string;
    readonly guideSidecarId?: string;
  },
) {
  return marks.filter(
    (mark) =>
      mark.targetObjectId === input.objectId &&
      mark.markId === input.markId &&
      (input.guideSidecarId === undefined || mark.guideSidecarId === input.guideSidecarId),
  );
}

function applyAlignCommand(
  document: CanvasDocument,
  command: Extract<CanvasCommand, { kind: "align" }>,
  changes: CanvasCommandChange[],
) {
  const anchor = document.objects[command.ids[0]];
  if (anchor === undefined) return document;

  const target = getAlignValue(anchor, command.axis);
  let nextDocument = document;

  for (const objectId of command.ids.slice(1)) {
    const object = nextDocument.objects[objectId];
    if (object === undefined) continue;
    const position = getAlignedPosition(object, command.axis, target);
    nextDocument = applyObjectPosition(nextDocument, changes, object, position.x, position.y);
  }

  return nextDocument;
}

function applyAlignToGridCommand(
  document: CanvasDocument,
  command: Extract<CanvasCommand, { kind: "alignToGrid" }>,
  changes: CanvasCommandChange[],
  context?: CanvasCommandApplyContext,
) {
  const point = gridPointRefToCanvasPoint(
    command.ref,
    document.width,
    document.height,
    context?.referenceGrid ?? document.referenceGrid,
  );
  const target = ["left", "centerX", "right"].includes(command.axis) ? point.x : point.y;
  let nextDocument = document;

  for (const objectId of command.ids) {
    const object = nextDocument.objects[objectId];
    if (object === undefined) continue;
    const position = getAlignedPosition(object, command.axis, target);
    nextDocument = applyObjectPosition(nextDocument, changes, object, position.x, position.y);
  }

  return nextDocument;
}

function applyDistributeCommand(
  document: CanvasDocument,
  command: Extract<CanvasCommand, { kind: "distribute" }>,
  changes: CanvasCommandChange[],
) {
  const axisField = command.axis === "horizontal" ? "x" : "y";
  const sizeField = command.axis === "horizontal" ? "width" : "height";
  const objects = command.ids
    .map((id) => document.objects[id])
    .filter((object): object is CanvasObject => object !== undefined)
    .sort((a, b) => a[axisField] - b[axisField]);

  if (objects.length < 2) return document;

  let nextDocument = document;
  if (command.gap !== undefined) {
    let cursor = objects[0][axisField];
    for (const object of objects) {
      const x = command.axis === "horizontal" ? cursor : object.x;
      const y = command.axis === "vertical" ? cursor : object.y;
      nextDocument = applyObjectPosition(nextDocument, changes, object, x, y);
      cursor += object[sizeField] + command.gap;
    }
    return nextDocument;
  }

  if (objects.length === 2) return document;

  const first = objects[0];
  const last = objects[objects.length - 1];
  const innerObjects = objects.slice(1, -1);
  const totalInnerSize = innerObjects.reduce((total, object) => total + object[sizeField], 0);
  const availableGap = last[axisField] - (first[axisField] + first[sizeField]) - totalInnerSize;
  const gap = availableGap / (objects.length - 1);
  let cursor = first[axisField] + first[sizeField] + gap;

  for (const object of innerObjects) {
    const x = command.axis === "horizontal" ? cursor : object.x;
    const y = command.axis === "vertical" ? cursor : object.y;
    nextDocument = applyObjectPosition(nextDocument, changes, object, x, y);
    cursor += object[sizeField] + gap;
  }

  return nextDocument;
}

function messageFor(command: CanvasCommand, changes: CanvasCommandChange[]) {
  if (command.kind === "alignObjectByGuideMarks") {
    return changes.length === 0
      ? `GuideAlignmentNoop: ${command.sourceObjectId} was already aligned to ${command.targetObjectId}.`
      : `Aligned ${command.sourceObjectId} to ${command.targetObjectId} by guide marks.`;
  }
  if (command.kind === "addImageObject") {
    return changes.length === 0
      ? `Image object ${command.object.id} was already present.`
      : `Added image object ${command.object.id}.`;
  }
  if (command.kind === "addSpriteSidecarObject") {
    return changes.length === 0
      ? `Sprite sidecar ${command.object.id} was already present.`
      : `Added sprite sidecar ${command.object.id}.`;
  }
  if (command.kind === "addGuideSidecarObject") {
    return changes.length === 0
      ? `Guide sidecar ${command.object.id} was already present.`
      : `Added guide sidecar ${command.object.id}.`;
  }
  if (command.kind === "addBlockoutSidecarObject") {
    return changes.length === 0
      ? `Blockout sidecar ${command.object.id} was already present.`
      : `Added blockout sidecar ${command.object.id}.`;
  }
  if (command.kind === "removeObject") {
    return changes.length === 0
      ? `Object ${command.id} was not removed.`
      : `Removed object ${command.id}.`;
  }
  if (command.kind === "attachAlphaMap") {
    return changes.length === 0
      ? `Alpha map ${command.alphaId} was already attached to ${command.sourceId}.`
      : `Attached alpha map ${command.alphaId} to ${command.sourceId}.`;
  }
  if (command.kind === "detachAlphaMap") {
    return changes.length === 0
      ? `No alpha map was attached to ${command.sourceId}.`
      : `Detached alpha map from ${command.sourceId}.`;
  }
  if (command.kind === "attachSketchOverlay") {
    return changes.length === 0
      ? `Sketch overlay ${command.overlayId} was already attached to ${command.sourceId}.`
      : `Attached sketch overlay ${command.overlayId} to ${command.sourceId}.`;
  }
  if (command.kind === "detachSketchOverlay") {
    return changes.length === 0
      ? `No sketch overlay was attached to ${command.sourceId}.`
      : `Detached sketch overlay from ${command.sourceId}.`;
  }
  if (command.kind === "setSketchOverlayVisible") {
    return changes.length === 0
      ? `Sketch overlay ${command.overlayId} visibility was already ${command.visible}.`
      : `Set sketch overlay ${command.overlayId} visible ${command.visible}.`;
  }
  if (command.kind === "attachGuideSidecar") {
    return changes.length === 0
      ? `Guide sidecar ${command.guideId} was already attached to ${command.sourceId}.`
      : `Attached guide sidecar ${command.guideId} to ${command.sourceId}.`;
  }
  if (command.kind === "detachGuideSidecar") {
    return changes.length === 0
      ? `Guide sidecar ${command.guideId} was already detached.`
      : `Detached guide sidecar ${command.guideId}.`;
  }
  if (command.kind === "setGuideSidecarVisible") {
    return changes.length === 0
      ? `Guide sidecar ${command.guideId} visibility was already ${command.visible}.`
      : `Set guide sidecar ${command.guideId} visible ${command.visible}.`;
  }
  if (command.kind === "setGuideSidecarOpacity") {
    return changes.length === 0
      ? `Guide sidecar ${command.guideId} opacity was already ${command.opacity}.`
      : `Set guide sidecar ${command.guideId} opacity ${command.opacity}.`;
  }
  if (command.kind === "attachBlockoutSidecar") {
    return changes.length === 0
      ? `Blockout sidecar ${command.blockoutId} was already attached to ${command.targetObjectId}.`
      : `Attached blockout sidecar ${command.blockoutId} to ${command.targetObjectId}.`;
  }
  if (command.kind === "detachBlockoutSidecar") {
    return changes.length === 0
      ? `Blockout sidecar ${command.blockoutId} was already detached.`
      : `Detached blockout sidecar ${command.blockoutId}.`;
  }
  if (command.kind === "setBlockoutSidecarVisible") {
    return changes.length === 0
      ? `Blockout sidecar ${command.blockoutId} visibility was already ${command.visible}.`
      : `Set blockout sidecar ${command.blockoutId} visible ${command.visible}.`;
  }
  if (command.kind === "setBlockoutSidecarOpacity") {
    return changes.length === 0
      ? `Blockout sidecar ${command.blockoutId} opacity was already ${command.opacity}.`
      : `Set blockout sidecar ${command.blockoutId} opacity ${command.opacity}.`;
  }
  if (command.kind === "attachSpriteSidecar") {
    return changes.length === 0
      ? `Sprite sidecar ${command.sidecarId} was already attached to ${command.sourceId}.`
      : `Attached sprite sidecar ${command.sidecarId} to ${command.sourceId}.`;
  }
  if (command.kind === "detachSpriteSidecar") {
    return changes.length === 0
      ? `No sprite sidecar was attached to ${command.sourceId}.`
      : `Detached sprite sidecar from ${command.sourceId}.`;
  }
  if (command.kind === "setSpriteSidecarVisible") {
    return changes.length === 0
      ? `Sprite sidecar ${command.sidecarId} visibility was already ${command.visible}.`
      : `Set sprite sidecar ${command.sidecarId} visible ${command.visible}.`;
  }
  if (command.kind === "setSpriteOverlayOption") {
    return changes.length === 0
      ? `Sprite overlay ${command.option} was already ${command.value}.`
      : `Set sprite overlay ${command.option} to ${command.value}.`;
  }
  if (command.kind === "setSpriteOverlayDisplayMode") {
    return changes.length === 0
      ? `Sprite overlay mode was already ${command.mode}.`
      : `Set sprite overlay mode to ${command.mode}.`;
  }
  if (command.kind === "selectSpriteFrame") {
    return changes.length === 0
      ? `Sprite frame selection was already ${command.frameId ?? "none"}.`
      : `Selected sprite frame ${command.frameId ?? "none"}.`;
  }
  if (command.kind === "updateSpriteFrameRect") {
    return changes.length === 0
      ? `Sprite frame ${command.frameId} rect was already current.`
      : `Updated sprite frame ${command.frameId} to x=${command.rect.x} y=${command.rect.y} w=${command.rect.width} h=${command.rect.height}.`;
  }
  if (command.kind === "nudgeSpriteFrame") {
    return changes.length === 0
      ? `Sprite frame ${command.frameId} did not move.`
      : `Moved sprite frame ${command.frameId} by dx=${command.dx} dy=${command.dy}.`;
  }
  if (command.kind === "resizeSpriteFrame") {
    return changes.length === 0
      ? `Sprite frame ${command.frameId} size was unchanged.`
      : `Resized sprite frame ${command.frameId} by dw=${command.dw} dh=${command.dh}.`;
  }
  if (command.kind === "clampSpriteFrameToGuideRegion") {
    return changes.length === 0
      ? `No guide region found for selected frame.`
      : `Clamped sprite frame ${command.frameId} to its guide region.`;
  }
  if (command.kind === "snapSpriteFrameToDatum") {
    return changes.length === 0
      ? `No matching datum target found for sprite frame ${command.frameId}.`
      : `Snapped sprite frame ${command.frameId} to datum ${command.datumId ?? "nearest"}.`;
  }
  if (command.kind === "snapSpriteFrameToNearestDatum") {
    return changes.length === 0
      ? `No nearby datum target found for sprite frame ${command.frameId}.`
      : `Snapped sprite frame ${command.frameId} to its nearest datum.`;
  }
  if (changes.length === 0) return `${command.kind} made no geometry changes.`;
  if (command.kind === "moveToGrid") {
    return `Moved ${command.id} ${command.anchor ?? "center"} to ${command.ref}.`;
  }
  if (command.kind === "alignToGrid") {
    return `Aligned ${command.ids.length} object${command.ids.length === 1 ? "" : "s"} ${command.axis} to ${command.ref}.`;
  }
  if (command.kind === "resizeToGridSpan") {
    return `Resized ${command.id} to span ${command.span}.`;
  }
  if (command.kind === "setFrame") {
    return `Set ${command.id} frame to ${command.frame.kind}.`;
  }
  const objectCount = new Set(changes.map((change) => change.objectId)).size;
  return `${command.kind} changed ${changes.length} field${changes.length === 1 ? "" : "s"} on ${objectCount} object${objectCount === 1 ? "" : "s"}.`;
}

export function alignObjectByGuideMarks(
  scene: CanvasDocument,
  input: {
    readonly sourceObjectId: string;
    readonly sourceMarkId: string;
    readonly targetObjectId: string;
    readonly targetMarkId: string;
    readonly sourceGuideSidecarId?: string;
    readonly targetGuideSidecarId?: string;
  },
): AlignObjectByGuideMarksResult {
  const sourceObject = scene.objects[input.sourceObjectId];
  if (!sourceObject) {
    return {
      document: scene,
      ok: false,
      message: `Source object "${input.sourceObjectId}" does not exist.`,
    };
  }
  const sourceImageObject = sourceObject.kind === "image" ? sourceObject : undefined;
  if (!isGuideAlignmentMovableObject(sourceObject)) {
    const message =
      sourceImageObject &&
      (sourceImageObject.role === "alphaMap" || sourceImageObject.role === "mask")
        ? "UnsupportedGuideAlignmentTransform: alpha masks still render using the parent image transform."
        : `UnsupportedGuideAlignmentTransform: ${sourceObject.kind} objects do not have an independent rendered transform for guide alignment.`;
    return { document: scene, ok: false, message };
  }
  if (!scene.objects[input.targetObjectId]) {
    return {
      document: scene,
      ok: false,
      message: `Target object "${input.targetObjectId}" does not exist.`,
    };
  }

  const resolvedMarks = resolveGuideAlignmentMarks(scene);
  const sourceMarks = findGuideAlignmentMark(resolvedMarks, {
    objectId: input.sourceObjectId,
    markId: input.sourceMarkId,
    guideSidecarId: input.sourceGuideSidecarId,
  });
  if (sourceMarks.length === 0) {
    return {
      document: scene,
      ok: false,
      message: `MissingGuideAlignmentMark: source mark "${input.sourceMarkId}" was not found for "${input.sourceObjectId}".`,
    };
  }
  if (sourceMarks.length > 1) {
    return {
      document: scene,
      ok: false,
      message: `AmbiguousGuideAlignmentMark: source mark "${input.sourceMarkId}" is ambiguous for "${input.sourceObjectId}".`,
    };
  }

  const targetMarks = findGuideAlignmentMark(resolvedMarks, {
    objectId: input.targetObjectId,
    markId: input.targetMarkId,
    guideSidecarId: input.targetGuideSidecarId,
  });
  if (targetMarks.length === 0) {
    return {
      document: scene,
      ok: false,
      message: `MissingGuideAlignmentMark: target mark "${input.targetMarkId}" was not found for "${input.targetObjectId}".`,
    };
  }
  if (targetMarks.length > 1) {
    return {
      document: scene,
      ok: false,
      message: `AmbiguousGuideAlignmentMark: target mark "${input.targetMarkId}" is ambiguous for "${input.targetObjectId}".`,
    };
  }

  const translation = computeGuideAlignmentTranslation({
    sourceMark: sourceMarks[0],
    targetMark: targetMarks[0],
  });
  if (translation.dx === 0 && translation.dy === 0) {
    return {
      document: scene,
      ok: true,
      message: `GuideAlignmentNoop: ${input.sourceObjectId} is already aligned to ${input.targetObjectId}.`,
      translation,
    };
  }

  return {
    document: replaceObject(scene, sourceObject.id, {
      ...sourceObject,
      x: sourceObject.x + translation.dx,
      y: sourceObject.y + translation.dy,
    }),
    ok: true,
    message: `Aligned ${input.sourceObjectId} by dx=${translation.dx}, dy=${translation.dy}.`,
    translation,
  };
}

export function applyCanvasCommand(
  document: CanvasDocument,
  command: CanvasCommand,
  context?: CanvasCommandApplyContext,
): CanvasCommandApplyResult {
  const changes: CanvasCommandChange[] = [];
  let nextDocument = document;

  if (command.kind === "alignObjectByGuideMarks") {
    const result = alignObjectByGuideMarks(document, command);
    if (!result.ok) {
      return { document, command, changes, message: result.message };
    }
    const object = document.objects[command.sourceObjectId];
    const moved = result.document.objects[command.sourceObjectId];
    if (object && moved) {
      changeField(changes, object, "x", moved.x);
      changeField(changes, object, "y", moved.y);
    }
    return {
      document: result.document,
      command,
      changes,
      message:
        changes.length === 0
          ? result.message
          : `${result.message} (${messageFor(command, changes)})`,
    };
  }

  if (command.kind === "addImageObject") {
    if (document.objects[command.object.id] !== undefined) {
      return {
        document,
        command,
        changes,
        message: `addImageObject skipped duplicate object "${command.object.id}".`,
      };
    }

    const layerExists = document.layers.some((layer) => layer.id === command.object.layerId);
    if (!layerExists || command.object.kind !== "image" || command.object.src.length === 0) {
      return {
        document,
        command,
        changes,
        message: `addImageObject skipped invalid image object "${command.object.id}".`,
      };
    }

    changes.push({
      objectId: command.object.id,
      field: "objects",
      before: undefined,
      after: command.object,
    });
    changes.push({
      objectId: command.object.id,
      field: "layer.objectIds",
      before: undefined,
      after: command.object.id,
    });
    if (document.selectedObjectId !== command.object.id) {
      changes.push({
        objectId: command.object.id,
        field: "selectedObjectId",
        before: document.selectedObjectId,
        after: command.object.id,
      });
    }

    nextDocument = {
      ...document,
      selectedObjectId: command.object.id,
      objects: {
        ...document.objects,
        [command.object.id]: command.object,
      },
      layers: document.layers.map((layer) =>
        layer.id === command.object.layerId
          ? { ...layer, objectIds: [...layer.objectIds, command.object.id] }
          : layer,
      ),
    };

    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "addBlockoutSidecarObject") {
    if (document.objects[command.object.id] !== undefined) {
      return {
        document,
        command,
        changes,
        message: `addBlockoutSidecarObject skipped duplicate object "${command.object.id}".`,
      };
    }

    const layerExists = document.layers.some((layer) => layer.id === command.object.layerId);
    const target = command.object.targetObjectId
      ? document.objects[command.object.targetObjectId]
      : undefined;
    if (!layerExists || command.object.kind !== "blockoutSidecar" || (command.attach && !target)) {
      return {
        document,
        command,
        changes,
        message: `addBlockoutSidecarObject skipped invalid blockout sidecar "${command.object.id}".`,
      };
    }

    const nextObject =
      command.attach && target
        ? createBlockoutSidecarObject(target, command.object.blockout, {
            id: command.object.id,
            layerId: command.object.layerId,
            name: command.object.name,
          })
        : command.object;

    changes.push({
      objectId: nextObject.id,
      field: "objects",
      before: undefined,
      after: nextObject,
    });
    changes.push({
      objectId: nextObject.id,
      field: "layer.objectIds",
      before: undefined,
      after: nextObject.id,
    });
    changes.push({
      objectId: nextObject.id,
      field: "selectedObjectId",
      before: document.selectedObjectId,
      after: nextObject.id,
    });

    nextDocument = {
      ...document,
      selectedObjectId: nextObject.id,
      objects: {
        ...document.objects,
        [nextObject.id]: nextObject,
      },
      layers: document.layers.map((layer) =>
        layer.id === nextObject.layerId
          ? { ...layer, objectIds: [...layer.objectIds, nextObject.id] }
          : layer,
      ),
    };

    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "addGuideSidecarObject") {
    if (document.objects[command.object.id] !== undefined) {
      return {
        document,
        command,
        changes,
        message: `addGuideSidecarObject skipped duplicate object "${command.object.id}".`,
      };
    }

    const layerExists = document.layers.some((layer) => layer.id === command.object.layerId);
    const target = command.object.targetId ? document.objects[command.object.targetId] : undefined;
    const targetImage = target?.kind === "image" ? target : undefined;
    if (
      !layerExists ||
      command.object.kind !== "guideSidecar" ||
      (command.attach && !targetImage)
    ) {
      return {
        document,
        command,
        changes,
        message: `addGuideSidecarObject skipped invalid guide sidecar "${command.object.id}".`,
      };
    }

    const nextObject =
      command.attach && targetImage
        ? {
            ...command.object,
            targetId: targetImage.id,
            guide: { ...command.object.guide, target: targetImage.id },
          }
        : command.object;

    changes.push({
      objectId: nextObject.id,
      field: "objects",
      before: undefined,
      after: nextObject,
    });
    changes.push({
      objectId: nextObject.id,
      field: "layer.objectIds",
      before: undefined,
      after: nextObject.id,
    });
    changes.push({
      objectId: nextObject.id,
      field: "selectedObjectId",
      before: document.selectedObjectId,
      after: nextObject.id,
    });

    nextDocument = {
      ...document,
      selectedObjectId: nextObject.id,
      objects: {
        ...document.objects,
        [nextObject.id]: nextObject,
      },
      layers: document.layers.map((layer) =>
        layer.id === nextObject.layerId
          ? { ...layer, objectIds: [...layer.objectIds, nextObject.id] }
          : layer,
      ),
    };

    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "addSpriteSidecarObject") {
    if (document.objects[command.object.id] !== undefined) {
      return {
        document,
        command,
        changes,
        message: `addSpriteSidecarObject skipped duplicate object "${command.object.id}".`,
      };
    }

    const layerExists = document.layers.some((layer) => layer.id === command.object.layerId);
    const target = command.object.targetId ? document.objects[command.object.targetId] : undefined;
    const targetImage = target?.kind === "image" ? target : undefined;
    if (
      !layerExists ||
      command.object.kind !== "spriteSidecar" ||
      (command.attach && !targetImage)
    ) {
      return {
        document,
        command,
        changes,
        message: `addSpriteSidecarObject skipped invalid sprite sidecar "${command.object.id}".`,
      };
    }

    changes.push({
      objectId: command.object.id,
      field: "objects",
      before: undefined,
      after: command.object,
    });
    changes.push({
      objectId: command.object.id,
      field: "layer.objectIds",
      before: undefined,
      after: command.object.id,
    });
    if (command.attach && targetImage) {
      changes.push({
        objectId: targetImage.id,
        field: "spriteSidecarId",
        before: targetImage.spriteSidecarId,
        after: command.object.id,
      });
    }
    changes.push({
      objectId: command.object.id,
      field: "selectedObjectId",
      before: document.selectedObjectId,
      after: command.object.id,
    });

    const nextObjects: Record<string, CanvasObject> = {
      ...document.objects,
      [command.object.id]: command.object,
    };
    if (command.attach && targetImage) {
      nextObjects[targetImage.id] = { ...targetImage, spriteSidecarId: command.object.id };
    }

    nextDocument = {
      ...document,
      selectedObjectId: command.object.id,
      objects: nextObjects,
      layers: document.layers.map((layer) =>
        layer.id === command.object.layerId
          ? { ...layer, objectIds: [...layer.objectIds, command.object.id] }
          : layer,
      ),
    };

    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "setUiProp") {
    const object = document.objects[command.id];
    if (object?.kind !== "uiComponent") {
      return {
        document,
        command,
        changes,
        message: `setUiProp skipped invalid UI component object "${command.id}".`,
      };
    }

    const before = object.props[command.prop];
    if (before !== command.value) {
      changes.push({
        objectId: object.id,
        field: `props.${command.prop}`,
        before,
        after: command.value,
      });
      nextDocument = replaceObject(document, object.id, {
        ...object,
        props: { ...object.props, [command.prop]: command.value },
      });
    }

    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "removeObject") {
    const removedObject = document.objects[command.id];
    if (removedObject === undefined) {
      return {
        document,
        command,
        changes,
        message: `removeObject skipped missing object "${command.id}".`,
      };
    }

    const nextObjects = { ...document.objects };
    delete nextObjects[command.id];
    for (const [objectId, object] of Object.entries(nextObjects)) {
      if (object.kind === "image" && object.alphaMapId === command.id) {
        const { alphaMapId: _alphaMapId, ...nextObject } = object;
        nextObjects[objectId] = nextObject;
        changes.push({
          objectId,
          field: "alphaMapId",
          before: command.id,
          after: undefined,
        });
      }
      if (object.kind === "image" && object.sketchOverlayId === command.id) {
        const { sketchOverlayId: _sketchOverlayId, ...nextObject } = object;
        nextObjects[objectId] = nextObject;
        changes.push({
          objectId,
          field: "sketchOverlayId",
          before: command.id,
          after: undefined,
        });
      }
      if (object.kind === "image" && object.spriteSidecarId === command.id) {
        const { spriteSidecarId: _spriteSidecarId, ...nextObject } = object;
        nextObjects[objectId] = nextObject;
        changes.push({
          objectId,
          field: "spriteSidecarId",
          before: command.id,
          after: undefined,
        });
      }
      if (object.kind === "sketchOverlay" && object.targetId === command.id) {
        nextObjects[objectId] = {
          ...object,
          targetId: undefined,
          spec: { ...object.spec, targetId: undefined },
        };
      }
      if (object.kind === "spriteSidecar" && object.targetId === command.id) {
        nextObjects[objectId] = {
          ...object,
          targetId: undefined,
          spec: { ...object.spec, targetId: undefined },
        };
      }
      if (object.kind === "guideSidecar" && object.targetId === command.id) {
        nextObjects[objectId] = {
          ...object,
          targetId: undefined,
          guide: { ...object.guide, target: undefined },
        };
      }
      if (object.kind === "blockoutSidecar" && object.targetObjectId === command.id) {
        nextObjects[objectId] = {
          ...object,
          targetObjectId: undefined,
        };
      }
    }

    changes.push({
      objectId: command.id,
      field: "objects",
      before: removedObject,
      after: undefined,
    });

    const nextLayers = document.layers.map((layer) => {
      if (!layer.objectIds.includes(command.id)) return layer;
      changes.push({
        objectId: command.id,
        field: "layer.objectIds",
        before: command.id,
        after: undefined,
      });
      return { ...layer, objectIds: layer.objectIds.filter((objectId) => objectId !== command.id) };
    });

    if (document.selectedObjectId === command.id) {
      changes.push({
        objectId: command.id,
        field: "selectedObjectId",
        before: command.id,
        after: undefined,
      });
    }

    nextDocument = {
      ...document,
      objects: nextObjects,
      layers: nextLayers,
      layerGroups: document.layerGroups?.map((group) => ({
        ...group,
        objectIds: group.objectIds.filter((objectId) => objectId !== command.id),
      })),
      selectedObjectId:
        document.selectedObjectId === command.id ? undefined : document.selectedObjectId,
    };

    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "select") {
    if (command.id !== undefined && document.objects[command.id] === undefined) {
      return {
        document,
        command,
        changes,
        message: `select skipped missing object "${command.id}".`,
      };
    }

    if (document.selectedObjectId !== command.id) {
      changes.push({
        objectId: command.id ?? document.id,
        field: "selectedObjectId",
        before: document.selectedObjectId,
        after: command.id,
      });
      nextDocument = { ...document, selectedObjectId: command.id };
    }

    return {
      document: nextDocument,
      command,
      changes,
      message: command.id === undefined ? "Selected document." : `Selected ${command.id}.`,
    };
  }

  if (command.kind === "align") {
    nextDocument = applyAlignCommand(document, command, changes);
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "distribute") {
    nextDocument = applyDistributeCommand(document, command, changes);
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "alignToGrid") {
    nextDocument = applyAlignToGridCommand(document, command, changes, context);
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "attachAlphaMap") {
    const source = document.objects[command.sourceId];
    if (source?.kind !== "image") {
      return {
        document,
        command,
        changes,
        message: `attachAlphaMap skipped invalid image object "${command.sourceId}".`,
      };
    }
    changeField(changes, source, "alphaMapId", command.alphaId);
    if (changes.length > 0) {
      nextDocument = replaceObject(document, source.id, { ...source, alphaMapId: command.alphaId });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "detachAlphaMap") {
    const source = document.objects[command.sourceId];
    if (source?.kind !== "image") {
      return {
        document,
        command,
        changes,
        message: `detachAlphaMap skipped invalid image object "${command.sourceId}".`,
      };
    }
    changeField(changes, source, "alphaMapId", undefined);
    if (changes.length > 0) {
      const { alphaMapId: _alphaMapId, ...nextSource } = source;
      nextDocument = replaceObject(document, source.id, nextSource);
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "attachSketchOverlay") {
    const source = document.objects[command.sourceId];
    const overlay = document.objects[command.overlayId];
    if (source?.kind !== "image") {
      return {
        document,
        command,
        changes,
        message: `attachSketchOverlay skipped invalid image object "${command.sourceId}".`,
      };
    }
    changeField(changes, source, "sketchOverlayId", command.overlayId);
    let nextScene = document;
    if (changes.length > 0) {
      nextScene = replaceObject(nextScene, source.id, {
        ...source,
        sketchOverlayId: command.overlayId,
      });
    }
    if (overlay?.kind === "sketchOverlay") {
      changeField(changes, overlay, "targetId", source.id);
      if (overlay.targetId !== source.id || overlay.spec.targetId !== source.id) {
        nextScene = replaceObject(nextScene, overlay.id, {
          ...overlay,
          targetId: source.id,
          spec: { ...overlay.spec, targetId: source.id },
        });
      }
    }
    return { document: nextScene, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "detachSketchOverlay") {
    const source = document.objects[command.sourceId];
    const overlayId = source?.kind === "image" ? source.sketchOverlayId : undefined;
    const overlay = overlayId ? document.objects[overlayId] : undefined;
    if (source?.kind !== "image") {
      return {
        document,
        command,
        changes,
        message: `detachSketchOverlay skipped invalid image object "${command.sourceId}".`,
      };
    }
    changeField(changes, source, "sketchOverlayId", undefined);
    let nextScene = document;
    if (changes.length > 0) {
      const { sketchOverlayId: _sketchOverlayId, ...nextSource } = source;
      nextScene = replaceObject(nextScene, source.id, nextSource);
    }
    if (overlay?.kind === "sketchOverlay") {
      changeField(changes, overlay, "targetId", undefined);
      if (overlay.targetId !== undefined || overlay.spec.targetId !== undefined) {
        nextScene = replaceObject(nextScene, overlay.id, {
          ...overlay,
          targetId: undefined,
          spec: { ...overlay.spec, targetId: undefined },
        });
      }
    }
    return { document: nextScene, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "setSketchOverlayVisible") {
    const overlay = document.objects[command.overlayId];
    if (overlay?.kind !== "sketchOverlay") {
      return {
        document,
        command,
        changes,
        message: `setSketchOverlayVisible skipped invalid sketch overlay "${command.overlayId}".`,
      };
    }
    changeField(changes, overlay, "visible", command.visible);
    if (changes.length > 0) {
      nextDocument = replaceObject(document, overlay.id, { ...overlay, visible: command.visible });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "attachGuideSidecar") {
    const source = document.objects[command.sourceId];
    const guide = document.objects[command.guideId];
    if (source?.kind !== "image") {
      return {
        document,
        command,
        changes,
        message: `attachGuideSidecar skipped invalid image object "${command.sourceId}".`,
      };
    }
    if (guide?.kind !== "guideSidecar") {
      return {
        document,
        command,
        changes,
        message: `attachGuideSidecar skipped invalid guide sidecar "${command.guideId}".`,
      };
    }
    changeField(changes, guide, "targetId", source.id);
    if (guide.targetId !== source.id || guide.guide.target !== source.id) {
      nextDocument = replaceObject(document, guide.id, {
        ...guide,
        targetId: source.id,
        guide: { ...guide.guide, target: source.id },
      });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "detachGuideSidecar") {
    const guide = document.objects[command.guideId];
    if (guide?.kind !== "guideSidecar") {
      return {
        document,
        command,
        changes,
        message: `detachGuideSidecar skipped invalid guide sidecar "${command.guideId}".`,
      };
    }
    changeField(changes, guide, "targetId", undefined);
    if (guide.targetId !== undefined || guide.guide.target !== undefined) {
      nextDocument = replaceObject(document, guide.id, {
        ...guide,
        targetId: undefined,
        guide: { ...guide.guide, target: undefined },
      });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "setGuideSidecarVisible") {
    const guide = document.objects[command.guideId];
    if (guide?.kind !== "guideSidecar") {
      return {
        document,
        command,
        changes,
        message: `setGuideSidecarVisible skipped invalid guide sidecar "${command.guideId}".`,
      };
    }
    changeField(changes, guide, "visible", command.visible);
    if (changes.length > 0) {
      nextDocument = replaceObject(document, guide.id, { ...guide, visible: command.visible });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "setGuideSidecarOpacity") {
    const guide = document.objects[command.guideId];
    if (guide?.kind !== "guideSidecar") {
      return {
        document,
        command,
        changes,
        message: `setGuideSidecarOpacity skipped invalid guide sidecar "${command.guideId}".`,
      };
    }
    changeField(changes, guide, "opacity", command.opacity);
    if (changes.length > 0) {
      nextDocument = replaceObject(document, guide.id, { ...guide, opacity: command.opacity });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "attachBlockoutSidecar") {
    const target = document.objects[command.targetObjectId];
    const blockout = document.objects[command.blockoutId];
    if (!target) {
      return {
        document,
        command,
        changes,
        message: `attachBlockoutSidecar skipped invalid target object "${command.targetObjectId}".`,
      };
    }
    if (blockout?.kind !== "blockoutSidecar") {
      return {
        document,
        command,
        changes,
        message: `attachBlockoutSidecar skipped invalid blockout sidecar "${command.blockoutId}".`,
      };
    }
    changeField(changes, blockout, "targetObjectId", target.id);
    if (blockout.targetObjectId !== target.id) {
      nextDocument = replaceObject(document, blockout.id, {
        ...blockout,
        targetObjectId: target.id,
      });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "detachBlockoutSidecar") {
    const blockout = document.objects[command.blockoutId];
    if (blockout?.kind !== "blockoutSidecar") {
      return {
        document,
        command,
        changes,
        message: `detachBlockoutSidecar skipped invalid blockout sidecar "${command.blockoutId}".`,
      };
    }
    changeField(changes, blockout, "targetObjectId", undefined);
    if (blockout.targetObjectId !== undefined) {
      nextDocument = replaceObject(document, blockout.id, {
        ...blockout,
        targetObjectId: undefined,
      });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "setBlockoutSidecarVisible") {
    const blockout = document.objects[command.blockoutId];
    if (blockout?.kind !== "blockoutSidecar") {
      return {
        document,
        command,
        changes,
        message: `setBlockoutSidecarVisible skipped invalid blockout sidecar "${command.blockoutId}".`,
      };
    }
    changeField(changes, blockout, "visible", command.visible);
    if (changes.length > 0) {
      nextDocument = replaceObject(document, blockout.id, {
        ...blockout,
        visible: command.visible,
      });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "setBlockoutSidecarOpacity") {
    const blockout = document.objects[command.blockoutId];
    if (blockout?.kind !== "blockoutSidecar") {
      return {
        document,
        command,
        changes,
        message: `setBlockoutSidecarOpacity skipped invalid blockout sidecar "${command.blockoutId}".`,
      };
    }
    changeField(changes, blockout, "opacity", command.opacity);
    if (changes.length > 0) {
      nextDocument = replaceObject(document, blockout.id, {
        ...blockout,
        opacity: command.opacity,
      });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "attachSpriteSidecar") {
    const source = document.objects[command.sourceId];
    const sidecar = document.objects[command.sidecarId];
    if (source?.kind !== "image") {
      return {
        document,
        command,
        changes,
        message: `attachSpriteSidecar skipped invalid image object "${command.sourceId}".`,
      };
    }
    changeField(changes, source, "spriteSidecarId", command.sidecarId);
    let nextScene = document;
    if (changes.length > 0) {
      nextScene = replaceObject(nextScene, source.id, {
        ...source,
        spriteSidecarId: command.sidecarId,
      });
    }
    if (sidecar?.kind === "spriteSidecar") {
      changeField(changes, sidecar, "targetId", source.id);
      if (sidecar.targetId !== source.id || sidecar.spec.targetId !== source.id) {
        nextScene = replaceObject(nextScene, sidecar.id, {
          ...sidecar,
          targetId: source.id,
          spec: { ...sidecar.spec, targetId: source.id },
        });
      }
    }
    return { document: nextScene, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "detachSpriteSidecar") {
    const source = document.objects[command.sourceId];
    const sidecarId = source?.kind === "image" ? source.spriteSidecarId : undefined;
    const sidecar = sidecarId ? document.objects[sidecarId] : undefined;
    if (source?.kind !== "image") {
      return {
        document,
        command,
        changes,
        message: `detachSpriteSidecar skipped invalid image object "${command.sourceId}".`,
      };
    }
    changeField(changes, source, "spriteSidecarId", undefined);
    let nextScene = document;
    if (changes.length > 0) {
      const { spriteSidecarId: _spriteSidecarId, ...nextSource } = source;
      nextScene = replaceObject(nextScene, source.id, nextSource);
    }
    if (sidecar?.kind === "spriteSidecar") {
      changeField(changes, sidecar, "targetId", undefined);
      if (sidecar.targetId !== undefined || sidecar.spec.targetId !== undefined) {
        nextScene = replaceObject(nextScene, sidecar.id, {
          ...sidecar,
          targetId: undefined,
          spec: { ...sidecar.spec, targetId: undefined },
        });
      }
    }
    return { document: nextScene, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "setSpriteSidecarVisible") {
    const sidecar = document.objects[command.sidecarId];
    if (sidecar?.kind !== "spriteSidecar") {
      return {
        document,
        command,
        changes,
        message: `setSpriteSidecarVisible skipped invalid sprite sidecar "${command.sidecarId}".`,
      };
    }
    changeField(changes, sidecar, "visible", command.visible);
    if (changes.length > 0) {
      nextDocument = replaceObject(document, sidecar.id, { ...sidecar, visible: command.visible });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "setSpriteOverlayOption") {
    const sidecar = document.objects[command.sidecarId];
    if (sidecar?.kind !== "spriteSidecar") {
      return {
        document,
        command,
        changes,
        message: `setSpriteOverlayOption skipped invalid sprite sidecar "${command.sidecarId}".`,
      };
    }
    const before = sidecar.spec.overlay[command.option];
    if (before !== command.value) {
      changes.push({
        objectId: sidecar.id,
        field: `spec.overlay.${command.option}`,
        before,
        after: command.value,
      });
      nextDocument = replaceObject(document, sidecar.id, {
        ...sidecar,
        spec: {
          ...sidecar.spec,
          overlay: { ...sidecar.spec.overlay, [command.option]: command.value },
        },
      });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "setSpriteOverlayDisplayMode") {
    const sidecar = document.objects[command.sidecarId];
    if (sidecar?.kind !== "spriteSidecar") {
      return {
        document,
        command,
        changes,
        message: `setSpriteOverlayDisplayMode skipped invalid sprite sidecar "${command.sidecarId}".`,
      };
    }
    const before = sidecar.spec.overlay.displayMode;
    if (before !== command.mode) {
      changes.push({
        objectId: sidecar.id,
        field: "spec.overlay.displayMode",
        before,
        after: command.mode,
      });
      nextDocument = replaceObject(document, sidecar.id, {
        ...sidecar,
        spec: {
          ...sidecar.spec,
          overlay: { ...sidecar.spec.overlay, displayMode: command.mode },
        },
      });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "selectSpriteFrame") {
    const sidecar = document.objects[command.sidecarId];
    if (sidecar?.kind !== "spriteSidecar") {
      return {
        document,
        command,
        changes,
        message: `selectSpriteFrame skipped invalid sprite sidecar "${command.sidecarId}".`,
      };
    }
    const nextSpec = selectSpriteFrameInSpec(sidecar.spec, command.frameId);
    if (sidecar.spec.selectedFrameId !== nextSpec.selectedFrameId) {
      changes.push({
        objectId: sidecar.id,
        field: "spec.selectedFrameId",
        before: sidecar.spec.selectedFrameId,
        after: nextSpec.selectedFrameId,
      });
    }
    if (changes.length > 0) {
      nextDocument = replaceObject(document, sidecar.id, {
        ...sidecar,
        spec: nextSpec,
      });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "updateSpriteFrameRect") {
    const sidecar = document.objects[command.sidecarId];
    if (sidecar?.kind !== "spriteSidecar") {
      return {
        document,
        command,
        changes,
        message: `updateSpriteFrameRect skipped invalid sprite sidecar "${command.sidecarId}".`,
      };
    }
    const frame = getSpriteFrame(sidecar, command.frameId);
    if (!frame) {
      return {
        document,
        command,
        changes,
        message: `updateSpriteFrameRect skipped missing sprite frame "${command.frameId}".`,
      };
    }

    const constrainedRect = maybeConstrainSpriteFrameRect(
      document,
      command.sidecarId,
      command.frameId,
      command.rect,
      context,
    );
    const nextSpec = updateSpriteFrameRectInSpec(sidecar.spec, command.frameId, constrainedRect);
    if (nextSpec !== sidecar.spec) {
      changes.push({
        objectId: sidecar.id,
        field: `spec.frames.${command.frameId}`,
        before: frame,
        after: nextSpec.frames.find((candidate) => candidate.id === command.frameId),
      });
      changes.push({
        objectId: sidecar.id,
        field: "spec.diagnostics",
        before: sidecar.spec.diagnostics,
        after: nextSpec.diagnostics,
      });
      changes.push({
        objectId: sidecar.id,
        field: "spec.rawToml",
        before: sidecar.spec.rawToml,
        after: nextSpec.rawToml,
      });
      nextDocument = replaceObject(document, sidecar.id, { ...sidecar, spec: nextSpec });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "nudgeSpriteFrame") {
    const sidecar = document.objects[command.sidecarId];
    if (sidecar?.kind !== "spriteSidecar") {
      return {
        document,
        command,
        changes,
        message: `nudgeSpriteFrame skipped invalid sprite sidecar "${command.sidecarId}".`,
      };
    }
    const frame = getSpriteFrame(sidecar, command.frameId);
    if (!frame) {
      return {
        document,
        command,
        changes,
        message: `nudgeSpriteFrame skipped missing sprite frame "${command.frameId}".`,
      };
    }
    const rect = {
      x: frame.x + command.dx,
      y: frame.y + command.dy,
      width: frame.width,
      height: frame.height,
    };
    const nextSpec = updateSpriteFrameRectInSpec(
      sidecar.spec,
      command.frameId,
      maybeConstrainSpriteFrameRect(document, command.sidecarId, command.frameId, rect, context),
    );
    changes.push({
      objectId: sidecar.id,
      field: `spec.frames.${command.frameId}`,
      before: frame,
      after: nextSpec.frames.find((candidate) => candidate.id === command.frameId),
    });
    changes.push({
      objectId: sidecar.id,
      field: "spec.diagnostics",
      before: sidecar.spec.diagnostics,
      after: nextSpec.diagnostics,
    });
    changes.push({
      objectId: sidecar.id,
      field: "spec.rawToml",
      before: sidecar.spec.rawToml,
      after: nextSpec.rawToml,
    });
    nextDocument = replaceObject(document, sidecar.id, { ...sidecar, spec: nextSpec });
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "resizeSpriteFrame") {
    const sidecar = document.objects[command.sidecarId];
    if (sidecar?.kind !== "spriteSidecar") {
      return {
        document,
        command,
        changes,
        message: `resizeSpriteFrame skipped invalid sprite sidecar "${command.sidecarId}".`,
      };
    }
    const frame = getSpriteFrame(sidecar, command.frameId);
    if (!frame) {
      return {
        document,
        command,
        changes,
        message: `resizeSpriteFrame skipped missing sprite frame "${command.frameId}".`,
      };
    }
    const rect = {
      x: frame.x,
      y: frame.y,
      width: frame.width + command.dw,
      height: frame.height + command.dh,
    };
    const nextSpec = updateSpriteFrameRectInSpec(
      sidecar.spec,
      command.frameId,
      maybeConstrainSpriteFrameRect(document, command.sidecarId, command.frameId, rect, context),
    );
    changes.push({
      objectId: sidecar.id,
      field: `spec.frames.${command.frameId}`,
      before: frame,
      after: nextSpec.frames.find((candidate) => candidate.id === command.frameId),
    });
    changes.push({
      objectId: sidecar.id,
      field: "spec.diagnostics",
      before: sidecar.spec.diagnostics,
      after: nextSpec.diagnostics,
    });
    changes.push({
      objectId: sidecar.id,
      field: "spec.rawToml",
      before: sidecar.spec.rawToml,
      after: nextSpec.rawToml,
    });
    nextDocument = replaceObject(document, sidecar.id, { ...sidecar, spec: nextSpec });
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (command.kind === "clampSpriteFrameToGuideRegion") {
    const sidecar = document.objects[command.sidecarId];
    if (sidecar?.kind !== "spriteSidecar") {
      return {
        document,
        command,
        changes,
        message: `clampSpriteFrameToGuideRegion skipped invalid sprite sidecar "${command.sidecarId}".`,
      };
    }
    const frame = getSpriteFrame(sidecar, command.frameId);
    if (!frame) {
      return {
        document,
        command,
        changes,
        message: `clampSpriteFrameToGuideRegion skipped missing sprite frame "${command.frameId}".`,
      };
    }
    const guideContext = findGuideRegionForSpriteFrame(document, {
      spriteSidecarId: command.sidecarId,
      frameId: command.frameId,
    });
    if (!guideContext) {
      return { document, command, changes, message: "No guide region found for selected frame." };
    }
    const nextSpec = updateSpriteFrameRectInSpec(
      sidecar.spec,
      command.frameId,
      clampSpriteFrameRectToGuideRegion(frame, guideContext.region),
    );
    if (nextSpec !== sidecar.spec) {
      changes.push({
        objectId: sidecar.id,
        field: `spec.frames.${command.frameId}`,
        before: frame,
        after: nextSpec.frames.find((candidate) => candidate.id === command.frameId),
      });
      nextDocument = replaceObject(document, sidecar.id, { ...sidecar, spec: nextSpec });
    }
    return { document: nextDocument, command, changes, message: messageFor(command, changes) };
  }

  if (
    command.kind === "snapSpriteFrameToDatum" ||
    command.kind === "snapSpriteFrameToNearestDatum"
  ) {
    const sidecar = document.objects[command.sidecarId];
    if (sidecar?.kind !== "spriteSidecar") {
      return {
        document,
        command,
        changes,
        message: `${command.kind} skipped invalid sprite sidecar "${command.sidecarId}".`,
      };
    }
    const frame = getSpriteFrame(sidecar, command.frameId);
    if (!frame) {
      return {
        document,
        command,
        changes,
        message: `${command.kind} skipped missing sprite frame "${command.frameId}".`,
      };
    }
    const target = resolveDatumSnapTarget(document, command);
    if (!target) {
      return {
        document,
        command,
        changes,
        message:
          command.kind === "snapSpriteFrameToDatum"
            ? `No matching datum target found for ${command.frameId}.`
            : `No nearby datum target found for ${command.frameId}.`,
      };
    }

    const snappedRect = getDatumSnapConstrainedRect(
      document,
      command.sidecarId,
      command.frameId,
      snapSpriteFrameRectToDatum(frame, target),
      context,
      command.constrainToGuideRegion,
    );
    const nextSpec = updateSpriteFrameRectInSpec(sidecar.spec, command.frameId, snappedRect);
    if (nextSpec !== sidecar.spec) {
      changes.push({
        objectId: sidecar.id,
        field: `spec.frames.${command.frameId}`,
        before: frame,
        after: nextSpec.frames.find((candidate) => candidate.id === command.frameId),
      });
      changes.push({
        objectId: sidecar.id,
        field: "spec.diagnostics",
        before: sidecar.spec.diagnostics,
        after: nextSpec.diagnostics,
      });
      changes.push({
        objectId: sidecar.id,
        field: "spec.rawToml",
        before: sidecar.spec.rawToml,
        after: nextSpec.rawToml,
      });
      nextDocument = replaceObject(document, sidecar.id, { ...sidecar, spec: nextSpec });
    }
    return {
      document: nextDocument,
      command,
      changes,
      message:
        changes.length === 0
          ? `Sprite frame ${command.frameId} was already snapped to datum ${target.datumId} (${target.datumKind === "point" ? "center" : target.anchor}).`
          : `Snapped sprite frame ${command.frameId} to datum ${target.datumId} (${target.datumKind === "point" ? "center" : target.anchor}).`,
    };
  }

  const object = document.objects[command.id];
  if (object === undefined) {
    return {
      document,
      command,
      changes,
      message: `${command.kind} skipped missing object "${command.id}".`,
    };
  }

  if (command.kind === "move") {
    const x = object.x + command.dx;
    const y = object.y + command.dy;
    nextDocument = applyObjectPosition(document, changes, object, x, y);
  } else if (command.kind === "moveToGrid") {
    const point = gridPointRefToCanvasPoint(
      command.ref,
      document.width,
      document.height,
      context?.referenceGrid ?? document.referenceGrid,
    );
    const anchor: GridAnchor = command.anchor ?? "center";
    const x =
      anchor === "topLeft"
        ? point.x
        : anchor === "bottomRight"
          ? point.x - object.width
          : point.x - object.width / 2;
    const y =
      anchor === "topLeft"
        ? point.y
        : anchor === "bottomRight"
          ? point.y - object.height
          : point.y - object.height / 2;
    nextDocument = applyObjectPosition(document, changes, object, x, y);
  } else if (command.kind === "resize") {
    changeField(changes, object, "width", command.width);
    changeField(changes, object, "height", command.height);
    if (changes.length > 0) {
      nextDocument = replaceObject(document, object.id, {
        ...object,
        width: command.width,
        height: command.height,
      });
    }
  } else if (command.kind === "resizeToGridSpan") {
    const rect = gridSpanRefToCanvasRect(
      command.span,
      document.width,
      document.height,
      context?.referenceGrid ?? document.referenceGrid,
    );
    changeField(changes, object, "x", rect.x);
    changeField(changes, object, "y", rect.y);
    changeField(changes, object, "width", rect.width);
    changeField(changes, object, "height", rect.height);
    if (changes.length > 0) {
      nextDocument = replaceObject(document, object.id, {
        ...object,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
    }
  } else if (command.kind === "setFrame") {
    const rect = resolveCanvasFrame(command.frame, {
      document,
      referenceGrid: context?.referenceGrid ?? document.referenceGrid,
    });
    changeField(changes, object, "frame", command.frame);
    changeField(changes, object, "x", rect.x);
    changeField(changes, object, "y", rect.y);
    changeField(changes, object, "width", rect.width);
    changeField(changes, object, "height", rect.height);
    if (changes.length > 0) {
      nextDocument = replaceObject(document, object.id, {
        ...object,
        frame: command.frame,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
    }
  } else if (command.kind === "setFill") {
    changeField(changes, object, "fill", command.fill);
    if (changes.length > 0) {
      nextDocument = replaceObject(document, object.id, { ...object, fill: command.fill });
    }
  } else {
    changeField(changes, object, "stroke", command.stroke);
    if (changes.length > 0) {
      nextDocument = replaceObject(document, object.id, { ...object, stroke: command.stroke });
    }
  }

  return { document: nextDocument, command, changes, message: messageFor(command, changes) };
}

export function selectSpriteFrame(
  document: CanvasDocument,
  sidecarId: string,
  frameId?: string,
  context?: CanvasCommandApplyContext,
): CanvasDocument {
  return applyCanvasCommands(document, [{ kind: "selectSpriteFrame", sidecarId, frameId }], context)
    .document;
}

export function updateSpriteFrameRect(
  document: CanvasDocument,
  sidecarId: string,
  frameId: string,
  rect: Pick<CanvasSpriteFrame, "x" | "y" | "width" | "height">,
  context?: CanvasCommandApplyContext,
): CanvasDocument {
  return applyCanvasCommands(
    document,
    [{ kind: "updateSpriteFrameRect", sidecarId, frameId, rect }],
    context,
  ).document;
}

export function nudgeSpriteFrame(
  document: CanvasDocument,
  sidecarId: string,
  frameId: string,
  dx: number,
  dy: number,
  context?: CanvasCommandApplyContext,
): CanvasDocument {
  return applyCanvasCommands(
    document,
    [{ kind: "nudgeSpriteFrame", sidecarId, frameId, dx, dy }],
    context,
  ).document;
}

export function resizeSpriteFrame(
  document: CanvasDocument,
  sidecarId: string,
  frameId: string,
  dw: number,
  dh: number,
  context?: CanvasCommandApplyContext,
): CanvasDocument {
  return applyCanvasCommands(
    document,
    [{ kind: "resizeSpriteFrame", sidecarId, frameId, dw, dh }],
    context,
  ).document;
}

export function clampSpriteFrameToGuideRegion(
  document: CanvasDocument,
  sidecarId: string,
  frameId: string,
): CanvasDocument {
  return applyCanvasCommands(document, [
    { kind: "clampSpriteFrameToGuideRegion", sidecarId, frameId },
  ]).document;
}

export function snapSpriteFrameToDatum(
  document: CanvasDocument,
  input: {
    readonly sidecarId: string;
    readonly frameId: string;
    readonly anchor?: SpriteFrameDatumAnchor;
    readonly datumId?: string;
    readonly maxDistance?: number;
    readonly constrainToGuideRegion?: boolean;
    readonly restrictToRegion?: boolean;
  },
  context?: CanvasCommandApplyContext,
): CanvasDocument {
  return applyCanvasCommands(
    document,
    [
      {
        kind: "snapSpriteFrameToDatum",
        sidecarId: input.sidecarId,
        frameId: input.frameId,
        anchor: input.anchor,
        datumId: input.datumId,
        maxDistance: input.maxDistance,
        constrainToGuideRegion: input.constrainToGuideRegion,
        restrictToRegion: input.restrictToRegion,
      },
    ],
    context,
  ).document;
}

export function snapSpriteFrameToNearestDatum(
  document: CanvasDocument,
  input: {
    readonly sidecarId: string;
    readonly frameId: string;
    readonly anchor?: SpriteFrameDatumAnchor;
    readonly maxDistance?: number;
    readonly constrainToGuideRegion?: boolean;
    readonly restrictToRegion?: boolean;
  },
  context?: CanvasCommandApplyContext,
): CanvasDocument {
  return applyCanvasCommands(
    document,
    [
      {
        kind: "snapSpriteFrameToNearestDatum",
        sidecarId: input.sidecarId,
        frameId: input.frameId,
        anchor: input.anchor,
        maxDistance: input.maxDistance,
        constrainToGuideRegion: input.constrainToGuideRegion,
        restrictToRegion: input.restrictToRegion,
      },
    ],
    context,
  ).document;
}

function appendObjectToScene<TObject extends CanvasObject>(
  document: CanvasDocument,
  object: TObject,
): CanvasDocument {
  if (document.objects[object.id] !== undefined) {
    throw new Error(`Object "${object.id}" already exists.`);
  }
  if (!document.layers.some((layer) => layer.id === object.layerId)) {
    throw new Error(`Layer "${object.layerId}" does not exist.`);
  }

  return {
    ...document,
    selectedObjectId: object.id,
    objects: {
      ...document.objects,
      [object.id]: object,
    },
    layers: document.layers.map((layer) =>
      layer.id === object.layerId
        ? { ...layer, objectIds: [...layer.objectIds, object.id] }
        : layer,
    ),
  };
}

function replaceMechanicalSidecar(
  document: CanvasDocument,
  sidecarId: string,
  update: (
    sidecar: Extract<CanvasObject, { kind: "mechanicalAnnotationSidecar" }>,
  ) => Extract<CanvasObject, { kind: "mechanicalAnnotationSidecar" }>,
): CanvasDocument {
  const object = document.objects[sidecarId];
  if (object?.kind !== "mechanicalAnnotationSidecar") {
    throw new Error(`Mechanical annotation sidecar "${sidecarId}" does not exist.`);
  }
  return replaceObject(document, sidecarId, update(object));
}

export function createMechanicalAnnotationSidecar(
  document: CanvasDocument,
  object: MechanicalAnnotationSidecarObject,
): CanvasDocument {
  return appendObjectToScene(document, object);
}

export function createBlockoutSidecar(
  document: CanvasDocument,
  object: BlockoutSidecarObject,
): CanvasDocument {
  return appendObjectToScene(document, object);
}

export function addMechanicalDimension(
  document: CanvasDocument,
  sidecarId: string,
  dimension: MechanicalDimensionAnnotation,
): CanvasDocument {
  return replaceMechanicalSidecar(document, sidecarId, (sidecar) => ({
    ...sidecar,
    annotations: {
      ...sidecar.annotations,
      dimensions: [...sidecar.annotations.dimensions, dimension],
    },
  }));
}

export function addMechanicalNote(
  document: CanvasDocument,
  sidecarId: string,
  note: MechanicalNoteAnnotation,
): CanvasDocument {
  return replaceMechanicalSidecar(document, sidecarId, (sidecar) => ({
    ...sidecar,
    annotations: {
      ...sidecar.annotations,
      notes: [...sidecar.annotations.notes, note],
    },
  }));
}

export function addMechanicalDatum(
  document: CanvasDocument,
  sidecarId: string,
  datum: MechanicalDatumAnnotation,
): CanvasDocument {
  return replaceMechanicalSidecar(document, sidecarId, (sidecar) => ({
    ...sidecar,
    annotations: {
      ...sidecar.annotations,
      datums: [...sidecar.annotations.datums, datum],
    },
  }));
}

export function addMechanicalBlock(
  document: CanvasDocument,
  sidecarId: string,
  block: MechanicalBlockAnnotation,
): CanvasDocument {
  return replaceMechanicalSidecar(document, sidecarId, (sidecar) => ({
    ...sidecar,
    annotations: {
      ...sidecar.annotations,
      blocks: [...sidecar.annotations.blocks, block],
    },
  }));
}

export function createLayerGroup(document: CanvasDocument, title: string): CanvasDocument {
  return createCanvasLayerGroup(document, title);
}

export function addObjectToLayerGroup(
  document: CanvasDocument,
  groupId: string,
  objectId: string,
): CanvasDocument {
  return addCanvasObjectToLayerGroup(document, groupId, objectId);
}

export function attachSpriteSidecarToImage(
  document: CanvasDocument,
  imageId: string,
  sidecarId: string,
): CanvasDocument {
  return applyCanvasCommand(document, {
    kind: "attachSpriteSidecar",
    sourceId: imageId,
    sidecarId,
  }).document;
}

export function attachGuideSidecarToImage(
  document: CanvasDocument,
  imageId: string,
  guideId: string,
): CanvasDocument {
  return applyCanvasCommand(document, {
    kind: "attachGuideSidecar",
    sourceId: imageId,
    guideId,
  }).document;
}

export function attachBlockoutSidecarToObject(
  document: CanvasDocument,
  targetObjectId: string,
  blockoutId: string,
): CanvasDocument {
  return applyCanvasCommand(document, {
    kind: "attachBlockoutSidecar",
    targetObjectId,
    blockoutId,
  }).document;
}

export function attachSketchOverlayToImage(
  document: CanvasDocument,
  imageId: string,
  overlayId: string,
): CanvasDocument {
  return applyCanvasCommand(document, {
    kind: "attachSketchOverlay",
    sourceId: imageId,
    overlayId,
  }).document;
}

export function attachAlphaMapToImage(
  document: CanvasDocument,
  imageId: string,
  alphaMapId: string,
): CanvasDocument {
  return applyCanvasCommand(document, {
    kind: "attachAlphaMap",
    sourceId: imageId,
    alphaId: alphaMapId,
  }).document;
}

export function detachAttachment(
  document: CanvasDocument,
  relation:
    | { kind: "spriteSidecar"; imageId: string }
    | { kind: "sketchOverlay"; imageId: string }
    | { kind: "alphaMap"; imageId: string }
    | { kind: "guideSidecar"; guideId: string }
    | { kind: "blockoutSidecar"; blockoutId: string },
): CanvasDocument {
  if (relation.kind === "guideSidecar") {
    return applyCanvasCommand(document, {
      kind: "detachGuideSidecar",
      guideId: relation.guideId,
    }).document;
  }
  if (relation.kind === "blockoutSidecar") {
    return applyCanvasCommand(document, {
      kind: "detachBlockoutSidecar",
      blockoutId: relation.blockoutId,
    }).document;
  }
  if (relation.kind === "spriteSidecar") {
    return applyCanvasCommand(document, {
      kind: "detachSpriteSidecar",
      sourceId: relation.imageId,
    }).document;
  }
  if (relation.kind === "sketchOverlay") {
    return applyCanvasCommand(document, {
      kind: "detachSketchOverlay",
      sourceId: relation.imageId,
    }).document;
  }
  return applyCanvasCommand(document, {
    kind: "detachAlphaMap",
    sourceId: relation.imageId,
  }).document;
}

export function applyCanvasCommands(
  document: CanvasDocument,
  commands: readonly CanvasCommand[],
  context?: CanvasCommandApplyContext,
): {
  document: CanvasDocument;
  results: CanvasCommandApplyResult[];
} {
  const results: CanvasCommandApplyResult[] = [];
  let nextDocument = document;

  for (const command of commands) {
    const result = applyCanvasCommand(nextDocument, command, context);
    nextDocument = refreshSpriteGuideDiagnostics(result.document);
    results.push({ ...result, document: nextDocument });
  }

  return { document: nextDocument, results };
}
