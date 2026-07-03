import type { CanvasDocument, CanvasObject } from "./sceneModel";

export function getObjectBoundsSummary(object: CanvasObject): string {
  return `${object.id} (${object.kind}) x:${object.x} y:${object.y} w:${object.width} h:${object.height}`;
}

export function summarizeScene(document: CanvasDocument): string {
  const objects = Object.values(document.objects);
  const selected = document.selectedObjectId
    ? document.objects[document.selectedObjectId]
    : undefined;
  const notableObjects = objects
    .filter((object) =>
      ["logo", "headline", "product-body", "cta-bg", "feature-chip-1"].includes(object.id),
    )
    .map((object) => getObjectBoundsSummary(object))
    .join("; ");

  const selectionText = selected
    ? ` Selected object: ${selected.name} (${getObjectBoundsSummary(selected)}).`
    : " No object selected.";

  return `${document.name} is ${document.width}x${document.height}${document.unit} with ${objects.length} objects across ${document.layers.length} layers.${selectionText} Notable geometry: ${notableObjects}.`;
}
