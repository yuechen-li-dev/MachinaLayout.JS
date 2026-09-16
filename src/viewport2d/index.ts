export type ViewportRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type ClientRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type Point2d = { readonly x: number; readonly y: number };

export function clientPointToViewport(
  bounds: ClientRect,
  viewport: ViewportRect,
  clientX: number,
  clientY: number
): Point2d {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: viewport.x, y: viewport.y };
  return {
    x: viewport.x + ((clientX - bounds.left) / bounds.width) * viewport.width,
    y: viewport.y + ((clientY - bounds.top) / bounds.height) * viewport.height
  };
}

export function zoomViewport(
  viewport: ViewportRect,
  factor: number,
  limits: { readonly minWidth: number; readonly maxWidth: number }
): ViewportRect {
  const nextWidth = Math.min(limits.maxWidth, Math.max(limits.minWidth, viewport.width * factor));
  const nextHeight = nextWidth * (viewport.height / viewport.width);
  return {
    x: viewport.x + (viewport.width - nextWidth) / 2,
    y: viewport.y + (viewport.height - nextHeight) / 2,
    width: nextWidth,
    height: nextHeight
  };
}

export function panViewport(
  start: ViewportRect,
  bounds: ClientRect,
  deltaClientX: number,
  deltaClientY: number
): ViewportRect {
  if (bounds.width <= 0 || bounds.height <= 0) return start;
  return {
    ...start,
    x: start.x - (deltaClientX / bounds.width) * start.width,
    y: start.y - (deltaClientY / bounds.height) * start.height
  };
}
