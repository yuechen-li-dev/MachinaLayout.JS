import { formatCanvasMeasurement, getCanvasUnitSystem } from "./canvasUnits";
import type { CanvasDocument, CanvasObject, CanvasUnitName } from "./sceneModel";

export type CanvasPoint = {
  x: number;
  y: number;
};

export type CanvasMeasurement = {
  kind: "size" | "distance" | "gap" | "alignment";
  label: string;
  value: number;
  unit: CanvasUnitName;
  text: string;
  objectIds: string[];
};

type AlignmentAxis = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";

function centerOf(object: CanvasObject): CanvasPoint {
  return {
    x: object.x + object.width / 2,
    y: object.y + object.height / 2,
  };
}

function createMeasurement(
  document: CanvasDocument,
  kind: CanvasMeasurement["kind"],
  label: string,
  value: number,
  objectIds: string[],
): CanvasMeasurement {
  const unitSystem = getCanvasUnitSystem(document);
  return {
    kind,
    label,
    value,
    unit: unitSystem.unit,
    text: `${label}: ${formatCanvasMeasurement(value, unitSystem)}`,
    objectIds,
  };
}

export function measureObjectSize(
  document: CanvasDocument,
  object: CanvasObject,
): CanvasMeasurement[] {
  return [
    createMeasurement(document, "size", `${object.id} width`, object.width, [object.id]),
    createMeasurement(document, "size", `${object.id} height`, object.height, [object.id]),
  ];
}

export function measureCenterDistance(
  document: CanvasDocument,
  a: CanvasObject,
  b: CanvasObject,
): CanvasMeasurement {
  const aCenter = centerOf(a);
  const bCenter = centerOf(b);
  const distance = Math.hypot(bCenter.x - aCenter.x, bCenter.y - aCenter.y);
  return createMeasurement(document, "distance", `${a.id} to ${b.id} center distance`, distance, [
    a.id,
    b.id,
  ]);
}

export function measureObjectGap(
  document: CanvasDocument,
  a: CanvasObject,
  b: CanvasObject,
  axis: "horizontal" | "vertical",
): CanvasMeasurement {
  const gap =
    axis === "horizontal"
      ? a.x <= b.x
        ? b.x - (a.x + a.width)
        : a.x - (b.x + b.width)
      : a.y <= b.y
        ? b.y - (a.y + a.height)
        : a.y - (b.y + b.height);

  return createMeasurement(document, "gap", `${a.id} to ${b.id} ${axis} gap`, gap, [a.id, b.id]);
}

function getAlignmentValue(object: CanvasObject, axis: AlignmentAxis): number {
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

export function measureAlignmentDelta(
  document: CanvasDocument,
  a: CanvasObject,
  b: CanvasObject,
  axis: AlignmentAxis,
): CanvasMeasurement {
  const delta = getAlignmentValue(b, axis) - getAlignmentValue(a, axis);
  return createMeasurement(document, "alignment", `${b.id} minus ${a.id} ${axis}`, delta, [
    a.id,
    b.id,
  ]);
}

export function getSelectedObjectMeasurements(document: CanvasDocument): CanvasMeasurement[] {
  const selected = document.selectedObjectId
    ? document.objects[document.selectedObjectId]
    : undefined;

  if (!selected) {
    return [
      createMeasurement(document, "size", "document width", document.width, []),
      createMeasurement(document, "size", "document height", document.height, []),
    ];
  }

  const center = centerOf(selected);
  return [
    ...measureObjectSize(document, selected),
    createMeasurement(document, "alignment", `${selected.id} x`, selected.x, [selected.id]),
    createMeasurement(document, "alignment", `${selected.id} y`, selected.y, [selected.id]),
    createMeasurement(document, "alignment", `${selected.id} center x`, center.x, [selected.id]),
    createMeasurement(document, "alignment", `${selected.id} center y`, center.y, [selected.id]),
  ];
}
