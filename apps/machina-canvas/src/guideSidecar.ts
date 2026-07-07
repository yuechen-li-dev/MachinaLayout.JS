import type { GuideSidecarObject, ImageObject } from "./sceneModel";
import { parseTomlDocument, stringifyTomlDocument } from "./tomlSyntax";

export type CanvasGuideSidecar = {
  readonly kind: "canvasGuideSidecar";
  readonly id: string;
  readonly target?: string;
  readonly units: string;
  readonly description?: string;
  readonly regions: readonly GuideRegion[];
  readonly datums: readonly GuideDatum[];
  readonly dimensions: readonly GuideDimension[];
  readonly alignmentMarks: readonly GuideAlignmentMark[];
  readonly rawToml?: string;
};

export type GuideRegion = {
  readonly id: string;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly description?: string;
  readonly grid?: GuideRegionGrid;
};

export type GuideRegionGrid = {
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly columns: number;
  readonly rows: number;
};

export type GuideDatum =
  | {
      readonly id: string;
      readonly kind: "vertical";
      readonly x: number;
      readonly label?: string;
      readonly region?: string;
    }
  | {
      readonly id: string;
      readonly kind: "horizontal";
      readonly y: number;
      readonly label?: string;
      readonly region?: string;
    }
  | {
      readonly id: string;
      readonly kind: "point";
      readonly x: number;
      readonly y: number;
      readonly label?: string;
      readonly region?: string;
    };

export type GuideDimension = {
  readonly id: string;
  readonly kind: "linear" | "angle" | "radius" | "diameter";
  readonly from?: readonly [number, number];
  readonly to?: readonly [number, number];
  readonly center?: readonly [number, number];
  readonly label: string;
  readonly units?: string;
  readonly tolerance?: string;
  readonly region?: string;
};

export type GuideAlignmentMark = {
  readonly id: string;
  readonly kind: "point";
  readonly target?: string;
  readonly x: number;
  readonly y: number;
  readonly label?: string;
  readonly region?: string;
};

export type GuideSidecarDiagnostic = {
  readonly severity: "error" | "warning" | "note";
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly regionId?: string;
  readonly datumId?: string;
  readonly dimensionId?: string;
  readonly alignmentMarkId?: string;
};

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

function formatGuideTomlError(
  code: "InvalidTomlSyntax" | "InvalidGuideTomlDocument",
  detail: string,
): string {
  return `${code}: ${detail}`;
}

function parseGuideTomlRoot(source: string): Record<string, unknown> {
  try {
    const root = parseTomlDocument(source);
    if (!isRecord(root)) {
      throw new Error(
        formatGuideTomlError(
          "InvalidGuideTomlDocument",
          "Guide sidecar TOML must contain a top-level table.",
        ),
      );
    }
    return root;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("InvalidGuideTomlDocument:")) {
      throw error;
    }
    const detail =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : "Guide sidecar TOML could not be parsed.";
    throw new Error(formatGuideTomlError("InvalidTomlSyntax", detail));
  }
}

function readRegionGrid(value: unknown): GuideRegionGrid | undefined {
  const table = isRecord(value) ? value : undefined;
  if (!table) return undefined;
  return {
    cellWidth: asNumber(table.cell_width) ?? 0,
    cellHeight: asNumber(table.cell_height) ?? 0,
    columns: asNumber(table.columns) ?? 0,
    rows: asNumber(table.rows) ?? 0,
  };
}

function readGuideRegion(table: Record<string, unknown>, index: number): GuideRegion {
  return {
    id: asString(table.id) ?? `region-${index + 1}`,
    kind: asString(table.kind) ?? "region",
    x: asNumber(table.x) ?? 0,
    y: asNumber(table.y) ?? 0,
    width: asNumber(table.width) ?? 0,
    height: asNumber(table.height) ?? 0,
    description: asString(table.description),
    grid: readRegionGrid(table.grid),
  };
}

function readGuideDatum(table: Record<string, unknown>, index: number): GuideDatum {
  const id = asString(table.id) ?? `datum-${index + 1}`;
  const kind = asString(table.kind) ?? "point";
  const label = asString(table.label);
  const region = asString(table.region);

  if (kind === "vertical") {
    return { id, kind, x: asNumber(table.x) ?? 0, label, region };
  }
  if (kind === "horizontal") {
    return { id, kind, y: asNumber(table.y) ?? 0, label, region };
  }
  return {
    id,
    kind: "point",
    x: asNumber(table.x) ?? 0,
    y: asNumber(table.y) ?? 0,
    label,
    region,
  };
}

function readGuideDimension(table: Record<string, unknown>, index: number): GuideDimension {
  return {
    id: asString(table.id) ?? `dimension-${index + 1}`,
    kind: (asString(table.kind) as GuideDimension["kind"] | undefined) ?? "linear",
    from: asPoint(table.from),
    to: asPoint(table.to),
    center: asPoint(table.center),
    label: asString(table.label) ?? "",
    units: asString(table.units),
    tolerance: asString(table.tolerance),
    region: asString(table.region),
  };
}

function readGuideAlignmentMark(table: Record<string, unknown>, index: number): GuideAlignmentMark {
  return {
    id: asString(table.id) ?? `alignment-mark-${index + 1}`,
    kind: "point",
    target: asString(table.target),
    x: asNumber(table.x) ?? 0,
    y: asNumber(table.y) ?? 0,
    label: asString(table.label),
    region: asString(table.region),
  };
}

export function parseGuideSidecarToml(source: string): CanvasGuideSidecar {
  const root = parseGuideTomlRoot(source);
  const guideTable = isRecord(root.guide) ? root.guide : undefined;
  const id = asString(guideTable?.id) ?? asString(root.id) ?? "guide";
  return {
    kind: "canvasGuideSidecar",
    id,
    target: asString(guideTable?.target) ?? asString(root.target),
    units: asString(guideTable?.units) ?? asString(root.units) ?? "px",
    description: asString(guideTable?.description) ?? asString(root.description),
    regions: asTableArray(root.regions).map(readGuideRegion),
    datums: asTableArray(root.datums).map(readGuideDatum),
    dimensions: asTableArray(root.dimensions).map(readGuideDimension),
    alignmentMarks: asTableArray(root.alignment_marks).map(readGuideAlignmentMark),
    rawToml: source,
  };
}

function toRegionToml(region: GuideRegion): Record<string, unknown> {
  const table: Record<string, unknown> = {
    id: region.id,
    kind: region.kind,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
  };
  if (region.description !== undefined) table.description = region.description;
  if (region.grid) {
    table.grid = {
      cell_width: region.grid.cellWidth,
      cell_height: region.grid.cellHeight,
      columns: region.grid.columns,
      rows: region.grid.rows,
    };
  }
  return table;
}

function toDatumToml(datum: GuideDatum): Record<string, unknown> {
  const table: Record<string, unknown> = { id: datum.id, kind: datum.kind };
  if ("x" in datum) table.x = datum.x;
  if ("y" in datum) table.y = datum.y;
  if (datum.label !== undefined) table.label = datum.label;
  if (datum.region !== undefined) table.region = datum.region;
  return table;
}

function toDimensionToml(dimension: GuideDimension): Record<string, unknown> {
  const table: Record<string, unknown> = {
    id: dimension.id,
    kind: dimension.kind,
    label: dimension.label,
  };
  if (dimension.from) table.from = [...dimension.from];
  if (dimension.to) table.to = [...dimension.to];
  if (dimension.center) table.center = [...dimension.center];
  if (dimension.units !== undefined) table.units = dimension.units;
  if (dimension.tolerance !== undefined) table.tolerance = dimension.tolerance;
  if (dimension.region !== undefined) table.region = dimension.region;
  return table;
}

function toAlignmentMarkToml(mark: GuideAlignmentMark): Record<string, unknown> {
  const table: Record<string, unknown> = {
    id: mark.id,
    kind: mark.kind,
    x: mark.x,
    y: mark.y,
  };
  if (mark.target !== undefined) table.target = mark.target;
  if (mark.label !== undefined) table.label = mark.label;
  if (mark.region !== undefined) table.region = mark.region;
  return table;
}

export function stringifyGuideSidecarToml(guide: CanvasGuideSidecar): string {
  if (guide.rawToml) {
    return `${guide.rawToml.trimEnd()}\n`;
  }

  return `${stringifyTomlDocument({
    guide: {
      id: guide.id,
      target: guide.target,
      units: guide.units,
      description: guide.description,
    },
    regions: guide.regions.map(toRegionToml),
    datums: guide.datums.map(toDatumToml),
    dimensions: guide.dimensions.map(toDimensionToml),
    alignment_marks: guide.alignmentMarks.map(toAlignmentMarkToml),
  }).trimEnd()}\n`;
}

function pushDiagnostic(diagnostics: GuideSidecarDiagnostic[], diagnostic: GuideSidecarDiagnostic) {
  diagnostics.push(diagnostic);
}

function validateGuideId(value: string, _code: string): boolean {
  return value.trim().length > 0 && !/\s/.test(value);
}

function pointWithinRegion(
  point: { x: number; y: number },
  region: Pick<GuideRegion, "x" | "y" | "width" | "height">,
): boolean {
  return (
    point.x >= region.x &&
    point.y >= region.y &&
    point.x <= region.x + region.width &&
    point.y <= region.y + region.height
  );
}

export function validateGuideSidecar(
  guide: CanvasGuideSidecar,
  options?: {
    readonly imageWidth?: number;
    readonly imageHeight?: number;
  },
): readonly GuideSidecarDiagnostic[] {
  const diagnostics: GuideSidecarDiagnostic[] = [];
  if (!validateGuideId(guide.id, "InvalidGuideId")) {
    pushDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidGuideId",
      message: "Guide id must be a non-empty identifier without whitespace.",
      path: "guide.id",
    });
  }
  if (!validateGuideId(guide.units, "InvalidGuideUnits")) {
    pushDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidGuideUnits",
      message: "Guide units must be a non-empty identifier without whitespace.",
      path: "guide.units",
    });
  }

  const regionIds = new Set<string>();
  const regionsById = new Map<string, GuideRegion>();
  for (const region of guide.regions) {
    if (regionIds.has(region.id)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "DuplicateGuideRegionId",
        message: `Guide region id "${region.id}" is duplicated.`,
        regionId: region.id,
      });
    }
    regionIds.add(region.id);
    regionsById.set(region.id, region);
    if (
      region.id.trim().length === 0 ||
      region.x < 0 ||
      region.y < 0 ||
      region.width <= 0 ||
      region.height <= 0
    ) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidGuideRegionRect",
        message: `Guide region "${region.id}" must have non-negative origin and positive size.`,
        regionId: region.id,
      });
    }
    if (
      options?.imageWidth !== undefined &&
      options?.imageHeight !== undefined &&
      (region.x + region.width > options.imageWidth ||
        region.y + region.height > options.imageHeight)
    ) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "GuideRegionOutOfBounds",
        message: `Guide region "${region.id}" extends beyond the target image bounds.`,
        regionId: region.id,
      });
    }
    if (region.grid) {
      const grid = region.grid;
      const validGrid =
        grid.cellWidth > 0 &&
        grid.cellHeight > 0 &&
        Number.isInteger(grid.columns) &&
        Number.isInteger(grid.rows) &&
        grid.columns > 0 &&
        grid.rows > 0;
      if (!validGrid) {
        pushDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidGuideRegionGrid",
          message: `Guide region "${region.id}" has an invalid grid definition.`,
          regionId: region.id,
        });
      } else if (
        grid.columns * grid.cellWidth !== region.width ||
        grid.rows * grid.cellHeight !== region.height
      ) {
        pushDiagnostic(diagnostics, {
          severity: "warning",
          code: "GuideRegionGridSizeMismatch",
          message: `Guide region "${region.id}" grid cells do not exactly fill the region bounds.`,
          regionId: region.id,
        });
      }
    }
  }

  const datumIds = new Set<string>();
  for (const datum of guide.datums) {
    if (datumIds.has(datum.id)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "DuplicateGuideDatumId",
        message: `Guide datum id "${datum.id}" is duplicated.`,
        datumId: datum.id,
      });
    }
    datumIds.add(datum.id);
    const region = datum.region ? regionsById.get(datum.region) : undefined;
    if (datum.region && !region) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "GuideReferenceMissingRegion",
        message: `Guide datum "${datum.id}" references missing region "${datum.region}".`,
        datumId: datum.id,
      });
    }
    const valid =
      (datum.kind === "vertical" && Number.isFinite(datum.x)) ||
      (datum.kind === "horizontal" && Number.isFinite(datum.y)) ||
      (datum.kind === "point" && Number.isFinite(datum.x) && Number.isFinite(datum.y));
    if (!valid || datum.id.trim().length === 0) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidGuideDatum",
        message: `Guide datum "${datum.id}" is missing coordinates required for kind "${datum.kind}".`,
        datumId: datum.id,
      });
    } else if (region) {
      const point =
        datum.kind === "vertical"
          ? { x: datum.x, y: region.y }
          : datum.kind === "horizontal"
            ? { x: region.x, y: datum.y }
            : { x: datum.x, y: datum.y };
      if (!pointWithinRegion(point, region)) {
        pushDiagnostic(diagnostics, {
          severity: "warning",
          code: "GuideDatumOutsideRegion",
          message: `Guide datum "${datum.id}" lies outside region "${region.id}".`,
          datumId: datum.id,
          regionId: region.id,
        });
      }
    }
  }

  const dimensionIds = new Set<string>();
  for (const dimension of guide.dimensions) {
    if (dimensionIds.has(dimension.id)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "DuplicateGuideDimensionId",
        message: `Guide dimension id "${dimension.id}" is duplicated.`,
        dimensionId: dimension.id,
      });
    }
    dimensionIds.add(dimension.id);
    if (dimension.region && !regionsById.has(dimension.region)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "GuideReferenceMissingRegion",
        message: `Guide dimension "${dimension.id}" references missing region "${dimension.region}".`,
        dimensionId: dimension.id,
      });
    }
    const valid =
      dimension.id.trim().length > 0 &&
      dimension.label.trim().length > 0 &&
      (dimension.kind !== "linear" || (dimension.from !== undefined && dimension.to !== undefined));
    if (!valid) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidGuideDimension",
        message: `Guide dimension "${dimension.id}" is missing required fields for kind "${dimension.kind}".`,
        dimensionId: dimension.id,
      });
    }
  }

  const alignmentIds = new Set<string>();
  for (const mark of guide.alignmentMarks) {
    if (alignmentIds.has(mark.id)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "DuplicateGuideAlignmentMarkId",
        message: `Guide alignment mark id "${mark.id}" is duplicated.`,
        alignmentMarkId: mark.id,
      });
    }
    alignmentIds.add(mark.id);
    if (mark.region && !regionsById.has(mark.region)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "GuideReferenceMissingRegion",
        message: `Guide alignment mark "${mark.id}" references missing region "${mark.region}".`,
        alignmentMarkId: mark.id,
      });
    }
    if (mark.id.trim().length === 0 || !Number.isFinite(mark.x) || !Number.isFinite(mark.y)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidGuideAlignmentMark",
        message: `Guide alignment mark "${mark.id}" must be a point with finite x/y coordinates.`,
        alignmentMarkId: mark.id,
      });
    }
  }

  return diagnostics;
}

export function createGuideSidecarObject(
  target: ImageObject,
  guide: CanvasGuideSidecar,
  options?: { id?: string; name?: string; layerId?: string },
): GuideSidecarObject {
  const id = options?.id ?? guide.id;
  return {
    id,
    name: options?.name ?? `${guide.id}.guide.toml`,
    kind: "guideSidecar",
    layerId: options?.layerId ?? target.layerId,
    visible: true,
    opacity: 0.9,
    showLabels: true,
    x: target.x,
    y: target.y,
    width: target.width,
    height: target.height,
    role: "guideSidecar",
    targetId: target.id,
    tags: ["guide", "sidecar"],
    notes: `${guide.regions.length} region${guide.regions.length === 1 ? "" : "s"}, ${guide.datums.length} datum${guide.datums.length === 1 ? "" : "s"}, ${guide.dimensions.length} dimension${guide.dimensions.length === 1 ? "" : "s"}.`,
    guide: {
      ...guide,
      id,
      target: target.id,
    },
  };
}

export function createUnattachedGuideSidecarObject(
  guide: CanvasGuideSidecar,
  options: { id?: string; name?: string; layerId: string },
): GuideSidecarObject {
  const id = options.id ?? guide.id;
  return {
    id,
    name: options.name ?? `${guide.id}.guide.toml`,
    kind: "guideSidecar",
    layerId: options.layerId,
    visible: true,
    opacity: 0.9,
    showLabels: true,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    role: "guideSidecar",
    targetId: guide.target,
    tags: ["guide", "sidecar", "unattached"],
    notes: `${guide.regions.length} region${guide.regions.length === 1 ? "" : "s"} awaiting attachment.`,
    guide: {
      ...guide,
      id,
    },
  };
}
