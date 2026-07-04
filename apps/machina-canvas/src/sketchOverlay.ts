import {
  gridPointRefToCanvasPoint,
  gridSpanRefToCanvasRect,
  parseGridPointRef,
  type GridSubcell,
} from "./referenceGrid";
import type {
  CanvasDocument,
  CanvasObject,
  CanvasSketchPrimitive,
  CanvasSketchRef,
  CanvasSketchSpec,
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
