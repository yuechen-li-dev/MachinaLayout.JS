import type {
  ArrangeSpec,
  EdgeInsets,
  FrameSpec,
  GridTrack,
  LayoutRow,
  LayoutRowVariant,
} from "../types";
import { MachinaAuthoringError, type MachinaAuthoringErrorCode } from "./errors";
import { copyRow, stackAxisFromArrange, validateDuplicateRows, validateNodeId } from "./lower";
import { node } from "./node";
import type { MachinaLowerContext, MachinaNode, MachinaNodeId } from "./types";

export type MachinaGridTrack = GridTrack;

export type CellOptions = {
  colSpan?: number;
  rowSpan?: number;
  view?: string;
  slot?: string;
  debugLabel?: string;
  layer?: string;
  z?: number;
  arrange?: ArrangeSpec;
  variants?: readonly LayoutRowVariant[];
};
export type GridAreaOptions = CellOptions;
export interface MachinaGridArea {
  readonly kind: "area";
  readonly id: MachinaNodeId;
  readonly options: GridAreaOptions;
  readonly children: readonly MachinaNode[];
}
export interface MachinaGridSkip {
  readonly kind: "skip";
  readonly span?: number;
}
export type MachinaGridMatrixItem = MachinaGridArea | MachinaGridSkip;
export interface MachinaGridRows {
  readonly kind: "gridRows";
  readonly rows: readonly (readonly MachinaGridMatrixItem[])[];
}
export type GridOptions = {
  columns: readonly MachinaGridTrack[];
  rows: readonly MachinaGridTrack[];
  columnGap?: number;
  rowGap?: number;
  padding?: number | Partial<EdgeInsets>;
  parent?: MachinaNodeId;
  frame?: FrameSpec;
  view?: string;
  slot?: string;
  debugLabel?: string;
  layer?: string;
  z?: number;
  variants?: readonly LayoutRowVariant[];
};

function authoringError(code: MachinaAuthoringErrorCode, message: string): never {
  throw new MachinaAuthoringError(code, message);
}
function validateNonNegative(
  value: number,
  code: "InvalidGridTrack" | "InvalidGridMatrix",
  name: string,
) {
  if (!Number.isFinite(value) || value < 0)
    authoringError(code, `${name} must be a finite number greater than or equal to 0.`);
}
function validatePositiveInteger(
  value: number | undefined,
  code: "InvalidGridArea" | "InvalidGridMatrix",
  name: string,
) {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 1)
    authoringError(code, `${name} must be an integer greater than or equal to 1.`);
}
function validateCellCoordinate(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0)
    authoringError("InvalidGridArea", `${name} must be an integer greater than or equal to 0.`);
}
function validateTrack(track: MachinaGridTrack, name: string) {
  if (track?.kind === "fixed") validateNonNegative(track.size, "InvalidGridTrack", `${name}.size`);
  else if (track?.kind === "fill")
    validateNonNegative(track.weight ?? 1, "InvalidGridTrack", `${name}.weight`);
  else authoringError("InvalidGridTrack", `${name} must be a fixed or fill track.`);
}
function validateTracks(tracks: readonly MachinaGridTrack[], name: string) {
  if (!Array.isArray(tracks) || tracks.length === 0)
    authoringError("InvalidGridMatrix", `grid ${name} must include at least one track.`);
  tracks.forEach((track, index) => {
    validateTrack(track, `${name}[${index}]`);
  });
}
function validateGaps(options: GridOptions) {
  if (options.columnGap !== undefined)
    validateNonNegative(options.columnGap, "InvalidGridMatrix", "columnGap");
  if (options.rowGap !== undefined)
    validateNonNegative(options.rowGap, "InvalidGridMatrix", "rowGap");
}

export function trackFixed(size: number): MachinaGridTrack {
  validateNonNegative(size, "InvalidGridTrack", "size");
  return { kind: "fixed", size };
}
export function trackFill(weight = 1): MachinaGridTrack {
  validateNonNegative(weight, "InvalidGridTrack", "weight");
  return { kind: "fill", weight };
}
export function cell(
  id: MachinaNodeId,
  col: number,
  row: number,
  options: CellOptions = {},
  children: readonly MachinaNode[] = [],
): MachinaNode {
  validateNodeId(id);
  validateCellCoordinate(col, "col");
  validateCellCoordinate(row, "row");
  validatePositiveInteger(options.colSpan, "InvalidGridArea", "colSpan");
  validatePositiveInteger(options.rowSpan, "InvalidGridArea", "rowSpan");
  const { colSpan, rowSpan, ...rest } = options;
  return node(id, { ...rest, frame: { kind: "cell", col, row, colSpan, rowSpan } }, children);
}
export function area(
  id: MachinaNodeId,
  options: GridAreaOptions = {},
  children: readonly MachinaNode[] = [],
): MachinaGridArea {
  validateNodeId(id);
  validatePositiveInteger(options.colSpan, "InvalidGridArea", "colSpan");
  validatePositiveInteger(options.rowSpan, "InvalidGridArea", "rowSpan");
  return { kind: "area", id, options: { ...options }, children: [...children] };
}
export function skip(span = 1): MachinaGridSkip {
  validatePositiveInteger(span, "InvalidGridMatrix", "span");
  return { kind: "skip", span };
}
export function gridRows(rows: readonly (readonly MachinaGridMatrixItem[])[]): MachinaGridRows {
  return { kind: "gridRows", rows: rows.map((row) => [...row]) };
}
function isGridRows(
  children: MachinaGridRows | readonly MachinaNode[] | undefined,
): children is MachinaGridRows {
  return (
    typeof children === "object" &&
    children !== null &&
    !Array.isArray(children) &&
    "kind" in children &&
    children.kind === "gridRows"
  );
}
function matrixToCells(
  matrix: MachinaGridRows,
  columnCount: number,
  rowCount: number,
): MachinaNode[] {
  if (matrix.rows.length > rowCount)
    authoringError("GridMatrixOutOfBounds", "gridRows contains more rows than the grid declares.");
  const occupied = new Set<string>();
  const mark = (col: number, row: number, code: "GridMatrixOverlap" | "GridMatrixOutOfBounds") => {
    if (col < 0 || col >= columnCount || row < 0 || row >= rowCount)
      authoringError("GridMatrixOutOfBounds", "grid matrix item exceeds declared grid bounds.");
    const key = `${col}:${row}`;
    if (occupied.has(key)) authoringError(code, "grid matrix item overlaps an occupied cell.");
    occupied.add(key);
  };
  const out: MachinaNode[] = [];
  matrix.rows.forEach((rowItems, row) => {
    let cursor = 0;
    for (const item of rowItems) {
      while (cursor < columnCount && occupied.has(`${cursor}:${row}`)) cursor += 1;
      if (item?.kind === "skip") {
        const span = item.span ?? 1;
        validatePositiveInteger(span, "InvalidGridMatrix", "span");
        for (let offset = 0; offset < span; offset++)
          mark(cursor + offset, row, "GridMatrixOverlap");
        cursor += span;
      } else if (item?.kind === "area") {
        const colSpan = item.options.colSpan ?? 1;
        const rowSpan = item.options.rowSpan ?? 1;
        validatePositiveInteger(colSpan, "InvalidGridArea", "colSpan");
        validatePositiveInteger(rowSpan, "InvalidGridArea", "rowSpan");
        if (cursor + colSpan > columnCount || row + rowSpan > rowCount)
          authoringError("GridMatrixOutOfBounds", "grid area exceeds declared grid bounds.");
        for (let dy = 0; dy < rowSpan; dy++)
          for (let dx = 0; dx < colSpan; dx++) mark(cursor + dx, row + dy, "GridMatrixOverlap");
        out.push(cell(item.id, cursor, row, item.options, item.children));
        cursor += colSpan;
      } else authoringError("InvalidGridMatrix", "gridRows contains an invalid matrix item.");
    }
  });
  return out;
}
export function grid(
  id: MachinaNodeId,
  options: GridOptions,
  children?: MachinaGridRows | readonly MachinaNode[],
): MachinaNode {
  validateNodeId(id);
  validateTracks(options.columns, "columns");
  validateTracks(options.rows, "rows");
  validateGaps(options);
  const childNodes = isGridRows(children) ? undefined : (children ?? []);
  return {
    id,
    rows() {
      const lowered = this.lower();
      validateDuplicateRows(lowered);
      return lowered;
    },
    lower(context: MachinaLowerContext = {}) {
      const row: LayoutRow = copyRow({
        id,
        parent: options.parent ?? context.parentId,
        frame: options.frame ?? { kind: "fill", weight: 1 },
        arrange: {
          kind: "grid",
          columns: [...options.columns],
          rows: [...options.rows],
          columnGap: options.columnGap,
          rowGap: options.rowGap,
          padding: options.padding as number | EdgeInsets | undefined,
        },
        view: options.view,
        slot: options.slot,
        debugLabel: options.debugLabel,
        layer: options.layer,
        z: options.z,
        variants: options.variants ? [...options.variants] : undefined,
      });
      const nodes = isGridRows(children)
        ? matrixToCells(children, options.columns.length, options.rows.length)
        : childNodes;
      const childRows = (nodes ?? []).flatMap((child) =>
        child.lower({ parentId: id, parentStackAxis: stackAxisFromArrange(row.arrange) }),
      );
      return [row, ...childRows];
    },
  };
}
