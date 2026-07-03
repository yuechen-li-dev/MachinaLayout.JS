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
  rows
};
export {
  M,
  MachinaAuthoringError,
  anchor,
  fill,
  fixed,
  hstack,
  makeNode,
  node,
  px,
  root,
  rows,
  space,
  stackArrange,
  ui,
  vstack,
  when
};
