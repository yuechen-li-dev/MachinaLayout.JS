import type { CanvasDocument, CanvasImageRole, ImageObject } from "./sceneModel";

export type LoadedImageAsset = {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  src: string;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
};

export type LoadImageAssetOptions = {
  idPrefix?: string;
};

const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

function sanitizeBaseName(fileName: string): string {
  const withoutPath = fileName.split(/[\\/]/).pop() ?? fileName;
  const withoutExtension = withoutPath.replace(/\.[^.]*$/, "");
  const sanitized = withoutExtension
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized.length > 0 ? sanitized : "image";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Image file could not be read as a data URL."));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Image read failed.")));
    reader.readAsDataURL(file);
  });
}

function inferImageDimensions(src: string): Promise<
  | {
      intrinsicWidth: number;
      intrinsicHeight: number;
    }
  | undefined
> {
  if (typeof Image === "undefined") return Promise.resolve(undefined);

  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => {
      const intrinsicWidth = image.naturalWidth || image.width;
      const intrinsicHeight = image.naturalHeight || image.height;
      resolve(
        intrinsicWidth > 0 && intrinsicHeight > 0
          ? {
              intrinsicWidth,
              intrinsicHeight,
            }
          : undefined,
      );
    });
    image.addEventListener("error", () => resolve(undefined));
    image.src = src;
  });
}

export async function loadImageAssetFromFile(
  file: File,
  options?: LoadImageAssetOptions,
): Promise<LoadedImageAsset> {
  if (!file.type.startsWith("image/") || !allowedImageMimeTypes.has(file.type)) {
    throw new Error(
      "MachinaCanvas can load PNG, JPEG, WebP, and SVG image files from this browser.",
    );
  }

  const src = await readFileAsDataUrl(file);
  const dimensions = await inferImageDimensions(src);
  const prefix = options?.idPrefix ?? "image-";
  const baseName = sanitizeBaseName(file.name);

  return {
    id: `${prefix}${baseName}`,
    name: baseName
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    fileName: file.name,
    mimeType: file.type,
    src,
    ...dimensions,
  };
}

export function makeUniqueObjectId(baseId: string, document: CanvasDocument): string {
  if (document.objects[baseId] === undefined) return baseId;

  let suffix = 2;
  while (document.objects[`${baseId}-${suffix}`] !== undefined) suffix += 1;
  return `${baseId}-${suffix}`;
}

function fitImageSize(
  document: CanvasDocument,
  intrinsicWidth: number | undefined,
  intrinsicHeight: number | undefined,
) {
  const maxWidth = document.width * 0.45;
  const maxHeight = document.height * 0.45;

  if (intrinsicWidth !== undefined && intrinsicHeight !== undefined) {
    const scale = Math.min(maxWidth / intrinsicWidth, maxHeight / intrinsicHeight, 1);
    return {
      width: intrinsicWidth * scale,
      height: intrinsicHeight * scale,
    };
  }

  const fallback = Math.max(80, Math.min(240, document.width * 0.35, document.height * 0.35));
  return {
    width: fallback,
    height: fallback,
  };
}

export function createImageObjectFromAsset(
  asset: LoadedImageAsset,
  options: {
    id: string;
    layerId: string;
    role?: CanvasImageRole;
    document: CanvasDocument;
    alphaMapId?: string;
  },
): ImageObject {
  const role = options.role ?? "image";
  const size = fitImageSize(options.document, asset.intrinsicWidth, asset.intrinsicHeight);
  const x = (options.document.width - size.width) / 2;
  const y = (options.document.height - size.height) / 2;
  const tags =
    role === "alphaMap" || role === "mask" ? ["loaded", "alpha-map"] : ["loaded", "image"];

  return {
    id: options.id,
    name: asset.name || asset.fileName,
    kind: "image",
    layerId: options.layerId,
    visible: role === "image",
    x,
    y,
    width: size.width,
    height: size.height,
    frame: {
      kind: "absolute",
      x,
      y,
      width: size.width,
      height: size.height,
    },
    src: asset.src,
    role,
    alphaMapId: options.alphaMapId,
    intrinsicWidth: asset.intrinsicWidth,
    intrinsicHeight: asset.intrinsicHeight,
    fit: "contain",
    tags,
    notes: `Loaded from ${asset.fileName} (${asset.mimeType}).`,
  };
}
