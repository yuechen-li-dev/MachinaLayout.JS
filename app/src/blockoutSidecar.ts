import type { BlockoutSidecarObject, CanvasObject } from "./sceneModel";
import { parseTomlDocument, stringifyTomlDocument } from "./tomlSyntax";

export type CanvasBlockoutRole = "solid" | "void" | "construction" | "reference" | "unknown";

export type CanvasBlockoutBox = {
  readonly id: string;
  readonly kind: string;
  readonly role?: CanvasBlockoutRole;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label?: string;
  readonly description?: string;
};

export type CanvasBlockoutPoint = {
  readonly id: string;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly label?: string;
};

export type CanvasBlockoutCurve = {
  readonly id: string;
  readonly kind: "arcCue" | "splineCue" | "centerline" | "pathCue";
  readonly points: readonly (readonly [number, number])[];
  readonly role?: CanvasBlockoutRole;
  readonly label?: string;
};

export type CanvasBlockoutSidecar = {
  readonly kind: "canvasBlockoutSidecar";
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly boxes: readonly CanvasBlockoutBox[];
  readonly points: readonly CanvasBlockoutPoint[];
  readonly curves: readonly CanvasBlockoutCurve[];
  readonly rawToml?: string;
};

export type CanvasBlockoutDiagnostic = {
  readonly severity: "error" | "warning" | "note";
  readonly code: string;
  readonly message: string;
  readonly itemId?: string;
  readonly path?: string;
};

const BLOCKOUT_ROLES = new Set<CanvasBlockoutRole>([
  "solid",
  "void",
  "construction",
  "reference",
  "unknown",
]);

const BLOCKOUT_CURVE_KINDS = new Set<CanvasBlockoutCurve["kind"]>([
  "arcCue",
  "splineCue",
  "centerline",
  "pathCue",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asArray(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function asTableArray(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asPoint(value: unknown): readonly [number, number] | undefined {
  const array = asArray(value);
  if (!array || array.length !== 2) return undefined;
  const x = asNumber(array[0]);
  const y = asNumber(array[1]);
  return x !== undefined && y !== undefined ? [x, y] : undefined;
}

function asRole(value: unknown): CanvasBlockoutRole | undefined {
  const role = asString(value);
  return role && BLOCKOUT_ROLES.has(role as CanvasBlockoutRole)
    ? (role as CanvasBlockoutRole)
    : undefined;
}

function formatBlockoutTomlError(
  code: "InvalidTomlSyntax" | "InvalidBlockoutTomlDocument",
  detail: string,
): string {
  return `${code}: ${detail}`;
}

function parseBlockoutTomlRoot(source: string): Record<string, unknown> {
  try {
    const root = parseTomlDocument(source);
    if (!isRecord(root)) {
      throw new Error(
        formatBlockoutTomlError(
          "InvalidBlockoutTomlDocument",
          "Blockout sidecar TOML must contain a top-level table.",
        ),
      );
    }
    return root;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("InvalidBlockoutTomlDocument:")) {
      throw error;
    }
    const detail =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : "Blockout sidecar TOML could not be parsed.";
    throw new Error(formatBlockoutTomlError("InvalidTomlSyntax", detail));
  }
}

function readBlockoutBox(table: Record<string, unknown>, index: number): CanvasBlockoutBox {
  return {
    id: asString(table.id) ?? `box-${index + 1}`,
    kind: asString(table.kind) ?? "unknown",
    role: asRole(table.role),
    x: asNumber(table.x) ?? 0,
    y: asNumber(table.y) ?? 0,
    width: asNumber(table.width) ?? 0,
    height: asNumber(table.height) ?? 0,
    label: asString(table.label),
    description: asString(table.description),
  };
}

function readBlockoutPoint(table: Record<string, unknown>, index: number): CanvasBlockoutPoint {
  return {
    id: asString(table.id) ?? `point-${index + 1}`,
    kind: asString(table.kind) ?? "point",
    x: asNumber(table.x) ?? 0,
    y: asNumber(table.y) ?? 0,
    label: asString(table.label),
  };
}

function readBlockoutCurve(table: Record<string, unknown>, index: number): CanvasBlockoutCurve {
  const kind = asString(table.kind);
  return {
    id: asString(table.id) ?? `curve-${index + 1}`,
    kind: BLOCKOUT_CURVE_KINDS.has(kind as CanvasBlockoutCurve["kind"])
      ? (kind as CanvasBlockoutCurve["kind"])
      : "pathCue",
    points: (asArray(table.points) ?? []).map(asPoint).filter((point) => point !== undefined),
    role: asRole(table.role),
    label: asString(table.label),
  };
}

export function parseBlockoutSidecarToml(source: string): CanvasBlockoutSidecar {
  const root = parseBlockoutTomlRoot(source);
  const blockoutTable = isRecord(root.blockout) ? root.blockout : undefined;
  return {
    kind: "canvasBlockoutSidecar",
    id: asString(blockoutTable?.id) ?? asString(root.id) ?? "blockout",
    name: asString(blockoutTable?.name) ?? asString(root.name),
    description: asString(blockoutTable?.description) ?? asString(root.description),
    boxes: asTableArray(root.boxes).map(readBlockoutBox),
    points: asTableArray(root.points).map(readBlockoutPoint),
    curves: asTableArray(root.curves).map(readBlockoutCurve),
    rawToml: source,
  };
}

function toBlockoutBoxToml(box: CanvasBlockoutBox): Record<string, unknown> {
  const table: Record<string, unknown> = {
    id: box.id,
    kind: box.kind,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  };
  if (box.role !== undefined) table.role = box.role;
  if (box.label !== undefined) table.label = box.label;
  if (box.description !== undefined) table.description = box.description;
  return table;
}

function toBlockoutPointToml(point: CanvasBlockoutPoint): Record<string, unknown> {
  const table: Record<string, unknown> = {
    id: point.id,
    kind: point.kind,
    x: point.x,
    y: point.y,
  };
  if (point.label !== undefined) table.label = point.label;
  return table;
}

function toBlockoutCurveToml(curve: CanvasBlockoutCurve): Record<string, unknown> {
  const table: Record<string, unknown> = {
    id: curve.id,
    kind: curve.kind,
    points: curve.points.map((point) => [...point]),
  };
  if (curve.role !== undefined) table.role = curve.role;
  if (curve.label !== undefined) table.label = curve.label;
  return table;
}

export function stringifyBlockoutSidecarToml(blockout: CanvasBlockoutSidecar): string {
  if (blockout.rawToml) {
    return `${blockout.rawToml.trimEnd()}\n`;
  }

  return `${stringifyTomlDocument({
    blockout: {
      id: blockout.id,
      name: blockout.name,
      description: blockout.description,
    },
    boxes: blockout.boxes.map(toBlockoutBoxToml),
    points: blockout.points.map(toBlockoutPointToml),
    curves: blockout.curves.map(toBlockoutCurveToml),
  }).trimEnd()}\n`;
}

function pushDiagnostic(
  diagnostics: CanvasBlockoutDiagnostic[],
  diagnostic: CanvasBlockoutDiagnostic,
) {
  diagnostics.push(diagnostic);
}

export function validateBlockoutSidecar(
  blockout: CanvasBlockoutSidecar,
): readonly CanvasBlockoutDiagnostic[] {
  const diagnostics: CanvasBlockoutDiagnostic[] = [];
  if (blockout.id.trim().length === 0) {
    pushDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidBlockoutId",
      message: "Blockout id must be a non-empty string.",
      path: "blockout.id",
    });
  }

  const seenIds = new Set<string>();
  const allItems: readonly (CanvasBlockoutBox | CanvasBlockoutPoint | CanvasBlockoutCurve)[] = [
    ...blockout.boxes,
    ...blockout.points,
    ...blockout.curves,
  ];
  for (const item of allItems) {
    if (item.id.trim().length === 0) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidBlockoutId",
        message: "Blockout items must have non-empty ids.",
        itemId: item.id,
      });
    } else if (seenIds.has(item.id)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "DuplicateBlockoutItemId",
        message: `Blockout item id "${item.id}" is duplicated.`,
        itemId: item.id,
      });
    }
    seenIds.add(item.id);
  }

  for (const box of blockout.boxes) {
    if (box.kind.trim().length === 0 || !Number.isFinite(box.x) || !Number.isFinite(box.y)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidBlockoutBox",
        message: `Blockout box "${box.id}" must have a non-empty kind and finite coordinates.`,
        itemId: box.id,
      });
    }
    if (
      !Number.isFinite(box.width) ||
      !Number.isFinite(box.height) ||
      box.width <= 0 ||
      box.height <= 0
    ) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidBlockoutBoxSize",
        message: `Blockout box "${box.id}" must have positive width and height.`,
        itemId: box.id,
      });
    }
    if (box.role !== undefined && !BLOCKOUT_ROLES.has(box.role)) {
      pushDiagnostic(diagnostics, {
        severity: "warning",
        code: "UnknownBlockoutRole",
        message: `Blockout box "${box.id}" uses unknown role "${box.role}".`,
        itemId: box.id,
      });
    }
  }

  for (const point of blockout.points) {
    if (point.kind.trim().length === 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidBlockoutPoint",
        message: `Blockout point "${point.id}" must have a non-empty kind and finite coordinates.`,
        itemId: point.id,
      });
    }
  }

  for (const curve of blockout.curves) {
    const allFinite = curve.points.every(
      (point) => Number.isFinite(point[0]) && Number.isFinite(point[1]),
    );
    if (
      curve.kind.trim().length === 0 ||
      !BLOCKOUT_CURVE_KINDS.has(curve.kind) ||
      !allFinite ||
      curve.points.length < 2
    ) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidBlockoutCurve",
        message: `Blockout curve "${curve.id}" must have a valid kind and at least two finite points.`,
        itemId: curve.id,
      });
    }
    if (curve.role !== undefined && !BLOCKOUT_ROLES.has(curve.role)) {
      pushDiagnostic(diagnostics, {
        severity: "warning",
        code: "UnknownBlockoutRole",
        message: `Blockout curve "${curve.id}" uses unknown role "${curve.role}".`,
        itemId: curve.id,
      });
    }
  }

  return diagnostics;
}

export function createBlockoutSidecarObject(
  target: CanvasObject,
  blockout: CanvasBlockoutSidecar,
  options?: { id?: string; name?: string; layerId?: string },
): BlockoutSidecarObject {
  const id = options?.id ?? blockout.id;
  return {
    id,
    name: options?.name ?? `${blockout.id}.blockout.toml`,
    kind: "blockoutSidecar",
    layerId: options?.layerId ?? target.layerId,
    visible: true,
    opacity: 0.72,
    showLabels: true,
    x: target.x,
    y: target.y,
    width: target.width,
    height: target.height,
    role: "blockoutSidecar",
    targetObjectId: target.id,
    tags: ["blockout", "sidecar"],
    notes: `${blockout.boxes.length} box${blockout.boxes.length === 1 ? "" : "es"}, ${blockout.points.length} point${blockout.points.length === 1 ? "" : "s"}, ${blockout.curves.length} curve${blockout.curves.length === 1 ? "" : "s"}.`,
    blockout: {
      ...blockout,
      id,
      name: blockout.name ?? target.name,
    },
  };
}

export function createUnattachedBlockoutSidecarObject(
  blockout: CanvasBlockoutSidecar,
  options: { id?: string; name?: string; layerId: string },
): BlockoutSidecarObject {
  const id = options.id ?? blockout.id;
  return {
    id,
    name: options.name ?? `${blockout.id}.blockout.toml`,
    kind: "blockoutSidecar",
    layerId: options.layerId,
    visible: true,
    opacity: 0.72,
    showLabels: true,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    role: "blockoutSidecar",
    tags: ["blockout", "sidecar", "unattached"],
    notes: `${blockout.boxes.length} box${blockout.boxes.length === 1 ? "" : "es"} awaiting attachment.`,
    blockout: {
      ...blockout,
      id,
    },
  };
}
