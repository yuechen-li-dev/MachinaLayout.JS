import type { CanvasDocument, CanvasObject } from "./sceneModel";

export type GeometryDiagnostic = {
  severity: "info" | "warning";
  code: string;
  message: string;
  objectIds: string[];
};

function getVisibleObjects(document: CanvasDocument): CanvasObject[] {
  const visibleLayerIds = new Set(
    document.layers.filter((layer) => layer.visible).map((layer) => layer.id),
  );
  return Object.values(document.objects).filter(
    (object) => object.visible && visibleLayerIds.has(object.layerId),
  );
}

function overlaps(a: CanvasObject, b: CanvasObject): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function withinTwoPixels(a: number, b: number): boolean {
  return Math.abs(a - b) <= 2;
}

export function getSceneGeometryDiagnostics(document: CanvasDocument): GeometryDiagnostic[] {
  const diagnostics: GeometryDiagnostic[] = [];
  const visibleObjects = getVisibleObjects(document);
  const selected = document.selectedObjectId
    ? document.objects[document.selectedObjectId]
    : undefined;

  for (const object of Object.values(document.objects)) {
    if (object.width < 0 || object.height < 0) {
      diagnostics.push({
        severity: "warning",
        code: "NegativeSize",
        message: `${object.name} has negative width or height.`,
        objectIds: [object.id],
      });
    }

    if (
      object.x < 0 ||
      object.y < 0 ||
      object.x + object.width > document.width ||
      object.y + object.height > document.height
    ) {
      diagnostics.push({
        severity: "warning",
        code: "OutOfBounds",
        message: `${object.name} exceeds the ${document.width} x ${document.height} artboard.`,
        objectIds: [object.id],
      });
    }

    if (object.kind === "image" && object.alphaMapId !== undefined) {
      const alphaMap = document.objects[object.alphaMapId];
      if (alphaMap === undefined) {
        diagnostics.push({
          severity: "warning",
          code: "InvalidCompositeRelation",
          message: `${object.name} references missing alpha map ${object.alphaMapId}.`,
          objectIds: [object.id],
        });
      } else if (alphaMap.kind !== "image") {
        diagnostics.push({
          severity: "warning",
          code: "InvalidCompositeRelation",
          message: `${object.name} references non-image alpha map ${alphaMap.name}.`,
          objectIds: [object.id, alphaMap.id],
        });
      }
    }

    if (object.kind === "image" && object.sketchOverlayId !== undefined) {
      const overlay = document.objects[object.sketchOverlayId];
      if (overlay === undefined) {
        diagnostics.push({
          severity: "warning",
          code: "InvalidSketchOverlayRelation",
          message: `${object.name} references missing sketch overlay ${object.sketchOverlayId}.`,
          objectIds: [object.id],
        });
      } else if (overlay.kind !== "sketchOverlay") {
        diagnostics.push({
          severity: "warning",
          code: "InvalidSketchOverlayRelation",
          message: `${object.name} references non-sketch overlay ${overlay.name}.`,
          objectIds: [object.id, overlay.id],
        });
      } else if (overlay.targetId !== object.id) {
        diagnostics.push({
          severity: "warning",
          code: "InvalidSketchOverlayRelation",
          message: `${object.name} sketch overlay ${overlay.id} targets ${overlay.targetId} instead.`,
          objectIds: [object.id, overlay.id],
        });
      }
    }
  }

  if (selected?.visible) {
    for (const object of visibleObjects) {
      if (object.id === selected.id) continue;

      if (overlaps(selected, object)) {
        diagnostics.push({
          severity: "warning",
          code: "SelectedOverlap",
          message: `${selected.name} overlaps ${object.name}.`,
          objectIds: [selected.id, object.id],
        });
      }

      if (withinTwoPixels(selected.x, object.x)) {
        diagnostics.push({
          severity: "info",
          code: "NearLeftAlignment",
          message: `${selected.name} left edge is within 2px of ${object.name}.`,
          objectIds: [selected.id, object.id],
        });
      }

      if (withinTwoPixels(selected.x + selected.width / 2, object.x + object.width / 2)) {
        diagnostics.push({
          severity: "info",
          code: "NearCenterXAlignment",
          message: `${selected.name} center X is within 2px of ${object.name}.`,
          objectIds: [selected.id, object.id],
        });
      }
    }
  }

  return diagnostics;
}
