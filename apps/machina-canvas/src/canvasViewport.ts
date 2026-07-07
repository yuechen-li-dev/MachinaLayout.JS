import type { CanvasDocument } from "./sceneModel";
import {
  gridPointRefToCanvasPoint,
  gridSpanRefToCanvasRect,
  parseGridPointRef,
  parseGridSpanRef,
} from "./referenceGrid";
import { mapSpriteFrameToCanvasRect } from "./spriteFrameEditor";
import type { CanvasSpriteFrame, ImageObject } from "./sceneModel";

export type CanvasViewportFocus =
  | {
      kind: "canvas";
    }
  | {
      kind: "object";
      objectId: string;
    }
  | {
      kind: "gridRef";
      ref: string;
    }
  | {
      kind: "gridSpan";
      span: string;
    }
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      kind: "spriteFrame";
      sidecarId: string;
      frameId: string;
    };

export type CanvasViewport = {
  zoom: number;
  centerX: number;
  centerY: number;
  focus?: CanvasViewportFocus;
};

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = {
  zoom: 1,
  centerX: 0,
  centerY: 0,
  focus: { kind: "canvas" },
};

const MIN_CANVAS_ZOOM = 0.25;
const MAX_CANVAS_ZOOM = 8;
export const CANVAS_ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 4, 8] as const;

function finiteOrFallback(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

export function normalizeCanvasZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, zoom));
}

export function createCanvasViewport(
  document: CanvasDocument,
  partial?: Partial<CanvasViewport>,
): CanvasViewport {
  const centerX = document.width / 2;
  const centerY = document.height / 2;

  return {
    zoom: normalizeCanvasZoom(partial?.zoom ?? DEFAULT_CANVAS_VIEWPORT.zoom),
    centerX: finiteOrFallback(partial?.centerX, centerX),
    centerY: finiteOrFallback(partial?.centerY, centerY),
    focus: partial?.focus ?? DEFAULT_CANVAS_VIEWPORT.focus,
  };
}

export function fitCanvasViewport(document: CanvasDocument): CanvasViewport {
  return createCanvasViewport(document, {
    zoom: 1,
    centerX: document.width / 2,
    centerY: document.height / 2,
    focus: { kind: "canvas" },
  });
}

export function setCanvasViewportZoom(viewport: CanvasViewport, zoom: number): CanvasViewport {
  return {
    ...viewport,
    zoom: normalizeCanvasZoom(zoom),
  };
}

export function nextZoomStep(currentZoom: number, direction: 1 | -1): number {
  const normalized = normalizeCanvasZoom(currentZoom);
  if (direction > 0) {
    for (const step of CANVAS_ZOOM_STEPS) {
      if (step > normalized) return step;
    }
    return CANVAS_ZOOM_STEPS[CANVAS_ZOOM_STEPS.length - 1];
  }
  for (let index = CANVAS_ZOOM_STEPS.length - 1; index >= 0; index -= 1) {
    const step = CANVAS_ZOOM_STEPS[index];
    if (step < normalized) return step;
  }
  return CANVAS_ZOOM_STEPS[0];
}

export function panCanvasViewport(
  viewport: CanvasViewport,
  delta: { dx: number; dy: number },
): CanvasViewport {
  return {
    ...viewport,
    centerX: viewport.centerX - delta.dx,
    centerY: viewport.centerY - delta.dy,
  };
}

function getZoomStepForRect(
  document: CanvasDocument,
  rect: { width: number; height: number },
): number {
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const targetZoom = Math.min((document.width * 0.42) / width, (document.height * 0.42) / height);
  const normalized = normalizeCanvasZoom(targetZoom);
  for (const step of CANVAS_ZOOM_STEPS) {
    if (step >= normalized) return step;
  }
  return CANVAS_ZOOM_STEPS[CANVAS_ZOOM_STEPS.length - 1];
}

export function viewportForRect(
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  options?: {
    zoom?: number;
    padding?: number;
    focus?: CanvasViewportFocus;
  },
): CanvasViewport {
  const padding = Math.max(0, finiteOrFallback(options?.padding, 0));
  const width = Math.max(0, finiteOrFallback(rect.width, 0));
  const height = Math.max(0, finiteOrFallback(rect.height, 0));

  return {
    zoom: normalizeCanvasZoom(options?.zoom ?? 4),
    centerX: finiteOrFallback(rect.x, 0) + width / 2,
    centerY: finiteOrFallback(rect.y, 0) + height / 2,
    focus:
      options?.focus ??
      ({
        kind: "rect",
        x: finiteOrFallback(rect.x, 0) - padding,
        y: finiteOrFallback(rect.y, 0) - padding,
        width: width + padding * 2,
        height: height + padding * 2,
      } satisfies CanvasViewportFocus),
  };
}

export function getCanvasViewportViewBox(
  document: CanvasDocument,
  viewport: CanvasViewport,
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const zoom = normalizeCanvasZoom(viewport.zoom);
  const width = document.width / zoom;
  const height = document.height / zoom;
  const centerX = finiteOrFallback(viewport.centerX, document.width / 2);
  const centerY = finiteOrFallback(viewport.centerY, document.height / 2);

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

export function viewportForObject(
  document: CanvasDocument,
  objectId: string,
  options?: {
    zoom?: number;
    padding?: number;
  },
): CanvasViewport {
  const object = document.objects[objectId];
  if (!object) {
    throw new Error(`Canvas object "${objectId}" does not exist.`);
  }

  return viewportForRect(object, {
    zoom: options?.zoom ?? 4,
    padding: options?.padding,
    focus: { kind: "object", objectId },
  });
}

export function viewportForGridRef(
  document: CanvasDocument,
  ref: string,
  options?: {
    zoom?: number;
  },
): CanvasViewport {
  parseGridPointRef(ref, document.referenceGrid);
  const point = gridPointRefToCanvasPoint(
    ref,
    document.width,
    document.height,
    document.referenceGrid,
  );

  return {
    zoom: normalizeCanvasZoom(options?.zoom ?? 4),
    centerX: point.x,
    centerY: point.y,
    focus: { kind: "gridRef", ref: ref.trim() },
  };
}

export function viewportForGridSpan(
  document: CanvasDocument,
  span: string,
  options?: {
    zoom?: number;
    padding?: number;
  },
): CanvasViewport {
  const parsed = parseGridSpanRef(span, document.referenceGrid);
  const rect = gridSpanRefToCanvasRect(
    parsed.span,
    document.width,
    document.height,
    document.referenceGrid,
  );

  return viewportForRect(rect, {
    zoom: options?.zoom ?? 3,
    padding: options?.padding,
    focus: { kind: "gridSpan", span: parsed.span },
  });
}

export function viewportForSpriteFrame(
  document: CanvasDocument,
  image: ImageObject,
  options: {
    sidecarId: string;
    frame: CanvasSpriteFrame;
    padding?: number;
  },
): CanvasViewport {
  const rect = mapSpriteFrameToCanvasRect(image, options.frame);
  return viewportForRect(rect, {
    zoom: getZoomStepForRect(document, rect),
    padding: options.padding ?? 12,
    focus: {
      kind: "spriteFrame",
      sidecarId: options.sidecarId,
      frameId: options.frame.id,
    },
  });
}
