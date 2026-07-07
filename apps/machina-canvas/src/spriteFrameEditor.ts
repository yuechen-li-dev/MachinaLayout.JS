import type { CanvasSpriteFrame, ImageObject, SpriteSidecarObject } from "./sceneModel";
import { getSpriteFrameSourceKind } from "./spriteSidecar";

export type SpriteFrameRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SpriteFrameHit = {
  frameId: string;
  frame: CanvasSpriteFrame;
  rect: SpriteFrameRect;
};

export function mapSpriteFrameToCanvasRect(
  object: ImageObject,
  frame: Pick<CanvasSpriteFrame, "x" | "y" | "width" | "height">,
): SpriteFrameRect {
  const sourceWidth = object.intrinsicWidth ?? object.width;
  const sourceHeight = object.intrinsicHeight ?? object.height;
  const scaleX = object.width / sourceWidth;
  const scaleY = object.height / sourceHeight;
  return {
    x: object.x + frame.x * scaleX,
    y: object.y + frame.y * scaleY,
    width: frame.width * scaleX,
    height: frame.height * scaleY,
  };
}

function getVisibleFrames(sidecar: SpriteSidecarObject): readonly CanvasSpriteFrame[] {
  if (!sidecar.spec.overlay.selectedOnly) return sidecar.spec.frames;
  return sidecar.spec.frames.filter((frame) => frame.id === sidecar.spec.selectedFrameId);
}

function containsPoint(rect: SpriteFrameRect, point: { x: number; y: number }) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function hitTestSpriteFrameAtPoint(
  sidecar: SpriteSidecarObject,
  image: ImageObject,
  point: { x: number; y: number },
): SpriteFrameHit | undefined {
  const hits = getVisibleFrames(sidecar)
    .map((frame) => ({ frameId: frame.id, frame, rect: mapSpriteFrameToCanvasRect(image, frame) }))
    .filter((hit) => containsPoint(hit.rect, point));

  if (hits.length === 0) return undefined;

  const sourceRank = (frame: CanvasSpriteFrame) => {
    const sourceKind = getSpriteFrameSourceKind(frame);
    if (sourceKind === "exact" || sourceKind === "manual") return 0;
    if (sourceKind === "stackframe") return 1;
    if (sourceKind === "grid") return 2;
    return 3;
  };

  // Prefer exact/manual cuts first, then the smallest containing frame.
  hits.sort((a, b) => {
    const rankDiff = sourceRank(a.frame) - sourceRank(b.frame);
    if (rankDiff !== 0) return rankDiff;
    const areaDiff = a.rect.width * a.rect.height - b.rect.width * b.rect.height;
    if (areaDiff !== 0) return areaDiff;
    return (
      sidecar.spec.frames.findIndex((frame) => frame.id === a.frameId) -
      sidecar.spec.frames.findIndex((frame) => frame.id === b.frameId)
    );
  });

  return hits[0];
}

export function snapSpriteValue(value: number, gridSize: number): number {
  if (!Number.isFinite(gridSize) || gridSize <= 1) return Math.round(value);
  return Math.round(value / gridSize) * gridSize;
}

export function snapSpriteFrameRect(
  rect: SpriteFrameRect,
  options: { enabled: boolean; gridSize: number },
): SpriteFrameRect {
  if (!options.enabled) {
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }

  return {
    x: snapSpriteValue(rect.x, options.gridSize),
    y: snapSpriteValue(rect.y, options.gridSize),
    width: snapSpriteValue(rect.width, options.gridSize),
    height: snapSpriteValue(rect.height, options.gridSize),
  };
}
