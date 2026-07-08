import type { CanvasCommand } from "./sceneCommands";
import type { GeometryDiagnostic } from "./sceneGeometry";
import { createArcFromThreePoints } from "./arcGeometry";
import { getCanvasUnitSystem } from "./canvasUnits";
import { getCoordinateProfile } from "./coordinateProfiles";
import type { CanvasViewport, CanvasViewportFocus } from "./canvasViewport";
import type {
  BlockoutSidecarObject,
  CanvasDocument,
  CanvasFrame,
  GuideSidecarObject,
  CanvasSketchRef,
  CanvasUiPropValue,
  ImageObject,
  CanvasLayer,
  CanvasObject,
  CanvasSpriteFrame,
  CanvasSpriteStackframe,
  SketchOverlayObject,
  SpriteSidecarObject,
  TextObject,
  UiComponentObject,
} from "./sceneModel";
import { stringifyBlockoutSidecarToml } from "./blockoutSidecar";
import { stringifyGuideSidecarToml } from "./guideSidecar";
import {
  getMechanicalSheetDimensions,
  serializeMechanicalAnnotationOverlayContent,
  serializeMechanicalAnnotationSidecarJson,
} from "./mechanicalAnnotations";
import { getCanvasImageMaskId, getImagePreserveAspectRatio } from "./canvasImageSvg";
import { summarizeScene } from "./sceneSummary";
import { createReferenceGridConfig, getColumnLabel } from "./referenceGrid";
import type { NormalizedRasterExportOptions } from "./rasterExport";
import {
  buildSpriteOverlayLabelChip,
  createSpriteOverlayRenderPlan,
  getSpriteOverlayFrameClassNames,
  getSpriteOverlaySubgridClassNames,
  layoutSpriteOverlayLabelChip,
} from "./spriteOverlay";
import { lowerCanvasDocumentToTsx, type TsxExportOptions } from "./tsxExport";
import { resolveSketchSpec } from "./sketchOverlay";
import {
  getSpriteExpectedSourceRect,
  getSpriteFrameSourceKind,
  type SpriteSidecarExportMode,
  type SpriteTomlExportOptions,
} from "./spriteSidecar";
import {
  findGuideRegionForSpriteFrame,
  type SpriteFrameGuideRegionContext,
} from "./spriteGuideRegions";
import { compileSpriteRuntimeSidecar } from "./spriteGuideCompiler";
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

function getGuideSidecarRelations(document: CanvasDocument) {
  return getObjectOrder(document)
    .map((objectId) => document.objects[objectId])
    .filter(
      (object): object is GuideSidecarObject =>
        object.kind === "guideSidecar" &&
        object.targetId !== undefined &&
        document.objects[object.targetId] !== undefined,
    )
    .map((object) => ({
      kind: "guideSidecarFor" as const,
      sourceId: object.targetId as string,
      guideId: object.id,
    }));
}

function getBlockoutSidecarRelations(document: CanvasDocument) {
  return getObjectOrder(document)
    .map((objectId) => document.objects[objectId])
    .filter(
      (object): object is BlockoutSidecarObject =>
        object.kind === "blockoutSidecar" &&
        object.targetObjectId !== undefined &&
        document.objects[object.targetObjectId] !== undefined,
    )
    .map((object) => ({
      kind: "blockoutSidecarFor" as const,
      sourceId: object.targetObjectId as string,
      blockoutId: object.id,
    }));
}

function getObjectAssetPath(object: CanvasObject): string {
  if (object.kind === "sketchOverlay" && object.spec.dialect === "sketch") {
    return `objects/${sanitizePathId(object.id)}.sketch.toml`;
  }
  if (object.kind === "spriteSidecar") {
    return `objects/${sanitizePathId(object.id)}.sprite.toml`;
  }
  if (object.kind === "guideSidecar") {
    return `objects/${sanitizePathId(object.id)}.guide.toml`;
  }
  if (object.kind === "blockoutSidecar") {
    return `objects/${sanitizePathId(object.id)}.blockout.toml`;
  }
  if (object.kind === "mechanicalAnnotationSidecar") {
    return `objects/${sanitizePathId(object.id)}.mechanical.json`;
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
  if (focus.kind === "spriteFrame") return `${focus.sidecarId}:${focus.frameId}`;
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

function serializeBlockoutCurvePath(
  curve: Extract<CanvasObject, { kind: "blockoutSidecar" }>["blockout"]["curves"][number],
  mappedPoints: readonly { x: number; y: number }[],
): string {
  if (curve.kind === "arcCue" && mappedPoints.length >= 3) {
    const arc = createArcFromThreePoints({
      start: [mappedPoints[0].x, mappedPoints[0].y],
      through: [mappedPoints[1].x, mappedPoints[1].y],
      end: [mappedPoints[2].x, mappedPoints[2].y],
    });
    if (arc.kind === "ok" && arc.path) {
      return arc.path;
    }
  }
  return mappedPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
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
        coordinateProfile: getCoordinateProfile(document.coordinateProfileId),
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
        ...getGuideSidecarRelations(document),
        ...getBlockoutSidecarRelations(document),
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
    `dialect = ${quoteTomlString(object.spec.dialect)}`,
    `visible = ${object.visible}`,
  ];
  if (object.targetId !== undefined) {
    lines.splice(3, 0, `target_id = ${quoteTomlString(object.targetId)}`);
  }

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
  const sourceKind = getSpriteFrameSourceKind(frame);
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
  setTomlField(table, "source_kind", sourceKind, sourceKind !== "unknown");
  setTomlField(table, "source_grid", frame.sourceGridId);
  setTomlField(table, "source_row", frame.sourceRow);
  setTomlField(table, "source_column", frame.sourceColumn);
  setTomlField(table, "source_frame", frame.sourceFrameId);
  setTomlField(table, "source_stackframe", frame.sourceStackframeId);
  setTomlField(table, "source_stack_index", frame.sourceStackIndex);
  setTomlField(table, "pivot", frame.pivot);
  setTomlField(table, "kind", frame.kind);
  return table;
}

function createSpriteStackframeTomlTable(
  stackframe: CanvasSpriteStackframe,
): Record<string, unknown> {
  const table: Record<string, unknown> = {
    x: stackframe.x,
    y: stackframe.y,
    width: stackframe.width,
    height: stackframe.height,
    count: stackframe.count,
    direction: stackframe.direction,
    step: stackframe.step,
  };
  setTomlField(table, "labels", stackframe.labels);
  setTomlField(table, "sprite", stackframe.spriteId);
  setTomlField(table, "animation", stackframe.animationId);
  setTomlField(table, "row", stackframe.row);
  setTomlField(table, "column", stackframe.column);
  setTomlField(table, "description", stackframe.description);
  return table;
}

function createSpriteStackframesTomlRecord(object: SpriteSidecarObject): Record<string, unknown> {
  const stackframes: Record<string, unknown> = {};
  for (const stackframe of object.spec.stackframes) {
    stackframes[stackframe.id] = createSpriteStackframeTomlTable(stackframe);
  }
  return stackframes;
}

function frameMatchesRect(
  frame: CanvasSpriteFrame,
  rect?: { x: number; y: number; width: number; height: number },
) {
  return (
    rect !== undefined &&
    frame.x === rect.x &&
    frame.y === rect.y &&
    frame.width === rect.width &&
    frame.height === rect.height
  );
}

function shouldExportFrameExplicitly(
  object: SpriteSidecarObject,
  frame: CanvasSpriteFrame,
  options?: SpriteTomlExportOptions,
) {
  const sourceKind = getSpriteFrameSourceKind(frame);
  if (sourceKind !== "stackframe") return true;
  if (options?.includeStackframes === false) return true;
  const expected = getSpriteExpectedSourceRect(frame, object.spec.grids, object.spec.stackframes);
  return !frameMatchesRect(frame, expected);
}

function createSpriteFramesTomlRecord(
  object: SpriteSidecarObject,
  options?: SpriteTomlExportOptions,
): Record<string, unknown> {
  const frames: Record<string, unknown> = {};
  for (const frame of object.spec.frames) {
    if (!shouldExportFrameExplicitly(object, frame, options)) continue;
    frames[frame.id] = createSpriteFrameTomlTable(frame);
  }
  return frames;
}

function createSpriteGridsTomlRecord(object: SpriteSidecarObject): Record<string, unknown> {
  const grids: Record<string, unknown> = {};
  for (const grid of object.spec.grids.filter((candidate) => candidate.source !== "roughCutGrid")) {
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

function createSpriteCutGridsTomlRecord(object: SpriteSidecarObject): Record<string, unknown> {
  const grids: Record<string, unknown> = {};
  for (const grid of object.spec.grids.filter((candidate) => candidate.source === "roughCutGrid")) {
    const table: Record<string, unknown> = {
      x: grid.x,
      y: grid.y,
      columns: grid.columns,
      rows: grid.rows,
      cell_width: grid.cellWidth,
      cell_height: grid.cellHeight,
    };
    setTomlField(table, "kind", grid.gridKind);
    setTomlField(table, "prefix", grid.framePrefix);
    setTomlField(table, "start_index", grid.frameStartIndex);
    setTomlField(table, "labels", grid.frameLabels);
    setTomlField(table, "pivot", grid.pivot);
    grids[grid.id] = table;
  }
  return grids;
}

function isFrameExportableAsGridCell(
  frame: CanvasSpriteFrame,
  object: SpriteSidecarObject,
  options?: { gridId?: string; row?: number },
) {
  if (getSpriteFrameSourceKind(frame) !== "grid") return false;
  const expected = getSpriteExpectedSourceRect(frame, object.spec.grids);
  if (!expected) return false;
  if (
    frame.x !== expected.x ||
    frame.y !== expected.y ||
    frame.width !== expected.width ||
    frame.height !== expected.height
  ) {
    return false;
  }
  if (options?.gridId !== undefined && frame.sourceGridId !== options.gridId) return false;
  if (options?.row !== undefined && frame.sourceRow !== options.row) return false;
  return frame.sourceColumn !== undefined;
}

function createSpriteForgeTomlRecord(object: SpriteSidecarObject): Record<string, unknown> {
  const grids = createSpriteGridsTomlRecord(object);
  const cutGrids = createSpriteCutGridsTomlRecord(object);
  const stackframes = createSpriteStackframesTomlRecord(object);
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
      (frame) => frame.animationId === undefined && isFrameExportableAsGridCell(frame, object),
    );
    const spriteTable: Record<string, unknown> = {
      display_name: directFrame?.label ?? spriteFrames[0]?.label ?? spriteId,
    };
    setTomlField(spriteTable, "kind", directFrame?.kind);
    setTomlField(spriteTable, "grid", directFrame?.sourceGridId ?? directFrame?.gridId);
    setTomlField(spriteTable, "row", directFrame?.sourceRow ?? directFrame?.row);
    setTomlField(spriteTable, "col", directFrame?.sourceColumn ?? directFrame?.column);
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
              isFrameExportableAsGridCell(frame, object, {
                gridId: animation.gridId,
                row: animation.row,
              })
            ) {
              return frame.sourceColumn;
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

  const record: Record<string, unknown> = {
    sprites,
    frames: createSpriteFramesTomlRecord(object),
  };
  if (Object.keys(grids).length > 0) record.grids = grids;
  if (Object.keys(cutGrids).length > 0) record.cut_grids = cutGrids;
  if (Object.keys(stackframes).length > 0) record.stackframes = stackframes;
  return record;
}

function createRuntimeSpriteTomlRecord(object: SpriteSidecarObject): Record<string, unknown> {
  const stackframes = createSpriteStackframesTomlRecord(object);
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
    const directFrame = spriteFrames.find((frame) => frame.animationId === undefined);
    const spriteTable: Record<string, unknown> = {};
    setTomlField(spriteTable, "display_name", directFrame?.label ?? spriteId);
    setTomlField(spriteTable, "kind", directFrame?.kind);
    setTomlField(spriteTable, "frame", directFrame?.id);

    const animationEntries = object.spec.animations.filter(
      (candidate) => candidate.spriteId === spriteId,
    );
    if (animationEntries.length > 0) {
      const animationsTable: Record<string, unknown> = {};
      for (const animation of animationEntries) {
        const animationTable: Record<string, unknown> = {
          frames: [...animation.frameIds],
        };
        setTomlField(animationTable, "fps", animation.fps);
        setTomlField(animationTable, "loop", animation.loop);
        animationsTable[animation.id] = animationTable;
      }
      spriteTable.animations = animationsTable;
    }

    sprites[spriteId] = spriteTable;
  }

  const record: Record<string, unknown> = {
    frames: createSpriteFramesTomlRecord(object, { mode: "runtime", includeStackframes: true }),
  };
  if (Object.keys(sprites).length > 0) record.sprites = sprites;
  if (Object.keys(stackframes).length > 0) record.stackframes = stackframes;
  return record;
}

function createCanvasSpriteTomlDocument(
  object: SpriteSidecarObject,
  options?: SpriteTomlExportOptions,
): Record<string, unknown> {
  const mode: SpriteSidecarExportMode = options?.mode ?? "authoring";
  if (mode === "runtime") {
    const document: Record<string, unknown> = {};
    if (object.spec.atlasImage || object.spec.atlasWidth || object.spec.atlasHeight) {
      const atlas: Record<string, unknown> = {};
      setTomlField(atlas, "image", object.spec.atlasImage);
      setTomlField(atlas, "width", object.spec.atlasWidth);
      setTomlField(atlas, "height", object.spec.atlasHeight);
      document.atlas = atlas;
    }
    Object.assign(document, createRuntimeSpriteTomlRecord(object));
    return document;
  }

  const document: Record<string, unknown> = {
    id: object.spec.id,
    kind: object.kind,
    name: object.spec.name,
    dialect: object.spec.dialect,
    visible: object.visible,
    overlay: {
      display_mode: object.spec.overlay.displayMode,
      show_bounds: object.spec.overlay.showBounds,
      show_labels: object.spec.overlay.showLabels,
      selected_only: object.spec.overlay.selectedOnly,
      show_subgrids: object.spec.overlay.showSubgrids,
      show_exact_frames: object.spec.overlay.showExactFrames,
    },
  };
  setTomlField(document, "target_id", object.targetId);

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
    document.frames = createSpriteFramesTomlRecord(object, options);
    const stackframes = createSpriteStackframesTomlRecord(object);
    if (Object.keys(stackframes).length > 0) document.stackframes = stackframes;
  }

  return document;
}

export function serializeCanvasSpriteToml(
  object: SpriteSidecarObject,
  options?: SpriteTomlExportOptions,
): string {
  const mode = options?.mode ?? "authoring";
  if (mode === "authoring" && object.spec.rawToml) return `${object.spec.rawToml.trimEnd()}\n`;
  return `${stringifyTomlDocument(createCanvasSpriteTomlDocument(object, options)).trimEnd()}\n`;
}

export function stringifyRuntimeSpriteToml(compiled: SpriteSidecarObject): string {
  return serializeCanvasSpriteToml(compiled, { mode: "runtime" });
}

export function serializeCompiledRuntimeSpriteToml(input: {
  readonly spriteSidecar: SpriteSidecarObject;
  readonly guideSidecar?: GuideSidecarObject;
  readonly options?: SpriteTomlExportOptions;
}): string {
  const compiled = compileSpriteRuntimeSidecar({
    spriteSidecar: input.spriteSidecar.spec,
    guideSidecar: input.guideSidecar?.guide,
    options: { mode: "runtime", ...input.options },
  });
  const runtimeSidecar: SpriteSidecarObject = {
    ...input.spriteSidecar,
    spec: compiled.spriteSidecar,
  };
  return stringifyRuntimeSpriteToml(runtimeSidecar);
}

export function serializeCanvasObjectToml(object: CanvasObject): string {
  if (object.kind === "sketchOverlay") {
    return serializeCanvasSketchToml(object);
  }
  if (object.kind === "spriteSidecar") {
    return serializeCanvasSpriteToml(object);
  }
  if (object.kind === "guideSidecar") {
    return stringifyGuideSidecarToml(object.guide);
  }
  if (object.kind === "blockoutSidecar") {
    return stringifyBlockoutSidecarToml(object.blockout);
  }
  if (object.kind === "mechanicalAnnotationSidecar") {
    return serializeMechanicalAnnotationSidecarJson(object);
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

  if (object.kind === "path") {
    lines.push("", "[path]", `d = ${quoteTomlString(object.d)}`);
    if (object.fillRule !== undefined)
      lines.push(`fill_rule = ${quoteTomlString(object.fillRule)}`);
    if (object.strokeWidth !== undefined) lines.push(`stroke_width = ${object.strokeWidth}`);
    if (object.strokeDasharray !== undefined) {
      lines.push(`stroke_dasharray = ${quoteTomlString(object.strokeDasharray)}`);
    }
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
    if (
      command.kind === "addImageObject" ||
      command.kind === "addSpriteSidecarObject" ||
      command.kind === "addGuideSidecarObject"
    ) {
      continue;
    }

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
      case "attachGuideSidecar":
        lines.push(
          `source_id = ${quoteTomlString(command.sourceId)}`,
          `guide_id = ${quoteTomlString(command.guideId)}`,
        );
        break;
      case "detachGuideSidecar":
        lines.push(`guide_id = ${quoteTomlString(command.guideId)}`);
        break;
      case "setGuideSidecarVisible":
        lines.push(
          `guide_id = ${quoteTomlString(command.guideId)}`,
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
      case "clampSpriteFrameToGuideRegion":
        lines.push(
          `sidecar_id = ${quoteTomlString(command.sidecarId)}`,
          `frame_id = ${quoteTomlString(command.frameId)}`,
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

  for (const relation of getGuideSidecarRelations(document)) {
    lines.push(
      "",
      "[[guide_sidecar]]",
      `source_id = ${quoteTomlString(relation.sourceId)}`,
      `guide_id = ${quoteTomlString(relation.guideId)}`,
      `path = ${quoteTomlString(getObjectAssetPath(document.objects[relation.guideId]))}`,
    );
  }

  for (const relation of getBlockoutSidecarRelations(document)) {
    lines.push(
      "",
      "[[blockout_sidecar]]",
      `source_id = ${quoteTomlString(relation.sourceId)}`,
      `blockout_id = ${quoteTomlString(relation.blockoutId)}`,
      `path = ${quoteTomlString(getObjectAssetPath(document.objects[relation.blockoutId]))}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function getSvgObjectAttributes(object: CanvasObject): string {
  return `data-canvas-object-id="${quoteXmlAttribute(object.id)}" data-canvas-kind="${quoteXmlAttribute(object.kind)}" data-canvas-name="${quoteXmlAttribute(object.name)}"`;
}

function getSvgPaint(value: string | undefined, fallback: string): string {
  return value === "transparent" ? "none" : (value ?? fallback);
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

function getVisibleGuideSidecars(
  document: CanvasDocument,
  object: ImageObject,
): readonly GuideSidecarObject[] {
  if (!object.visible) return [];
  return Object.values(document.objects).filter(
    (candidate): candidate is GuideSidecarObject =>
      candidate.kind === "guideSidecar" && candidate.visible && candidate.targetId === object.id,
  );
}

function getVisibleBlockoutSidecars(
  document: CanvasDocument,
  object: CanvasObject,
): readonly BlockoutSidecarObject[] {
  if (!object.visible) return [];
  return Object.values(document.objects).filter(
    (candidate): candidate is BlockoutSidecarObject =>
      candidate.kind === "blockoutSidecar" &&
      candidate.visible &&
      candidate.targetObjectId === object.id,
  );
}

function mapSpriteFrameToCanvasRect(
  object: ImageObject,
  frame: Pick<CanvasSpriteFrame, "x" | "y" | "width" | "height">,
) {
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
  selectedGuideRegionContext?: SpriteFrameGuideRegionContext,
): string[] {
  const lines = [
    `  <g class="canvas-sprite-overlay" data-canvas-object-id="${quoteXmlAttribute(sidecar.id)}" data-canvas-kind="spriteSidecar" data-canvas-name="${quoteXmlAttribute(sidecar.name)}">`,
  ];
  const plan = createSpriteOverlayRenderPlan(sidecar);

  for (const grid of sidecar.spec.grids) {
    const presentation = plan.subgridPresentations.get(grid.id);
    if (!presentation?.showRect) continue;
    const rect = mapSpriteFrameToCanvasRect(object, grid);
    const fill =
      presentation.emphasis === "context" ? "rgba(23, 91, 201, 0.06)" : "rgba(23, 91, 201, 0.02)";
    const stroke = presentation.emphasis === "context" ? "#175bc9" : "#7f9bc6";
    lines.push(
      `    <rect class="${getSpriteOverlaySubgridClassNames(presentation)}" data-canvas-sprite-subgrid-id="${quoteXmlAttribute(grid.id)}" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${fill}" stroke="${stroke}" stroke-dasharray="${presentation.emphasis === "context" ? "10 6" : "6 8"}" pointer-events="none" />`,
    );
    if (presentation.showLabel) {
      lines.push(
        `    <text class="canvas-sprite-subgrid-label${presentation.emphasis === "context" ? " sprite-subgrid--context" : presentation.emphasis === "dimmed" ? " sprite-subgrid--dimmed" : ""}" data-canvas-sprite-subgrid-id="${quoteXmlAttribute(grid.id)}" x="${rect.x + 6}" y="${rect.y + 16}" pointer-events="none">${escapeXmlText(grid.id)}</text>`,
      );
    }
  }

  const imageRect = { x: object.x, y: object.y, width: object.width, height: object.height };
  for (const frame of sidecar.spec.frames) {
    const presentation = plan.framePresentations.get(frame.id);
    if (!presentation) continue;
    const rect = mapSpriteFrameToCanvasRect(object, frame);
    if (presentation.showRect) {
      const fill =
        presentation.emphasis === "selected"
          ? "rgba(255, 196, 0, 0.18)"
          : presentation.emphasis === "hovered"
            ? "rgba(255, 196, 0, 0.1)"
            : presentation.sourceKind === "grid"
              ? presentation.emphasis === "dimmed"
                ? "rgba(0, 160, 140, 0.03)"
                : "rgba(0, 160, 140, 0.08)"
              : presentation.emphasis === "dimmed"
                ? "rgba(201, 95, 23, 0.03)"
                : "rgba(201, 95, 23, 0.08)";
      const stroke =
        presentation.emphasis === "selected"
          ? "#ffb000"
          : presentation.emphasis === "hovered"
            ? "#ffcf5d"
            : presentation.emphasis === "audit"
              ? "#d64242"
              : presentation.emphasis === "dimmed"
                ? presentation.sourceKind === "grid"
                  ? "#8abaae"
                  : "#d9a27f"
                : presentation.sourceKind === "grid"
                  ? "#00a08c"
                  : presentation.sourceKind === "manual"
                    ? "#8f3fd1"
                    : "#c95f17";
      lines.push(
        `    <rect class="${getSpriteOverlayFrameClassNames(presentation)}${
          frame.id === sidecar.spec.selectedFrameId &&
          selectedGuideRegionContext &&
          selectedGuideRegionContext.relation !== "contains"
            ? " sprite-frame--outside-guide"
            : ""
        }" data-canvas-sprite-frame-id="${quoteXmlAttribute(frame.id)}" data-canvas-sprite-source-kind="${quoteXmlAttribute(presentation.sourceKind)}" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${fill}" stroke="${stroke}" pointer-events="none" />`,
      );
    }
    if (presentation.showLabel) {
      const chip = buildSpriteOverlayLabelChip(
        frame,
        presentation.sourceKind,
        presentation.emphasis,
      );
      const labelRect = layoutSpriteOverlayLabelChip(rect, imageRect, chip);
      const labelClass =
        presentation.labelTone === "selected"
          ? "canvas-sprite-label sprite-frame-label--selected"
          : presentation.labelTone === "hovered"
            ? "canvas-sprite-label sprite-frame-label--hovered"
            : presentation.labelTone === "audit"
              ? "canvas-sprite-label sprite-frame-label--audit"
              : "canvas-sprite-label";
      const chipClass =
        presentation.labelTone === "selected"
          ? "canvas-sprite-label-chip sprite-frame-label--selected"
          : presentation.labelTone === "hovered"
            ? "canvas-sprite-label-chip sprite-frame-label--hovered"
            : presentation.labelTone === "audit"
              ? "canvas-sprite-label-chip sprite-frame-label--audit"
              : "canvas-sprite-label-chip";
      lines.push(
        `    <rect class="${chipClass}" data-canvas-sprite-frame-id="${quoteXmlAttribute(frame.id)}" x="${labelRect.x}" y="${labelRect.y}" width="${labelRect.width}" height="${labelRect.height}" rx="6" ry="6" pointer-events="none" />`,
      );
      lines.push(
        `    <text class="${labelClass}" data-canvas-sprite-frame-id="${quoteXmlAttribute(frame.id)}" x="${labelRect.x + 8}" y="${labelRect.titleY}" pointer-events="none">${escapeXmlText(chip.title)}</text>`,
      );
      if (chip.detail && labelRect.detailY !== undefined) {
        lines.push(
          `    <text class="canvas-sprite-label-meta" data-canvas-sprite-frame-id="${quoteXmlAttribute(frame.id)}" x="${labelRect.x + 8}" y="${labelRect.detailY}" pointer-events="none">${escapeXmlText(chip.detail)}</text>`,
        );
      }
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

function serializeResolvedGuideSidecar(
  object: ImageObject,
  guideObject: GuideSidecarObject,
  selectedGuideRegionContext?: SpriteFrameGuideRegionContext,
): string[] {
  const scaleX = object.width / (object.intrinsicWidth ?? object.width);
  const scaleY = object.height / (object.intrinsicHeight ?? object.height);
  const mapPoint = (x: number, y: number) => ({
    x: object.x + x * scaleX,
    y: object.y + y * scaleY,
  });
  const opacity = guideObject.opacity ?? 0.9;
  const showLabels = guideObject.showLabels ?? true;
  const lines = [
    `  <g class="canvas-guide-overlay" data-canvas-object-id="${quoteXmlAttribute(guideObject.id)}" data-canvas-kind="guideSidecar" data-canvas-name="${quoteXmlAttribute(guideObject.name)}" opacity="${opacity}">`,
  ];
  for (const region of guideObject.guide.regions) {
    const origin = mapPoint(region.x, region.y);
    const width = region.width * scaleX;
    const height = region.height * scaleY;
    const isSelectedContextRegion =
      selectedGuideRegionContext?.guideSidecarId === guideObject.id &&
      selectedGuideRegionContext.regionId === region.id;
    const isWarningRegion =
      isSelectedContextRegion && selectedGuideRegionContext.relation !== "contains";
    lines.push(
      `    <rect class="canvas-guide-region${
        isSelectedContextRegion ? " guide-region--selected-context" : ""
      }${isWarningRegion ? " guide-region--warning" : ""}" data-canvas-guide-region-id="${quoteXmlAttribute(region.id)}" x="${origin.x}" y="${origin.y}" width="${width}" height="${height}" fill="${
        isSelectedContextRegion ? "rgba(255, 122, 0, 0.1)" : "rgba(233, 77, 26, 0.06)"
      }" stroke="${
        isWarningRegion ? "#d64242" : isSelectedContextRegion ? "#ff7a00" : "#e94d1a"
      }" stroke-dasharray="${
        isWarningRegion ? "10 4" : isSelectedContextRegion ? "10 5" : "8 6"
      }" pointer-events="none" />`,
    );
    if (showLabels) {
      lines.push(
        `    <text class="canvas-guide-label" x="${origin.x + 6}" y="${origin.y + 16}" pointer-events="none">${escapeXmlText(region.id)}</text>`,
      );
    }
    if (region.grid) {
      for (let index = 0; index < region.grid.columns - 1; index += 1) {
        const x = origin.x + (index + 1) * region.grid.cellWidth * scaleX;
        lines.push(
          `    <line class="canvas-guide-grid" x1="${x}" y1="${origin.y}" x2="${x}" y2="${origin.y + height}" stroke="#f58d61" pointer-events="none" />`,
        );
      }
      for (let index = 0; index < region.grid.rows - 1; index += 1) {
        const y = origin.y + (index + 1) * region.grid.cellHeight * scaleY;
        lines.push(
          `    <line class="canvas-guide-grid" x1="${origin.x}" y1="${y}" x2="${origin.x + width}" y2="${y}" stroke="#f58d61" pointer-events="none" />`,
        );
      }
    }
  }
  for (const datum of guideObject.guide.datums) {
    if (datum.kind === "vertical") {
      const x = object.x + datum.x * scaleX;
      lines.push(
        `    <line class="canvas-guide-datum" x1="${x}" y1="${object.y}" x2="${x}" y2="${object.y + object.height}" stroke="#d9480f" pointer-events="none" />`,
      );
      if (showLabels) {
        lines.push(
          `    <text class="canvas-guide-label" x="${x + 4}" y="${object.y + 14}" pointer-events="none">${escapeXmlText(datum.label ?? datum.id)}</text>`,
        );
      }
      continue;
    }
    if (datum.kind === "horizontal") {
      const y = object.y + datum.y * scaleY;
      lines.push(
        `    <line class="canvas-guide-datum" x1="${object.x}" y1="${y}" x2="${object.x + object.width}" y2="${y}" stroke="#d9480f" pointer-events="none" />`,
      );
      if (showLabels) {
        lines.push(
          `    <text class="canvas-guide-label" x="${object.x + 6}" y="${y - 4}" pointer-events="none">${escapeXmlText(datum.label ?? datum.id)}</text>`,
        );
      }
      continue;
    }
    const point = mapPoint(datum.x, datum.y);
    lines.push(
      `    <line class="canvas-guide-datum" x1="${point.x - 6}" y1="${point.y}" x2="${point.x + 6}" y2="${point.y}" stroke="#d9480f" pointer-events="none" />`,
      `    <line class="canvas-guide-datum" x1="${point.x}" y1="${point.y - 6}" x2="${point.x}" y2="${point.y + 6}" stroke="#d9480f" pointer-events="none" />`,
    );
    if (showLabels) {
      lines.push(
        `    <text class="canvas-guide-label" x="${point.x + 8}" y="${point.y - 8}" pointer-events="none">${escapeXmlText(datum.label ?? datum.id)}</text>`,
      );
    }
  }
  for (const dimension of guideObject.guide.dimensions) {
    if (dimension.kind !== "linear" || !dimension.from || !dimension.to) continue;
    const from = mapPoint(dimension.from[0], dimension.from[1]);
    const to = mapPoint(dimension.to[0], dimension.to[1]);
    lines.push(
      `    <line class="canvas-guide-dimension" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#ff7a00" pointer-events="none" />`,
    );
    if (showLabels) {
      lines.push(
        `    <text class="canvas-guide-label" x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 - 6}" text-anchor="middle" pointer-events="none">${escapeXmlText(dimension.label)}</text>`,
      );
    }
  }
  for (const mark of guideObject.guide.alignmentMarks) {
    const point = mapPoint(mark.x, mark.y);
    lines.push(
      `    <circle class="canvas-guide-mark" cx="${point.x}" cy="${point.y}" r="4" fill="#c92a2a" pointer-events="none" />`,
      `    <line class="canvas-guide-mark" x1="${point.x - 8}" y1="${point.y}" x2="${point.x + 8}" y2="${point.y}" stroke="#c92a2a" pointer-events="none" />`,
      `    <line class="canvas-guide-mark" x1="${point.x}" y1="${point.y - 8}" x2="${point.x}" y2="${point.y + 8}" stroke="#c92a2a" pointer-events="none" />`,
    );
    if (showLabels) {
      lines.push(
        `    <text class="canvas-guide-label" x="${point.x + 8}" y="${point.y + 14}" pointer-events="none">${escapeXmlText(mark.label ?? mark.id)}</text>`,
      );
    }
  }
  lines.push("  </g>");
  return lines;
}

function serializeResolvedBlockoutSidecar(
  owner: CanvasObject,
  sidecar: BlockoutSidecarObject,
): string[] {
  const sourceWidth =
    owner.kind === "image" ? (owner.intrinsicWidth ?? owner.width) : sidecar.width || owner.width;
  const sourceHeight =
    owner.kind === "image"
      ? (owner.intrinsicHeight ?? owner.height)
      : sidecar.height || owner.height;
  const scaleX = owner.width / (sourceWidth || owner.width || 1);
  const scaleY = owner.height / (sourceHeight || owner.height || 1);
  const opacity = sidecar.opacity ?? 0.72;
  const showLabels = sidecar.showLabels ?? true;
  const mapPoint = (x: number, y: number) => ({
    x: owner.x + x * scaleX,
    y: owner.y + y * scaleY,
  });
  const lines = [
    `  <g class="canvas-blockout-overlay" data-canvas-object-id="${quoteXmlAttribute(sidecar.id)}" data-canvas-kind="blockoutSidecar" data-canvas-name="${quoteXmlAttribute(sidecar.name)}" opacity="${opacity}">`,
  ];

  for (const box of sidecar.blockout.boxes) {
    const origin = mapPoint(box.x, box.y);
    const width = box.width * scaleX;
    const height = box.height * scaleY;
    const stroke =
      box.role === "construction" ? "#ff8c00" : box.role === "void" ? "#169c46" : "#13a538";
    const fill =
      box.role === "void"
        ? "rgba(19, 165, 56, 0.06)"
        : box.role === "construction"
          ? "rgba(255, 140, 0, 0.04)"
          : "rgba(19, 165, 56, 0.12)";
    lines.push(
      `    <rect class="canvas-blockout-box${box.role === "construction" ? " blockout-role--construction" : box.role === "void" ? " blockout-role--void" : ""}" data-canvas-blockout-id="${quoteXmlAttribute(box.id)}" x="${origin.x}" y="${origin.y}" width="${width}" height="${height}" fill="${quoteXmlAttribute(fill)}" stroke="${quoteXmlAttribute(stroke)}" stroke-dasharray="${quoteXmlAttribute(box.role === "construction" ? "7 4" : box.role === "void" ? "10 4" : "8 5")}" />`,
    );
    if (showLabels && (box.label ?? box.id)) {
      lines.push(
        `    <text class="canvas-blockout-label" x="${origin.x + 6}" y="${origin.y + 16}">${escapeXmlText(box.label ?? box.id)}</text>`,
      );
    }
  }

  for (const point of sidecar.blockout.points) {
    const mapped = mapPoint(point.x, point.y);
    lines.push(
      `    <line class="canvas-blockout-point" x1="${mapped.x - 6}" y1="${mapped.y}" x2="${mapped.x + 6}" y2="${mapped.y}" stroke="#0f8f37" />`,
      `    <line class="canvas-blockout-point" x1="${mapped.x}" y1="${mapped.y - 6}" x2="${mapped.x}" y2="${mapped.y + 6}" stroke="#0f8f37" />`,
    );
    if (showLabels && (point.label ?? point.id)) {
      lines.push(
        `    <text class="canvas-blockout-label" x="${mapped.x + 8}" y="${mapped.y - 8}">${escapeXmlText(point.label ?? point.id)}</text>`,
      );
    }
  }

  for (const curve of sidecar.blockout.curves) {
    if (curve.points.length < 2) continue;
    const mappedPoints = curve.points.map((point) => mapPoint(point[0], point[1]));
    const d = serializeBlockoutCurvePath(curve, mappedPoints);
    const stroke =
      curve.role === "construction" || curve.kind === "centerline" ? "#ff8c00" : "#13a538";
    lines.push(
      `    <path class="canvas-blockout-curve${curve.role === "construction" || curve.kind === "centerline" ? " blockout-role--construction" : ""}" data-canvas-blockout-id="${quoteXmlAttribute(curve.id)}" d="${quoteXmlAttribute(d)}" fill="none" stroke="${quoteXmlAttribute(stroke)}" stroke-dasharray="${quoteXmlAttribute(curve.role === "construction" || curve.kind === "centerline" ? "6 4" : "5 3")}" />`,
    );
    if (showLabels && (curve.label ?? curve.id)) {
      const anchor = mappedPoints[0];
      lines.push(
        `    <text class="canvas-blockout-label" x="${anchor.x + 6}" y="${anchor.y - 8}">${escapeXmlText(curve.label ?? curve.id)}</text>`,
      );
    }
  }

  lines.push("  </g>");
  return lines;
}

function serializeResolvedMechanicalAnnotationSidecar(
  sidecar: Extract<CanvasObject, { kind: "mechanicalAnnotationSidecar" }>,
): string[] {
  const lines = [
    `  <g class="canvas-mechanical-overlay" data-canvas-object-id="${quoteXmlAttribute(sidecar.id)}" data-canvas-kind="mechanicalAnnotationSidecar" data-canvas-name="${quoteXmlAttribute(sidecar.name)}">`,
  ];
  const content = serializeMechanicalAnnotationOverlayContent(sidecar);
  if (content.length > 0) {
    lines.push(`    ${content}`);
  }
  lines.push("  </g>");
  return lines;
}

function getSvgSizeAttributes(document: CanvasDocument): { width: string; height: string } {
  const mechanicalSidecar = Object.values(document.objects).find(
    (object): object is Extract<CanvasObject, { kind: "mechanicalAnnotationSidecar" }> =>
      object.kind === "mechanicalAnnotationSidecar" && object.annotations.sheet !== undefined,
  );
  const mechanicalSheet = mechanicalSidecar?.annotations.sheet;
  const mechanicalDimensions = mechanicalSheet
    ? getMechanicalSheetDimensions(mechanicalSheet)
    : undefined;
  if (mechanicalSheet?.units === "mm" && mechanicalDimensions) {
    return {
      width: `${mechanicalDimensions[0]}mm`,
      height: `${mechanicalDimensions[1]}mm`,
    };
  }
  return {
    width: String(document.width),
    height: String(document.height),
  };
}

export function serializeCanvasRenderSvg(document: CanvasDocument): string {
  const size = getSvgSizeAttributes(document);
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${document.width} ${document.height}">`,
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
          `  <rect ${attrs} x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${object.radius ?? 0}" fill="${quoteXmlAttribute(getSvgPaint(object.fill, "none"))}" stroke="${quoteXmlAttribute(object.stroke ?? "none")}" />`,
        );
      } else if (object.kind === "ellipse") {
        lines.push(
          `  <ellipse ${attrs} cx="${object.x + object.width / 2}" cy="${object.y + object.height / 2}" rx="${object.width / 2}" ry="${object.height / 2}" fill="${quoteXmlAttribute(getSvgPaint(object.fill, "none"))}" stroke="${quoteXmlAttribute(object.stroke ?? "none")}" />`,
        );
      } else if (object.kind === "path") {
        lines.push(
          `  <path ${attrs} d="${quoteXmlAttribute(object.d)}" fill="${quoteXmlAttribute(getSvgPaint(object.fill, "none"))}"${object.fillRule ? ` fill-rule="${quoteXmlAttribute(object.fillRule)}"` : ""} stroke="${quoteXmlAttribute(object.stroke ?? "none")}" stroke-width="${object.strokeWidth ?? 1}"${object.strokeDasharray ? ` stroke-dasharray="${quoteXmlAttribute(object.strokeDasharray)}"` : ""} />`,
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
        const selectedGuideRegionContext =
          spriteSidecar?.spec.selectedFrameId !== undefined
            ? findGuideRegionForSpriteFrame(document, {
                spriteSidecarId: spriteSidecar.id,
                frameId: spriteSidecar.spec.selectedFrameId,
              })
            : undefined;
        for (const guideObject of getVisibleGuideSidecars(document, object)) {
          lines.push(
            ...serializeResolvedGuideSidecar(
              object,
              guideObject,
              selectedGuideRegionContext?.guideSidecarId === guideObject.id
                ? selectedGuideRegionContext
                : undefined,
            ),
          );
        }
        for (const blockoutObject of getVisibleBlockoutSidecars(document, object)) {
          lines.push(...serializeResolvedBlockoutSidecar(object, blockoutObject));
        }
        if (spriteSidecar) {
          lines.push(
            ...serializeResolvedSpriteSidecar(object, spriteSidecar, selectedGuideRegionContext),
          );
        }
      } else if (object.kind === "mechanicalAnnotationSidecar") {
        const target =
          object.targetObjectId !== undefined ? document.objects[object.targetObjectId] : undefined;
        if (target?.visible) {
          continue;
        }
        lines.push(...serializeResolvedMechanicalAnnotationSidecar(object));
      } else {
        continue;
      }

      const attachedMechanicalSidecars = Object.values(document.objects).filter(
        (candidate): candidate is Extract<CanvasObject, { kind: "mechanicalAnnotationSidecar" }> =>
          candidate.kind === "mechanicalAnnotationSidecar" &&
          candidate.visible &&
          candidate.targetObjectId === object.id,
      );
      for (const sidecar of attachedMechanicalSidecars) {
        lines.push(...serializeResolvedMechanicalAnnotationSidecar(sidecar));
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
