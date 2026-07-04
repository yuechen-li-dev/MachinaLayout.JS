import type { CanvasExportBundle, CanvasExportFile } from "./canvasExport";

export type CanvasExportValidationSeverity = "error" | "warning" | "info";

export type CanvasExportValidationDiagnosticCode =
  | "MissingRequiredFile"
  | "InvalidDocumentJson"
  | "MissingLayerAsset"
  | "MissingObjectAsset"
  | "UnknownLayerObject"
  | "UnknownObjectAsset"
  | "MissingRenderObject"
  | "MissingHandoff"
  | "InvalidHandoffReference"
  | "InvalidUnitSystem"
  | "InvalidCompositeRelation"
  | "MissingCompositeMask"
  | "MissingCommandRecipe"
  | "EmptyExportBundle";

export type CanvasExportValidationDiagnostic = {
  severity: CanvasExportValidationSeverity;
  code: CanvasExportValidationDiagnosticCode;
  message: string;
  path?: string;
  objectId?: string;
  layerId?: string;
};

export type CanvasExportValidationResult = {
  ok: boolean;
  diagnostics: CanvasExportValidationDiagnostic[];
};

export type CanvasExportValidationOptions = {
  requireRenderSvg?: boolean;
  requireHandoffToml?: boolean;
  requireCommandRecipeWhenCommandsExist?: boolean;
  checkRenderObjectIds?: boolean;
  expectedCommands?: boolean;
};

type DocumentIndex = {
  document: {
    id: string;
    width: number;
    height: number;
    unitSystem?: unknown;
  };
  layers: Array<{
    id: string;
    asset: string;
    objectIds: string[];
  }>;
  objects: Record<
    string,
    {
      kind?: string;
      asset: string;
    }
  >;
  relations?: Array<{
    kind: string;
    sourceId: string;
    alphaId: string;
  }>;
};

const defaultOptions = {
  requireRenderSvg: true,
  requireHandoffToml: true,
  requireCommandRecipeWhenCommandsExist: true,
  checkRenderObjectIds: true,
} satisfies Required<Omit<CanvasExportValidationOptions, "expectedCommands">>;

function getFile(bundle: CanvasExportBundle, path: string): CanvasExportFile | undefined {
  return bundle.files.find((file) => file.path === path);
}

function hasFile(bundle: CanvasExportBundle, path: string): boolean {
  return getFile(bundle, path) !== undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDocumentIndex(value: unknown): DocumentIndex | undefined {
  if (!isRecord(value)) return undefined;
  if (!isRecord(value.document)) return undefined;
  if (typeof value.document.id !== "string") return undefined;
  if (typeof value.document.width !== "number") return undefined;
  if (typeof value.document.height !== "number") return undefined;
  if (!Array.isArray(value.layers)) return undefined;
  if (!isRecord(value.objects)) return undefined;

  const layers: DocumentIndex["layers"] = [];
  for (const layer of value.layers) {
    if (!isRecord(layer)) return undefined;
    if (typeof layer.id !== "string") return undefined;
    if (typeof layer.asset !== "string") return undefined;
    if (!Array.isArray(layer.objectIds)) return undefined;
    if (!layer.objectIds.every((objectId) => typeof objectId === "string")) return undefined;
    layers.push({
      id: layer.id,
      asset: layer.asset,
      objectIds: [...layer.objectIds],
    });
  }

  const objects: DocumentIndex["objects"] = {};
  for (const [objectId, object] of Object.entries(value.objects)) {
    if (!isRecord(object)) return undefined;
    if (typeof object.asset !== "string") return undefined;
    if (object.kind !== undefined && typeof object.kind !== "string") return undefined;
    objects[objectId] = { kind: object.kind, asset: object.asset };
  }

  const relations: DocumentIndex["relations"] = [];
  if (value.relations !== undefined) {
    if (!Array.isArray(value.relations)) return undefined;
    for (const relation of value.relations) {
      if (!isRecord(relation)) return undefined;
      if (typeof relation.kind !== "string") return undefined;
      if (typeof relation.sourceId !== "string") return undefined;
      if (typeof relation.alphaId !== "string") return undefined;
      relations.push({
        kind: relation.kind,
        sourceId: relation.sourceId,
        alphaId: relation.alphaId,
      });
    }
  }

  return {
    document: {
      id: value.document.id,
      width: value.document.width,
      height: value.document.height,
      unitSystem: value.document.unitSystem,
    },
    layers,
    objects,
    relations,
  };
}

function isValidUnitSystem(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  if (typeof value.unit !== "string") return false;
  if (typeof value.label !== "string") return false;
  if (typeof value.pixelsPerUnit !== "number" || value.pixelsPerUnit <= 0) return false;
  if (typeof value.precision !== "number" || !Number.isInteger(value.precision)) return false;
  if (value.precision < 0) return false;
  if (value.unitsPerInch !== undefined && typeof value.unitsPerInch !== "number") return false;
  return true;
}

function parseDocumentJson(
  file: CanvasExportFile,
  diagnostics: CanvasExportValidationDiagnostic[],
): DocumentIndex | undefined {
  try {
    const parsed = JSON.parse(file.text) as unknown;
    const documentIndex = readDocumentIndex(parsed);
    if (!documentIndex) {
      diagnostics.push({
        severity: "error",
        code: "InvalidDocumentJson",
        path: "document.json",
        message: "document.json does not match the expected export index shape.",
      });
      return undefined;
    }
    return documentIndex;
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    diagnostics.push({
      severity: "error",
      code: "InvalidDocumentJson",
      path: "document.json",
      message: `document.json could not be parsed as JSON.${detail}`,
    });
    return undefined;
  }
}

function getTomlStringValue(text: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `(?:^|\\n)\\s*${escapedKey}\\s*=\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`,
  ).exec(text);
  if (!match) return undefined;

  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

function quoteXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getTomlBooleanValue(text: string, key: string): boolean | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)\\s*${escapedKey}\\s*=\\s*(true|false)`).exec(text);
  return match ? match[1] === "true" : undefined;
}

function getObjectToml(bundle: CanvasExportBundle, documentIndex: DocumentIndex, objectId: string) {
  const asset = documentIndex.objects[objectId]?.asset;
  return asset ? getFile(bundle, asset)?.text : undefined;
}

function isHiddenAlphaMapToml(text: string | undefined): boolean {
  if (text === undefined) return false;
  return (
    getTomlStringValue(text, "role") === "alphaMap" &&
    getTomlBooleanValue(text, "visible") === false
  );
}

function getCanvasImageMaskId(objectId: string): string {
  const sanitized = objectId.replace(/[^A-Za-z0-9_-]/g, "-");
  return `mask-${sanitized.length > 0 ? sanitized : "image"}`;
}

export function validateCanvasExportBundle(
  bundle: CanvasExportBundle,
  options?: CanvasExportValidationOptions,
): CanvasExportValidationResult {
  const resolvedOptions = { ...defaultOptions, ...options };
  const diagnostics: CanvasExportValidationDiagnostic[] = [];
  const paths = new Set(bundle.files.map((file) => file.path));

  if (bundle.files.length === 0) {
    diagnostics.push({
      severity: "error",
      code: "EmptyExportBundle",
      message: "Export bundle does not contain any files.",
    });
  }

  if (!paths.has("document.json")) {
    diagnostics.push({
      severity: "error",
      code: "MissingRequiredFile",
      path: "document.json",
      message: "Export bundle is missing required file document.json.",
    });
  }

  if (resolvedOptions.requireRenderSvg && !paths.has("render.svg")) {
    diagnostics.push({
      severity: "error",
      code: "MissingRequiredFile",
      path: "render.svg",
      message: "Export bundle is missing required file render.svg.",
    });
  }

  if (resolvedOptions.requireHandoffToml && !paths.has("handoff.toml")) {
    diagnostics.push({
      severity: "error",
      code: "MissingHandoff",
      path: "handoff.toml",
      message: "Export bundle is missing required file handoff.toml.",
    });
  }

  const documentFile = getFile(bundle, "document.json");
  const documentIndex = documentFile ? parseDocumentJson(documentFile, diagnostics) : undefined;

  if (documentIndex) {
    const objectIds = new Set(Object.keys(documentIndex.objects));

    if (!isValidUnitSystem(documentIndex.document.unitSystem)) {
      diagnostics.push({
        severity: "warning",
        code: "InvalidUnitSystem",
        path: "document.json",
        message:
          "document.unitSystem is present but does not match the expected unit metadata shape.",
      });
    }

    for (const layer of documentIndex.layers) {
      if (!hasFile(bundle, layer.asset)) {
        diagnostics.push({
          severity: "error",
          code: "MissingLayerAsset",
          path: layer.asset,
          layerId: layer.id,
          message: `Layer ${layer.id} references missing asset ${layer.asset}.`,
        });
      }

      for (const objectId of layer.objectIds) {
        if (!objectIds.has(objectId)) {
          diagnostics.push({
            severity: "error",
            code: "UnknownLayerObject",
            objectId,
            layerId: layer.id,
            message: `Layer ${layer.id} references unknown object ${objectId}.`,
          });
        }
      }
    }

    for (const [objectId, object] of Object.entries(documentIndex.objects)) {
      if (!hasFile(bundle, object.asset)) {
        diagnostics.push({
          severity: "error",
          code: "MissingObjectAsset",
          path: object.asset,
          objectId,
          message: `Object ${objectId} references missing asset ${object.asset}.`,
        });
      }
    }

    for (const path of [...paths]
      .filter((path) => path.startsWith("objects/") && path.endsWith(".toml"))
      .sort()) {
      const owner = Object.entries(documentIndex.objects).find(
        ([, object]) => object.asset === path,
      );
      if (!owner) {
        diagnostics.push({
          severity: "warning",
          code: "UnknownObjectAsset",
          path,
          message: `${path} does not correspond to an object entry in document.json.`,
        });
      }
    }

    const renderSvg = getFile(bundle, "render.svg");
    if (resolvedOptions.checkRenderObjectIds && renderSvg) {
      for (const objectId of Object.keys(documentIndex.objects).sort()) {
        if (isHiddenAlphaMapToml(getObjectToml(bundle, documentIndex, objectId))) continue;
        if (!renderSvg.text.includes(`data-canvas-object-id="${quoteXmlAttribute(objectId)}"`)) {
          diagnostics.push({
            severity: "warning",
            code: "MissingRenderObject",
            objectId,
            message: `render.svg does not contain data-canvas-object-id for ${objectId}.`,
          });
        }
      }
    }

    for (const relation of documentIndex.relations ?? []) {
      if (relation.kind !== "alphaMapFor") continue;

      const source = documentIndex.objects[relation.sourceId];
      const alpha = documentIndex.objects[relation.alphaId];
      if (source === undefined) {
        diagnostics.push({
          severity: "error",
          code: "InvalidCompositeRelation",
          path: "document.json",
          objectId: relation.sourceId,
          message: `alphaMapFor source ${relation.sourceId} is not present in document.json.`,
        });
      } else if (source.kind !== "image") {
        diagnostics.push({
          severity: "error",
          code: "InvalidCompositeRelation",
          path: "document.json",
          objectId: relation.sourceId,
          message: `alphaMapFor source ${relation.sourceId} must be an image object.`,
        });
      }

      if (alpha === undefined) {
        diagnostics.push({
          severity: "error",
          code: "InvalidCompositeRelation",
          path: "document.json",
          objectId: relation.alphaId,
          message: `alphaMapFor alpha ${relation.alphaId} is not present in document.json.`,
        });
      } else if (alpha.kind !== "image") {
        diagnostics.push({
          severity: "error",
          code: "InvalidCompositeRelation",
          path: "document.json",
          objectId: relation.alphaId,
          message: `alphaMapFor alpha ${relation.alphaId} must be an image object.`,
        });
      }

      if (renderSvg) {
        const maskId = getCanvasImageMaskId(relation.sourceId);
        if (
          !renderSvg.text.includes(`id="${quoteXmlAttribute(maskId)}"`) &&
          !renderSvg.text.includes(`mask="url(#${quoteXmlAttribute(maskId)})"`)
        ) {
          diagnostics.push({
            severity: "warning",
            code: "MissingCompositeMask",
            path: "render.svg",
            objectId: relation.sourceId,
            message: `render.svg does not contain a mask for alphaMapFor source ${relation.sourceId}.`,
          });
        }
      }
    }

    const handoffToml = getFile(bundle, "handoff.toml");
    if (handoffToml) {
      const selectedObjectId = getTomlStringValue(handoffToml.text, "object_id");
      if (selectedObjectId !== undefined && !objectIds.has(selectedObjectId)) {
        diagnostics.push({
          severity: "error",
          code: "InvalidHandoffReference",
          path: "handoff.toml",
          objectId: selectedObjectId,
          message: `handoff.toml selected object ${selectedObjectId} is not present in document.json.`,
        });
      }
    }
  }

  if (
    resolvedOptions.requireCommandRecipeWhenCommandsExist &&
    options?.expectedCommands === true &&
    !bundle.files.some((file) => file.path.startsWith("commands/") && file.path.endsWith(".toml"))
  ) {
    diagnostics.push({
      severity: "error",
      code: "MissingCommandRecipe",
      path: "commands/session-commands.toml",
      message: "Expected exported commands, but no commands/*.toml recipe file was generated.",
    });
  }

  return {
    ok: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    diagnostics,
  };
}

export function formatCanvasExportValidationReport(result: CanvasExportValidationResult): string {
  const status = result.ok ? "ok" : "failed";
  const lines = [
    `Canvas export validation: ${status}`,
    `Diagnostics: ${result.diagnostics.length}`,
  ];

  result.diagnostics.forEach((diagnostic, index) => {
    if (index === 0) lines.push("");
    else lines.push("", "");

    lines.push(`${index + 1}. ${diagnostic.severity} ${diagnostic.code}`);
    if (diagnostic.path) lines.push(`   path: ${diagnostic.path}`);
    if (diagnostic.objectId) lines.push(`   object: ${diagnostic.objectId}`);
    if (diagnostic.layerId) lines.push(`   layer: ${diagnostic.layerId}`);
    lines.push(`   message: ${diagnostic.message}`);
  });

  return lines.join("\n");
}
