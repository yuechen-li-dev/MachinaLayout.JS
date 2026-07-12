import type { CanvasDocument, CanvasObject, CanvasObjectBase } from "./sceneModel";
import {
  getMechanicalA4LandscapeLayout,
  MECHANICAL_A4_LANDSCAPE_MM,
  MECHANICAL_A4_PRINT_MARGIN_MM,
  type MechanicalSheetLayout,
} from "./mechanicalSheet";

export type MechanicalUnits = "mm" | "cm" | "m" | "in" | "px";

export type MechanicalSheetSize =
  | "A4"
  | "A3"
  | "A2"
  | "A1"
  | "A0"
  | "Letter"
  | "Legal"
  | "Tabloid"
  | "Custom";

export type MechanicalSheetOrientation = "portrait" | "landscape";

export type MechanicalSheetMetadata = {
  readonly size: MechanicalSheetSize;
  readonly orientation: MechanicalSheetOrientation;
  readonly width?: number;
  readonly height?: number;
  readonly units: MechanicalUnits;
  readonly scale?: string;
  readonly drawingNumber?: string;
  readonly title?: string;
  readonly revision?: string;
};

export type MechanicalGeometryAnchor =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight"
  | "start"
  | "end";

export type MechanicalGeometryReference = {
  readonly objectId: string;
  readonly anchor?: MechanicalGeometryAnchor;
};

export type MechanicalDimensionAnnotation =
  | MechanicalLinearDimension
  | MechanicalAlignedDimension
  | MechanicalAngleDimension
  | MechanicalRadiusDimension
  | MechanicalDiameterDimension;

export type MechanicalDimensionBase = {
  readonly id: string;
  readonly label?: string;
  readonly tolerance?: string;
  readonly units?: MechanicalUnits;
  readonly note?: string;
  readonly references?: readonly MechanicalGeometryReference[];
};

export type MechanicalLinearDimension = MechanicalDimensionBase & {
  readonly kind: "linear";
  readonly axis: "horizontal" | "vertical";
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly offset?: number;
  readonly labelOffset?: number;
};

export type MechanicalAlignedDimension = MechanicalDimensionBase & {
  readonly kind: "aligned";
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly offset?: number;
  readonly labelOffset?: number;
};

export type MechanicalAngleDimension = MechanicalDimensionBase & {
  readonly kind: "angle";
  readonly center: readonly [number, number];
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly radius?: number;
  readonly labelOffset?: number;
};

export type MechanicalRadiusDimension = MechanicalDimensionBase & {
  readonly kind: "radius";
  readonly center: readonly [number, number];
  readonly radius: number;
  readonly leaderAngle?: number;
  readonly leaderLength?: number;
  readonly labelOffset?: readonly [number, number];
  readonly showCenterMark?: boolean;
};

export type MechanicalDiameterDimension = MechanicalDimensionBase & {
  readonly kind: "diameter";
  readonly center: readonly [number, number];
  readonly diameter: number;
  readonly leaderAngle?: number;
  readonly leaderLength?: number;
  readonly labelOffset?: readonly [number, number];
  readonly showCenterMark?: boolean;
};

export type MechanicalNoteAnnotation = {
  readonly id: string;
  readonly kind: "note" | "callout";
  readonly at: readonly [number, number];
  readonly text: string;
  readonly leaderTo?: readonly [number, number];
};

export type MechanicalDatumAnnotation = {
  readonly id: string;
  readonly label: string;
  readonly at: readonly [number, number];
  readonly target?: readonly [number, number];
};

export type MechanicalBlockAnnotation =
  | MechanicalTitleBlock
  | MechanicalRevisionTable
  | MechanicalBomTable;

export type MechanicalTitleBlock = {
  readonly id: string;
  readonly kind: "titleBlock";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fields: Readonly<Record<string, string>>;
};

export type MechanicalRevisionTable = {
  readonly id: string;
  readonly kind: "revisionTable";
  readonly x: number;
  readonly y: number;
  readonly columns: readonly string[];
  readonly rows: readonly Readonly<Record<string, string>>[];
};

export type MechanicalBomTable = {
  readonly id: string;
  readonly kind: "bomTable";
  readonly x: number;
  readonly y: number;
  readonly columns: readonly string[];
  readonly rows: readonly Readonly<Record<string, string>>[];
};

export type MechanicalAnnotationSet = {
  readonly kind: "mechanicalAnnotationSet";
  readonly id: string;
  readonly units: MechanicalUnits;
  readonly scale?: string;
  readonly sheet?: MechanicalSheetMetadata;
  readonly dimensions: readonly MechanicalDimensionAnnotation[];
  readonly notes: readonly MechanicalNoteAnnotation[];
  readonly datums: readonly MechanicalDatumAnnotation[];
  readonly blocks: readonly MechanicalBlockAnnotation[];
};

export type MechanicalAnnotationDiagnostic = {
  readonly severity: "error" | "warning" | "note";
  readonly code: string;
  readonly message: string;
  readonly annotationId?: string;
  readonly path?: string;
};

export type MechanicalAnnotationSidecarObject = CanvasObjectBase & {
  readonly kind: "mechanicalAnnotationSidecar";
  readonly role?: "mechanicalAnnotationSidecar";
  readonly targetObjectId?: string;
  readonly annotations: MechanicalAnnotationSet;
};

const MECHANICAL_UNITS = new Set<MechanicalUnits>(["mm", "cm", "m", "in", "px"]);
const MECHANICAL_SHEET_SIZES = new Map<
  Exclude<MechanicalSheetSize, "Custom">,
  readonly [number, number]
>([
  ["A4", [210, 297]],
  ["A3", [297, 420]],
  ["A2", [420, 594]],
  ["A1", [594, 841]],
  ["A0", [841, 1189]],
  ["Letter", [216, 279]],
  ["Legal", [216, 356]],
  ["Tabloid", [279, 432]],
]);

const MECHANICAL_REQUIRED_TITLE_BLOCK_FIELDS = [
  "Title",
  "Drawing",
  "Rev",
  "Scale",
  "Units",
] as const;

const MECHANICAL_LINE_STROKE = 0.35;
const MECHANICAL_LIGHT_STROKE = 0.25;
const MECHANICAL_LABEL_FONT_SIZE = 4.2;
const MECHANICAL_NOTE_FONT_SIZE = 4.4;
const MECHANICAL_BLOCK_TITLE_FONT_SIZE = 4;
const MECHANICAL_TABLE_HEADER_FONT_SIZE = 3.1;
const MECHANICAL_TABLE_CELL_FONT_SIZE = 3.6;

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function quoteXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFinitePoint(
  value: readonly [number, number] | undefined,
): value is readonly [number, number] {
  return Boolean(
    value &&
      value.length === 2 &&
      typeof value[0] === "number" &&
      Number.isFinite(value[0]) &&
      typeof value[1] === "number" &&
      Number.isFinite(value[1]),
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pointsEqual(
  left: readonly [number, number] | undefined,
  right: readonly [number, number] | undefined,
  tolerance = 0.001,
): boolean {
  if (!left || !right) return false;
  return Math.abs(left[0] - right[0]) <= tolerance && Math.abs(left[1] - right[1]) <= tolerance;
}

function hasRectLikeBounds(object: CanvasObject): boolean {
  return (
    Number.isFinite(object.x) &&
    Number.isFinite(object.y) &&
    Number.isFinite(object.width) &&
    Number.isFinite(object.height)
  );
}

function resolveRectLikeAnchor(
  object: CanvasObject,
  anchor: Exclude<MechanicalGeometryAnchor, "start" | "end">,
): readonly [number, number] | undefined {
  if (!hasRectLikeBounds(object)) return undefined;
  const minX = object.x;
  const minY = object.y;
  const maxX = object.x + object.width;
  const maxY = object.y + object.height;
  const centerX = object.x + object.width / 2;
  const centerY = object.y + object.height / 2;
  switch (anchor) {
    case "center":
      return [centerX, centerY];
    case "top":
      return [centerX, minY];
    case "bottom":
      return [centerX, maxY];
    case "left":
      return [minX, centerY];
    case "right":
      return [maxX, centerY];
    case "topLeft":
      return [minX, minY];
    case "topRight":
      return [maxX, minY];
    case "bottomLeft":
      return [minX, maxY];
    case "bottomRight":
      return [maxX, maxY];
  }
}

function pushDiagnostic(
  diagnostics: MechanicalAnnotationDiagnostic[],
  diagnostic: MechanicalAnnotationDiagnostic,
) {
  diagnostics.push(diagnostic);
}

function validatePointDiagnostic(
  diagnostics: MechanicalAnnotationDiagnostic[],
  annotationId: string,
  point: readonly [number, number] | undefined,
  path: string,
) {
  if (!isFinitePoint(point)) {
    pushDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidMechanicalDimensionPoints",
      message: `Mechanical annotation "${annotationId}" requires finite ${path} coordinates.`,
      annotationId,
      path,
    });
  }
}

function getDimensionIds(
  annotations: MechanicalAnnotationSet,
): readonly MechanicalDimensionAnnotation[] {
  return annotations.dimensions;
}

function getAllAnnotationIds(annotations: MechanicalAnnotationSet): readonly string[] {
  return [
    ...annotations.dimensions.map((item) => item.id),
    ...annotations.notes.map((item) => item.id),
    ...annotations.datums.map((item) => item.id),
    ...annotations.blocks.map((item) => item.id),
  ];
}

export function createMechanicalAnnotationSet(
  input?: Partial<Omit<MechanicalAnnotationSet, "kind">>,
): MechanicalAnnotationSet {
  return {
    kind: "mechanicalAnnotationSet",
    id: input?.id ?? "mechanical-annotations",
    units: input?.units ?? "mm",
    scale: input?.scale,
    sheet: input?.sheet,
    dimensions: input?.dimensions ?? [],
    notes: input?.notes ?? [],
    datums: input?.datums ?? [],
    blocks: input?.blocks ?? [],
  };
}

export function createDefaultMechanicalSheetMetadata(): MechanicalSheetMetadata {
  return {
    size: "A4",
    orientation: "landscape",
    units: "mm",
  };
}

export function isMechanicalA4LandscapeSheet(sheet: MechanicalSheetMetadata | undefined): boolean {
  return (
    sheet?.size === "A4" &&
    sheet.orientation === "landscape" &&
    getMechanicalSheetDimensions(sheet)?.[0] === MECHANICAL_A4_LANDSCAPE_MM.width &&
    getMechanicalSheetDimensions(sheet)?.[1] === MECHANICAL_A4_LANDSCAPE_MM.height
  );
}

export function getMechanicalSheetLayout(
  sheet: MechanicalSheetMetadata | undefined,
): MechanicalSheetLayout {
  if (sheet === undefined || isMechanicalA4LandscapeSheet(sheet)) {
    return getMechanicalA4LandscapeLayout();
  }
  const dimensions = getMechanicalSheetDimensions(sheet);
  if (!dimensions) {
    return getMechanicalA4LandscapeLayout();
  }
  const [widthMm, heightMm] = dimensions;
  return {
    widthMm,
    heightMm,
    marginMm: { ...MECHANICAL_A4_PRINT_MARGIN_MM },
    contentBoxMm: {
      x: MECHANICAL_A4_PRINT_MARGIN_MM.left,
      y: MECHANICAL_A4_PRINT_MARGIN_MM.top,
      width: Math.max(
        0,
        widthMm - MECHANICAL_A4_PRINT_MARGIN_MM.left - MECHANICAL_A4_PRINT_MARGIN_MM.right,
      ),
      height: Math.max(
        0,
        heightMm - MECHANICAL_A4_PRINT_MARGIN_MM.top - MECHANICAL_A4_PRINT_MARGIN_MM.bottom,
      ),
    },
  };
}

export function countMechanicalAnnotations(annotations: MechanicalAnnotationSet) {
  const referenceBackedDimensions = annotations.dimensions.filter(
    (dimension) => dimension.references && dimension.references.length > 0,
  ).length;
  return {
    dimensions: annotations.dimensions.length,
    notes: annotations.notes.length,
    datums: annotations.datums.length,
    blocks: annotations.blocks.length,
    referenceBackedDimensions,
    total:
      annotations.dimensions.length +
      annotations.notes.length +
      annotations.datums.length +
      annotations.blocks.length,
  };
}

export function formatMechanicalDimensionText(
  dimension: MechanicalDimensionAnnotation,
  fallbackUnits: MechanicalUnits,
): string {
  const label =
    dimension.label?.trim() ||
    (dimension.kind === "radius"
      ? `R${dimension.radius}`
      : dimension.kind === "diameter"
        ? `⌀${dimension.diameter}`
        : undefined);
  const parts = [label ?? `${dimension.id} (${dimension.units ?? fallbackUnits})`];
  if (dimension.tolerance?.trim()) {
    parts.push(dimension.tolerance.trim());
  }
  if (dimension.note?.trim()) {
    parts.push(dimension.note.trim());
  }
  return parts.join(" ");
}

export function getMechanicalSheetDimensions(
  sheet: MechanicalSheetMetadata,
): readonly [number, number] | undefined {
  if (sheet.size === "Custom") {
    if (!isFiniteNumber(sheet.width) || !isFiniteNumber(sheet.height)) {
      return undefined;
    }
    return [sheet.width, sheet.height];
  }
  const base = MECHANICAL_SHEET_SIZES.get(sheet.size);
  if (!base) return undefined;
  return sheet.orientation === "portrait" ? base : [base[1], base[0]];
}

function normalizeMechanicalFieldValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function getMechanicalTitleBlockEntries(
  annotations: MechanicalAnnotationSet,
  block: MechanicalTitleBlock,
): readonly (readonly [string, string])[] {
  const sheet = annotations.sheet;
  const preferred = new Map<string, string>([
    ["Title", normalizeMechanicalFieldValue(block.fields.Title ?? sheet?.title)],
    ["Drawing", normalizeMechanicalFieldValue(block.fields.Drawing ?? sheet?.drawingNumber)],
    ["Rev", normalizeMechanicalFieldValue(block.fields.Rev ?? sheet?.revision)],
    [
      "Scale",
      normalizeMechanicalFieldValue(block.fields.Scale ?? sheet?.scale ?? annotations.scale),
    ],
    [
      "Units",
      normalizeMechanicalFieldValue(block.fields.Units ?? sheet?.units ?? annotations.units),
    ],
  ]);
  for (const [key, value] of Object.entries(block.fields)) {
    if (!preferred.has(key)) {
      preferred.set(key, normalizeMechanicalFieldValue(value));
    }
  }
  return Array.from(preferred.entries());
}

export type MechanicalTableRenderMetrics = {
  readonly width: number;
  readonly height: number;
  readonly columnWidth: number;
  readonly rowHeight: number;
};

export function getMechanicalTableRenderMetrics(
  annotations: MechanicalAnnotationSet,
  block: MechanicalRevisionTable | MechanicalBomTable,
): MechanicalTableRenderMetrics {
  const layout = getMechanicalSheetLayout(annotations.sheet);
  const availableWidth = Math.max(72, layout.widthMm - block.x - layout.marginMm.right);
  const preferredWidth = block.kind === "revisionTable" ? 90 : 120;
  const minColumnWidth = block.kind === "revisionTable" ? 18 : 17;
  const minWidth = Math.max(72, block.columns.length * minColumnWidth);
  const maxWidth = Math.max(
    Math.min(availableWidth, preferredWidth),
    Math.min(minWidth, availableWidth),
  );
  const width = Math.max(60, maxWidth);
  const rowHeight = 8.5;
  return {
    width,
    height: rowHeight * (block.rows.length + 1),
    columnWidth: width / Math.max(block.columns.length, 1),
    rowHeight,
  };
}

function getMechanicalBlockBounds(
  annotations: MechanicalAnnotationSet,
  block: MechanicalBlockAnnotation,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  if (block.kind === "titleBlock") {
    return { x: block.x, y: block.y, width: block.width, height: block.height };
  }
  const metrics = getMechanicalTableRenderMetrics(annotations, block);
  return { x: block.x, y: block.y, width: metrics.width, height: metrics.height };
}

export function resolveMechanicalGeometryAnchor(
  scene: CanvasDocument,
  reference: MechanicalGeometryReference,
): readonly [number, number] | undefined {
  const object = scene.objects[reference.objectId];
  if (!object) return undefined;
  const anchor = reference.anchor ?? "center";
  if (anchor === "start" || anchor === "end") {
    return undefined;
  }
  return resolveRectLikeAnchor(object, anchor);
}

export function createLinearDimensionFromGeometryRefs(input: {
  readonly id: string;
  readonly scene: CanvasDocument;
  readonly from: MechanicalGeometryReference;
  readonly to: MechanicalGeometryReference;
  readonly axis: "horizontal" | "vertical";
  readonly offset?: number;
  readonly label?: string;
  readonly tolerance?: string;
}): MechanicalLinearDimension | undefined {
  const from = resolveMechanicalGeometryAnchor(input.scene, input.from);
  const to = resolveMechanicalGeometryAnchor(input.scene, input.to);
  if (!from || !to) return undefined;
  return {
    id: input.id,
    kind: "linear",
    axis: input.axis,
    from,
    to,
    offset: input.offset,
    label: input.label,
    tolerance: input.tolerance,
    references: [input.from, input.to],
  };
}

function getReferenceResolutionIssue(
  scene: CanvasDocument,
  reference: MechanicalGeometryReference,
): "missingObject" | "unsupportedAnchor" | "unresolved" | undefined {
  const object = scene.objects[reference.objectId];
  if (!object) return "missingObject";
  const anchor = reference.anchor ?? "center";
  if (anchor === "start" || anchor === "end") {
    return "unsupportedAnchor";
  }
  return resolveRectLikeAnchor(object, anchor) ? undefined : "unresolved";
}

function validateMechanicalSheetMetadata(
  diagnostics: MechanicalAnnotationDiagnostic[],
  sheet: MechanicalSheetMetadata,
) {
  if (!MECHANICAL_UNITS.has(sheet.units)) {
    pushDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidMechanicalSheet",
      message: `Mechanical sheet units "${String(sheet.units)}" are invalid.`,
      path: "annotations.sheet.units",
    });
  }
  if (sheet.orientation !== "portrait" && sheet.orientation !== "landscape") {
    pushDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidMechanicalSheet",
      message: `Mechanical sheet orientation "${String(sheet.orientation)}" is invalid.`,
      path: "annotations.sheet.orientation",
    });
  }
  if (sheet.size === "Custom") {
    if (!isFiniteNumber(sheet.width) || sheet.width <= 0) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidMechanicalSheet",
        message: "Custom mechanical sheets require a positive width.",
        path: "annotations.sheet.width",
      });
    }
    if (!isFiniteNumber(sheet.height) || sheet.height <= 0) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidMechanicalSheet",
        message: "Custom mechanical sheets require a positive height.",
        path: "annotations.sheet.height",
      });
    }
  } else if (!MECHANICAL_SHEET_SIZES.has(sheet.size)) {
    pushDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidMechanicalSheet",
      message: `Mechanical sheet size "${String(sheet.size)}" is invalid.`,
      path: "annotations.sheet.size",
    });
  }
}

export function validateMechanicalAnnotations(
  annotations: MechanicalAnnotationSet,
): readonly MechanicalAnnotationDiagnostic[] {
  const diagnostics: MechanicalAnnotationDiagnostic[] = [];

  if (!isNonEmptyString(annotations.id)) {
    pushDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidMechanicalAnnotationSetId",
      message: "Mechanical annotation set id must be a non-empty string.",
      path: "annotations.id",
    });
  }

  if (!MECHANICAL_UNITS.has(annotations.units)) {
    pushDiagnostic(diagnostics, {
      severity: "error",
      code: "InvalidMechanicalUnits",
      message: `Mechanical annotation units "${String(annotations.units)}" are invalid.`,
      path: "annotations.units",
    });
  }

  if (annotations.sheet) {
    validateMechanicalSheetMetadata(diagnostics, annotations.sheet);
  }

  const seenIds = new Set<string>();
  for (const id of getAllAnnotationIds(annotations)) {
    if (!isNonEmptyString(id)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "DuplicateMechanicalAnnotationId",
        message: "Mechanical annotations require non-empty ids.",
      });
      continue;
    }
    if (seenIds.has(id)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "DuplicateMechanicalAnnotationId",
        message: `Mechanical annotation id "${id}" is duplicated.`,
        annotationId: id,
      });
    }
    seenIds.add(id);
  }

  for (const dimension of getDimensionIds(annotations)) {
    if (!isNonEmptyString(dimension.id)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidMechanicalDimension",
        message: "Mechanical dimensions require non-empty ids.",
        annotationId: dimension.id,
      });
    }
    if (dimension.tolerance !== undefined && dimension.tolerance.trim().length === 0) {
      pushDiagnostic(diagnostics, {
        severity: "warning",
        code: "InvalidMechanicalTolerance",
        message: `Mechanical dimension "${dimension.id}" has an empty tolerance string.`,
        annotationId: dimension.id,
        path: "tolerance",
      });
    }
    if (dimension.references) {
      if (dimension.references.length === 0) {
        pushDiagnostic(diagnostics, {
          severity: "warning",
          code: "InvalidMechanicalReference",
          message: `Mechanical dimension "${dimension.id}" has an empty references list.`,
          annotationId: dimension.id,
          path: "references",
        });
      }
      for (const [referenceIndex, reference] of dimension.references.entries()) {
        if (!isNonEmptyString(reference.objectId)) {
          pushDiagnostic(diagnostics, {
            severity: "error",
            code: "InvalidMechanicalReference",
            message: `Mechanical dimension "${dimension.id}" reference ${referenceIndex + 1} requires a non-empty object id.`,
            annotationId: dimension.id,
            path: `references.${referenceIndex}.objectId`,
          });
        }
      }
    }

    if (dimension.kind === "linear") {
      validatePointDiagnostic(diagnostics, dimension.id, dimension.from, "from");
      validatePointDiagnostic(diagnostics, dimension.id, dimension.to, "to");
      if (dimension.axis !== "horizontal" && dimension.axis !== "vertical") {
        pushDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidMechanicalDimension",
          message: `Mechanical linear dimension "${dimension.id}" requires a valid axis.`,
          annotationId: dimension.id,
        });
      }
    } else if (dimension.kind === "aligned") {
      validatePointDiagnostic(diagnostics, dimension.id, dimension.from, "from");
      validatePointDiagnostic(diagnostics, dimension.id, dimension.to, "to");
    } else if (dimension.kind === "angle") {
      validatePointDiagnostic(diagnostics, dimension.id, dimension.center, "center");
      validatePointDiagnostic(diagnostics, dimension.id, dimension.from, "from");
      validatePointDiagnostic(diagnostics, dimension.id, dimension.to, "to");
    } else if (dimension.kind === "radius") {
      validatePointDiagnostic(diagnostics, dimension.id, dimension.center, "center");
      if (!isFiniteNumber(dimension.radius) || dimension.radius <= 0) {
        pushDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidMechanicalDimension",
          message: `Mechanical radius dimension "${dimension.id}" requires a positive radius.`,
          annotationId: dimension.id,
          path: "radius",
        });
      }
    } else if (dimension.kind === "diameter") {
      validatePointDiagnostic(diagnostics, dimension.id, dimension.center, "center");
      if (!isFiniteNumber(dimension.diameter) || dimension.diameter <= 0) {
        pushDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidMechanicalDimension",
          message: `Mechanical diameter dimension "${dimension.id}" requires a positive diameter.`,
          annotationId: dimension.id,
          path: "diameter",
        });
      }
    }
  }

  for (const note of annotations.notes) {
    if (!isNonEmptyString(note.id) || !isFinitePoint(note.at) || !isNonEmptyString(note.text)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidMechanicalNote",
        message: `Mechanical note "${note.id}" requires a non-empty id, finite point, and text.`,
        annotationId: note.id,
      });
    }
    if (note.leaderTo !== undefined && !isFinitePoint(note.leaderTo)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidMechanicalNote",
        message: `Mechanical note "${note.id}" has an invalid leader target.`,
        annotationId: note.id,
        path: "leaderTo",
      });
    }
  }

  for (const datum of annotations.datums) {
    if (!isNonEmptyString(datum.id) || !isFinitePoint(datum.at) || !isNonEmptyString(datum.label)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidMechanicalDatum",
        message: `Mechanical datum "${datum.id}" requires a non-empty id, label, and finite point.`,
        annotationId: datum.id,
      });
    }
    if (datum.target !== undefined && !isFinitePoint(datum.target)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidMechanicalDatum",
        message: `Mechanical datum "${datum.id}" has an invalid target point.`,
        annotationId: datum.id,
        path: "target",
      });
    }
  }

  for (const block of annotations.blocks) {
    if (!isNonEmptyString(block.id)) {
      pushDiagnostic(diagnostics, {
        severity: "error",
        code: "InvalidMechanicalBlock",
        message: "Mechanical blocks require non-empty ids.",
      });
      continue;
    }
    if (block.kind === "titleBlock") {
      if (
        !isFiniteNumber(block.x) ||
        !isFiniteNumber(block.y) ||
        !isFiniteNumber(block.width) ||
        !isFiniteNumber(block.height) ||
        block.width <= 0 ||
        block.height <= 0
      ) {
        pushDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidMechanicalBlock",
          message: `Mechanical title block "${block.id}" requires positive finite geometry.`,
          annotationId: block.id,
        });
      }
    } else {
      if (
        block.columns.length === 0 ||
        block.columns.some((column) => column.trim().length === 0)
      ) {
        pushDiagnostic(diagnostics, {
          severity: "error",
          code: "InvalidMechanicalTable",
          message: `Mechanical table "${block.id}" requires non-empty column names.`,
          annotationId: block.id,
        });
      }
      for (const [rowIndex, row] of block.rows.entries()) {
        if (typeof row !== "object" || row === null) {
          pushDiagnostic(diagnostics, {
            severity: "error",
            code: "InvalidMechanicalTable",
            message: `Mechanical table "${block.id}" row ${rowIndex + 1} must be a record.`,
            annotationId: block.id,
          });
          continue;
        }
        for (const column of block.columns) {
          const value = row[column];
          if (value !== undefined && typeof value !== "string") {
            pushDiagnostic(diagnostics, {
              severity: "warning",
              code: "InvalidMechanicalTable",
              message: `Mechanical table "${block.id}" row ${rowIndex + 1} column "${column}" should be a string.`,
              annotationId: block.id,
            });
          }
        }
      }
    }
  }

  return diagnostics;
}

export function createMechanicalAnnotationSidecarObject(input: {
  readonly id: string;
  readonly name?: string;
  readonly layerId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly targetObjectId?: string;
  readonly annotations?: MechanicalAnnotationSet;
  readonly visible?: boolean;
}): MechanicalAnnotationSidecarObject {
  const annotations =
    input.annotations ??
    createMechanicalAnnotationSet({
      id: `${input.id}-annotations`,
    });
  const counts = countMechanicalAnnotations(annotations);
  return {
    id: input.id,
    name: input.name ?? "Mechanical annotations",
    kind: "mechanicalAnnotationSidecar",
    layerId: input.layerId,
    visible: input.visible ?? true,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    role: "mechanicalAnnotationSidecar",
    targetObjectId: input.targetObjectId,
    tags: ["mechanical", "annotation", "drafting", "sidecar"],
    notes: `${counts.dimensions} dimensions, ${counts.notes} notes, ${counts.datums} datums, ${counts.blocks} blocks.`,
    annotations,
  };
}

export function validateMechanicalAnnotationsForScene(
  scene: CanvasDocument,
  sidecar: MechanicalAnnotationSidecarObject,
): readonly MechanicalAnnotationDiagnostic[] {
  const diagnostics = [...validateMechanicalAnnotations(sidecar.annotations)];
  const sheet = sidecar.annotations.sheet;
  const layout = getMechanicalSheetLayout(sheet);
  const pointWithinSheet = (point: readonly [number, number]) =>
    point[0] >= 0 && point[1] >= 0 && point[0] <= layout.widthMm && point[1] <= layout.heightMm;
  const pointWithinPrintMargin = (point: readonly [number, number]) =>
    point[0] >= layout.contentBoxMm.x &&
    point[1] >= layout.contentBoxMm.y &&
    point[0] <= layout.contentBoxMm.x + layout.contentBoxMm.width &&
    point[1] <= layout.contentBoxMm.y + layout.contentBoxMm.height;

  if (sheet && !isMechanicalA4LandscapeSheet(sheet)) {
    pushDiagnostic(diagnostics, {
      severity: "warning",
      code: "MechanicalSheetNotA4Landscape",
      message:
        "Non-A4 sheet metadata is present, but Mechanical drafting mode currently targets A4 landscape.",
      path: "annotations.sheet",
    });
  }

  for (const dimension of sidecar.annotations.dimensions) {
    if (!dimension.references?.length) continue;
    for (const [referenceIndex, reference] of dimension.references.entries()) {
      const issue = getReferenceResolutionIssue(scene, reference);
      if (issue === "missingObject") {
        pushDiagnostic(diagnostics, {
          severity: "warning",
          code: "MissingMechanicalReferenceObject",
          message: `Mechanical dimension "${dimension.id}" references missing object "${reference.objectId}".`,
          annotationId: dimension.id,
          path: `dimensions.${dimension.id}.references.${referenceIndex}`,
        });
      } else if (issue === "unsupportedAnchor") {
        pushDiagnostic(diagnostics, {
          severity: "warning",
          code: "UnsupportedMechanicalReferenceAnchor",
          message: `Mechanical dimension "${dimension.id}" cannot resolve anchor "${reference.anchor}" on object "${reference.objectId}".`,
          annotationId: dimension.id,
          path: `dimensions.${dimension.id}.references.${referenceIndex}`,
        });
      } else if (issue === "unresolved") {
        pushDiagnostic(diagnostics, {
          severity: "warning",
          code: "UnresolvedMechanicalReference",
          message: `Mechanical dimension "${dimension.id}" could not resolve reference "${reference.objectId}".`,
          annotationId: dimension.id,
          path: `dimensions.${dimension.id}.references.${referenceIndex}`,
        });
      }
    }

    if (
      (dimension.kind === "linear" || dimension.kind === "aligned") &&
      dimension.references.length >= 2
    ) {
      const resolvedFrom = resolveMechanicalGeometryAnchor(scene, dimension.references[0]);
      const resolvedTo = resolveMechanicalGeometryAnchor(scene, dimension.references[1]);
      if (
        resolvedFrom &&
        resolvedTo &&
        (!pointsEqual(resolvedFrom, dimension.from) || !pointsEqual(resolvedTo, dimension.to))
      ) {
        pushDiagnostic(diagnostics, {
          severity: "warning",
          code: "MechanicalDimensionReferenceMismatch",
          message: `Mechanical dimension "${dimension.id}" stores explicit points that differ from its referenced geometry anchors.`,
          annotationId: dimension.id,
        });
      }
    }

    const points =
      dimension.kind === "linear" || dimension.kind === "aligned"
        ? [dimension.from, dimension.to]
        : dimension.kind === "angle"
          ? [dimension.center, dimension.from, dimension.to]
          : [dimension.center];
    for (const point of points) {
      if (!pointWithinSheet(point) || !pointWithinPrintMargin(point)) {
        pushDiagnostic(diagnostics, {
          severity: "warning",
          code: "MechanicalAnnotationOutsidePrintMargin",
          message: `Mechanical annotation "${dimension.id}" extends outside the A4 print-safe content area.`,
          annotationId: dimension.id,
        });
        break;
      }
    }
  }

  for (const note of sidecar.annotations.notes) {
    if (!pointWithinSheet(note.at) || !pointWithinPrintMargin(note.at)) {
      pushDiagnostic(diagnostics, {
        severity: "warning",
        code: "MechanicalAnnotationOutsidePrintMargin",
        message: `Mechanical note "${note.id}" extends outside the A4 print-safe content area.`,
        annotationId: note.id,
      });
    }
  }

  for (const datum of sidecar.annotations.datums) {
    if (!pointWithinSheet(datum.at) || !pointWithinPrintMargin(datum.at)) {
      pushDiagnostic(diagnostics, {
        severity: "warning",
        code: "MechanicalAnnotationOutsidePrintMargin",
        message: `Mechanical datum "${datum.id}" extends outside the A4 print-safe content area.`,
        annotationId: datum.id,
      });
    }
  }

  for (const block of sidecar.annotations.blocks) {
    const bounds = getMechanicalBlockBounds(sidecar.annotations, block);
    if (
      bounds.x < 0 ||
      bounds.y < 0 ||
      bounds.x + bounds.width > layout.widthMm ||
      bounds.y + bounds.height > layout.heightMm
    ) {
      pushDiagnostic(diagnostics, {
        severity: "warning",
        code: "MechanicalBlockOutsideSheet",
        message: `Mechanical block "${block.id}" extends outside the sheet boundary.`,
        annotationId: block.id,
      });
    }
    if (block.kind === "titleBlock" && sidecar.annotations.sheet) {
      const entries = new Map(getMechanicalTitleBlockEntries(sidecar.annotations, block));
      for (const field of MECHANICAL_REQUIRED_TITLE_BLOCK_FIELDS) {
        if ((entries.get(field) ?? "").trim().length > 0) continue;
        pushDiagnostic(diagnostics, {
          severity: "warning",
          code: "MechanicalTitleBlockMissingField",
          message: `Mechanical title block "${block.id}" is missing "${field}".`,
          annotationId: block.id,
          path: `blocks.${block.id}.${field}`,
        });
      }
    }
  }
  return diagnostics;
}

export type MechanicalReferenceSummary = {
  readonly objectId: string;
  readonly anchor: MechanicalGeometryAnchor;
  readonly resolved: boolean;
  readonly point?: readonly [number, number];
};

export type MechanicalInspectorSummary = {
  readonly sheetSize: string;
  readonly orientation: string;
  readonly sheetTarget: string;
  readonly sheetSizeLabel: string;
  readonly printMarginLabel: string;
  readonly units: MechanicalUnits;
  readonly scale: string;
  readonly drawingNumber: string;
  readonly title: string;
  readonly revision: string;
  readonly dimensionCount: number;
  readonly noteCount: number;
  readonly datumCount: number;
  readonly blockCount: number;
  readonly diagnosticsCount: number;
  readonly referenceDiagnosticCount: number;
  readonly sheetNotice?: string;
  readonly dimensionReferenceSummaries: readonly {
    readonly dimensionId: string;
    readonly label: string;
    readonly references: readonly MechanicalReferenceSummary[];
  }[];
};

export function getMechanicalDimensionReferenceSummaries(
  scene: CanvasDocument,
  dimension: MechanicalDimensionAnnotation,
): readonly MechanicalReferenceSummary[] {
  return (dimension.references ?? []).map((reference) => {
    const point = resolveMechanicalGeometryAnchor(scene, reference);
    return {
      objectId: reference.objectId,
      anchor: reference.anchor ?? "center",
      resolved: point !== undefined,
      point,
    };
  });
}

export function getMechanicalInspectorSummary(
  scene: CanvasDocument,
  sidecar: MechanicalAnnotationSidecarObject,
): MechanicalInspectorSummary {
  const diagnostics = validateMechanicalAnnotationsForScene(scene, sidecar);
  const sheet = sidecar.annotations.sheet;
  const layout = getMechanicalSheetLayout(sheet);
  const nonA4Notice =
    sheet && !isMechanicalA4LandscapeSheet(sheet)
      ? "Non-A4 sheet metadata is present, but Mechanical drafting mode currently targets A4 landscape."
      : undefined;
  return {
    sheetSize: sheet?.size ?? "unspecified",
    orientation: sheet?.orientation ?? "unspecified",
    sheetTarget: isMechanicalA4LandscapeSheet(sheet) ? "A4 landscape" : "A4 landscape target",
    sheetSizeLabel: `${layout.widthMm} × ${layout.heightMm} mm`,
    printMarginLabel: `${layout.marginMm.left} mm`,
    units: sidecar.annotations.units,
    scale: sheet?.scale ?? sidecar.annotations.scale ?? "unspecified",
    drawingNumber: sheet?.drawingNumber ?? "unspecified",
    title: sheet?.title ?? "unspecified",
    revision: sheet?.revision ?? "unspecified",
    dimensionCount: sidecar.annotations.dimensions.length,
    noteCount: sidecar.annotations.notes.length,
    datumCount: sidecar.annotations.datums.length,
    blockCount: sidecar.annotations.blocks.length,
    diagnosticsCount: diagnostics.length,
    referenceDiagnosticCount: diagnostics.filter((diagnostic) =>
      [
        "MissingMechanicalReferenceObject",
        "UnsupportedMechanicalReferenceAnchor",
        "UnresolvedMechanicalReference",
        "MechanicalDimensionReferenceMismatch",
      ].includes(diagnostic.code),
    ).length,
    sheetNotice: nonA4Notice,
    dimensionReferenceSummaries: sidecar.annotations.dimensions
      .filter((dimension) => dimension.references && dimension.references.length > 0)
      .map((dimension) => ({
        dimensionId: dimension.id,
        label: dimension.label ?? dimension.id,
        references: getMechanicalDimensionReferenceSummaries(scene, dimension),
      })),
  };
}

function formatBlockTitle(kind: MechanicalBlockAnnotation["kind"]): string {
  return kind === "titleBlock" ? "TITLE BLOCK" : kind === "revisionTable" ? "REVISIONS" : "BOM";
}

function renderTableContent(
  annotations: MechanicalAnnotationSet,
  block: MechanicalRevisionTable | MechanicalBomTable,
  lines: string[],
) {
  const { width, height, columnWidth, rowHeight } = getMechanicalTableRenderMetrics(
    annotations,
    block,
  );
  lines.push(
    `<rect class="canvas-mechanical-table" x="${block.x}" y="${block.y}" width="${width}" height="${height}" fill="#ffffff" stroke="#253043" stroke-width="${MECHANICAL_LINE_STROKE}" />`,
  );
  for (let columnIndex = 1; columnIndex < block.columns.length; columnIndex += 1) {
    const x = block.x + columnIndex * columnWidth;
    lines.push(
      `<line class="canvas-mechanical-table-line" x1="${x}" y1="${block.y}" x2="${x}" y2="${block.y + height}" stroke="#253043" stroke-width="${MECHANICAL_LIGHT_STROKE}" />`,
    );
  }
  for (let rowIndex = 1; rowIndex <= block.rows.length; rowIndex += 1) {
    const y = block.y + rowIndex * rowHeight;
    lines.push(
      `<line class="canvas-mechanical-table-line" x1="${block.x}" y1="${y}" x2="${block.x + width}" y2="${y}" stroke="#253043" stroke-width="${MECHANICAL_LIGHT_STROKE}" />`,
    );
  }
  block.columns.forEach((column, columnIndex) => {
    lines.push(
      `<text class="canvas-mechanical-table-header" x="${block.x + columnIndex * columnWidth + 2.5}" y="${block.y + 5.7}" fill="#253043" font-size="${MECHANICAL_TABLE_HEADER_FONT_SIZE}" font-weight="700" stroke="none">${escapeXmlText(column)}</text>`,
    );
  });
  block.rows.forEach((row, rowIndex) => {
    block.columns.forEach((column, columnIndex) => {
      lines.push(
        `<text class="canvas-mechanical-table-cell" x="${block.x + columnIndex * columnWidth + 2.5}" y="${block.y + (rowIndex + 2) * rowHeight - 2.6}" fill="#253043" font-size="${MECHANICAL_TABLE_CELL_FONT_SIZE}" stroke="none">${escapeXmlText(String(row[column] ?? ""))}</text>`,
      );
    });
  });
}

function renderMechanicalSheetFrame(sidecar: MechanicalAnnotationSidecarObject, lines: string[]) {
  const layout = getMechanicalSheetLayout(sidecar.annotations.sheet);
  lines.push(
    `<g class="canvas-mechanical-sheet-frame" data-canvas-mechanical-sheet="A4-landscape">`,
    `<rect class="canvas-mechanical-sheet-boundary" x="0" y="0" width="${layout.widthMm}" height="${layout.heightMm}" fill="none" stroke="#253043" stroke-width="${MECHANICAL_LINE_STROKE}" />`,
    `<rect class="canvas-mechanical-sheet-margin" x="${layout.contentBoxMm.x}" y="${layout.contentBoxMm.y}" width="${layout.contentBoxMm.width}" height="${layout.contentBoxMm.height}" fill="none" stroke="#7f8896" stroke-width="${MECHANICAL_LIGHT_STROKE}" stroke-dasharray="2 1.4" />`,
    `<rect class="canvas-mechanical-sheet-content" x="${layout.contentBoxMm.x}" y="${layout.contentBoxMm.y}" width="${layout.contentBoxMm.width}" height="${layout.contentBoxMm.height}" fill="none" stroke="#c7ccd4" stroke-width="${MECHANICAL_LIGHT_STROKE}" />`,
    `</g>`,
  );
}

function renderBlock(
  annotations: MechanicalAnnotationSet,
  block: MechanicalBlockAnnotation,
  lines: string[],
) {
  if (block.kind === "titleBlock") {
    const entries = getMechanicalTitleBlockEntries(annotations, block);
    lines.push(
      `<g class="canvas-mechanical-block" data-canvas-mechanical-id="${quoteXmlAttribute(block.id)}">`,
      `<rect x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" fill="#ffffff" stroke="#253043" stroke-width="${MECHANICAL_LINE_STROKE}" />`,
      `<text class="canvas-mechanical-block-title" x="${block.x + 3}" y="${block.y + 5.5}" fill="#253043" font-size="${MECHANICAL_BLOCK_TITLE_FONT_SIZE}" font-weight="700" stroke="none">${formatBlockTitle(block.kind)}</text>`,
    );
    const rowHeight = Math.max(5.2, (block.height - 7) / Math.max(entries.length, 1));
    entries.forEach(([key, value], index) => {
      const rowY = block.y + 7 + index * rowHeight;
      if (index > 0) {
        lines.push(
          `<line x1="${block.x}" y1="${rowY}" x2="${block.x + block.width}" y2="${rowY}" stroke="#253043" stroke-width="${MECHANICAL_LIGHT_STROKE}" />`,
        );
      }
      lines.push(
        `<text class="canvas-mechanical-table-header" x="${block.x + 3}" y="${rowY + 4.2}" fill="#253043" font-size="${MECHANICAL_TABLE_HEADER_FONT_SIZE}" font-weight="700" stroke="none">${escapeXmlText(key)}</text>`,
        `<text class="canvas-mechanical-table-cell" x="${block.x + Math.max(24, block.width * 0.34)}" y="${rowY + 4.4}" fill="#253043" font-size="${MECHANICAL_TABLE_CELL_FONT_SIZE}" stroke="none">${escapeXmlText(value)}</text>`,
      );
    });
    lines.push(`</g>`);
    return;
  }

  lines.push(
    `<g class="canvas-mechanical-block" data-canvas-mechanical-id="${quoteXmlAttribute(block.id)}">`,
    `<text class="canvas-mechanical-block-title" x="${block.x}" y="${block.y - 2}" fill="#253043" font-size="${MECHANICAL_BLOCK_TITLE_FONT_SIZE}" font-weight="700" stroke="none">${formatBlockTitle(block.kind)}</text>`,
  );
  renderTableContent(annotations, block, lines);
  lines.push(`</g>`);
}

function renderLeader(
  from: readonly [number, number],
  to: readonly [number, number],
  lines: string[],
  className: string,
  options?: { readonly arrows?: "start" | "end" | "both" },
) {
  const markerStart =
    options?.arrows === "start" || options?.arrows === "both"
      ? ' marker-start="url(#canvas-mechanical-arrow)"'
      : "";
  const markerEnd =
    options?.arrows === "end" || options?.arrows === "both"
      ? ' marker-end="url(#canvas-mechanical-arrow)"'
      : "";
  lines.push(
    `<line class="${className}" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}" stroke="#253043" stroke-width="${className === "canvas-mechanical-extension" ? MECHANICAL_LIGHT_STROKE : MECHANICAL_LINE_STROKE}"${markerStart}${markerEnd} />`,
  );
}

function estimateLabelWidth(text: string): number {
  return Math.max(8, text.length * MECHANICAL_LABEL_FONT_SIZE * 0.62 + 2.8);
}

function renderDimensionLabel(
  text: string,
  at: readonly [number, number],
  lines: string[],
  options?: {
    readonly textAnchor?: "start" | "middle" | "end";
    readonly rotate?: number;
  },
) {
  const width = estimateLabelWidth(text);
  const height = MECHANICAL_LABEL_FONT_SIZE + 2.2;
  const anchor = options?.textAnchor ?? "middle";
  const rectX =
    anchor === "start" ? at[0] - 1.4 : anchor === "end" ? at[0] - width + 1.4 : at[0] - width / 2;
  const rectY = at[1] - MECHANICAL_LABEL_FONT_SIZE - 1.2;
  const transform =
    options?.rotate !== undefined ? ` transform="rotate(${options.rotate} ${at[0]} ${at[1]})"` : "";
  lines.push(
    `<g class="canvas-mechanical-label-group"${transform}>`,
    `<rect class="canvas-mechanical-label-backplate" x="${rectX}" y="${rectY}" width="${width}" height="${height}" fill="#ffffff" stroke="none" />`,
    `<text class="canvas-mechanical-label" x="${at[0]}" y="${at[1]}" text-anchor="${anchor}" fill="#253043" font-size="${MECHANICAL_LABEL_FONT_SIZE}" stroke="none">${escapeXmlText(text)}</text>`,
    `</g>`,
  );
}

function renderLinearDimension(
  dimension: MechanicalLinearDimension | MechanicalAlignedDimension,
  defaultUnits: MechanicalUnits,
  lines: string[],
) {
  const dx = dimension.to[0] - dimension.from[0];
  const dy = dimension.to[1] - dimension.from[1];
  const length = Math.hypot(dx, dy) || 1;
  const normalX =
    dimension.kind === "linear" ? (dimension.axis === "horizontal" ? 0 : 1) : -dy / length;
  const normalY =
    dimension.kind === "linear" ? (dimension.axis === "horizontal" ? -1 : 0) : dx / length;
  const offset = dimension.offset ?? 18;
  const start =
    dimension.kind === "linear" && dimension.axis === "horizontal"
      ? ([dimension.from[0], dimension.from[1] + normalY * offset] as const)
      : dimension.kind === "linear" && dimension.axis === "vertical"
        ? ([dimension.from[0] + normalX * offset, dimension.from[1]] as const)
        : ([dimension.from[0] + normalX * offset, dimension.from[1] + normalY * offset] as const);
  const end =
    dimension.kind === "linear" && dimension.axis === "horizontal"
      ? ([dimension.to[0], dimension.from[1] + normalY * offset] as const)
      : dimension.kind === "linear" && dimension.axis === "vertical"
        ? ([dimension.from[0] + normalX * offset, dimension.to[1]] as const)
        : ([dimension.to[0] + normalX * offset, dimension.to[1] + normalY * offset] as const);
  const labelX = (start[0] + end[0]) / 2;
  const labelY = (start[1] + end[1]) / 2 - (dimension.labelOffset ?? 4);
  const labelAngle =
    dimension.kind === "aligned"
      ? (Math.atan2(end[1] - start[1], end[0] - start[0]) * 180) / Math.PI
      : 0;
  renderLeader(dimension.from, start, lines, "canvas-mechanical-extension");
  renderLeader(dimension.to, end, lines, "canvas-mechanical-extension");
  renderLeader(start, end, lines, "canvas-mechanical-dimension", { arrows: "both" });
  renderDimensionLabel(
    formatMechanicalDimensionText(dimension, defaultUnits),
    [labelX, labelY],
    lines,
    {
      rotate: dimension.kind === "aligned" ? labelAngle : undefined,
    },
  );
}

function renderAngleDimension(
  dimension: MechanicalAngleDimension,
  defaultUnits: MechanicalUnits,
  lines: string[],
) {
  const radius = dimension.radius ?? 22;
  const startAngle = Math.atan2(
    dimension.from[1] - dimension.center[1],
    dimension.from[0] - dimension.center[0],
  );
  const endAngle = Math.atan2(
    dimension.to[1] - dimension.center[1],
    dimension.to[0] - dimension.center[0],
  );
  const start = [
    dimension.center[0] + Math.cos(startAngle) * radius,
    dimension.center[1] + Math.sin(startAngle) * radius,
  ] as const;
  const end = [
    dimension.center[0] + Math.cos(endAngle) * radius,
    dimension.center[1] + Math.sin(endAngle) * radius,
  ] as const;
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  const midAngle = startAngle + (endAngle - startAngle) / 2;
  const labelOffset = dimension.labelOffset ?? 14;
  const label = [
    dimension.center[0] + Math.cos(midAngle) * (radius + labelOffset),
    dimension.center[1] + Math.sin(midAngle) * (radius + labelOffset),
  ] as const;
  renderLeader(dimension.center, dimension.from, lines, "canvas-mechanical-extension");
  renderLeader(dimension.center, dimension.to, lines, "canvas-mechanical-extension");
  lines.push(
    `<path class="canvas-mechanical-dimension" d="M ${start[0]} ${start[1]} A ${radius} ${radius} 0 ${largeArc} 1 ${end[0]} ${end[1]}" fill="none" stroke="#253043" stroke-width="${MECHANICAL_LINE_STROKE}" marker-start="url(#canvas-mechanical-arrow)" marker-end="url(#canvas-mechanical-arrow)" />`,
  );
  renderDimensionLabel(formatMechanicalDimensionText(dimension, defaultUnits), label, lines);
}

function renderCircularDimension(
  dimension: MechanicalRadiusDimension | MechanicalDiameterDimension,
  defaultUnits: MechanicalUnits,
  lines: string[],
) {
  const radius = dimension.kind === "radius" ? dimension.radius : dimension.diameter / 2;
  const angle = ((dimension.leaderAngle ?? 0) * Math.PI) / 180;
  const radial = [Math.cos(angle), Math.sin(angle)] as const;
  const anchor = [
    dimension.center[0] + radial[0] * radius,
    dimension.center[1] + radial[1] * radius,
  ] as const;
  const leaderLength = dimension.leaderLength ?? 18;
  const leaderEnd = [
    anchor[0] + radial[0] * leaderLength,
    anchor[1] + radial[1] * leaderLength,
  ] as const;
  const labelOffset = dimension.labelOffset ?? ([radial[0] >= 0 ? 3 : -3, -2] as const);
  const label = [leaderEnd[0] + labelOffset[0], leaderEnd[1] + labelOffset[1]] as const;
  renderLeader(leaderEnd, anchor, lines, "canvas-mechanical-dimension", { arrows: "end" });
  if (dimension.showCenterMark ?? dimension.kind === "diameter") {
    lines.push(
      `<circle class="canvas-mechanical-center-mark" cx="${dimension.center[0]}" cy="${dimension.center[1]}" r="1.1" fill="#253043" stroke="none" />`,
    );
  }
  renderDimensionLabel(formatMechanicalDimensionText(dimension, defaultUnits), label, lines, {
    textAnchor: radial[0] >= 0 ? "start" : "end",
  });
}

export function serializeMechanicalAnnotationOverlayContent(
  sidecar: MechanicalAnnotationSidecarObject,
): string {
  const lines: string[] = [];
  const units = sidecar.annotations.units;
  lines.push(
    `<g class="canvas-mechanical-annotation-layer" font-family="Arial, Helvetica, sans-serif" fill="none" stroke="#253043" stroke-linecap="square" stroke-linejoin="miter">`,
    `<defs><marker id="canvas-mechanical-arrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto-start-reverse"><path d="M 5 2.5 L 0 0 L 0 5 Z" fill="#253043" stroke="none" /></marker></defs>`,
  );

  renderMechanicalSheetFrame(sidecar, lines);

  for (const dimension of sidecar.annotations.dimensions) {
    if (dimension.kind === "linear" || dimension.kind === "aligned") {
      renderLinearDimension(dimension, units, lines);
    } else if (dimension.kind === "angle") {
      renderAngleDimension(dimension, units, lines);
    } else {
      renderCircularDimension(dimension, units, lines);
    }
  }

  for (const note of sidecar.annotations.notes) {
    if (note.leaderTo) {
      renderLeader(note.at, note.leaderTo, lines, "canvas-mechanical-note-leader");
    }
    lines.push(
      `<text class="canvas-mechanical-note" x="${note.at[0]}" y="${note.at[1]}" fill="#253043" font-size="${MECHANICAL_NOTE_FONT_SIZE}" font-weight="700" stroke="none">${escapeXmlText(note.text)}</text>`,
    );
  }

  for (const datum of sidecar.annotations.datums) {
    if (datum.target) {
      renderLeader(datum.at, datum.target, lines, "canvas-mechanical-datum-leader");
    }
    lines.push(
      `<rect class="canvas-mechanical-datum-box" x="${datum.at[0] - 4.5}" y="${datum.at[1] - 5.5}" width="10" height="8" fill="#ffffff" stroke="#253043" stroke-width="${MECHANICAL_LINE_STROKE}" />`,
      `<text class="canvas-mechanical-datum-label" x="${datum.at[0] + 0.4}" y="${datum.at[1] + 1.6}" fill="#253043" font-size="${MECHANICAL_LABEL_FONT_SIZE}" font-weight="700" stroke="none">${escapeXmlText(datum.label)}</text>`,
    );
  }

  for (const block of sidecar.annotations.blocks) {
    renderBlock(sidecar.annotations, block, lines);
  }

  lines.push(`</g>`);
  return lines.join("");
}

export function serializeMechanicalAnnotationSidecarJson(
  object: MechanicalAnnotationSidecarObject,
): string {
  return `${JSON.stringify(
    {
      id: object.id,
      name: object.name,
      kind: object.kind,
      role: object.role,
      targetObjectId: object.targetObjectId,
      visible: object.visible,
      annotations: object.annotations,
    },
    null,
    2,
  )}\n`;
}

export function hasMechanicalAnnotationSidecars(
  objects: readonly CanvasObject[],
): objects is readonly (CanvasObject | MechanicalAnnotationSidecarObject)[] {
  return objects.some((object) => object.kind === "mechanicalAnnotationSidecar");
}
