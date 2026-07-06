import type { CanvasCommand } from "./sceneCommands";
import type { GeometryDiagnostic } from "./sceneGeometry";
import { getCanvasUnitSystem } from "./canvasUnits";
import type { CanvasViewport, CanvasViewportFocus } from "./canvasViewport";
import type {
  CanvasDocument,
  CanvasFrame,
  CanvasSketchRef,
  CanvasUiPropValue,
  ImageObject,
  CanvasLayer,
  CanvasObject,
  CanvasSpriteFrame,
  SketchOverlayObject,
  SpriteSidecarObject,
  TextObject,
  UiComponentObject,
} from "./sceneModel";
import { getCanvasImageMaskId, getImagePreserveAspectRatio } from "./canvasImageSvg";
import { summarizeScene } from "./sceneSummary";
import { createReferenceGridConfig, getColumnLabel } from "./referenceGrid";
import type { NormalizedRasterExportOptions } from "./rasterExport";
import { lowerCanvasDocumentToTsx, type TsxExportOptions } from "./tsxExport";
import { resolveSketchSpec } from "./sketchOverlay";
import { stringifyTomlDocument } from "./tomlSyntax";

export type CanvasExportFile = {
  path: string;
  mimeType: string;
  text: string;
};

export type CanvasExportBundle = {
  rootName: string;
  files: CanvasExportFile[];
};

export type CanvasExportOptions = {
  rootName?: string;
  selectedObjectId?: string;
  includeSessionCommands?: boolean;
  viewport?: CanvasViewport;
  rasterArtifactPath?: string;
  rasterOptions?: NormalizedRasterExportOptions;
  tsxOptions?: TsxExportOptions | false;
};

function quoteTomlString(value: string): string {
  return JSON.stringify(value);
}

function quoteXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function serializeTomlArray(values: readonly string[]): string {
  return `[${values.map(quoteTomlString).join(", ")}]`;
}

function tomlValue(value: string | number | boolean | null): string {
  if (value === null) return '""';
  return typeof value === "string" ? quoteTomlString(value) : String(value);
}

function tomlUiPropValue(value: CanvasUiPropValue): string {
  if (Array.isArray(value)) {
    const arrayValue = value as readonly (string | number)[];
    return `[${arrayValue.map((item) => tomlValue(item)).join(", ")}]`;
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return tomlValue(value);
  }
  throw new Error("Unsupported UI prop value.");
}

function sanitizePathId(id: string): string {
  const sanitized = id.replace(/[^A-Za-z0-9._-]/g, "-");
  return sanitized.length > 0 ? sanitized : "untitled";
}

function normalizeAssetSrc(src: string): string {
  return src.startsWith("/") ? src.slice(1) : src;
}

function getAlphaMapRelations(document: CanvasDocument) {
  return getObjectOrder(document)
    .map((objectId) => document.objects[objectId])
    .filter(
      (object): object is ImageObject =>
        object.kind === "image" &&
        object.alphaMapId !== undefined &&
        document.objects[object.alphaMapId] !== undefined,
    )
    .map((object) => ({
      kind: "alphaMapFor" as const,
      sourceId: object.id,
      alphaId: object.alphaMapId as string,
    }));
}

function getSketchOverlayRelations(document: CanvasDocument) {
  return getObjectOrder(document)
    .map((objectId) => document.objects[objectId])
    .filter(
      (object): object is ImageObject =>
        object.kind === "image" &&
        object.sketchOverlayId !== undefined &&
        document.objects[object.sketchOverlayId] !== undefined,
    )
    .map((object) => ({
      kind: "sketchOverlayFor" as const,
      sourceId: object.id,
      overlayId: object.sketchOverlayId as string,
    }));
}

function getSpriteSidecarRelations(document: CanvasDocument) {
  return getObjectOrder(document)
    .map((objectId) => document.objects[objectId])
    .filter(
      (object): object is ImageObject =>
        object.kind === "image" &&
        object.spriteSidecarId !== undefined &&
        document.objects[object.spriteSidecarId] !== undefined,
    )
    .map((object) => ({
      kind: "spriteSidecarFor" as const,
      sourceId: object.id,
      sidecarId: object.spriteSidecarId as string,
    }));
}

function getObjectAssetPath(object: CanvasObject): string {
  if (object.kind === "sketchOverlay" && object.spec.dialect === "sketch") {
    return `objects/${sanitizePathId(object.id)}.sketch.toml`;
  }
  if (object.kind === "spriteSidecar") {
    return `objects/${sanitizePathId(object.id)}.sprite.toml`;
  }
  return `objects/${sanitizePathId(object.id)}.toml`;
}

function getObjectOrder(document: CanvasDocument): string[] {
  const orderedIds: string[] = [];
  const seen = new Set<string>();

  for (const layer of document.layers) {
    for (const objectId of layer.objectIds) {
      if (document.objects[objectId] !== undefined && !seen.has(objectId)) {
        orderedIds.push(objectId);
        seen.add(objectId);
      }
    }
  }

  for (const objectId of Object.keys(document.objects).sort()) {
    if (!seen.has(objectId)) orderedIds.push(objectId);
  }

  return orderedIds;
}

function getReferenceGridMetadata(document: CanvasDocument) {
  const config = createReferenceGridConfig(document.referenceGrid);
  const columnLabels = Array.from({ length: config.columns }, (_, index) =>
    getColumnLabel(index, config.columnStart),
  );
  const rowLabels = Array.from({ length: config.rows }, (_, index) =>
    String((config.rowStart ?? 1) + index),
  );

  return {
    columns: config.columns,
    rows: config.rows,
    columnLabels,
    rowLabels,
  };
}

function getUnitSystemMetadata(document: CanvasDocument) {
  const unitSystem = getCanvasUnitSystem(document);
  return {
    unit: unitSystem.unit,
    label: unitSystem.label,
    unitsPerInch: unitSystem.unitsPerInch,
    pixelsPerUnit: unitSystem.pixelsPerUnit,
    precision: unitSystem.precision,
  };
}

function pushUnitSystemToml(lines: string[], document: CanvasDocument) {
  const unitSystem = getUnitSystemMetadata(document);
  lines.push(
    "",
    "[unit_system]",
    `unit = ${quoteTomlString(unitSystem.unit)}`,
    `label = ${quoteTomlString(unitSystem.label)}`,
  );
  if (unitSystem.unitsPerInch !== undefined) {
    lines.push(`units_per_inch = ${unitSystem.unitsPerInch}`);
  }
  lines.push(
    `pixels_per_unit = ${unitSystem.pixelsPerUnit}`,
    `precision = ${unitSystem.precision}`,
  );
}

function getViewportFocusValue(focus: CanvasViewportFocus | undefined): string | undefined {
  if (!focus || focus.kind === "canvas") return undefined;
  if (focus.kind === "object") return focus.objectId;
  if (focus.kind === "gridRef") return focus.ref;
  if (focus.kind === "gridSpan") return focus.span;
  return `${focus.x},${focus.y},${focus.width},${focus.height}`;
}

function pushViewportToml(lines: string[], viewport: CanvasViewport | undefined) {
  if (!viewport) return;

  lines.push(
    "",
    "[viewport]",
    `zoom = ${viewport.zoom}`,
    `center_x = ${viewport.centerX}`,
    `center_y = ${viewport.centerY}`,
    `focus_kind = ${quoteTomlString(viewport.focus?.kind ?? "canvas")}`,
  );

  const focusValue = getViewportFocusValue(viewport.focus);
  if (focusValue !== undefined) {
    lines.push(`focus_value = ${quoteTomlString(focusValue)}`);
  }
}

function pushTsxLoweringToml(lines: string[], options: TsxExportOptions | false | undefined) {
  if (options === false || options === undefined) return;

  lines.push(
    "",
    "[rendered_artifacts]",
    'tsx = "generated-page.tsx"',
    "",
    "[lowering.react]",
    'target = "tsx"',
    `component_name = ${quoteTomlString(options?.componentName ?? "GeneratedPage")}`,
    "lossy = true",
  );
}

function formatLabelRange(labels: readonly string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels[0]}-${labels[labels.length - 1]}`;
}

function pushMetadata(lines: string[], tags?: readonly string[], notes?: string) {
  if (!tags?.length && !notes) return;

  lines.push("", "[metadata]");
  if (tags?.length) lines.push(`tags = ${serializeTomlArray(tags)}`);
  if (notes) lines.push(`notes = ${quoteTomlString(notes)}`);
}

function getObjectFrame(object: CanvasObject): CanvasFrame {
  return (
    object.frame ?? {
      kind: "absolute",
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
    }
  );
}

function pushFrameToml(lines: string[], header: string, frame: CanvasFrame) {
  lines.push("", header, `kind = ${quoteTomlString(frame.kind)}`);

  switch (frame.kind) {
    case "absolute":
      lines.push(
        `x = ${frame.x}`,
        `y = ${frame.y}`,
        `width = ${frame.width}`,
        `height = ${frame.height}`,
      );
      break;
    case "anchor":
      if (frame.left !== undefined) lines.push(`left = ${frame.left}`);
      if (frame.right !== undefined) lines.push(`right = ${frame.right}`);
      if (frame.top !== undefined) lines.push(`top = ${frame.top}`);
      if (frame.bottom !== undefined) lines.push(`bottom = ${frame.bottom}`);
      if (frame.width !== undefined) lines.push(`width = ${frame.width}`);
      if (frame.height !== undefined) lines.push(`height = ${frame.height}`);
      break;
    case "referenceGrid":
      lines.push(`ref = ${quoteTomlString(frame.ref)}`);
      if (frame.anchor !== undefined) lines.push(`anchor = ${quoteTomlString(frame.anchor)}`);
      lines.push(`width = ${frame.width}`, `height = ${frame.height}`);
      break;
    case "referenceGridSpan":
      lines.push(`span = ${quoteTomlString(frame.span)}`);
      break;
  }
}

function pushResolvedToml(lines: string[], object: CanvasObject) {
  lines.push(
    "",
    "[resolved]",
    `x = ${object.x}`,
    `y = ${object.y}`,
    `width = ${object.width}`,
    `height = ${object.height}`,
  );
}

function wrapText(object: TextObject): string[] {
  const maxChars = Math.max(8, Math.floor(object.width / (object.fontSize * 0.48)));
  const words = object.text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function uiComponentPreviewLabel(object: UiComponentObject): string {
  const candidate = object.props.children ?? object.props.title ?? object.componentId;
  return typeof candidate === "string" ? candidate : object.componentId;
}

export function serializeCanvasDocumentJson(document: CanvasDocument): string {
  const objects: Record<string, { kind: CanvasObject["kind"]; asset: string }> = {};

  for (const objectId of getObjectOrder(document)) {
    const object = document.objects[objectId];
    objects[objectId] = {
      kind: object.kind,
      asset: getObjectAssetPath(object),
    };
  }

  return JSON.stringify(
    {
      schemaVersion: 1,
      document: {
        id: document.id,
        name: document.name,
        width: document.width,
        height: document.height,
        unit: getCanvasUnitSystem(document).unit,
        unitSystem: getUnitSystemMetadata(document),
      },
      referenceGrid: getReferenceGridMetadata(document),
      layers: document.layers.map((layer) => ({
        id: layer.id,
        asset: `layers/${sanitizePathId(layer.id)}.toml`,
        objectIds: [...layer.objectIds],
      })),
      objects,
      relations: [
        ...getAlphaMapRelations(document),
        ...getSketchOverlayRelations(document),
        ...getSpriteSidecarRelations(document),
      ],
    },
    null,
    2,
  );
}

function sketchRefToTomlFields(
  lines: string[],
  fieldName: string,
  ref: CanvasSketchRef,
  preferFrame = false,
) {
  switch (ref.kind) {
    case "gridRef":
      lines.push(`${fieldName} = ${quoteTomlString(ref.ref)}`);
      break;
    case "gridSpan":
      lines.push(`${preferFrame ? "frame" : fieldName} = ${quoteTomlString(ref.span)}`);
      break;
    case "absolutePoint":
      lines.push(`${fieldName}_kind = "absolute_point"`, `x = ${ref.x}`, `y = ${ref.y}`);
      break;
    case "absoluteRect":
      lines.push(
        `${preferFrame ? "frame_kind" : `${fieldName}_kind`} = "absolute_rect"`,
        `x = ${ref.x}`,
        `y = ${ref.y}`,
        `width = ${ref.width}`,
        `height = ${ref.height}`,
      );
      break;
    case "objectAnchor":
      lines.push(
        `${fieldName}_kind = "object_anchor"`,
        `object_id = ${quoteTomlString(ref.objectId)}`,
        `anchor = ${quoteTomlString(ref.anchor)}`,
      );
      break;
  }
}

export function serializeCanvasSketchToml(object: SketchOverlayObject): string {
  const lines = [
    `id = ${quoteTomlString(object.spec.id)}`,
    `kind = ${quoteTomlString(object.kind)}`,
    `name = ${quoteTomlString(object.spec.name)}`,
    `target_id = ${quoteTomlString(object.targetId)}`,
    `dialect = ${quoteTomlString(object.spec.dialect)}`,
    `visible = ${object.visible}`,
  ];

  for (const primitive of object.spec.primitives) {
    lines.push("", `[[${primitive.kind}]]`, `id = ${quoteTomlString(primitive.id)}`);
    if ("label" in primitive && primitive.label) {
      lines.push(`label = ${quoteTomlString(primitive.label)}`);
    }
    if (primitive.kind === "box") {
      sketchRefToTomlFields(lines, "ref", primitive.ref, true);
      if (primitive.stroke !== undefined)
        lines.push(`stroke = ${quoteTomlString(primitive.stroke)}`);
      if (primitive.fill !== undefined) lines.push(`fill = ${quoteTomlString(primitive.fill)}`);
    } else if (primitive.kind === "line") {
      sketchRefToTomlFields(lines, "from", primitive.from);
      sketchRefToTomlFields(lines, "to", primitive.to);
      if (primitive.stroke !== undefined)
        lines.push(`stroke = ${quoteTomlString(primitive.stroke)}`);
    } else if (primitive.kind === "point") {
      sketchRefToTomlFields(lines, "ref", primitive.ref);
      if (primitive.stroke !== undefined)
        lines.push(`stroke = ${quoteTomlString(primitive.stroke)}`);
      if (primitive.fill !== undefined) lines.push(`fill = ${quoteTomlString(primitive.fill)}`);
    } else {
      lines.push(`text = ${quoteTomlString(primitive.text)}`);
      sketchRefToTomlFields(lines, "ref", primitive.ref);
    }
  }

  return `${lines.join("\n")}\n`;
}

function setTomlField(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
  include = value !== undefined,
) {
  if (include) target[key] = value;
}

function createSpriteFrameTomlTable(frame: CanvasSpriteFrame): Record<string, unknown> {
  const table: Record<string, unknown> = {
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  };
  setTomlField(table, "display_name", frame.label, frame.label !== frame.id);
  setTomlField(table, "sprite_id", frame.spriteId);
  setTomlField(table, "animation_id", frame.animationId);
  setTomlField(table, "row", frame.row);
  setTomlField(table, "column", frame.column);
  setTomlField(table, "grid", frame.gridId);
  setTomlField(table, "pivot", frame.pivot);
  setTomlField(table, "kind", frame.kind);
  return table;
}

function createSpriteFramesTomlRecord(object: SpriteSidecarObject): Record<string, unknown> {
  const frames: Record<string, unknown> = {};
  for (const frame of object.spec.frames) {
    frames[frame.id] = createSpriteFrameTomlTable(frame);
  }
  return frames;
}

function createSpriteGridsTomlRecord(object: SpriteSidecarObject): Record<string, unknown> {
  const grids: Record<string, unknown> = {};
  for (const grid of object.spec.grids) {
    const table: Record<string, unknown> = {
      origin_x: grid.x,
      origin_y: grid.y,
      columns: grid.columns,
      rows: grid.rows,
      cell_width: grid.cellWidth,
      cell_height: grid.cellHeight,
    };
    setTomlField(table, "default_pivot", grid.pivot);
    grids[grid.id] = table;
  }
  return grids;
}

function createSpriteForgeTomlRecord(object: SpriteSidecarObject): Record<string, unknown> {
  const sprites: Record<string, unknown> = {};
  const spriteIds = new Set<string>();
  for (const frame of object.spec.frames) {
    if (frame.spriteId) spriteIds.add(frame.spriteId);
  }
  for (const animation of object.spec.animations) {
    spriteIds.add(animation.spriteId);
  }

  for (const spriteId of [...spriteIds].sort()) {
    const spriteFrames = object.spec.frames.filter((frame) => frame.spriteId === spriteId);
    const directFrame = spriteFrames.find(
      (frame) =>
        frame.animationId === undefined && frame.row !== undefined && frame.column !== undefined,
    );
    const spriteTable: Record<string, unknown> = {
      display_name: directFrame?.label ?? spriteFrames[0]?.label ?? spriteId,
    };
    setTomlField(spriteTable, "kind", directFrame?.kind);
    setTomlField(spriteTable, "grid", directFrame?.gridId);
    setTomlField(spriteTable, "row", directFrame?.row);
    setTomlField(spriteTable, "col", directFrame?.column);
    setTomlField(spriteTable, "pivot", directFrame?.pivot);

    const animationEntries = object.spec.animations.filter(
      (candidate) => candidate.spriteId === spriteId,
    );
    if (animationEntries.length > 0) {
      const animationsTable: Record<string, unknown> = {};
      for (const animation of animationEntries) {
        const animationTable: Record<string, unknown> = {
          frames: animation.frameIds.map((frameId) => {
            const frame = object.spec.frames.find((candidate) => candidate.id === frameId);
            if (
              frame &&
              frame.gridId === animation.gridId &&
              frame.row === animation.row &&
              frame.column !== undefined
            ) {
              return frame.column;
            }
            return frameId;
          }),
        };
        setTomlField(animationTable, "grid", animation.gridId);
        setTomlField(animationTable, "row", animation.row);
        setTomlField(animationTable, "fps", animation.fps);
        setTomlField(animationTable, "loop", animation.loop);
        animationsTable[animation.id] = animationTable;
      }
      spriteTable.animations = animationsTable;
    }

    sprites[spriteId] = spriteTable;
  }

  return {
    grids: createSpriteGridsTomlRecord(object),
    sprites,
    frames: createSpriteFramesTomlRecord(object),
  };
}

function createCanvasSpriteTomlDocument(object: SpriteSidecarObject): Record<string, unknown> {
  const document: Record<string, unknown> = {
    id: object.spec.id,
    kind: object.kind,
    name: object.spec.name,
    target_id: object.targetId,
    dialect: object.spec.dialect,
    visible: object.visible,
    overlay: {
      show_bounds: object.spec.overlay.showBounds,
      show_labels: object.spec.overlay.showLabels,
      selected_only: object.spec.overlay.selectedOnly,
    },
  };

  if (object.spec.atlasImage || object.spec.atlasWidth || object.spec.atlasHeight) {
    const atlas: Record<string, unknown> = {};
    setTomlField(atlas, "image", object.spec.atlasImage);
    setTomlField(atlas, "width", object.spec.atlasWidth);
    setTomlField(atlas, "height", object.spec.atlasHeight);
    document.atlas = atlas;
  }

  if (object.spec.dialect === "spriteforge") {
    Object.assign(document, createSpriteForgeTomlRecord(object));
  } else {
    document.frames = createSpriteFramesTomlRecord(object);
  }

  return document;
}

export function serializeCanvasSpriteToml(object: SpriteSidecarObject): string {
  if (object.spec.rawToml) return `${object.spec.rawToml.trimEnd()}\n`;
  return `${stringifyTomlDocument(createCanvasSpriteTomlDocument(object)).trimEnd()}\n`;
}

export function serializeCanvasObjectToml(object: CanvasObject): string {
  if (object.kind === "sketchOverlay") {
    return serializeCanvasSketchToml(object);
  }
  if (object.kind === "spriteSidecar") {
    return serializeCanvasSpriteToml(object);
  }

  const lines = [
    `id = ${quoteTomlString(object.id)}`,
    `kind = ${quoteTomlString(object.kind)}`,
    `name = ${quoteTomlString(object.name)}`,
    `layer = ${quoteTomlString(object.layerId)}`,
    `visible = ${object.visible}`,
    `locked = ${object.locked ?? false}`,
    "",
    "[geometry]",
    `x = ${object.x}`,
    `y = ${object.y}`,
    `width = ${object.width}`,
    `height = ${object.height}`,
  ];

  pushFrameToml(lines, "[frame]", getObjectFrame(object));
  pushResolvedToml(lines, object);

  if (object.kind === "rect") {
    lines.push("", "[shape]", `radius = ${object.radius ?? 0}`);
  }

  if (object.kind === "text") {
    lines.push(
      "",
      "[text]",
      `value = ${quoteTomlString(object.text)}`,
      `font_size = ${object.fontSize}`,
    );
    if (object.fontWeight !== undefined)
      lines.push(`font_weight = ${tomlValue(object.fontWeight)}`);
  }

  if (object.kind === "image") {
    lines.push("", "[image]", `src = ${quoteTomlString(normalizeAssetSrc(object.src))}`);
    lines.push(`role = ${quoteTomlString(object.role ?? "image")}`);
    if (object.alphaMapId !== undefined) {
      lines.push(`alpha_map_id = ${quoteTomlString(object.alphaMapId)}`);
    }
    if (object.sketchOverlayId !== undefined) {
      lines.push(`sketch_overlay_id = ${quoteTomlString(object.sketchOverlayId)}`);
    }
    if (object.spriteSidecarId !== undefined) {
      lines.push(`sprite_sidecar_id = ${quoteTomlString(object.spriteSidecarId)}`);
    }
    if (object.fit !== undefined) lines.push(`fit = ${quoteTomlString(object.fit)}`);
    if (object.intrinsicWidth !== undefined) {
      lines.push(`intrinsic_width = ${object.intrinsicWidth}`);
    }
    if (object.intrinsicHeight !== undefined) {
      lines.push(`intrinsic_height = ${object.intrinsicHeight}`);
    }
    if (object.role === "alphaMap") lines.push('color_space = "alpha"');

    if (object.opacity !== undefined || object.blendMode !== undefined) {
      lines.push("", "[composite]");
      if (object.opacity !== undefined) lines.push(`opacity = ${object.opacity}`);
      if (object.blendMode !== undefined) {
        lines.push(`blend_mode = ${quoteTomlString(object.blendMode)}`);
      }
    }
  }

  if (object.kind === "uiComponent") {
    lines.push("", "[component]", `id = ${quoteTomlString(object.componentId)}`);
    if (object.variant !== undefined) lines.push(`variant = ${quoteTomlString(object.variant)}`);
    if (object.exportName !== undefined) {
      lines.push(`export_name = ${quoteTomlString(object.exportName)}`);
    }

    lines.push("", "[props]");
    for (const [key, value] of Object.entries(object.props).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push(`${key} = ${tomlUiPropValue(value)}`);
    }
  }

  if (object.fill !== undefined || object.stroke !== undefined) {
    lines.push("", "[style]");
    if (object.fill !== undefined) lines.push(`fill = ${quoteTomlString(object.fill)}`);
    if (object.stroke !== undefined) lines.push(`stroke = ${quoteTomlString(object.stroke)}`);
  }

  pushMetadata(lines, object.tags, object.notes);
  return `${lines.join("\n")}\n`;
}

export function serializeCanvasLayerToml(layer: CanvasLayer): string {
  const lines = [
    `id = ${quoteTomlString(layer.id)}`,
    `name = ${quoteTomlString(layer.name)}`,
    `visible = ${layer.visible}`,
  ];

  pushMetadata(lines);
  return `${lines.join("\n")}\n`;
}

export function serializeCanvasCommandsToml(
  name: string,
  commands: readonly CanvasCommand[],
  description?: string,
): string {
  const lines = [`name = ${quoteTomlString(name)}`];
  if (description) lines.push(`description = ${quoteTomlString(description)}`);

  for (const command of commands) {
    if (command.kind === "addImageObject" || command.kind === "addSpriteSidecarObject") continue;

    lines.push("", "[[command]]", `kind = ${quoteTomlString(command.kind)}`);
    switch (command.kind) {
      case "select":
        if (command.id !== undefined) lines.push(`id = ${quoteTomlString(command.id)}`);
        break;
      case "move":
        lines.push(
          `id = ${quoteTomlString(command.id)}`,
          `dx = ${command.dx}`,
          `dy = ${command.dy}`,
        );
        break;
      case "resize":
        lines.push(
          `id = ${quoteTomlString(command.id)}`,
          `width = ${command.width}`,
          `height = ${command.height}`,
        );
        break;
      case "setFill":
        lines.push(
          `id = ${quoteTomlString(command.id)}`,
          `fill = ${quoteTomlString(command.fill)}`,
        );
        break;
      case "setStroke":
        lines.push(
          `id = ${quoteTomlString(command.id)}`,
          `stroke = ${quoteTomlString(command.stroke)}`,
        );
        break;
      case "align":
        lines.push(
          `axis = ${quoteTomlString(command.axis)}`,
          `ids = ${serializeTomlArray(command.ids)}`,
        );
        break;
      case "distribute":
        lines.push(
          `axis = ${quoteTomlString(command.axis)}`,
          `ids = ${serializeTomlArray(command.ids)}`,
        );
        if (command.gap !== undefined) lines.push(`gap = ${command.gap}`);
        break;
      case "moveToGrid":
        lines.push(`id = ${quoteTomlString(command.id)}`, `ref = ${quoteTomlString(command.ref)}`);
        if (command.anchor !== undefined) lines.push(`anchor = ${quoteTomlString(command.anchor)}`);
        break;
      case "alignToGrid":
        lines.push(
          `axis = ${quoteTomlString(command.axis)}`,
          `ids = ${serializeTomlArray(command.ids)}`,
          `ref = ${quoteTomlString(command.ref)}`,
        );
        break;
      case "resizeToGridSpan":
        lines.push(
          `id = ${quoteTomlString(command.id)}`,
          `span = ${quoteTomlString(command.span)}`,
        );
        break;
      case "setFrame":
        lines.push(`id = ${quoteTomlString(command.id)}`);
        pushFrameToml(lines, "[command.frame]", command.frame);
        break;
      case "setUiProp":
        lines.push(
          `id = ${quoteTomlString(command.id)}`,
          `prop = ${quoteTomlString(command.prop)}`,
          `value = ${tomlUiPropValue(command.value)}`,
        );
        break;
      case "removeObject":
        lines.push(`id = ${quoteTomlString(command.id)}`);
        break;
      case "attachAlphaMap":
        lines.push(
          `source_id = ${quoteTomlString(command.sourceId)}`,
          `alpha_id = ${quoteTomlString(command.alphaId)}`,
        );
        break;
      case "detachAlphaMap":
        lines.push(`source_id = ${quoteTomlString(command.sourceId)}`);
        break;
      case "attachSketchOverlay":
        lines.push(
          `source_id = ${quoteTomlString(command.sourceId)}`,
          `overlay_id = ${quoteTomlString(command.overlayId)}`,
        );
        break;
      case "detachSketchOverlay":
        lines.push(`source_id = ${quoteTomlString(command.sourceId)}`);
        break;
      case "setSketchOverlayVisible":
        lines.push(
          `overlay_id = ${quoteTomlString(command.overlayId)}`,
          `visible = ${command.visible}`,
        );
        break;
      case "attachSpriteSidecar":
        lines.push(
          `source_id = ${quoteTomlString(command.sourceId)}`,
          `sidecar_id = ${quoteTomlString(command.sidecarId)}`,
        );
        break;
      case "detachSpriteSidecar":
        lines.push(`source_id = ${quoteTomlString(command.sourceId)}`);
        break;
      case "setSpriteSidecarVisible":
        lines.push(
          `sidecar_id = ${quoteTomlString(command.sidecarId)}`,
          `visible = ${command.visible}`,
        );
        break;
      case "setSpriteOverlayOption":
        lines.push(
          `sidecar_id = ${quoteTomlString(command.sidecarId)}`,
          `option = ${quoteTomlString(command.option)}`,
          `value = ${command.value}`,
        );
        break;
      case "selectSpriteFrame":
        lines.push(`sidecar_id = ${quoteTomlString(command.sidecarId)}`);
        if (command.frameId !== undefined) {
          lines.push(`frame_id = ${quoteTomlString(command.frameId)}`);
        }
        break;
      case "updateSpriteFrameRect":
        lines.push(
          `sidecar_id = ${quoteTomlString(command.sidecarId)}`,
          `frame_id = ${quoteTomlString(command.frameId)}`,
          `x = ${command.rect.x}`,
          `y = ${command.rect.y}`,
          `width = ${command.rect.width}`,
          `height = ${command.rect.height}`,
        );
        break;
      case "nudgeSpriteFrame":
        lines.push(
          `sidecar_id = ${quoteTomlString(command.sidecarId)}`,
          `frame_id = ${quoteTomlString(command.frameId)}`,
          `dx = ${command.dx}`,
          `dy = ${command.dy}`,
        );
        break;
      case "resizeSpriteFrame":
        lines.push(
          `sidecar_id = ${quoteTomlString(command.sidecarId)}`,
          `frame_id = ${quoteTomlString(command.frameId)}`,
          `dw = ${command.dw}`,
          `dh = ${command.dh}`,
        );
        break;
    }
  }

  return `${lines.join("\n")}\n`;
}

export function serializeCanvasHandoffToml(
  document: CanvasDocument,
  options?: {
    rootName?: string;
    selectedObjectId?: string;
    summary?: string;
    diagnostics?: readonly GeometryDiagnostic[];
    viewport?: CanvasViewport;
    rasterArtifactPath?: string;
    rasterOptions?: NormalizedRasterExportOptions;
    tsxOptions?: TsxExportOptions | false;
  },
): string {
  const selectedObjectId = options?.selectedObjectId ?? document.selectedObjectId;
  const diagnostics = options?.diagnostics ?? [];
  const referenceGrid = getReferenceGridMetadata(document);
  const lines = [
    "schema_version = 1",
    `name = ${quoteTomlString(options?.rootName ?? document.name)}`,
    'created_by = "MachinaCanvas"',
    'source_app = "apps/machina-canvas"',
    "",
    'render_svg = "render.svg"',
    'document_json = "document.json"',
  ];

  if (options?.rasterArtifactPath && options.rasterOptions) {
    const target =
      options.rasterOptions.mimeType === "image/png" ? "png" : options.rasterOptions.mimeType;
    lines.push(
      "",
      "[rendered_artifacts]",
      'svg = "render.svg"',
      `${target === "png" ? "png" : "raster"} = ${quoteTomlString(options.rasterArtifactPath)}`,
      "",
      "[lowering]",
      `target = ${quoteTomlString(target)}`,
      `scale = ${options.rasterOptions.scale}`,
      `background = ${quoteTomlString(options.rasterOptions.background)}`,
      "lossy = true",
    );
  }

  if (!(options?.rasterArtifactPath && options.rasterOptions)) {
    pushTsxLoweringToml(lines, options?.tsxOptions);
  }

  if (selectedObjectId) {
    lines.push("", "[selected]", `object_id = ${quoteTomlString(selectedObjectId)}`);
  }

  pushViewportToml(lines, options?.viewport);
  pushUnitSystemToml(lines, document);

  lines.push(
    "",
    "[reference_grid]",
    `columns = ${referenceGrid.columns}`,
    `rows = ${referenceGrid.rows}`,
    `columns_label = ${quoteTomlString(formatLabelRange(referenceGrid.columnLabels))}`,
    `rows_label = ${quoteTomlString(formatLabelRange(referenceGrid.rowLabels))}`,
  );

  lines.push(
    "",
    "[summary]",
    `text = ${quoteTomlString(options?.summary ?? summarizeScene(document))}`,
    "",
    "[validation]",
    `ok = ${!diagnostics.some((diagnostic) => diagnostic.severity === "warning")}`,
    `diagnostics = ${diagnostics.length}`,
  );

  for (const diagnostic of diagnostics) {
    lines.push(
      "",
      "[[diagnostic]]",
      `severity = ${quoteTomlString(diagnostic.severity)}`,
      `code = ${quoteTomlString(diagnostic.code)}`,
    );
    if (diagnostic.objectIds.length === 1) {
      lines.push(`object_id = ${quoteTomlString(diagnostic.objectIds[0])}`);
    } else if (diagnostic.objectIds.length > 1) {
      lines.push(`object_ids = ${serializeTomlArray(diagnostic.objectIds)}`);
    }
    lines.push(`message = ${quoteTomlString(diagnostic.message)}`);
  }

  for (const relation of getAlphaMapRelations(document)) {
    lines.push(
      "",
      "[[composite]]",
      `kind = ${quoteTomlString(relation.kind)}`,
      `source_id = ${quoteTomlString(relation.sourceId)}`,
      `alpha_id = ${quoteTomlString(relation.alphaId)}`,
    );
  }

  for (const relation of getSketchOverlayRelations(document)) {
    lines.push(
      "",
      "[[sketch_overlay]]",
      `source_id = ${quoteTomlString(relation.sourceId)}`,
      `overlay_id = ${quoteTomlString(relation.overlayId)}`,
      `path = ${quoteTomlString(getObjectAssetPath(document.objects[relation.overlayId]))}`,
    );
  }

  for (const relation of getSpriteSidecarRelations(document)) {
    lines.push(
      "",
      "[[sprite_sidecar]]",
      `source_id = ${quoteTomlString(relation.sourceId)}`,
      `sidecar_id = ${quoteTomlString(relation.sidecarId)}`,
      `path = ${quoteTomlString(getObjectAssetPath(document.objects[relation.sidecarId]))}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function getSvgObjectAttributes(object: CanvasObject): string {
  return `data-canvas-object-id="${quoteXmlAttribute(object.id)}" data-canvas-kind="${quoteXmlAttribute(object.kind)}" data-canvas-name="${quoteXmlAttribute(object.name)}"`;
}

function serializeImageElement(object: ImageObject, maskId?: string): string {
  const attrs = getSvgObjectAttributes(object);
  const mask = maskId ? ` mask="url(#${quoteXmlAttribute(maskId)})"` : "";
  const opacity = object.opacity !== undefined ? ` opacity="${object.opacity}"` : "";
  const preserveAspectRatio = getImagePreserveAspectRatio(object.fit);
  return `  <image ${attrs} href="${quoteXmlAttribute(normalizeAssetSrc(object.src))}" x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" preserveAspectRatio="${preserveAspectRatio}"${opacity}${mask} />`;
}

function getVisibleSketchOverlay(
  document: CanvasDocument,
  object: ImageObject,
): SketchOverlayObject | undefined {
  if (!object.visible || object.sketchOverlayId === undefined) return undefined;
  const overlay = document.objects[object.sketchOverlayId];
  if (overlay?.kind !== "sketchOverlay" || !overlay.visible || overlay.targetId !== object.id) {
    return undefined;
  }
  return overlay;
}

function getVisibleSpriteSidecar(
  document: CanvasDocument,
  object: ImageObject,
): SpriteSidecarObject | undefined {
  if (!object.visible || object.spriteSidecarId === undefined) return undefined;
  const sidecar = document.objects[object.spriteSidecarId];
  if (sidecar?.kind !== "spriteSidecar" || !sidecar.visible || sidecar.targetId !== object.id) {
    return undefined;
  }
  return sidecar;
}

function mapSpriteFrameToCanvasRect(object: ImageObject, frame: CanvasSpriteFrame) {
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

function serializeResolvedSpriteSidecar(
  object: ImageObject,
  sidecar: SpriteSidecarObject,
): string[] {
  const lines = [
    `  <g class="canvas-sprite-overlay" data-canvas-object-id="${quoteXmlAttribute(sidecar.id)}" data-canvas-kind="spriteSidecar" data-canvas-name="${quoteXmlAttribute(sidecar.name)}">`,
  ];
  const selectedFrameId = sidecar.spec.selectedFrameId;
  const frames = sidecar.spec.overlay.selectedOnly
    ? sidecar.spec.frames.filter((frame) => frame.id === selectedFrameId)
    : sidecar.spec.frames;

  for (const frame of frames) {
    const rect = mapSpriteFrameToCanvasRect(object, frame);
    const selected = frame.id === selectedFrameId;
    if (sidecar.spec.overlay.showBounds) {
      lines.push(
        `    <rect class="canvas-sprite-frame${selected ? " is-selected" : ""}" data-canvas-sprite-frame-id="${quoteXmlAttribute(frame.id)}" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${selected ? "rgba(255, 196, 0, 0.16)" : "rgba(0, 160, 140, 0.08)"}" stroke="${selected ? "#ffb000" : "#00a08c"}" pointer-events="none" />`,
      );
    }
    if (sidecar.spec.overlay.showLabels) {
      lines.push(
        `    <text class="canvas-sprite-label" data-canvas-sprite-frame-id="${quoteXmlAttribute(frame.id)}" x="${rect.x + 4}" y="${rect.y + 14}" pointer-events="none">${escapeXmlText(frame.label)}</text>`,
      );
    }
  }

  lines.push("  </g>");
  return lines;
}

function serializeResolvedSketchOverlay(
  document: CanvasDocument,
  overlay: SketchOverlayObject,
): string[] {
  const lines = [
    `  <g class="canvas-sketch-overlay" data-canvas-object-id="${quoteXmlAttribute(overlay.id)}" data-canvas-kind="sketchOverlay" data-canvas-name="${quoteXmlAttribute(overlay.name)}">`,
  ];
  for (const primitive of resolveSketchSpec(document, overlay.spec)) {
    if (primitive.kind === "box") {
      lines.push(
        `    <rect class="canvas-sketch-box" data-canvas-sketch-id="${quoteXmlAttribute(primitive.id)}" x="${primitive.rect.x}" y="${primitive.rect.y}" width="${primitive.rect.width}" height="${primitive.rect.height}" fill="${quoteXmlAttribute(primitive.fill ?? "transparent")}" stroke="${quoteXmlAttribute(primitive.stroke ?? "#2364d2")}" pointer-events="none" />`,
      );
    } else if (primitive.kind === "line") {
      lines.push(
        `    <line class="canvas-sketch-line" data-canvas-sketch-id="${quoteXmlAttribute(primitive.id)}" x1="${primitive.from.x}" y1="${primitive.from.y}" x2="${primitive.to.x}" y2="${primitive.to.y}" stroke="${quoteXmlAttribute(primitive.stroke ?? "#2364d2")}" pointer-events="none" />`,
      );
    } else if (primitive.kind === "point") {
      lines.push(
        `    <circle class="canvas-sketch-point" data-canvas-sketch-id="${quoteXmlAttribute(primitive.id)}" cx="${primitive.point.x}" cy="${primitive.point.y}" r="5" fill="${quoteXmlAttribute(primitive.fill ?? "#ffffff")}" stroke="${quoteXmlAttribute(primitive.stroke ?? "#2364d2")}" pointer-events="none" />`,
      );
    } else {
      lines.push(
        `    <text class="canvas-sketch-label" data-canvas-sketch-id="${quoteXmlAttribute(primitive.id)}" x="${primitive.point.x}" y="${primitive.point.y}" pointer-events="none">${escapeXmlText(primitive.text)}</text>`,
      );
    }
  }
  lines.push("  </g>");
  return lines;
}

export function serializeCanvasRenderSvg(document: CanvasDocument): string {
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">`,
  ];
  const alphaMappedImages = getObjectOrder(document)
    .map((objectId) => document.objects[objectId])
    .filter(
      (object): object is ImageObject =>
        object.kind === "image" &&
        object.alphaMapId !== undefined &&
        document.objects[object.alphaMapId]?.kind === "image",
    );

  if (alphaMappedImages.length > 0) {
    lines.push("  <defs>");
    for (const object of alphaMappedImages) {
      const alpha = document.objects[object.alphaMapId as string];
      if (alpha?.kind !== "image") continue;
      const maskId = getCanvasImageMaskId(object.id);
      lines.push(`    <mask id="${quoteXmlAttribute(maskId)}" maskUnits="userSpaceOnUse">`);
      lines.push(
        `      <image href="${quoteXmlAttribute(normalizeAssetSrc(alpha.src))}" x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" preserveAspectRatio="${getImagePreserveAspectRatio(object.fit)}" />`,
      );
      lines.push("    </mask>");
    }
    lines.push("  </defs>");
  }

  for (const layer of document.layers) {
    if (!layer.visible) continue;
    for (const objectId of layer.objectIds) {
      const object = document.objects[objectId];
      if (object === undefined || !object.visible) continue;

      const attrs = getSvgObjectAttributes(object);
      if (object.kind === "rect") {
        lines.push(
          `  <rect ${attrs} x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${object.radius ?? 0}" fill="${quoteXmlAttribute(object.fill ?? "transparent")}" stroke="${quoteXmlAttribute(object.stroke ?? "none")}" />`,
        );
      } else if (object.kind === "ellipse") {
        lines.push(
          `  <ellipse ${attrs} cx="${object.x + object.width / 2}" cy="${object.y + object.height / 2}" rx="${object.width / 2}" ry="${object.height / 2}" fill="${quoteXmlAttribute(object.fill ?? "transparent")}" stroke="${quoteXmlAttribute(object.stroke ?? "none")}" />`,
        );
      } else if (object.kind === "text") {
        lines.push(
          `  <text ${attrs} x="${object.x}" y="${object.y + object.fontSize}" fill="${quoteXmlAttribute(object.fill ?? "#111111")}" font-size="${object.fontSize}"${object.fontWeight !== undefined ? ` font-weight="${quoteXmlAttribute(String(object.fontWeight))}"` : ""}>`,
        );
        wrapText(object).forEach((line, index) => {
          lines.push(
            `    <tspan x="${object.x}" dy="${index === 0 ? 0 : object.fontSize * 1.12}">${escapeXmlText(line)}</tspan>`,
          );
        });
        lines.push("  </text>");
      } else if (object.kind === "uiComponent") {
        lines.push(
          `  <g ${attrs}>`,
          `    <rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="8" fill="#ffffff" stroke="#111111" />`,
          `    <text x="${object.x + 12}" y="${object.y + Math.min(28, object.height / 2 + 5)}" fill="#111111" font-size="14" font-weight="700">${escapeXmlText(uiComponentPreviewLabel(object))}</text>`,
          `    <text x="${object.x + 12}" y="${object.y + object.height - 12}" fill="#555550" font-size="10">${escapeXmlText(object.componentId)}</text>`,
          "  </g>",
        );
      } else if (object.kind === "image") {
        lines.push(
          serializeImageElement(
            object,
            object.alphaMapId ? getCanvasImageMaskId(object.id) : undefined,
          ),
        );
        const overlay = getVisibleSketchOverlay(document, object);
        if (overlay) {
          lines.push(...serializeResolvedSketchOverlay(document, overlay));
        }
        const spriteSidecar = getVisibleSpriteSidecar(document, object);
        if (spriteSidecar) {
          lines.push(...serializeResolvedSpriteSidecar(object, spriteSidecar));
        }
      }
    }
  }

  lines.push("</svg>");
  return `${lines.join("\n")}\n`;
}

export function createCanvasExportBundle(
  document: CanvasDocument,
  options?: CanvasExportOptions & {
    commands?: readonly CanvasCommand[];
    summary?: string;
    diagnostics?: readonly GeometryDiagnostic[];
  },
): CanvasExportBundle {
  const rootName = options?.rootName ?? `${sanitizePathId(document.id)}.mcanvas`;
  const files: CanvasExportFile[] = [
    {
      path: "render.svg",
      mimeType: "image/svg+xml",
      text: serializeCanvasRenderSvg(document),
    },
    {
      path: "document.json",
      mimeType: "application/json",
      text: serializeCanvasDocumentJson(document),
    },
    {
      path: "handoff.toml",
      mimeType: "text/plain",
      text: serializeCanvasHandoffToml(document, {
        rootName: options?.rootName,
        selectedObjectId: options?.selectedObjectId,
        summary: options?.summary,
        diagnostics: options?.diagnostics,
        viewport: options?.viewport,
        rasterArtifactPath: options?.rasterArtifactPath,
        rasterOptions: options?.rasterOptions,
        tsxOptions: options?.tsxOptions,
      }),
    },
  ];

  for (const layer of document.layers) {
    files.push({
      path: `layers/${sanitizePathId(layer.id)}.toml`,
      mimeType: "text/plain",
      text: serializeCanvasLayerToml(layer),
    });
  }

  for (const objectId of getObjectOrder(document)) {
    const object = document.objects[objectId];
    files.push({
      path: getObjectAssetPath(object),
      mimeType: "text/plain",
      text: serializeCanvasObjectToml(object),
    });
  }

  if (options?.commands && (options.includeSessionCommands ?? true)) {
    files.push({
      path: "commands/session-commands.toml",
      mimeType: "text/plain",
      text: serializeCanvasCommandsToml(
        "MachinaCanvas session commands",
        options.commands,
        "Commands exported from the current browser-local MachinaCanvas session.",
      ),
    });
  }

  if (options?.tsxOptions !== undefined && options.tsxOptions !== false) {
    const tsx = lowerCanvasDocumentToTsx(document, options?.tsxOptions);
    files.push({
      path: tsx.path,
      mimeType: "text/typescript",
      text: tsx.text,
    });
  }

  return { rootName, files };
}
