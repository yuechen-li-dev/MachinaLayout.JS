// src/machina/errors.ts
var MachinaAuthoringError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "MachinaAuthoringError";
    this.code = code;
  }
};

// src/machina/lower.ts
function validateNodeId(id) {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new MachinaAuthoringError("InvalidNodeId", "Machina node ids must be non-empty strings.");
  }
}
function validateFinite(value, code, name) {
  if (!Number.isFinite(value)) {
    throw new MachinaAuthoringError(code, `${name} must be a finite number.`);
  }
}
function validateNonNegativeFinite(value, code, name) {
  validateFinite(value, code, name);
  if (value < 0)
    throw new MachinaAuthoringError(code, `${name} must be greater than or equal to 0.`);
}
function stackAxisFromArrange(arrange) {
  return arrange?.kind === "stack" ? arrange.axis : void 0;
}
function copyRow(row) {
  return {
    ...row,
    variants: row.variants ? row.variants.map((variant) => ({ ...variant })) : void 0
  };
}
function validateDuplicateRows(rows2) {
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows2) {
    if (seen.has(row.id))
      throw new MachinaAuthoringError("DuplicateNodeId", `Duplicate Machina node id: ${row.id}`);
    seen.add(row.id);
  }
}
function validateUiLength(length, code = "InvalidLength") {
  if (length === void 0) return;
  if (typeof length === "number") {
    if (!Number.isFinite(length)) throw new MachinaAuthoringError(code, "Length must be finite.");
    return;
  }
  if (!Number.isFinite(length.value))
    throw new MachinaAuthoringError(code, "Length value must be finite.");
}

// src/machina/node.ts
function makeNode(id, lowerRow, children = []) {
  validateNodeId(id);
  return {
    id,
    rows() {
      const lowered = this.lower();
      validateDuplicateRows(lowered);
      return lowered;
    },
    lower(context = {}) {
      const row = copyRow(lowerRow(context));
      const childAxis = stackAxisFromArrange(row.arrange);
      const childRows = children.flatMap(
        (child) => child.lower({ parentId: id, parentStackAxis: childAxis })
      );
      return [row, ...childRows];
    }
  };
}
function node(id, options, children = []) {
  validateNodeId(id);
  return makeNode(
    id,
    (context = {}) => {
      const row = {
        ...options,
        variants: options.variants ? [...options.variants] : void 0,
        id
      };
      if (options.parent !== void 0) row.parent = options.parent;
      else if (context.parentId !== void 0) row.parent = context.parentId;
      return row;
    },
    children
  );
}
function root(id, options = {}, children = []) {
  validateNodeId(id);
  return makeNode(
    id,
    (context = {}) => {
      if (context.parentId !== void 0) {
        throw new MachinaAuthoringError(
          "InvalidAuthoringTree",
          "A Machina root cannot be lowered with a parent."
        );
      }
      return {
        ...options,
        variants: options.variants ? [...options.variants] : void 0,
        id,
        frame: { kind: "root" }
      };
    },
    children
  );
}
function rows(node2) {
  return node2.rows();
}

// src/machina/stack.ts
function stackArrange(axis, options = {}) {
  if (options.gap !== void 0) validateFinite(options.gap, "InvalidStackChild", "gap");
  return { kind: "stack", axis, ...options };
}
function stack(id, axis, options = {}, children = []) {
  const {
    gap,
    padding,
    justify,
    align,
    parent,
    frame = { kind: "fill", weight: 1 },
    ...rest
  } = options;
  return node(
    id,
    { ...rest, parent, frame, arrange: stackArrange(axis, { gap, padding, justify, align }) },
    children
  );
}
var vstack = (id, options, children) => stack(id, "vertical", options, children);
var hstack = (id, options, children) => stack(id, "horizontal", options, children);
function mergeView(viewOrOptions, options) {
  return typeof viewOrOptions === "string" ? { ...options, view: viewOrOptions } : { ...viewOrOptions, ...options };
}
function fixed(id, mainSize, viewOrOptions, options, children = []) {
  validateNodeId(id);
  validateNonNegativeFinite(mainSize, "InvalidLength", "mainSize");
  const opts = mergeView(viewOrOptions, options);
  return makeNode(
    id,
    (context = {}) => {
      if (!context.parentStackAxis)
        throw new MachinaAuthoringError(
          "InvalidFixedFrameContext",
          "fixed() must be lowered under a stack parent axis."
        );
      const frame = context.parentStackAxis === "vertical" ? { kind: "fixed", height: mainSize } : { kind: "fixed", width: mainSize };
      return {
        ...opts,
        variants: opts.variants ? [...opts.variants] : void 0,
        id,
        parent: context.parentId,
        frame
      };
    },
    children
  );
}
function fill(id, weight = 1, viewOrOptions, options, children = []) {
  validateNodeId(id);
  validateNonNegativeFinite(weight, "InvalidLength", "weight");
  const opts = mergeView(viewOrOptions, options);
  const { cross, ...rest } = opts;
  return node(id, { ...rest, frame: { kind: "fill", weight, cross } }, children);
}
function space(id, weight = 1) {
  validateNodeId(id);
  validateNonNegativeFinite(weight, "InvalidSpaceNode", "weight");
  return node(id, { frame: { kind: "fill", weight } });
}

// src/machina/anchor.ts
function anchor(id, options, children = []) {
  validateUiLength(options.left, "InvalidAnchorFrame");
  validateUiLength(options.right, "InvalidAnchorFrame");
  validateUiLength(options.top, "InvalidAnchorFrame");
  validateUiLength(options.bottom, "InvalidAnchorFrame");
  validateUiLength(options.width, "InvalidAnchorFrame");
  validateUiLength(options.height, "InvalidAnchorFrame");
  const { left, right, top, bottom, width, height, ...rest } = options;
  return node(
    id,
    { ...rest, frame: { kind: "anchor", left, right, top, bottom, width, height } },
    children
  );
}

// src/machina/units.ts
function px(value) {
  validateFinite(value, "InvalidLength", "px value");
  return { unit: "px", value };
}
function ui(value) {
  validateFinite(value, "InvalidLength", "ui value");
  return { unit: "ui", value };
}

// src/machina/variant.ts
function when(condition, overrides) {
  for (const [key, value] of Object.entries(condition))
    if (value !== void 0) validateFinite(value, "InvalidVariant", key);
  return { when: { ...condition }, ...overrides };
}

// src/machina/grid.ts
function authoringError(code, message) {
  throw new MachinaAuthoringError(code, message);
}
function validateNonNegative(value, code, name) {
  if (!Number.isFinite(value) || value < 0)
    authoringError(code, `${name} must be a finite number greater than or equal to 0.`);
}
function validatePositiveInteger(value, code, name) {
  if (value === void 0) return;
  if (!Number.isInteger(value) || value < 1)
    authoringError(code, `${name} must be an integer greater than or equal to 1.`);
}
function validateCellCoordinate(value, name) {
  if (!Number.isInteger(value) || value < 0)
    authoringError("InvalidGridArea", `${name} must be an integer greater than or equal to 0.`);
}
function validateTrack(track, name) {
  if (track?.kind === "fixed") validateNonNegative(track.size, "InvalidGridTrack", `${name}.size`);
  else if (track?.kind === "fill")
    validateNonNegative(track.weight ?? 1, "InvalidGridTrack", `${name}.weight`);
  else authoringError("InvalidGridTrack", `${name} must be a fixed or fill track.`);
}
function validateTracks(tracks, name) {
  if (!Array.isArray(tracks) || tracks.length === 0)
    authoringError("InvalidGridMatrix", `grid ${name} must include at least one track.`);
  tracks.forEach((track, index) => {
    validateTrack(track, `${name}[${index}]`);
  });
}
function validateGaps(options) {
  if (options.columnGap !== void 0)
    validateNonNegative(options.columnGap, "InvalidGridMatrix", "columnGap");
  if (options.rowGap !== void 0)
    validateNonNegative(options.rowGap, "InvalidGridMatrix", "rowGap");
}
function trackFixed(size) {
  validateNonNegative(size, "InvalidGridTrack", "size");
  return { kind: "fixed", size };
}
function trackFill(weight = 1) {
  validateNonNegative(weight, "InvalidGridTrack", "weight");
  return { kind: "fill", weight };
}
function cell(id, col, row, options = {}, children = []) {
  validateNodeId(id);
  validateCellCoordinate(col, "col");
  validateCellCoordinate(row, "row");
  validatePositiveInteger(options.colSpan, "InvalidGridArea", "colSpan");
  validatePositiveInteger(options.rowSpan, "InvalidGridArea", "rowSpan");
  const { colSpan, rowSpan, ...rest } = options;
  return node(id, { ...rest, frame: { kind: "cell", col, row, colSpan, rowSpan } }, children);
}
function area(id, options = {}, children = []) {
  validateNodeId(id);
  validatePositiveInteger(options.colSpan, "InvalidGridArea", "colSpan");
  validatePositiveInteger(options.rowSpan, "InvalidGridArea", "rowSpan");
  return { kind: "area", id, options: { ...options }, children: [...children] };
}
function skip(span = 1) {
  validatePositiveInteger(span, "InvalidGridMatrix", "span");
  return { kind: "skip", span };
}
function gridRows(rows2) {
  return { kind: "gridRows", rows: rows2.map((row) => [...row]) };
}
function isGridRows(children) {
  return typeof children === "object" && children !== null && !Array.isArray(children) && "kind" in children && children.kind === "gridRows";
}
function matrixToCells(matrix, columnCount, rowCount) {
  if (matrix.rows.length > rowCount)
    authoringError("GridMatrixOutOfBounds", "gridRows contains more rows than the grid declares.");
  const occupied = /* @__PURE__ */ new Set();
  const mark = (col, row, code) => {
    if (col < 0 || col >= columnCount || row < 0 || row >= rowCount)
      authoringError("GridMatrixOutOfBounds", "grid matrix item exceeds declared grid bounds.");
    const key = `${col}:${row}`;
    if (occupied.has(key)) authoringError(code, "grid matrix item overlaps an occupied cell.");
    occupied.add(key);
  };
  const out = [];
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
function grid(id, options, children) {
  validateNodeId(id);
  validateTracks(options.columns, "columns");
  validateTracks(options.rows, "rows");
  validateGaps(options);
  const childNodes = isGridRows(children) ? void 0 : children ?? [];
  return {
    id,
    rows() {
      const lowered = this.lower();
      validateDuplicateRows(lowered);
      return lowered;
    },
    lower(context = {}) {
      const row = copyRow({
        id,
        parent: options.parent ?? context.parentId,
        frame: options.frame ?? { kind: "fill", weight: 1 },
        arrange: {
          kind: "grid",
          columns: [...options.columns],
          rows: [...options.rows],
          columnGap: options.columnGap,
          rowGap: options.rowGap,
          padding: options.padding
        },
        view: options.view,
        slot: options.slot,
        debugLabel: options.debugLabel,
        layer: options.layer,
        z: options.z,
        variants: options.variants ? [...options.variants] : void 0
      });
      const nodes = isGridRows(children) ? matrixToCells(children, options.columns.length, options.rows.length) : childNodes;
      const childRows = (nodes ?? []).flatMap(
        (child) => child.lower({ parentId: id, parentStackAxis: stackAxisFromArrange(row.arrange) })
      );
      return [row, ...childRows];
    }
  };
}

// src/machina/index.ts
var M = {
  node,
  root,
  vstack,
  hstack,
  stackArrange,
  fixed,
  fill,
  space,
  anchor,
  px,
  ui,
  when,
  rows,
  grid,
  gridRows,
  area,
  skip,
  cell,
  trackFixed,
  trackFill
};
export {
  M,
  MachinaAuthoringError,
  anchor,
  area,
  cell,
  fill,
  fixed,
  grid,
  gridRows,
  hstack,
  makeNode,
  node,
  px,
  root,
  rows,
  skip,
  space,
  stackArrange,
  trackFill,
  trackFixed,
  ui,
  vstack,
  when
};
