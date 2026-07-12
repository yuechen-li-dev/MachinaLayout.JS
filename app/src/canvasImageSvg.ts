import type { ImageObject } from "./sceneModel";

export function getCanvasImageMaskId(objectId: string): string {
  const sanitized = objectId.replace(/[^A-Za-z0-9_-]/g, "-");
  return `mask-${sanitized.length > 0 ? sanitized : "image"}`;
}

export function getImagePreserveAspectRatio(fit: ImageObject["fit"] | undefined): string {
  if (fit === "contain") return "xMidYMid meet";
  if (fit === "cover") return "xMidYMid slice";
  return "none";
}

export function isAlphaMapObject(object: { kind: string; role?: string }): boolean {
  return object.kind === "image" && (object.role === "alphaMap" || object.role === "mask");
}
