import {
  gridPointRefToCanvasPoint,
  gridSpanRefToCanvasRect,
  parseGridPointRef,
  type GridSubcell,
} from "./referenceGrid";
import { parseTomlDocument } from "./tomlSyntax";
import type {
  CanvasDocument,
  ImageObject,
  CanvasObject,
  CanvasSketchPrimitive,
  CanvasSketchRef,
  CanvasSketchSpec,
  SketchOverlayObject,
} from "./sceneModel";

export type ResolvedSketchPoint = {
  x: number;
  y: number;
};

export type ResolvedSketchRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResolvedSketchPrimitive =
  | {
      kind: "box";
      id: string;
      label?: string;
      rect: ResolvedSketchRect;
      stroke?: string;
      fill?: string;
    }
  | {
      kind: "line";
      id: string;
      label?: string;
      from: ResolvedSketchPoint;
      to: ResolvedSketchPoint;
      stroke?: string;
    }
  | {
      kind: "point";
      id: string;
      label?: string;
      point: ResolvedSketchPoint;
      stroke?: string;
      fill?: string;
    }
  | {
      kind: "label";
      id: string;
      text: string;
      point: ResolvedSketchPoint;
    };

function assertFiniteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Sketch overlay ${label} must be a finite number.`);
  }
  return value;
}

function resolveObjectAnchorPoint(object: CanvasObject, anchor: GridSubcell): ResolvedSketchPoint {
  const halfWidth = object.width / 2;
  const halfHeight = object.height / 2;
  switch (anchor) {
    case "nw":
      return { x: object.x, y: object.y };
    case "n":
      return { x: object.x + halfWidth, y: object.y };
    case "ne":
      return { x: object.x + object.width, y: object.y };
    case "w":
      return { x: object.x, y: object.y + halfHeight };
    case "c":
      return { x: object.x + halfWidth, y: object.y + halfHeight };
    case "e":
      return { x: object.x + object.width, y: object.y + halfHeight };
    case "sw":
      return { x: object.x, y: object.y + object.height };
    case "s":
      return { x: object.x + halfWidth, y: object.y + object.height };
    case "se":
      return { x: object.x + object.width, y: object.y + object.height };
  }
}

export function resolveSketchRefToPoint(
  document: CanvasDocument,
  ref: CanvasSketchRef,
): ResolvedSketchPoint {
  switch (ref.kind) {
    case "absolutePoint":
      return {
        x: assertFiniteNumber(ref.x, "absolutePoint.x"),
        y: assertFiniteNumber(ref.y, "absolutePoint.y"),
      };
    case "absoluteRect":
      return {
        x:
          assertFiniteNumber(ref.x, "absoluteRect.x") +
          assertFiniteNumber(ref.width, "absoluteRect.width") / 2,
        y:
          assertFiniteNumber(ref.y, "absoluteRect.y") +
          assertFiniteNumber(ref.height, "absoluteRect.height") / 2,
      };
    case "gridRef":
      return gridPointRefToCanvasPoint(
        ref.ref,
        document.width,
        document.height,
        document.referenceGrid,
      );
    case "gridSpan": {
      const rect = gridSpanRefToCanvasRect(
        ref.span,
        document.width,
        document.height,
        document.referenceGrid,
      );
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }
    case "objectAnchor": {
      const object = document.objects[ref.objectId];
      if (!object) {
        throw new Error(`Sketch overlay objectAnchor target "${ref.objectId}" does not exist.`);
      }
      return resolveObjectAnchorPoint(object, ref.anchor);
    }
  }
}

export function resolveSketchRefToRect(
  document: CanvasDocument,
  ref: CanvasSketchRef,
): ResolvedSketchRect {
  switch (ref.kind) {
    case "absoluteRect":
      return {
        x: assertFiniteNumber(ref.x, "absoluteRect.x"),
        y: assertFiniteNumber(ref.y, "absoluteRect.y"),
        width: assertFiniteNumber(ref.width, "absoluteRect.width"),
        height: assertFiniteNumber(ref.height, "absoluteRect.height"),
      };
    case "gridRef": {
      const grid = document.referenceGrid;
      const columns = grid?.columns ?? 6;
      const rows = grid?.rows ?? 4;
      const parsed = parseGridPointRef(ref.ref, document.referenceGrid);
      return {
        x: parsed.col * (document.width / columns),
        y: parsed.row * (document.height / rows),
        width: document.width / columns,
        height: document.height / rows,
      };
    }
    case "gridSpan":
      return gridSpanRefToCanvasRect(
        ref.span,
        document.width,
        document.height,
        document.referenceGrid,
      );
    case "absolutePoint":
      throw new Error("Sketch overlay absolutePoint cannot resolve to a rect.");
    case "objectAnchor":
      throw new Error("Sketch overlay objectAnchor cannot resolve to a rect.");
  }
}

function resolvePrimitive(
  document: CanvasDocument,
  primitive: CanvasSketchPrimitive,
): ResolvedSketchPrimitive {
  switch (primitive.kind) {
    case "box":
      return {
        kind: "box",
        id: primitive.id,
        label: primitive.label,
        rect: resolveSketchRefToRect(document, primitive.ref),
        stroke: primitive.stroke,
        fill: primitive.fill,
      };
    case "line":
      return {
        kind: "line",
        id: primitive.id,
        label: primitive.label,
        from: resolveSketchRefToPoint(document, primitive.from),
        to: resolveSketchRefToPoint(document, primitive.to),
        stroke: primitive.stroke,
      };
    case "point":
      return {
        kind: "point",
        id: primitive.id,
        label: primitive.label,
        point: resolveSketchRefToPoint(document, primitive.ref),
        stroke: primitive.stroke,
        fill: primitive.fill,
      };
    case "label":
      return {
        kind: "label",
        id: primitive.id,
        text: primitive.text,
        point: resolveSketchRefToPoint(document, primitive.ref),
      };
  }
}

export function resolveSketchSpec(
  document: CanvasDocument,
  spec: CanvasSketchSpec,
): ResolvedSketchPrimitive[] {
  return spec.primitives.map((primitive) => resolvePrimitive(document, primitive));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asPrimitiveArray<_T extends CanvasSketchPrimitive["kind"]>(
  value: unknown,
): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readSketchRef(
  table: Record<string, unknown>,
  field: "ref" | "from" | "to",
): CanvasSketchRef {
  const fieldValue = asString(table[field]);
  const kindValue = asString(table[`${field}_kind`]);

  if (kindValue === "absolute_point") {
    return {
      kind: "absolutePoint",
      x: asNumber(table.x) ?? 0,
      y: asNumber(table.y) ?? 0,
    };
  }

  if (
    kindValue === "absolute_rect" ||
    (field === "ref" && asString(table.frame_kind) === "absolute_rect")
  ) {
    return {
      kind: "absoluteRect",
      x: asNumber(table.x) ?? 0,
      y: asNumber(table.y) ?? 0,
      width: asNumber(table.width) ?? 0,
      height: asNumber(table.height) ?? 0,
    };
  }

  if (kindValue === "object_anchor") {
    return {
      kind: "objectAnchor",
      objectId: asString(table.object_id) ?? "",
      anchor: (asString(table.anchor) as GridSubcell | undefined) ?? "c",
    };
  }

  if (field === "ref") {
    const frame = asString(table.frame);
    if (frame) {
      return frame.includes(".")
        ? { kind: "gridRef", ref: frame }
        : { kind: "gridSpan", span: frame };
    }
  }

  if (!fieldValue) {
    throw new Error(`Invalid sketch TOML: ${field} is required.`);
  }
  return fieldValue.includes(".")
    ? { kind: "gridRef", ref: fieldValue }
    : { kind: "gridSpan", span: fieldValue };
}

export function parseSketchOverlayToml(
  text: string,
  options: { id: string; name: string; targetId?: string },
): CanvasSketchSpec {
  const root = parseTomlDocument(text);
  if (!isRecord(root)) {
    throw new Error("Invalid sketch TOML: expected a top-level table.");
  }

  const targetId = asString(root.target_id) ?? options.targetId;
  const primitives: CanvasSketchPrimitive[] = [];

  for (const table of asPrimitiveArray(root.box)) {
    primitives.push({
      kind: "box",
      id: asString(table.id) ?? `box-${primitives.length + 1}`,
      label: asString(table.label),
      ref: readSketchRef(table, "ref"),
      stroke: asString(table.stroke),
      fill: asString(table.fill),
    });
  }

  for (const table of asPrimitiveArray(root.line)) {
    primitives.push({
      kind: "line",
      id: asString(table.id) ?? `line-${primitives.length + 1}`,
      label: asString(table.label),
      from: readSketchRef(table, "from"),
      to: readSketchRef(table, "to"),
      stroke: asString(table.stroke),
    });
  }

  for (const table of asPrimitiveArray(root.point)) {
    primitives.push({
      kind: "point",
      id: asString(table.id) ?? `point-${primitives.length + 1}`,
      label: asString(table.label),
      ref: readSketchRef(table, "ref"),
      stroke: asString(table.stroke),
      fill: asString(table.fill),
    });
  }

  for (const table of asPrimitiveArray(root.label)) {
    primitives.push({
      kind: "label",
      id: asString(table.id) ?? `label-${primitives.length + 1}`,
      text: asString(table.text) ?? "",
      ref: readSketchRef(table, "ref"),
    });
  }

  return {
    id: asString(root.id) ?? options.id,
    name: asString(root.name) ?? options.name,
    dialect: "sketch",
    targetId,
    primitives,
  };
}

export function createSketchOverlayObject(
  spec: CanvasSketchSpec,
  options: { id?: string; name?: string; target?: ImageObject; layerId: string },
): SketchOverlayObject {
  const target = options.target;
  return {
    id: options.id ?? spec.id,
    name: options.name ?? spec.name,
    kind: "sketchOverlay",
    layerId: options.layerId,
    visible: true,
    x: target?.x ?? 0,
    y: target?.y ?? 0,
    width: target?.width ?? 0,
    height: target?.height ?? 0,
    role: "sketch",
    targetId: target?.id ?? spec.targetId,
    tags: ["sketch", "sidecar"],
    notes: `${spec.primitives.length} sketch primitive${spec.primitives.length === 1 ? "" : "s"}.`,
    spec: {
      ...spec,
      id: options.id ?? spec.id,
      name: options.name ?? spec.name,
      targetId: target?.id ?? spec.targetId,
    },
  };
}
