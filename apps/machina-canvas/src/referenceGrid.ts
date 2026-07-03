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
  const first = columnStart.trim().toUpperCase().charCodeAt(0);
  if (first < 65 || first > 90) return 0;
  return first - 65;
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
