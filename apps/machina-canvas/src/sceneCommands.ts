import type { CanvasDocument, CanvasObject } from "./sceneModel";

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
type AlignAxis = Extract<CanvasCommand, { kind: "align" }>["axis"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
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
) {
  if (!Array.isArray(ids) || ids.length < 2 || !ids.every(isString)) {
    addDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidObjectList",
      message: "ids must be an array of at least two object IDs.",
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

export function validateCanvasCommand(
  document: CanvasDocument,
  command: unknown,
  commandIndex?: number,
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
): CanvasCommandValidationResult {
  const commandList = Array.isArray(commands) ? commands : [commands];
  const diagnostics = commandList.flatMap(
    (command, index) => validateCanvasCommand(document, command, index).diagnostics,
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

function changeField<T extends keyof CanvasObject>(
  changes: CanvasCommandChange[],
  object: CanvasObject,
  field: T,
  after: CanvasObject[T],
) {
  if (object[field] !== after) {
    changes.push({
      objectId: object.id,
      field: String(field),
      before: object[field],
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
  if (changes.length === 0) return `${command.kind} made no geometry changes.`;
  const objectCount = new Set(changes.map((change) => change.objectId)).size;
  return `${command.kind} changed ${changes.length} field${changes.length === 1 ? "" : "s"} on ${objectCount} object${objectCount === 1 ? "" : "s"}.`;
}

export function applyCanvasCommand(
  document: CanvasDocument,
  command: CanvasCommand,
): CanvasCommandApplyResult {
  const changes: CanvasCommandChange[] = [];
  let nextDocument = document;

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
): {
  document: CanvasDocument;
  results: CanvasCommandApplyResult[];
} {
  const results: CanvasCommandApplyResult[] = [];
  let nextDocument = document;

  for (const command of commands) {
    const result = applyCanvasCommand(nextDocument, command);
    results.push(result);
    nextDocument = result.document;
  }

  return { document: nextDocument, results };
}
