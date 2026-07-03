import type { CanvasDocument, CanvasObject } from "./sceneModel";
import { formatCanvasMeasurement, formatCanvasRect, getCanvasUnitSystem } from "./canvasUnits";
import { objectToGridRef } from "./referenceGrid";

export function getObjectFrameKind(object: CanvasObject): string {
  return object.frame?.kind ?? "implicit absolute";
}

export function getObjectBoundsSummary(object: CanvasObject, document?: CanvasDocument): string {
  const grid = document ? `${objectToGridRef(object, document).span}; ` : "";
  const bounds = document
    ? formatCanvasRect(object, getCanvasUnitSystem(document))
    : `x:${object.x} y:${object.y} w:${object.width} h:${object.height}`;
  return `${object.id} (${object.kind}) ${grid}frame ${getObjectFrameKind(object)}; ${bounds}`;
}

export function summarizeScene(document: CanvasDocument): string {
  const objects = Object.values(document.objects);
  const unitSystem = getCanvasUnitSystem(document);
  const selected = document.selectedObjectId
    ? document.objects[document.selectedObjectId]
    : undefined;
  const notableObjects = objects
    .filter((object) =>
      ["logo", "headline", "product-body", "cta-bg", "feature-chip-1"].includes(object.id),
    )
    .map((object) => getObjectBoundsSummary(object, document))
    .join("; ");

  const selectionText = selected
    ? ` Selected ${selected.name} spans ${objectToGridRef(selected, document).span}; size ${formatCanvasMeasurement(selected.width, unitSystem)} x ${formatCanvasMeasurement(selected.height, unitSystem)}; center ${objectToGridRef(selected, document).center.ref}.`
    : " No object selected.";

  return `${document.name} is ${formatCanvasMeasurement(document.width, unitSystem)} x ${formatCanvasMeasurement(document.height, unitSystem)} with ${objects.length} objects across ${document.layers.length} layers.${selectionText} Notable geometry: ${notableObjects}.`;
}
