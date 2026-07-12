import {
  createImageObjectFromAsset,
  makeUniqueObjectId,
  type LoadedImageAsset,
} from "../imageAssets";
import { applyCanvasCommands, type CanvasCommand } from "../sceneCommands";
import type { CanvasDocument, ImageObject } from "../sceneModel";
import type { CanvasToolDefinition, CanvasToolInput } from "./types";

export const GENERATE_ALPHA_MAP_TOOL_ID = "generate-alpha-map";

export type PixelImage = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
};

export type GenerateAlphaMapOptions = {
  readonly autoAttach?: boolean;
  readonly threshold?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBooleanOption(options: Record<string, unknown> | undefined, key: string) {
  return typeof options?.[key] === "boolean" ? options[key] : undefined;
}

function getNumberOption(options: Record<string, unknown> | undefined, key: string) {
  return typeof options?.[key] === "number" && Number.isFinite(options[key])
    ? options[key]
    : undefined;
}

function parseGenerateAlphaMapOptions(input: CanvasToolInput): Required<GenerateAlphaMapOptions> {
  const options = isRecord(input.options) ? input.options : undefined;
  return {
    autoAttach: getBooleanOption(options, "autoAttach") ?? true,
    threshold: Math.max(1, getNumberOption(options, "threshold") ?? 32),
  };
}

function getPixelOffset(image: PixelImage, x: number, y: number): number {
  return (y * image.width + x) * 4;
}

function sampleBackgroundColor(image: PixelImage): [number, number, number] {
  const corners = [
    [0, 0],
    [image.width - 1, 0],
    [0, image.height - 1],
    [image.width - 1, image.height - 1],
  ];
  const total = corners.reduce(
    (sum, [x, y]) => {
      const offset = getPixelOffset(image, x, y);
      return [
        sum[0] + image.data[offset],
        sum[1] + image.data[offset + 1],
        sum[2] + image.data[offset + 2],
      ];
    },
    [0, 0, 0],
  );
  return [total[0] / corners.length, total[1] / corners.length, total[2] / corners.length];
}

function colorDistance(
  r: number,
  g: number,
  b: number,
  background: readonly [number, number, number],
): number {
  const dr = r - background[0];
  const dg = g - background[1];
  const db = b - background[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function enqueueBackground(
  x: number,
  y: number,
  width: number,
  height: number,
  rawForeground: Uint8Array,
  background: Uint8Array,
  queue: number[],
) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const index = y * width + x;
  if (background[index] || rawForeground[index]) return;
  background[index] = 1;
  queue.push(index);
}

export function deriveAlphaMapPixels(
  image: PixelImage,
  options?: Pick<GenerateAlphaMapOptions, "threshold">,
): PixelImage {
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    image.data.length !== image.width * image.height * 4
  ) {
    throw new Error("Alpha map source pixels must be RGBA data with positive dimensions.");
  }

  const threshold = Math.max(1, options?.threshold ?? 32);
  const backgroundColor = sampleBackgroundColor(image);
  const rawForeground = new Uint8Array(image.width * image.height);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = getPixelOffset(image, x, y);
      const alpha = image.data[offset + 3];
      const distance = colorDistance(
        image.data[offset],
        image.data[offset + 1],
        image.data[offset + 2],
        backgroundColor,
      );
      rawForeground[y * image.width + x] = alpha > 8 && distance > threshold ? 1 : 0;
    }
  }

  const background = new Uint8Array(image.width * image.height);
  const queue: number[] = [];
  for (let x = 0; x < image.width; x += 1) {
    enqueueBackground(x, 0, image.width, image.height, rawForeground, background, queue);
    enqueueBackground(
      x,
      image.height - 1,
      image.width,
      image.height,
      rawForeground,
      background,
      queue,
    );
  }
  for (let y = 0; y < image.height; y += 1) {
    enqueueBackground(0, y, image.width, image.height, rawForeground, background, queue);
    enqueueBackground(
      image.width - 1,
      y,
      image.width,
      image.height,
      rawForeground,
      background,
      queue,
    );
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const x = index % image.width;
    const y = Math.floor(index / image.width);
    enqueueBackground(x + 1, y, image.width, image.height, rawForeground, background, queue);
    enqueueBackground(x - 1, y, image.width, image.height, rawForeground, background, queue);
    enqueueBackground(x, y + 1, image.width, image.height, rawForeground, background, queue);
    enqueueBackground(x, y - 1, image.width, image.height, rawForeground, background, queue);
  }

  const output = new Uint8ClampedArray(image.width * image.height * 4);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < image.width && ny < image.height) {
            neighbors += background[ny * image.width + nx] ? 0 : 1;
          }
        }
      }

      const objectPixel = background[y * image.width + x] === 0;
      const value = objectPixel ? (neighbors < 9 ? 220 : 255) : neighbors > 0 ? 48 : 0;
      const offset = getPixelOffset(image, x, y);
      output[offset] = value;
      output[offset + 1] = value;
      output[offset + 2] = value;
      output[offset + 3] = 255;
    }
  }

  return {
    width: image.width,
    height: image.height,
    data: output,
  };
}

async function imageObjectToPixels(object: ImageObject): Promise<PixelImage> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    throw new Error("Generate Alpha Map requires browser image and canvas APIs.");
  }

  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Image "${object.id}" could not be decoded.`));
    image.src = object.src;
  });

  const width = image.naturalWidth || image.width || object.intrinsicWidth;
  const height = image.naturalHeight || image.height || object.intrinsicHeight;
  if (!width || !height) {
    throw new Error(`Image "${object.id}" has no readable intrinsic dimensions.`);
  }

  const canvas = window.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2D canvas context is unavailable.");
  }
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return {
    width,
    height,
    data: imageData.data,
  };
}

function pixelsToPngDataUrl(image: PixelImage): string {
  if (typeof window === "undefined") {
    throw new Error("PNG alpha map encoding requires browser canvas APIs.");
  }

  const canvas = window.document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2D canvas context is unavailable.");
  }
  const imageData = context.createImageData(image.width, image.height);
  imageData.data.set(image.data);
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export function createAlphaMapObjectFromAsset(
  document: CanvasDocument,
  source: ImageObject,
  asset: LoadedImageAsset,
): ImageObject {
  const id = makeUniqueObjectId(`${source.id}-alpha-map`, document);
  return {
    ...createImageObjectFromAsset(asset, {
      id,
      layerId: source.layerId,
      role: "alphaMap",
      document,
    }),
    name: `${source.name} alpha map`,
    visible: false,
    x: source.x,
    y: source.y,
    width: source.width,
    height: source.height,
    frame: source.frame,
    notes:
      "Generated by deterministic local alpha-map tool. Assumes a solid background connected to the image edges; white means opaque, black means transparent.",
  };
}

export async function runGenerateAlphaMapTool(input: CanvasToolInput, document: CanvasDocument) {
  const targetId = input.targetObjectId;
  if (!targetId) {
    throw new Error("Generate Alpha Map requires an image object target.");
  }

  const source = document.objects[targetId];
  if (source?.kind !== "image") {
    throw new Error(`Generate Alpha Map target "${targetId}" must be an image object.`);
  }
  if (source.role === "alphaMap" || source.role === "mask") {
    throw new Error(`Generate Alpha Map target "${targetId}" must be a normal image object.`);
  }

  const options = parseGenerateAlphaMapOptions(input);
  const sourcePixels = await imageObjectToPixels(source);
  const alphaPixels = deriveAlphaMapPixels(sourcePixels, options);
  const alphaSrc = pixelsToPngDataUrl(alphaPixels);
  const asset: LoadedImageAsset = {
    id: `${source.id}-alpha-map`,
    name: `${source.name} alpha map`,
    fileName: `${source.id}-alpha-map.png`,
    mimeType: "image/png",
    src: alphaSrc,
    intrinsicWidth: alphaPixels.width,
    intrinsicHeight: alphaPixels.height,
  };
  const alphaObject = createAlphaMapObjectFromAsset(document, source, asset);
  const commands: CanvasCommand[] = [{ kind: "addImageObject", object: alphaObject }];
  if (options.autoAttach) {
    commands.push({ kind: "attachAlphaMap", sourceId: source.id, alphaId: alphaObject.id });
  }

  const applied = applyCanvasCommands(document, commands);
  return {
    toolId: GENERATE_ALPHA_MAP_TOOL_ID,
    document: applied.document,
    commands,
    commandResults: applied.results,
    createdObjectIds: [alphaObject.id],
    updatedObjectIds: options.autoAttach ? [source.id] : [],
    notes: [
      `created alpha map object ${alphaObject.id}`,
      ...(options.autoAttach ? [`attached alpha map to source image ${source.id}`] : []),
      "deterministic silhouette extraction from sampled edge background",
    ],
  };
}

export const generateAlphaMapTool: CanvasToolDefinition = {
  id: GENERATE_ALPHA_MAP_TOOL_ID,
  label: "Generate Alpha Map",
  description:
    "Derive a local grayscale alpha map from a selected image using deterministic silhouette extraction.",
  targetKind: "image-object",
  run: (input, context) => runGenerateAlphaMapTool(input, context.document),
};
