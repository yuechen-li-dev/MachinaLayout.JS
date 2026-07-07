import type { CanvasObject, CanvasObjectBase } from "./sceneModel";

export type MechanicalUnits = "mm" | "cm" | "m" | "in" | "px";

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
};

export type MechanicalLinearDimension = MechanicalDimensionBase & {
  readonly kind: "linear";
  readonly axis: "horizontal" | "vertical";
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly offset?: number;
};

export type MechanicalAlignedDimension = MechanicalDimensionBase & {
  readonly kind: "aligned";
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly offset?: number;
};

export type MechanicalAngleDimension = MechanicalDimensionBase & {
  readonly kind: "angle";
  readonly center: readonly [number, number];
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
};

export type MechanicalRadiusDimension = MechanicalDimensionBase & {
  readonly kind: "radius";
  readonly center: readonly [number, number];
  readonly radius: number;
};

export type MechanicalDiameterDimension = MechanicalDimensionBase & {
  readonly kind: "diameter";
  readonly center: readonly [number, number];
  readonly diameter: number;
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
    dimensions: input?.dimensions ?? [],
    notes: input?.notes ?? [],
    datums: input?.datums ?? [],
    blocks: input?.blocks ?? [],
  };
}

export function countMechanicalAnnotations(annotations: MechanicalAnnotationSet) {
  return {
    dimensions: annotations.dimensions.length,
    notes: annotations.notes.length,
    datums: annotations.datums.length,
    blocks: annotations.blocks.length,
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

function formatBlockTitle(kind: MechanicalBlockAnnotation["kind"]): string {
  return kind === "titleBlock" ? "TITLE BLOCK" : kind === "revisionTable" ? "REVISIONS" : "BOM";
}

function renderTableContent(block: MechanicalRevisionTable | MechanicalBomTable, lines: string[]) {
  const rowHeight = 18;
  const columnWidth = 96;
  const width = Math.max(columnWidth * block.columns.length, 120);
  const height = rowHeight * (block.rows.length + 1);
  lines.push(
    `<rect class="canvas-mechanical-table" x="${block.x}" y="${block.y}" width="${width}" height="${height}" fill="rgba(255,255,255,0.9)" stroke="#253043" />`,
  );
  for (let columnIndex = 1; columnIndex < block.columns.length; columnIndex += 1) {
    const x = block.x + columnIndex * columnWidth;
    lines.push(
      `<line class="canvas-mechanical-table-line" x1="${x}" y1="${block.y}" x2="${x}" y2="${block.y + height}" stroke="#253043" />`,
    );
  }
  for (let rowIndex = 1; rowIndex <= block.rows.length; rowIndex += 1) {
    const y = block.y + rowIndex * rowHeight;
    lines.push(
      `<line class="canvas-mechanical-table-line" x1="${block.x}" y1="${y}" x2="${block.x + width}" y2="${y}" stroke="#253043" />`,
    );
  }
  block.columns.forEach((column, columnIndex) => {
    lines.push(
      `<text class="canvas-mechanical-table-header" x="${block.x + columnIndex * columnWidth + 6}" y="${block.y + 13}">${escapeXmlText(column)}</text>`,
    );
  });
  block.rows.forEach((row, rowIndex) => {
    block.columns.forEach((column, columnIndex) => {
      lines.push(
        `<text class="canvas-mechanical-table-cell" x="${block.x + columnIndex * columnWidth + 6}" y="${block.y + (rowIndex + 2) * rowHeight - 5}">${escapeXmlText(String(row[column] ?? ""))}</text>`,
      );
    });
  });
}

function renderBlock(block: MechanicalBlockAnnotation, lines: string[]) {
  if (block.kind === "titleBlock") {
    lines.push(
      `<g class="canvas-mechanical-block" data-canvas-mechanical-id="${quoteXmlAttribute(block.id)}">`,
      `<rect x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" fill="rgba(255,255,255,0.9)" stroke="#253043" />`,
      `<text class="canvas-mechanical-block-title" x="${block.x + 8}" y="${block.y + 16}">${formatBlockTitle(block.kind)}</text>`,
    );
    const entries = Object.entries(block.fields);
    const rowHeight = Math.max(18, Math.floor((block.height - 22) / Math.max(entries.length, 1)));
    entries.forEach(([key, value], index) => {
      const rowY = block.y + 22 + index * rowHeight;
      if (index > 0) {
        lines.push(
          `<line x1="${block.x}" y1="${rowY}" x2="${block.x + block.width}" y2="${rowY}" stroke="#253043" />`,
        );
      }
      lines.push(
        `<text class="canvas-mechanical-table-header" x="${block.x + 8}" y="${rowY + 13}">${escapeXmlText(key)}</text>`,
        `<text class="canvas-mechanical-table-cell" x="${block.x + Math.max(80, block.width * 0.34)}" y="${rowY + 13}">${escapeXmlText(value)}</text>`,
      );
    });
    lines.push(`</g>`);
    return;
  }

  lines.push(
    `<g class="canvas-mechanical-block" data-canvas-mechanical-id="${quoteXmlAttribute(block.id)}">`,
    `<text class="canvas-mechanical-block-title" x="${block.x}" y="${block.y - 6}">${formatBlockTitle(block.kind)}</text>`,
  );
  renderTableContent(block, lines);
  lines.push(`</g>`);
}

function renderLeader(
  from: readonly [number, number],
  to: readonly [number, number],
  lines: string[],
  className: string,
) {
  lines.push(
    `<line class="${className}" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}" stroke="#253043" />`,
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
  const start = [
    dimension.from[0] + normalX * offset,
    dimension.from[1] + normalY * offset,
  ] as const;
  const end = [dimension.to[0] + normalX * offset, dimension.to[1] + normalY * offset] as const;
  const labelX = (start[0] + end[0]) / 2;
  const labelY = (start[1] + end[1]) / 2 - 4;
  renderLeader(dimension.from, start, lines, "canvas-mechanical-extension");
  renderLeader(dimension.to, end, lines, "canvas-mechanical-extension");
  renderLeader(start, end, lines, "canvas-mechanical-dimension");
  lines.push(
    `<text class="canvas-mechanical-label" x="${labelX}" y="${labelY}" text-anchor="middle">${escapeXmlText(formatMechanicalDimensionText(dimension, defaultUnits))}</text>`,
  );
}

function renderAngleDimension(
  dimension: MechanicalAngleDimension,
  defaultUnits: MechanicalUnits,
  lines: string[],
) {
  const radius = 22;
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
  const label = [
    dimension.center[0] + Math.cos(midAngle) * (radius + 14),
    dimension.center[1] + Math.sin(midAngle) * (radius + 14),
  ] as const;
  renderLeader(dimension.center, dimension.from, lines, "canvas-mechanical-extension");
  renderLeader(dimension.center, dimension.to, lines, "canvas-mechanical-extension");
  lines.push(
    `<path class="canvas-mechanical-dimension" d="M ${start[0]} ${start[1]} A ${radius} ${radius} 0 ${largeArc} 1 ${end[0]} ${end[1]}" fill="none" stroke="#253043" />`,
    `<text class="canvas-mechanical-label" x="${label[0]}" y="${label[1]}" text-anchor="middle">${escapeXmlText(formatMechanicalDimensionText(dimension, defaultUnits))}</text>`,
  );
}

function renderCircularDimension(
  dimension: MechanicalRadiusDimension | MechanicalDiameterDimension,
  defaultUnits: MechanicalUnits,
  lines: string[],
) {
  const radius = dimension.kind === "radius" ? dimension.radius : dimension.diameter / 2;
  const anchor = [dimension.center[0] + radius, dimension.center[1]] as const;
  const label = [anchor[0] + 18, anchor[1] - 8] as const;
  renderLeader(dimension.center, anchor, lines, "canvas-mechanical-dimension");
  lines.push(
    `<circle class="canvas-mechanical-center-mark" cx="${dimension.center[0]}" cy="${dimension.center[1]}" r="2.5" fill="#253043" />`,
    `<text class="canvas-mechanical-label" x="${label[0]}" y="${label[1]}">${escapeXmlText(formatMechanicalDimensionText(dimension, defaultUnits))}</text>`,
  );
}

export function serializeMechanicalAnnotationOverlayContent(
  sidecar: MechanicalAnnotationSidecarObject,
): string {
  const lines: string[] = [];
  const units = sidecar.annotations.units;

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
      `<text class="canvas-mechanical-note" x="${note.at[0]}" y="${note.at[1]}">${escapeXmlText(note.text)}</text>`,
    );
  }

  for (const datum of sidecar.annotations.datums) {
    if (datum.target) {
      renderLeader(datum.at, datum.target, lines, "canvas-mechanical-datum-leader");
    }
    lines.push(
      `<rect class="canvas-mechanical-datum-box" x="${datum.at[0] - 8}" y="${datum.at[1] - 12}" width="20" height="16" fill="#ffffff" stroke="#253043" />`,
      `<text class="canvas-mechanical-datum-label" x="${datum.at[0] + 2}" y="${datum.at[1]}">${escapeXmlText(datum.label)}</text>`,
    );
  }

  for (const block of sidecar.annotations.blocks) {
    renderBlock(block, lines);
  }

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
