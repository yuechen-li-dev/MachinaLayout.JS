import {
  MachinaAtlasError,
  defineMachinaAtlas
} from "../chunk-PKZM3ZTE.js";
import {
  defineDeusMachine
} from "../chunk-2ZQ2RFFI.js";

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

// src/machina/guide.ts
var EDGE_NAMES = /* @__PURE__ */ new Set([
  "left",
  "right",
  "top",
  "bottom",
  "centerX",
  "centerY"
]);
function validateGuideEdgeName(edgeName) {
  if (typeof edgeName !== "string" || !EDGE_NAMES.has(edgeName)) {
    throw new MachinaAuthoringError("InvalidGuideEdge", "Guide edge must be a valid edge name.");
  }
}
function edge(ref, edge2, offset) {
  try {
    validateNodeId(ref);
    validateGuideEdgeName(edge2);
    validateUiLength(offset, "InvalidGuideEdge");
  } catch (error) {
    if (error instanceof MachinaAuthoringError && error.code === "InvalidNodeId") {
      throw new MachinaAuthoringError(
        "InvalidGuideEdge",
        "Guide edge ref must be a non-empty string."
      );
    }
    throw error;
  }
  return offset === void 0 ? { ref, edge: edge2 } : { ref, edge: edge2, offset };
}
function isEdgeRef(value) {
  return typeof value === "object" && value !== null && "ref" in value && "edge" in value;
}
function validateGuideLength(value) {
  if (isEdgeRef(value)) {
    edge(value.ref, value.edge, value.offset);
  } else {
    validateUiLength(value, "InvalidGuideFrame");
  }
}
function copyGuideLength(value) {
  if (value === void 0) return void 0;
  if (!isEdgeRef(value)) return value;
  const copied = { ref: value.ref, edge: value.edge };
  if (value.offset !== void 0) copied.offset = value.offset;
  return copied;
}
function guide(id, options, children = []) {
  validateNodeId(id);
  validateGuideLength(options.left);
  validateGuideLength(options.right);
  validateGuideLength(options.top);
  validateGuideLength(options.bottom);
  validateUiLength(options.width, "InvalidGuideFrame");
  validateUiLength(options.height, "InvalidGuideFrame");
  const { left, right, top, bottom, width, height, ...rest } = options;
  return node(
    id,
    {
      ...rest,
      frame: {
        kind: "guide",
        left: copyGuideLength(left),
        right: copyGuideLength(right),
        top: copyGuideLength(top),
        bottom: copyGuideLength(bottom),
        width,
        height
      }
    },
    children
  );
}

// src/machina/text.ts
function validateText(content, options = {}) {
  if (typeof content !== "string") {
    throw new MachinaAuthoringError("InvalidTextSpec", "Text content must be a string.");
  }
  for (const field of ["blockGap", "listGap"]) {
    if (options[field] !== void 0 && !Number.isFinite(options[field])) {
      throw new MachinaAuthoringError("InvalidTextSpec", `${field} must be a finite number.`);
    }
  }
}
function makeText(sourceKind, content, options = {}) {
  validateText(content, options);
  return { kind: "text", source: { kind: sourceKind, text: content }, ...options };
}
var text = Object.assign(
  (content, options) => makeText("machina-text", content, options),
  {
    plain: (content, options) => makeText("plain", content, options),
    mono: (content, options) => makeText("plain", content, { variant: "mono", ...options })
  }
);

// src/machina/layers.ts
function validateLayerName(name) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new MachinaAuthoringError("InvalidLayer", "Layer name must be a non-empty string.");
  }
}
function onLayer(name) {
  validateLayerName(name);
  return name;
}
function defineLayers(layers) {
  if (typeof layers !== "object" || layers === null || Array.isArray(layers)) {
    throw new MachinaAuthoringError("InvalidLayer", "Layers must be an object.");
  }
  const result = {};
  for (const [name, layer] of Object.entries(layers)) {
    validateLayerName(name);
    if (typeof layer !== "object" || layer === null || !Number.isFinite(layer.z)) {
      throw new MachinaAuthoringError("InvalidLayer", `Layer ${name} z must be a finite number.`);
    }
    result[name] = { z: layer.z };
  }
  return result;
}

// src/machina/screen.ts
function validateStringArray(value, field) {
  if (value === void 0) return;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new MachinaAuthoringError("InvalidScreen", `${field} must be an array of strings.`);
  }
}
function screen(key, definition) {
  if (typeof key !== "string" || key.trim() === "") {
    throw new MachinaAuthoringError("InvalidScreen", "Screen key must be a non-empty string.");
  }
  if (typeof definition !== "object" || definition === null || Array.isArray(definition)) {
    throw new MachinaAuthoringError("InvalidScreen", "Screen definition must be an object.");
  }
  if (typeof definition.route !== "string" || definition.route.trim() === "") {
    throw new MachinaAuthoringError("InvalidScreen", "Screen route must be a non-empty string.");
  }
  if (definition.fixture !== void 0 && typeof definition.fixture !== "string") {
    throw new MachinaAuthoringError("InvalidScreen", "Screen fixture must be a string.");
  }
  validateStringArray(definition.viewports, "Screen viewports");
  validateStringArray(definition.tags, "Screen tags");
  if (definition.layout !== void 0 && typeof definition.layout !== "function") {
    throw new MachinaAuthoringError("InvalidScreen", "Screen layout must be a function.");
  }
  return {
    ...definition,
    key,
    viewports: definition.viewports === void 0 ? void 0 : [...definition.viewports],
    tags: definition.tags === void 0 ? void 0 : [...definition.tags]
  };
}

// src/machina/machine.ts
function copyPath(path) {
  return [...path];
}
function pathKey(path) {
  return path.join("/");
}
function generatedTransitionKey(from, eventType, to, suffix = "") {
  const target = Array.isArray(to) ? pathKey(to) : "dynamic";
  return `${pathKey(from)}:${eventType}->${target}${suffix}`;
}
function state(path, options = {}) {
  return {
    path: copyPath(path),
    ...options.onEnter ? { onEnter: options.onEnter } : null,
    ...options.onExit ? { onExit: options.onExit } : null
  };
}
function on(eventType, from, to, action, options = {}) {
  return {
    key: options.key ?? generatedTransitionKey(from, eventType, to),
    event: eventType,
    from: copyPath(from),
    to: Array.isArray(to) ? copyPath(to) : to,
    ...action ? { do: action } : null,
    ...options.when ? { when: options.when } : null,
    ...options.score !== void 0 ? { score: options.score } : null,
    ...options.reason !== void 0 ? { reason: options.reason } : null
  };
}
function choose(eventType, from, to, candidates, options = {}) {
  return {
    key: options.key ?? generatedTransitionKey(from, eventType, to, ":utility"),
    event: eventType,
    from: copyPath(from),
    to: Array.isArray(to) ? copyPath(to) : to,
    utility: candidates.map((candidate) => ({ ...candidate })),
    ...options.when ? { when: options.when } : null,
    ...options.score !== void 0 ? { score: options.score } : null,
    ...options.reason !== void 0 ? { reason: options.reason } : null,
    ...options.hysteresis ? { hysteresis: options.hysteresis } : null,
    ...options.do ? { do: options.do } : null
  };
}
function machine(definition) {
  return defineDeusMachine(definition);
}

// src/machina/atlas.ts
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function copyArray(value) {
  return value === void 0 ? void 0 : [...value];
}
function section(key, options) {
  if (!isNonEmptyString(key)) {
    throw new MachinaAtlasError("InvalidAtlasSection", "Machina section key must be non-empty.");
  }
  if (!options || !isNonEmptyString(options.name)) {
    throw new MachinaAtlasError("InvalidAtlasSection", "Machina section name must be non-empty.");
  }
  return {
    key,
    name: options.name,
    kind: options.kind,
    marker: options.marker,
    file: options.file,
    symbol: options.symbol,
    route: options.route,
    fixture: options.fixture,
    screen: options.screen,
    owns: copyArray(options.owns),
    uses: copyArray(options.uses),
    usedBy: copyArray(options.usedBy),
    dependsOn: copyArray(options.dependsOn),
    tags: copyArray(options.tags),
    notes: options.notes,
    metadata: options.metadata
  };
}
function atlas(options) {
  return defineMachinaAtlas({
    app: options.app,
    sections: options.sections === void 0 ? void 0 : [...options.sections],
    tags: options.tags === void 0 ? void 0 : [...options.tags],
    notes: options.notes,
    metadata: options.metadata
  });
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
  trackFill,
  edge,
  guide,
  text,
  onLayer,
  defineLayers,
  screen,
  machine,
  state,
  on,
  choose,
  section,
  atlas
};
export {
  M,
  MachinaAuthoringError,
  anchor,
  area,
  atlas,
  cell,
  choose,
  defineLayers,
  edge,
  fill,
  fixed,
  grid,
  gridRows,
  guide,
  hstack,
  machine,
  makeNode,
  node,
  on,
  onLayer,
  px,
  root,
  rows,
  screen,
  section,
  skip,
  space,
  stackArrange,
  state,
  text,
  trackFill,
  trackFixed,
  ui,
  vstack,
  when
};
