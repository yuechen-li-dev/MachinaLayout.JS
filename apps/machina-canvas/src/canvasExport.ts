import type { CanvasCommand } from "./sceneCommands";
import type { GeometryDiagnostic } from "./sceneGeometry";
import type { CanvasDocument, CanvasLayer, CanvasObject, TextObject } from "./sceneModel";
import { summarizeScene } from "./sceneSummary";

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

function pushMetadata(lines: string[], tags?: readonly string[], notes?: string) {
  if (!tags?.length && !notes) return;

  lines.push("", "[metadata]");
  if (tags?.length) lines.push(`tags = ${serializeTomlArray(tags)}`);
  if (notes) lines.push(`notes = ${quoteTomlString(notes)}`);
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
        unit: document.unit,
      },
      layers: document.layers.map((layer) => ({
        id: layer.id,
        asset: `layers/${sanitizePathId(layer.id)}.toml`,
        objectIds: [...layer.objectIds],
      })),
      objects,
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
  },
): string {
  const selectedObjectId = options?.selectedObjectId ?? document.selectedObjectId;
  const diagnostics = options?.diagnostics ?? [];
  const lines = [
    "schema_version = 1",
    `name = ${quoteTomlString(options?.rootName ?? document.name)}`,
    'created_by = "MachinaCanvas"',
    'source_app = "apps/machina-canvas"',
    "",
    'render_svg = "render.svg"',
    'document_json = "document.json"',
  ];

  if (selectedObjectId) {
    lines.push("", "[selected]", `object_id = ${quoteTomlString(selectedObjectId)}`);
  }

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

  return `${lines.join("\n")}\n`;
}

export function serializeCanvasRenderSvg(document: CanvasDocument): string {
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">`,
  ];

  for (const layer of document.layers) {
    if (!layer.visible) continue;
    for (const objectId of layer.objectIds) {
      const object = document.objects[objectId];
      if (object === undefined || !object.visible) continue;

      const attrs = `data-canvas-object-id="${quoteXmlAttribute(object.id)}" data-canvas-kind="${quoteXmlAttribute(object.kind)}" data-canvas-name="${quoteXmlAttribute(object.name)}"`;
      if (object.kind === "rect") {
        lines.push(
          `  <rect ${attrs} x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${object.radius ?? 0}" fill="${quoteXmlAttribute(object.fill ?? "transparent")}" stroke="${quoteXmlAttribute(object.stroke ?? "none")}" />`,
        );
      } else if (object.kind === "ellipse") {
        lines.push(
          `  <ellipse ${attrs} cx="${object.x + object.width / 2}" cy="${object.y + object.height / 2}" rx="${object.width / 2}" ry="${object.height / 2}" fill="${quoteXmlAttribute(object.fill ?? "transparent")}" stroke="${quoteXmlAttribute(object.stroke ?? "none")}" />`,
        );
      } else {
        lines.push(
          `  <text ${attrs} x="${object.x}" y="${object.y + object.fontSize}" fill="${quoteXmlAttribute(object.fill ?? "#111111")}" font-size="${object.fontSize}"${object.fontWeight !== undefined ? ` font-weight="${quoteXmlAttribute(String(object.fontWeight))}"` : ""}>`,
        );
        wrapText(object).forEach((line, index) => {
          lines.push(
            `    <tspan x="${object.x}" dy="${index === 0 ? 0 : object.fontSize * 1.12}">${escapeXmlText(line)}</tspan>`,
          );
        });
        lines.push("  </text>");
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
