import type { CanvasDocument, CanvasObject } from "./sceneModel";
import { formatCanvasMeasurement, formatCanvasRect, getCanvasUnitSystem } from "./canvasUnits";
import { objectToGridRef } from "./referenceGrid";
import { getSpriteOverlayDisplayModeLabel } from "./spriteOverlay";
import { getSpriteFrameSourceKind } from "./spriteSidecar";

export function getObjectFrameKind(object: CanvasObject): string {
  return object.frame?.kind ?? "implicit absolute";
}

export function getObjectBoundsSummary(object: CanvasObject, document?: CanvasDocument): string {
  const grid = document ? `${objectToGridRef(object, document).span}; ` : "";
  const bounds = document
    ? formatCanvasRect(object, getCanvasUnitSystem(document))
    : `x:${object.x} y:${object.y} w:${object.width} h:${object.height}`;
  const imageSummary =
    object.kind === "image"
      ? `; role ${object.role ?? "image"}${object.alphaMapId ? `; uses alpha map ${object.alphaMapId}` : ""}${object.sketchOverlayId ? `; uses sketch overlay ${object.sketchOverlayId}` : ""}`
      : "";
  const spriteImageSummary =
    object.kind === "image" && object.spriteSidecarId
      ? `; uses sprite sidecar ${object.spriteSidecarId}`
      : "";
  const sketchSummary =
    object.kind === "sketchOverlay"
      ? `; target ${object.targetId}; primitives ${object.spec.primitives.length}; dialect ${object.spec.dialect}`
      : "";
  const spriteSummary =
    object.kind === "spriteSidecar"
      ? `; target ${object.targetId}; subgrids ${object.spec.grids.length}; frames ${object.spec.frames.length}; animations ${object.spec.animations.length}; overlay ${object.spec.overlay.displayMode}; dialect ${object.spec.dialect}`
      : "";
  return `${object.id} (${object.kind}) ${grid}frame ${getObjectFrameKind(object)}; ${bounds}${imageSummary}${spriteImageSummary}${sketchSummary}${spriteSummary}`;
}

export function summarizeScene(document: CanvasDocument): string {
  const objects = Object.values(document.objects);
  const unitSystem = getCanvasUnitSystem(document);
  const selected = document.selectedObjectId
    ? document.objects[document.selectedObjectId]
    : undefined;
  const notableObjects = objects
    .filter((object) =>
      ["logo", "headline", "generated-product-image", "cta-bg", "feature-chip-1"].includes(
        object.id,
      ),
    )
    .map((object) => getObjectBoundsSummary(object, document))
    .join("; ");

  const selectionText = selected
    ? ` Selected ${selected.name} spans ${objectToGridRef(selected, document).span}; size ${formatCanvasMeasurement(selected.width, unitSystem)} x ${formatCanvasMeasurement(selected.height, unitSystem)}; center ${objectToGridRef(selected, document).center.ref}.${
        selected.kind === "spriteSidecar"
          ? (
              () => {
                const frame = selected.spec.frames.find(
                  (candidate) => candidate.id === selected.spec.selectedFrameId,
                );
                return frame
                  ? ` Overlay mode ${getSpriteOverlayDisplayModeLabel(selected.spec.overlay.displayMode)}. Selected frame ${frame.id} is ${frame.x},${frame.y} ${frame.width}x${frame.height}; source ${getSpriteFrameSourceKind(frame)}${frame.sourceGridId ? ` on ${frame.sourceGridId}` : ""}.`
                  : "";
              }
            )()
          : ""
      }`
    : " No object selected.";

  return `${document.name} is ${formatCanvasMeasurement(document.width, unitSystem)} x ${formatCanvasMeasurement(document.height, unitSystem)} with ${objects.length} objects across ${document.layers.length} layers.${selectionText} Notable geometry: ${notableObjects || "none yet"}.`;
}
