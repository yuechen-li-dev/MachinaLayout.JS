import {
  gridPointRefToCanvasPoint,
  gridSpanRefToCanvasRect,
  type ReferenceGridConfig,
} from "./referenceGrid";
import type { CanvasDocument, CanvasFrame, CanvasObject } from "./sceneModel";

export type CanvasFrameResolveContext = {
  document: CanvasDocument;
  referenceGrid?: Partial<ReferenceGridConfig>;
};

export type ResolvedCanvasFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function assertFiniteNumber(value: number, field: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`Canvas frame ${field} must be a finite number.`);
  }
}

function assertNonNegativeSize(value: number, field: string) {
  assertFiniteNumber(value, field);
  if (value < 0) {
    throw new Error(`Canvas frame ${field} must be greater than or equal to 0.`);
  }
}

function countDefined(values: readonly (number | undefined)[]) {
  return values.filter((value) => value !== undefined).length;
}

function resolveAnchorAxis(
  start: number | undefined,
  end: number | undefined,
  size: number | undefined,
  parentSize: number,
  axis: "horizontal" | "vertical",
): { position: number; size: number } {
  if (countDefined([start, end, size]) !== 2) {
    throw new Error(`Canvas anchor frame must specify exactly two ${axis} constraints.`);
  }

  if (start !== undefined) assertFiniteNumber(start, axis === "horizontal" ? "left" : "top");
  if (end !== undefined) assertFiniteNumber(end, axis === "horizontal" ? "right" : "bottom");
  if (size !== undefined) assertNonNegativeSize(size, axis === "horizontal" ? "width" : "height");

  if (start !== undefined && size !== undefined) {
    return { position: start, size };
  }
  if (end !== undefined && size !== undefined) {
    return { position: parentSize - end - size, size };
  }

  const resolvedSize = parentSize - (start as number) - (end as number);
  assertNonNegativeSize(resolvedSize, axis === "horizontal" ? "width" : "height");
  return { position: start as number, size: resolvedSize };
}

export function resolveCanvasFrame(
  frame: CanvasFrame,
  context: CanvasFrameResolveContext,
  _current?: Pick<CanvasObject, "x" | "y" | "width" | "height">,
): ResolvedCanvasFrame {
  switch (frame.kind) {
    case "absolute":
      assertFiniteNumber(frame.x, "x");
      assertFiniteNumber(frame.y, "y");
      assertNonNegativeSize(frame.width, "width");
      assertNonNegativeSize(frame.height, "height");
      return { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
    case "anchor": {
      const horizontal = resolveAnchorAxis(
        frame.left,
        frame.right,
        frame.width,
        context.document.width,
        "horizontal",
      );
      const vertical = resolveAnchorAxis(
        frame.top,
        frame.bottom,
        frame.height,
        context.document.height,
        "vertical",
      );
      return {
        x: horizontal.position,
        y: vertical.position,
        width: horizontal.size,
        height: vertical.size,
      };
    }
    case "referenceGrid": {
      assertNonNegativeSize(frame.width, "width");
      assertNonNegativeSize(frame.height, "height");
      const point = gridPointRefToCanvasPoint(
        frame.ref,
        context.document.width,
        context.document.height,
        context.referenceGrid ?? context.document.referenceGrid,
      );
      const anchor = frame.anchor ?? "center";
      return {
        x:
          anchor === "topLeft"
            ? point.x
            : anchor === "bottomRight"
              ? point.x - frame.width
              : point.x - frame.width / 2,
        y:
          anchor === "topLeft"
            ? point.y
            : anchor === "bottomRight"
              ? point.y - frame.height
              : point.y - frame.height / 2,
        width: frame.width,
        height: frame.height,
      };
    }
    case "referenceGridSpan":
      return gridSpanRefToCanvasRect(
        frame.span,
        context.document.width,
        context.document.height,
        context.referenceGrid ?? context.document.referenceGrid,
      );
  }
}

export function resolveCanvasObjectFrame(
  object: CanvasObject,
  context: CanvasFrameResolveContext,
): ResolvedCanvasFrame {
  if (!object.frame) {
    return { x: object.x, y: object.y, width: object.width, height: object.height };
  }

  return resolveCanvasFrame(object.frame, context, object);
}

export function applyCanvasObjectFrame(
  object: CanvasObject,
  context: CanvasFrameResolveContext,
): CanvasObject {
  if (!object.frame) return object;
  return { ...object, ...resolveCanvasObjectFrame(object, context) };
}

export function resolveCanvasDocumentFrames(
  document: CanvasDocument,
  referenceGrid?: Partial<ReferenceGridConfig>,
): CanvasDocument {
  const context = { document, referenceGrid };
  let changed = false;
  const objects = Object.fromEntries(
    Object.entries(document.objects).map(([id, object]) => {
      const nextObject = applyCanvasObjectFrame(object, context);
      if (nextObject !== object) changed = true;
      return [id, nextObject];
    }),
  ) as CanvasDocument["objects"];

  return changed ? { ...document, objects } : { ...document };
}
