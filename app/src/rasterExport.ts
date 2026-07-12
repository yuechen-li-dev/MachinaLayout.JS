import { serializeCanvasRenderSvg } from "./canvasExport";
import type { CanvasDocument } from "./sceneModel";

export type RasterExportMimeType = "image/png" | "image/jpeg" | "image/webp";

export type RasterExportBackground = "transparent" | string;

export type RasterExportOptions = {
  mimeType?: RasterExportMimeType;
  scale?: number;
  background?: RasterExportBackground;
  quality?: number;
};

export type NormalizedRasterExportOptions = {
  mimeType: RasterExportMimeType;
  scale: number;
  background: RasterExportBackground;
  quality?: number;
};

const MIN_RASTER_SCALE = 0.25;
const MAX_RASTER_SCALE = 8;

function normalizeScale(scale: number | undefined): number {
  if (scale === undefined) return 1;
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("Raster export scale must be a finite positive number.");
  }

  return Math.min(MAX_RASTER_SCALE, Math.max(MIN_RASTER_SCALE, scale));
}

function normalizeQuality(quality: number | undefined): number | undefined {
  if (quality === undefined) return undefined;
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
    throw new Error("Raster export quality must be a finite number from 0 to 1.");
  }
  return quality;
}

export function normalizeRasterExportOptions(
  options?: RasterExportOptions,
): NormalizedRasterExportOptions {
  const mimeType = options?.mimeType ?? "image/png";
  const scale = normalizeScale(options?.scale);
  const background =
    mimeType === "image/jpeg" && (options?.background ?? "transparent") === "transparent"
      ? "#ffffff"
      : (options?.background ?? "transparent");
  const quality = normalizeQuality(options?.quality);

  return {
    mimeType,
    scale,
    background,
    ...(quality === undefined ? {} : { quality }),
  };
}

export function getRasterExportFileName(baseName: string, options?: RasterExportOptions): string {
  const normalized = normalizeRasterExportOptions(options);
  const extension =
    normalized.mimeType === "image/jpeg"
      ? "jpg"
      : normalized.mimeType === "image/webp"
        ? "webp"
        : "png";
  const scaleSuffix = normalized.scale === 1 ? "" : `@${Number(normalized.scale.toFixed(2))}x`;

  return `${baseName}${scaleSuffix}.${extension}`;
}

function loadImageFromObjectUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("SVG raster source could not be loaded."));
    image.src = url;
  });
}

function isRelativeImageHref(value: string): boolean {
  return (
    !value.startsWith("#") &&
    !value.startsWith("data:") &&
    !value.startsWith("blob:") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(value)
  );
}

function absolutizeSvgImageHrefs(svgText: string): string {
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    return svgText;
  }

  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (parsed.querySelector("parsererror")) return svgText;

  for (const image of Array.from(parsed.querySelectorAll("image"))) {
    for (const attribute of ["href", "xlink:href"]) {
      const value = image.getAttribute(attribute);
      if (value && isRelativeImageHref(value)) {
        image.setAttribute(attribute, new URL(value, window.location.href).href);
      }
    }
  }

  return new XMLSerializer().serializeToString(parsed);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: RasterExportMimeType,
  quality: number | undefined,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas raster export did not produce a Blob."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

function getScaledRasterDimension(size: number, scale: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Raster export dimensions must be finite positive numbers.");
  }

  return Math.max(1, Math.round(size * scale));
}

export async function lowerSvgToRasterBlob(
  svgText: string,
  width: number,
  height: number,
  options?: RasterExportOptions,
): Promise<Blob> {
  const normalized = normalizeRasterExportOptions(options);
  const svgBlob = new Blob([absolutizeSvgImageHrefs(svgText)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImageFromObjectUrl(url);
    const canvas = document.createElement("canvas");
    canvas.width = getScaledRasterDimension(width, normalized.scale);
    canvas.height = getScaledRasterDimension(height, normalized.scale);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("2D canvas context is unavailable.");
    }

    if (normalized.background !== "transparent") {
      context.fillStyle = normalized.background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await canvasToBlob(canvas, normalized.mimeType, normalized.quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function lowerCanvasDocumentToRasterBlob(
  documentModel: CanvasDocument,
  options?: RasterExportOptions,
): Promise<Blob> {
  const svgText = serializeCanvasRenderSvg(documentModel);
  return lowerSvgToRasterBlob(svgText, documentModel.width, documentModel.height, options);
}
