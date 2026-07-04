import type { CanvasCommand } from "./sceneCommands";
import type { GeometryDiagnostic } from "./sceneGeometry";
import { getCanvasUnitSystem } from "./canvasUnits";
import type { CanvasViewport, CanvasViewportFocus } from "./canvasViewport";
import type {
  CanvasDocument,
  CanvasFrame,
  ImageObject,
  CanvasLayer,
  CanvasObject,
  TextObject,
} from "./sceneModel";
import { getCanvasImageMaskId, getImagePreserveAspectRatio } from "./canvasImageSvg";
import { summarizeScene } from "./sceneSummary";
import { createReferenceGridConfig, getColumnLabel } from "./referenceGrid";
import type { NormalizedRasterExportOptions } from "./rasterExport";

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

function tomlValue(value: string | number | boolean): string {
  return typeof value === "string" ? quoteTomlString(value) : String(value);
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

export function serializeCanvasDocumentJson(document: CanvasDocument): string {
  const objects: Record<string, { kind: CanvasObject["kind"]; asset: string }> = {};

  for (const objectId of getObjectOrder(document)) {
    const object = document.objects[objectId];
    objects[objectId] = {
      kind: object.kind,
      asset: `objects/${sanitizePathId(objectId)}.toml`,
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
      relations: getAlphaMapRelations(document),
    },
    null,
    2,
  );
}

export function serializeCanvasObjectToml(object: CanvasObject): string {
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
    if (command.kind === "addImageObject") continue;

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
      } else {
        lines.push(
          serializeImageElement(
            object,
            object.alphaMapId ? getCanvasImageMaskId(object.id) : undefined,
          ),
        );
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
      path: `objects/${sanitizePathId(object.id)}.toml`,
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

  return { rootName, files };
}
