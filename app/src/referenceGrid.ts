import type { CanvasDocument, CanvasObject } from "./sceneModel";

export type ReferenceGridConfig = {
  columns: number;
  rows: number;
  columnStart?: string;
  rowStart?: number;
  showBorder?: boolean;
  showLines?: boolean;
  showLabels?: boolean;
};

export type GridCellRef = {
  col: number;
  row: number;
  columnLabel: string;
  rowLabel: string;
  ref: string;
};

export type GridSubcell = "nw" | "n" | "ne" | "w" | "c" | "e" | "sw" | "s" | "se";

export type GridPointRef = {
  cell: GridCellRef;
  subcell: GridSubcell;
  ref: string;
  localX: number;
  localY: number;
};

export type GridBoundsRef = {
  start: GridCellRef;
  end: GridCellRef;
  span: string;
  center: GridPointRef;
};

export type ParsedGridPointRef = {
  cell: string;
  columnLabel: string;
  rowLabel: string;
  col: number;
  row: number;
  subcell?: GridSubcell;
  localX?: number;
  localY?: number;
};

export type ParsedGridSpanRef = {
  start: ParsedGridPointRef;
  end: ParsedGridPointRef;
  span: string;
};

const defaultReferenceGridConfig = {
  columns: 6,
  rows: 4,
  columnStart: "A",
  rowStart: 1,
  showBorder: true,
  showLines: false,
  showLabels: true,
} satisfies Required<ReferenceGridConfig>;

const boundsEpsilon = 0.000001;

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Reference grid ${label} must be an integer >= 1.`);
  }
  return value;
}

function assertInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`Reference grid ${label} must be an integer.`);
  }
  return value;
}

function normalizeColumnStart(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Reference grid columnStart must be a non-empty string.");
  }
  return normalized;
}

function getColumnStartOffset(columnStart: string): number {
  return columnLabelToNumber(columnStart.trim().toUpperCase()) ?? 0;
}

function numberToColumnLabel(value: number): string {
  let remaining = value + 1;
  let label = "";

  while (remaining > 0) {
    remaining -= 1;
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26);
  }

  return label;
}

function columnLabelToNumber(label: string): number | undefined {
  if (!/^[A-Z]+$/.test(label)) return undefined;
  let value = 0;
  for (const char of label) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }
  return value - 1;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function positiveFiniteOrOne(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cellRef(col: number, row: number, config: ReferenceGridConfig): GridCellRef {
  const columnLabel = getColumnLabel(col, config.columnStart);
  const rowLabel = String((config.rowStart ?? defaultReferenceGridConfig.rowStart) + row);
  return {
    col,
    row,
    columnLabel,
    rowLabel,
    ref: `${columnLabel}${rowLabel}`,
  };
}

function subcellFromLocal(localX: number, localY: number): GridSubcell {
  const xBand = localX < 1 / 3 ? "w" : localX < 2 / 3 ? "c" : "e";
  const yBand = localY < 1 / 3 ? "n" : localY < 2 / 3 ? "c" : "s";

  if (xBand === "c" && yBand === "c") return "c";
  if (yBand === "c") return xBand as GridSubcell;
  if (xBand === "c") return yBand as GridSubcell;
  return `${yBand}${xBand}` as GridSubcell;
}

function localFromSubcell(subcell: GridSubcell): { localX: number; localY: number } {
  switch (subcell) {
    case "nw":
      return { localX: 0, localY: 0 };
    case "n":
      return { localX: 0.5, localY: 0 };
    case "ne":
      return { localX: 1, localY: 0 };
    case "w":
      return { localX: 0, localY: 0.5 };
    case "c":
      return { localX: 0.5, localY: 0.5 };
    case "e":
      return { localX: 1, localY: 0.5 };
    case "sw":
      return { localX: 0, localY: 1 };
    case "s":
      return { localX: 0.5, localY: 1 };
    case "se":
      return { localX: 1, localY: 1 };
  }
}

export function createReferenceGridConfig(
  partial?: Partial<ReferenceGridConfig>,
): ReferenceGridConfig {
  const columns = assertPositiveInteger(
    partial?.columns ?? defaultReferenceGridConfig.columns,
    "columns",
  );
  const rows = assertPositiveInteger(partial?.rows ?? defaultReferenceGridConfig.rows, "rows");
  const columnStart = normalizeColumnStart(
    partial?.columnStart ?? defaultReferenceGridConfig.columnStart,
  );
  const rowStart = assertInteger(
    partial?.rowStart ?? defaultReferenceGridConfig.rowStart,
    "rowStart",
  );

  return {
    columns,
    rows,
    columnStart,
    rowStart,
    showBorder: partial?.showBorder ?? defaultReferenceGridConfig.showBorder,
    showLines: partial?.showLines ?? defaultReferenceGridConfig.showLines,
    showLabels: partial?.showLabels ?? defaultReferenceGridConfig.showLabels,
  };
}

export function getColumnLabel(index: number, columnStart = "A"): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Reference grid column index must be an integer >= 0.");
  }

  return numberToColumnLabel(index + getColumnStartOffset(columnStart));
}

export function parseGridPointRef(
  ref: string,
  config?: Partial<ReferenceGridConfig>,
): ParsedGridPointRef {
  const resolved = createReferenceGridConfig(config);
  const trimmed = ref.trim();
  const match = /^([A-Za-z]+)(\d+)(?:(?:\.([A-Za-z]+))|(?:@([^,]+),([^,]+)))?$/.exec(trimmed);

  if (!match) {
    throw new Error(`Invalid grid point ref "${ref}".`);
  }

  const columnLabel = match[1].toUpperCase();
  const rowLabel = match[2];
  const columnIndex = columnLabelToNumber(columnLabel);
  if (columnIndex === undefined) {
    throw new Error(`Invalid grid column "${match[1]}".`);
  }

  const col = columnIndex - getColumnStartOffset(resolved.columnStart ?? "A");
  const row = Number(rowLabel) - (resolved.rowStart ?? 1);
  if (!Number.isInteger(col) || col < 0 || col >= resolved.columns) {
    throw new Error(`Grid column "${columnLabel}" is outside the reference grid.`);
  }
  if (!Number.isInteger(row) || row < 0 || row >= resolved.rows) {
    throw new Error(`Grid row "${rowLabel}" is outside the reference grid.`);
  }

  const subcell = match[3]?.toLowerCase();
  if (subcell !== undefined && !isGridSubcell(subcell)) {
    throw new Error(`Invalid grid subcell "${match[3]}".`);
  }

  const parsed: ParsedGridPointRef = {
    cell: `${columnLabel}${rowLabel}`,
    columnLabel,
    rowLabel,
    col,
    row,
  };

  if (subcell !== undefined) {
    parsed.subcell = subcell;
  }

  if (match[4] !== undefined && match[5] !== undefined) {
    const localX = Number(match[4]);
    const localY = Number(match[5]);
    if (!Number.isFinite(localX) || localX < 0 || localX > 1) {
      throw new Error(`Grid local X for "${ref}" must be between 0 and 1.`);
    }
    if (!Number.isFinite(localY) || localY < 0 || localY > 1) {
      throw new Error(`Grid local Y for "${ref}" must be between 0 and 1.`);
    }
    parsed.localX = localX;
    parsed.localY = localY;
  }

  return parsed;
}

function isGridSubcell(value: string): value is GridSubcell {
  return ["nw", "n", "ne", "w", "c", "e", "sw", "s", "se"].includes(value);
}

export function parseGridSpanRef(
  span: string,
  config?: Partial<ReferenceGridConfig>,
): ParsedGridSpanRef {
  const parts = span
    .trim()
    .split("-")
    .map((part) => part.trim());
  if (parts.length < 1 || parts.length > 2 || parts.some((part) => part.length === 0)) {
    throw new Error(`Invalid grid span ref "${span}".`);
  }

  const parsed = parts.map((part) => {
    if (/[.@]/.test(part)) {
      throw new Error(`Grid span ref "${span}" must use whole cell refs.`);
    }
    return parseGridPointRef(part, config);
  });

  const first = parsed[0];
  const second = parsed[1] ?? first;
  const startCol = Math.min(first.col, second.col);
  const endCol = Math.max(first.col, second.col);
  const startRow = Math.min(first.row, second.row);
  const endRow = Math.max(first.row, second.row);
  const resolved = createReferenceGridConfig(config);
  const startCell = cellRef(startCol, startRow, resolved);
  const endCell = cellRef(endCol, endRow, resolved);
  const start: ParsedGridPointRef = {
    cell: startCell.ref,
    columnLabel: startCell.columnLabel,
    rowLabel: startCell.rowLabel,
    col: startCol,
    row: startRow,
  };
  const end: ParsedGridPointRef = {
    cell: endCell.ref,
    columnLabel: endCell.columnLabel,
    rowLabel: endCell.rowLabel,
    col: endCol,
    row: endRow,
  };

  return {
    start,
    end,
    span: start.cell === end.cell ? start.cell : `${start.cell}-${end.cell}`,
  };
}

export function gridPointRefToCanvasPoint(
  ref: string,
  canvasWidth: number,
  canvasHeight: number,
  config?: Partial<ReferenceGridConfig>,
): { x: number; y: number } {
  const parsed = parseGridPointRef(ref, config);
  const resolved = createReferenceGridConfig(config);
  const cellWidth = positiveFiniteOrOne(canvasWidth) / resolved.columns;
  const cellHeight = positiveFiniteOrOne(canvasHeight) / resolved.rows;
  const local =
    parsed.localX !== undefined && parsed.localY !== undefined
      ? { localX: parsed.localX, localY: parsed.localY }
      : localFromSubcell(parsed.subcell ?? "c");

  return {
    x: parsed.col * cellWidth + local.localX * cellWidth,
    y: parsed.row * cellHeight + local.localY * cellHeight,
  };
}

export function gridSpanRefToCanvasRect(
  span: string,
  canvasWidth: number,
  canvasHeight: number,
  config?: Partial<ReferenceGridConfig>,
): { x: number; y: number; width: number; height: number } {
  const parsed = parseGridSpanRef(span, config);
  const resolved = createReferenceGridConfig(config);
  const cellWidth = positiveFiniteOrOne(canvasWidth) / resolved.columns;
  const cellHeight = positiveFiniteOrOne(canvasHeight) / resolved.rows;

  return {
    x: parsed.start.col * cellWidth,
    y: parsed.start.row * cellHeight,
    width: (parsed.end.col - parsed.start.col + 1) * cellWidth,
    height: (parsed.end.row - parsed.start.row + 1) * cellHeight,
  };
}

export function pointToGridRef(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  config?: Partial<ReferenceGridConfig>,
): GridPointRef {
  const resolved = createReferenceGridConfig(config);
  const width = positiveFiniteOrOne(canvasWidth);
  const height = positiveFiniteOrOne(canvasHeight);
  const clampedX = clamp(finiteOrZero(x), 0, width);
  const clampedY = clamp(finiteOrZero(y), 0, height);
  const cellWidth = width / resolved.columns;
  const cellHeight = height / resolved.rows;
  const col = clamp(Math.floor(clampedX / cellWidth), 0, resolved.columns - 1);
  const row = clamp(Math.floor(clampedY / cellHeight), 0, resolved.rows - 1);
  const cellX = col * cellWidth;
  const cellY = row * cellHeight;
  const localX = clamp((clampedX - cellX) / cellWidth, 0, 1);
  const localY = clamp((clampedY - cellY) / cellHeight, 0, 1);
  const subcell = subcellFromLocal(localX, localY);
  const cell = cellRef(col, row, resolved);

  return {
    cell,
    subcell,
    ref: `${cell.ref}.${subcell}`,
    localX,
    localY,
  };
}

export function boundsToGridRef(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasWidth: number,
  canvasHeight: number,
  config?: Partial<ReferenceGridConfig>,
): GridBoundsRef {
  const resolved = createReferenceGridConfig(config);
  const safeX = finiteOrZero(x);
  const safeY = finiteOrZero(y);
  const safeWidth = Math.max(0, finiteOrZero(width));
  const safeHeight = Math.max(0, finiteOrZero(height));
  const right = safeX + safeWidth - (safeWidth > 0 ? boundsEpsilon : 0);
  const bottom = safeY + safeHeight - (safeHeight > 0 ? boundsEpsilon : 0);
  const start = pointToGridRef(safeX, safeY, canvasWidth, canvasHeight, resolved).cell;
  const end = pointToGridRef(right, bottom, canvasWidth, canvasHeight, resolved).cell;
  const center = pointToGridRef(
    safeX + safeWidth / 2,
    safeY + safeHeight / 2,
    canvasWidth,
    canvasHeight,
    resolved,
  );

  return {
    start,
    end,
    span: start.ref === end.ref ? start.ref : `${start.ref}-${end.ref}`,
    center,
  };
}

export function objectToGridRef(
  object: CanvasObject,
  document: CanvasDocument,
  config?: Partial<ReferenceGridConfig>,
): GridBoundsRef {
  return boundsToGridRef(
    object.x,
    object.y,
    object.width,
    object.height,
    document.width,
    document.height,
    config ?? document.referenceGrid,
  );
}
