import { resolveCanvasFrame } from "./canvasFrames";
import { getCanvasUiComponentDefinition } from "./uiComponents/catalog";
import type { CanvasUiComponentDefinition } from "./uiComponents/catalog";
import type {
  CanvasDocument,
  CanvasFrame,
  CanvasObject,
  CanvasUiPropValue,
  ImageObject,
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
      kind: "addImageObject";
      object: ImageObject;
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
    };

export type CanvasCommandValidationContext = {
  referenceGrid?: Partial<ReferenceGridConfig>;
};

export type CanvasCommandApplyContext = {
  referenceGrid?: Partial<ReferenceGridConfig>;
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

function validateRemoveObjectCommand(
  document: CanvasDocument,
  diagnostics: CanvasCommandValidationDiagnostic[],
  id: unknown,
  commandIndex: number | undefined,
) {
  validateObjectId(document, diagnostics, id, commandIndex);
  if (!isString(id) || document.objects[id] === undefined) return;

  const references = Object.values(document.objects).filter(
    (object) => object.kind === "image" && object.alphaMapId === id,
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
    case "addImageObject":
      validateAddImageObjectCommand(document, diagnostics, command.object, commandIndex);
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
  if (command.kind === "addImageObject") {
    return changes.length === 0
      ? `Image object ${command.object.id} was already present.`
      : `Added image object ${command.object.id}.`;
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

export function applyCanvasCommand(
  document: CanvasDocument,
  command: CanvasCommand,
  context?: CanvasCommandApplyContext,
): CanvasCommandApplyResult {
  const changes: CanvasCommandChange[] = [];
  let nextDocument = document;

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
    results.push(result);
    nextDocument = result.document;
  }

  return { document: nextDocument, results };
}
