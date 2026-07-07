import type { CanvasViewport } from "./canvasViewport";
import { getCanvasViewportViewBox } from "./canvasViewport";
import { formatCanvasRect, getCanvasUnitSystem } from "./canvasUnits";
import { objectToGridRef } from "./referenceGrid";
import type { CanvasDocument, CanvasObject } from "./sceneModel";

function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y
  );
}

function getVisibleLayerIds(document: CanvasDocument): Set<string> {
  return new Set(document.layers.filter((layer) => layer.visible).map((layer) => layer.id));
}

function getOrderedObjects(document: CanvasDocument): CanvasObject[] {
  const objects: CanvasObject[] = [];
  const seen = new Set<string>();

  for (const layer of document.layers) {
    for (const objectId of layer.objectIds) {
      const object = document.objects[objectId];
      if (object && !seen.has(object.id)) {
        objects.push(object);
        seen.add(object.id);
      }
    }
  }

  for (const object of Object.values(document.objects)) {
    if (!seen.has(object.id)) objects.push(object);
  }

  return objects;
}

function formatFocus(viewport: CanvasViewport): string {
  const focus = viewport.focus;
  if (!focus || focus.kind === "canvas") return "canvas";
  if (focus.kind === "object") return `object ${focus.objectId}`;
  if (focus.kind === "gridRef") return focus.ref;
  if (focus.kind === "gridSpan") return focus.span;
  if (focus.kind === "spriteFrame") return `sprite frame ${focus.frameId}`;
  return "rect";
}

export function getObjectsInViewport(
  document: CanvasDocument,
  viewport: CanvasViewport,
): CanvasObject[] {
  const viewBox = getCanvasViewportViewBox(document, viewport);
  const visibleLayerIds = getVisibleLayerIds(document);

  return getOrderedObjects(document).filter(
    (object) =>
      object.visible && visibleLayerIds.has(object.layerId) && rectsIntersect(object, viewBox),
  );
}

export function summarizeViewport(document: CanvasDocument, viewport: CanvasViewport): string {
  const unitSystem = getCanvasUnitSystem(document);
  const viewBox = getCanvasViewportViewBox(document, viewport);
  const visibleObjects = getObjectsInViewport(document, viewport);
  const selected = document.selectedObjectId
    ? document.objects[document.selectedObjectId]
    : undefined;
  const selectedVisible = selected
    ? visibleObjects.some((object) => object.id === selected.id)
    : false;
  const objectList = visibleObjects
    .slice(0, 5)
    .map((object) => `${object.id} (${objectToGridRef(object, document).span})`)
    .join(", ");
  const selectedText = selected
    ? ` Selected ${selected.id} is ${selectedVisible ? "visible" : "outside this viewport"}.`
    : " No object selected.";

  return `Viewport: ${Math.round(viewport.zoom * 100)}% centered on ${formatFocus(
    viewport,
  )}. Visible rect: ${formatCanvasRect(viewBox, unitSystem)}. Visible objects: ${
    visibleObjects.length
  }${objectList ? `; ${objectList}` : ""}.${selectedText}`;
}
