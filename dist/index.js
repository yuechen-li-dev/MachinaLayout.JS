import {
  MachinaReactView
} from "./chunk-HU6XYOH7.js";
import "./chunk-SU2CQZEM.js";
import {
  MachinaTextView
} from "./chunk-KYWOCAHK.js";
import {
  MachinaVueTextView
} from "./chunk-EL4VUOAB.js";
import {
  parseMachinaText,
  parseMachinaTextInline
} from "./chunk-BJOQRPPX.js";
import {
  MachinaLayoutError,
  toResolvedTree
} from "./chunk-TR24ERZT.js";

// src/validation.ts
function assertFiniteNumber(value, fieldName) {
  if (!Number.isFinite(value)) {
    throw new MachinaLayoutError(
      "NonFiniteNumber",
      `${fieldName} must be a finite number. Received: ${value}`
    );
  }
}
function assertNonNegativeSize(value, fieldName) {
  assertFiniteNumber(value, fieldName);
  if (value < 0) {
    throw new MachinaLayoutError(
      "NegativeSize",
      `${fieldName} must be non-negative. Received: ${value}`
    );
  }
}
function assertNonNegativeGap(value, fieldName = "gap") {
  assertFiniteNumber(value, fieldName);
  if (value < 0) {
    throw new MachinaLayoutError(
      "NegativeGap",
      `${fieldName} must be non-negative. Received: ${value}`
    );
  }
}
function assertNonNegativePadding(value, fieldName = "padding") {
  assertFiniteNumber(value, fieldName);
  if (value < 0) {
    throw new MachinaLayoutError(
      "NegativePadding",
      `${fieldName} must be non-negative. Received: ${value}`
    );
  }
}

// src/padding.ts
function normalizePadding(padding) {
  const resolved = typeof padding === "number" ? { top: padding, right: padding, bottom: padding, left: padding } : padding === void 0 ? { top: 0, right: 0, bottom: 0, left: 0 } : {
    top: padding.top,
    right: padding.right,
    bottom: padding.bottom,
    left: padding.left
  };
  assertNonNegativePadding(resolved.top, "padding.top");
  assertNonNegativePadding(resolved.right, "padding.right");
  assertNonNegativePadding(resolved.bottom, "padding.bottom");
  assertNonNegativePadding(resolved.left, "padding.left");
  return {
    top: resolved.top,
    right: resolved.right,
    bottom: resolved.bottom,
    left: resolved.left
  };
}

// src/length.ts
function resolveUiLength(length, axisSize, fieldName = "length") {
  assertFiniteNumber(axisSize, "axisSize");
  if (typeof length === "number") {
    assertFiniteNumber(length, fieldName);
    return length;
  }
  if (!length || typeof length !== "object" || !("unit" in length) || !("value" in length)) {
    throw new MachinaLayoutError("InvalidLengthUnit", `Invalid UiLength for ${fieldName}.`);
  }
  const { unit, value } = length;
  assertFiniteNumber(value, `${fieldName}.value`);
  if (unit === "px") {
    return value;
  }
  if (unit === "ui") {
    return value * axisSize;
  }
  throw new MachinaLayoutError(
    "InvalidLengthUnit",
    `Invalid UiLength unit for ${fieldName}: ${String(unit)}.`
  );
}

// src/offset.ts
function applyOffset(rect, parentRect, offset) {
  const dx = offset?.x === void 0 ? 0 : resolveUiLength(offset.x, parentRect.width);
  const dy = offset?.y === void 0 ? 0 : resolveUiLength(offset.y, parentRect.height);
  return {
    x: rect.x + dx,
    y: rect.y + dy,
    width: rect.width,
    height: rect.height
  };
}

// src/compileLayoutRows.ts
function compileLayoutRows(rows) {
  if (rows.length === 0) {
    throw new MachinaLayoutError("EmptyRows", "rows must contain at least one row.");
  }
  const nodes = {};
  const rowById = /* @__PURE__ */ new Map();
  const rootCandidates = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (row.id.trim().length === 0) {
      throw new MachinaLayoutError("InvalidId", `row at index ${rowIndex} has an invalid id.`);
    }
    if (rowById.has(row.id)) {
      throw new MachinaLayoutError("DuplicateId", `duplicate id found: ${row.id}`);
    }
    if (row.order !== void 0) {
      assertFiniteNumber(row.order, `rows[${rowIndex}].order`);
    }
    if (row.frame.kind === "root" && row.parent !== void 0) {
      throw new MachinaLayoutError(
        "RootFrameNotRoot",
        `row ${row.id} uses RootFrame but is not a root row.`
      );
    }
    if (row.z !== void 0) {
      assertFiniteNumber(row.z, `rows[${rowIndex}].z`);
      if (!Number.isInteger(row.z) || row.z < -5 || row.z > 5) {
        throw new MachinaLayoutError(
          "InvalidZ",
          `rows[${rowIndex}].z must be an integer in range -5..5`
        );
      }
    }
    rowById.set(row.id, row);
    nodes[row.id] = {
      id: row.id,
      z: row.z,
      frame: row.frame,
      arrange: row.arrange,
      view: row.view,
      slot: row.slot,
      debugLabel: row.debugLabel,
      layer: row.layer,
      offset: row.offset
    };
    if (row.parent === void 0) {
      rootCandidates.push(row.id);
    }
  }
  if (rootCandidates.length === 0) {
    throw new MachinaLayoutError("MissingRoot", "exactly one root is required, found none.");
  }
  if (rootCandidates.length > 1) {
    throw new MachinaLayoutError("MultipleRoots", "exactly one root is required, found multiple.");
  }
  const rootId = rootCandidates[0];
  if (nodes[rootId].frame.kind === "fill") {
    throw new MachinaLayoutError(
      "FillFrameWithoutArranger",
      "FillFrame cannot be used as the root frame."
    );
  }
  if (nodes[rootId].frame.kind === "fixed") {
    throw new MachinaLayoutError(
      "FixedFrameWithoutArranger",
      "FixedFrame cannot be used as the root frame."
    );
  }
  const childrenEntries = /* @__PURE__ */ new Map();
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (row.parent === void 0) {
      continue;
    }
    if (row.parent === row.id) {
      throw new MachinaLayoutError("SelfParent", `node ${row.id} cannot parent itself.`);
    }
    if (!rowById.has(row.parent) || row.parent.trim().length === 0) {
      throw new MachinaLayoutError(
        "UnknownParent",
        `node ${row.id} references unknown parent: ${row.parent}`
      );
    }
    const entry = {
      childId: row.id,
      orderValue: row.order ?? 0,
      rowIndex
    };
    const list = childrenEntries.get(row.parent);
    if (list) {
      list.push(entry);
    } else {
      childrenEntries.set(row.parent, [entry]);
    }
  }
  const children = {};
  for (const [parentId, list] of childrenEntries.entries()) {
    list.sort((a, b) => a.orderValue - b.orderValue || a.rowIndex - b.rowIndex);
    children[parentId] = list.map((item) => item.childId);
  }
  const parentById = /* @__PURE__ */ new Map();
  for (const row of rows) {
    parentById.set(row.id, row.parent);
  }
  const chainState = /* @__PURE__ */ new Map();
  const detectParentChainCycle = (nodeId) => {
    const state = chainState.get(nodeId) ?? 0;
    if (state === 2) {
      return;
    }
    if (state === 1) {
      throw new MachinaLayoutError("Cycle", `cycle detected at node ${nodeId}`);
    }
    chainState.set(nodeId, 1);
    const parentId = parentById.get(nodeId);
    if (parentId !== void 0) {
      detectParentChainCycle(parentId);
    }
    chainState.set(nodeId, 2);
  };
  for (const row of rows) {
    detectParentChainCycle(row.id);
  }
  const visitState = /* @__PURE__ */ new Map();
  let visitedCount = 0;
  const dfs = (nodeId) => {
    const state = visitState.get(nodeId) ?? 0;
    if (state === 1) {
      throw new MachinaLayoutError("Cycle", `cycle detected at node ${nodeId}`);
    }
    if (state === 2) {
      return;
    }
    visitState.set(nodeId, 1);
    visitedCount += 1;
    for (const childId of children[nodeId] ?? []) {
      dfs(childId);
    }
    visitState.set(nodeId, 2);
  };
  dfs(rootId);
  if (visitedCount !== rows.length) {
    throw new MachinaLayoutError(
      "UnreachableNode",
      "one or more nodes are unreachable from the root."
    );
  }
  return { rootId, nodes, children };
}

// src/selectLayoutRowsForRoot.ts
function validateRootRect(rootRect) {
  assertFiniteNumber(rootRect.x, "rootRect.x");
  assertFiniteNumber(rootRect.y, "rootRect.y");
  assertNonNegativeSize(rootRect.width, "rootRect.width");
  assertNonNegativeSize(rootRect.height, "rootRect.height");
}
function validateCondition(condition, rowIndex, variantIndex) {
  if (condition.minWidth !== void 0) {
    assertFiniteNumber(
      condition.minWidth,
      `rows[${rowIndex}].variants[${variantIndex}].when.minWidth`
    );
  }
  if (condition.maxWidth !== void 0) {
    assertFiniteNumber(
      condition.maxWidth,
      `rows[${rowIndex}].variants[${variantIndex}].when.maxWidth`
    );
  }
  if (condition.minHeight !== void 0) {
    assertFiniteNumber(
      condition.minHeight,
      `rows[${rowIndex}].variants[${variantIndex}].when.minHeight`
    );
  }
  if (condition.maxHeight !== void 0) {
    assertFiniteNumber(
      condition.maxHeight,
      `rows[${rowIndex}].variants[${variantIndex}].when.maxHeight`
    );
  }
  if (condition.minWidth !== void 0 && condition.maxWidth !== void 0 && condition.minWidth > condition.maxWidth) {
    throw new MachinaLayoutError(
      "InvalidVariantCondition",
      `rows[${rowIndex}].variants[${variantIndex}].when has minWidth > maxWidth`
    );
  }
  if (condition.minHeight !== void 0 && condition.maxHeight !== void 0 && condition.minHeight > condition.maxHeight) {
    throw new MachinaLayoutError(
      "InvalidVariantCondition",
      `rows[${rowIndex}].variants[${variantIndex}].when has minHeight > maxHeight`
    );
  }
}
function conditionMatches(condition, rootRect) {
  if (condition.minWidth !== void 0 && rootRect.width < condition.minWidth) return false;
  if (condition.maxWidth !== void 0 && rootRect.width > condition.maxWidth) return false;
  if (condition.minHeight !== void 0 && rootRect.height < condition.minHeight) return false;
  if (condition.maxHeight !== void 0 && rootRect.height > condition.maxHeight) return false;
  return true;
}
function validateVariantZ(variant, rowIndex, variantIndex) {
  if (variant.z === void 0) return;
  assertFiniteNumber(variant.z, `rows[${rowIndex}].variants[${variantIndex}].z`);
  if (!Number.isInteger(variant.z) || variant.z < -5 || variant.z > 5) {
    throw new MachinaLayoutError(
      "InvalidZ",
      `rows[${rowIndex}].variants[${variantIndex}].z must be an integer in range -5..5`
    );
  }
}
function selectLayoutRowsForRoot(rows, rootRect) {
  validateRootRect(rootRect);
  return rows.map((row, rowIndex) => {
    const baseRow = { ...row };
    delete baseRow.variants;
    const variants = row.variants;
    if (!variants || variants.length === 0) {
      return baseRow;
    }
    for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
      const variant = variants[variantIndex];
      validateCondition(variant.when, rowIndex, variantIndex);
      validateVariantZ(variant, rowIndex, variantIndex);
      if (!conditionMatches(variant.when, rootRect)) {
        continue;
      }
      const selected = {
        ...baseRow,
        frame: variant.frame ?? baseRow.frame,
        arrange: variant.arrange ?? baseRow.arrange,
        offset: variant.offset ?? baseRow.offset,
        z: variant.z ?? baseRow.z,
        view: variant.view ?? baseRow.view,
        slot: variant.slot ?? baseRow.slot,
        debugLabel: variant.debugLabel ?? baseRow.debugLabel,
        layer: variant.layer ?? baseRow.layer
      };
      return selected;
    }
    return baseRow;
  });
}

// src/resolveFrame.ts
function validateParentRect(parent) {
  assertFiniteNumber(parent.x, "parent.x");
  assertFiniteNumber(parent.y, "parent.y");
  assertNonNegativeSize(parent.width, "parent.width");
  assertNonNegativeSize(parent.height, "parent.height");
}
function hasLength(value) {
  return value !== void 0;
}
function resolveAnchor(parent, frame) {
  const hasLeft = hasLength(frame.left);
  const hasRight = hasLength(frame.right);
  const hasTop = hasLength(frame.top);
  const hasBottom = hasLength(frame.bottom);
  const hasWidth = hasLength(frame.width);
  const hasHeight = hasLength(frame.height);
  const left = hasLeft ? resolveUiLength(frame.left, parent.width, "frame.left") : void 0;
  const right = hasRight ? resolveUiLength(frame.right, parent.width, "frame.right") : void 0;
  const top = hasTop ? resolveUiLength(frame.top, parent.height, "frame.top") : void 0;
  const bottom = hasBottom ? resolveUiLength(frame.bottom, parent.height, "frame.bottom") : void 0;
  const explicitWidth = hasWidth ? resolveUiLength(frame.width, parent.width, "frame.width") : void 0;
  const explicitHeight = hasHeight ? resolveUiLength(frame.height, parent.height, "frame.height") : void 0;
  if (hasWidth) assertNonNegativeSize(explicitWidth, "frame.width");
  if (hasHeight) assertNonNegativeSize(explicitHeight, "frame.height");
  const horizontalCount = Number(hasLeft) + Number(hasRight) + Number(hasWidth);
  if (horizontalCount !== 2) {
    throw new MachinaLayoutError(
      "InvalidAnchorHorizontal",
      "Anchor frame must specify exactly two horizontal constraints: left, right, width."
    );
  }
  const verticalCount = Number(hasTop) + Number(hasBottom) + Number(hasHeight);
  if (verticalCount !== 2) {
    throw new MachinaLayoutError(
      "InvalidAnchorVertical",
      "Anchor frame must specify exactly two vertical constraints: top, bottom, height."
    );
  }
  let x;
  let width;
  if (hasLeft && hasWidth) {
    x = parent.x + left;
    width = explicitWidth;
  } else if (hasRight && hasWidth) {
    x = parent.x + parent.width - right - explicitWidth;
    width = explicitWidth;
  } else {
    x = parent.x + left;
    width = parent.width - left - right;
  }
  let y;
  let height;
  if (hasTop && hasHeight) {
    y = parent.y + top;
    height = explicitHeight;
  } else if (hasBottom && hasHeight) {
    y = parent.y + parent.height - bottom - explicitHeight;
    height = explicitHeight;
  } else {
    y = parent.y + top;
    height = parent.height - top - bottom;
  }
  if (width < 0 || height < 0) {
    throw new MachinaLayoutError(
      "NegativeResolvedSize",
      `Resolved anchor frame size must be non-negative. Received width=${width}, height=${height}.`
    );
  }
  return { x, y, width, height };
}
function resolveFrame(parent, frame) {
  validateParentRect(parent);
  switch (frame.kind) {
    case "absolute": {
      assertFiniteNumber(frame.x, "frame.x");
      assertFiniteNumber(frame.y, "frame.y");
      assertNonNegativeSize(frame.width, "frame.width");
      assertNonNegativeSize(frame.height, "frame.height");
      return {
        x: parent.x + frame.x,
        y: parent.y + frame.y,
        width: frame.width,
        height: frame.height
      };
    }
    case "anchor":
      return resolveAnchor(parent, frame);
    case "root":
      throw new MachinaLayoutError(
        "RootFrameWithoutRoot",
        "RootFrame can only be declared on the root row."
      );
    case "fixed": {
      assertNonNegativeSize(frame.width, "frame.width");
      assertNonNegativeSize(frame.height, "frame.height");
      throw new MachinaLayoutError(
        "FixedFrameWithoutArranger",
        "Fixed frames require an arranger to determine placement."
      );
    }
    case "fill":
      throw new MachinaLayoutError(
        "FillFrameWithoutArranger",
        "Fill frames require a stack arranger to determine placement."
      );
    case "cell":
      throw new MachinaLayoutError(
        "CellFrameWithoutGrid",
        "Cell frames require a grid arranger to determine placement."
      );
    case "guide":
      throw new MachinaLayoutError(
        "GuideTargetUnresolved",
        "Guide frames require document-level dependency resolution and cannot be resolved directly."
      );
  }
}

// src/resolveLayoutDocument.ts
function validateRootRect2(rootRect) {
  assertFiniteNumber(rootRect.x, "rootRect.x");
  assertFiniteNumber(rootRect.y, "rootRect.y");
  assertNonNegativeSize(rootRect.width, "rootRect.width");
  assertNonNegativeSize(rootRect.height, "rootRect.height");
}
var H_EDGES = /* @__PURE__ */ new Set(["left", "right", "centerX"]);
var V_EDGES = /* @__PURE__ */ new Set(["top", "bottom", "centerY"]);
var ALL_EDGES = /* @__PURE__ */ new Set(["left", "right", "top", "bottom", "centerX", "centerY"]);
var isEdgeRef = (value) => Boolean(value && typeof value === "object" && "ref" in value && "edge" in value);
function getRectEdgeValue(rect, edge) {
  switch (edge) {
    case "left":
      return rect.x;
    case "right":
      return rect.x + rect.width;
    case "centerX":
      return rect.x + rect.width / 2;
    case "top":
      return rect.y;
    case "bottom":
      return rect.y + rect.height;
    case "centerY":
      return rect.y + rect.height / 2;
    default:
      throw new MachinaLayoutError("InvalidGuideFrame", `unknown guide edge: ${String(edge)}`);
  }
}
function validateGuideFrame(nodeId, frame, document) {
  const hCount = Number(frame.left !== void 0) + Number(frame.right !== void 0) + Number(frame.width !== void 0);
  const vCount = Number(frame.top !== void 0) + Number(frame.bottom !== void 0) + Number(frame.height !== void 0);
  if (hCount !== 2 || vCount !== 2)
    throw new MachinaLayoutError(
      "InvalidGuideFrame",
      `guide frame must provide exactly two constraints per axis: ${nodeId}`
    );
  const hRefs = [frame.left, frame.right].filter(isEdgeRef);
  const vRefs = [frame.top, frame.bottom].filter(isEdgeRef);
  if (hRefs.length > 1 || vRefs.length > 1)
    throw new MachinaLayoutError(
      "GuideTooManyReferencesPerAxis",
      `guide has too many refs on one axis: ${nodeId}`
    );
  for (const ref of [...hRefs, ...vRefs]) {
    if (ref.ref === nodeId)
      throw new MachinaLayoutError(
        "GuideSelfReference",
        `guide cannot reference itself: ${nodeId}`
      );
    if (!document.nodes[ref.ref])
      throw new MachinaLayoutError("GuideTargetNotFound", `guide target not found: ${ref.ref}`);
    if (!ALL_EDGES.has(ref.edge))
      throw new MachinaLayoutError("InvalidGuideFrame", `unknown edge: ${String(ref.edge)}`);
  }
  for (const ref of hRefs)
    if (!H_EDGES.has(ref.edge))
      throw new MachinaLayoutError(
        "GuideInvalidEdgeForAxis",
        `horizontal guide ref must use horizontal edge: ${nodeId}`
      );
  for (const ref of vRefs)
    if (!V_EDGES.has(ref.edge))
      throw new MachinaLayoutError(
        "GuideInvalidEdgeForAxis",
        `vertical guide ref must use vertical edge: ${nodeId}`
      );
}
function resolveGuidePosition(parentRect, side, value, resolvedNodes) {
  if (isEdgeRef(value)) {
    const target = resolvedNodes[value.ref];
    if (!target)
      throw new MachinaLayoutError(
        "GuideTargetUnresolved",
        `guide target unresolved: ${value.ref}`
      );
    const axisSize2 = side === "left" || side === "right" ? parentRect.width : parentRect.height;
    const offset = value.offset === void 0 ? 0 : resolveUiLength(value.offset, axisSize2, `frame.${side}.offset`);
    return getRectEdgeValue(target.rect, value.edge) + offset;
  }
  const axisSize = side === "left" || side === "right" ? parentRect.width : parentRect.height;
  const scalar = resolveUiLength(value, axisSize, `frame.${side}`);
  if (side === "left") return parentRect.x + scalar;
  if (side === "right") return parentRect.x + parentRect.width - scalar;
  if (side === "top") return parentRect.y + scalar;
  return parentRect.y + parentRect.height - scalar;
}
function resolveGuideFrame(parentRect, frame, resolvedNodes) {
  const hasLeft = frame.left !== void 0;
  const hasRight = frame.right !== void 0;
  const hasWidth = frame.width !== void 0;
  const hasTop = frame.top !== void 0;
  const hasBottom = frame.bottom !== void 0;
  const hasHeight = frame.height !== void 0;
  const left = hasLeft ? resolveGuidePosition(parentRect, "left", frame.left, resolvedNodes) : void 0;
  const right = hasRight ? resolveGuidePosition(parentRect, "right", frame.right, resolvedNodes) : void 0;
  const top = hasTop ? resolveGuidePosition(parentRect, "top", frame.top, resolvedNodes) : void 0;
  const bottom = hasBottom ? resolveGuidePosition(parentRect, "bottom", frame.bottom, resolvedNodes) : void 0;
  const explicitWidth = hasWidth ? resolveUiLength(frame.width, parentRect.width, "frame.width") : void 0;
  const explicitHeight = hasHeight ? resolveUiLength(frame.height, parentRect.height, "frame.height") : void 0;
  if (hasWidth) assertNonNegativeSize(explicitWidth, "frame.width");
  if (hasHeight) assertNonNegativeSize(explicitHeight, "frame.height");
  const x = hasLeft && hasWidth ? left : hasRight && hasWidth ? right - explicitWidth : left;
  const width = hasWidth ? explicitWidth : right - left;
  const y = hasTop && hasHeight ? top : hasBottom && hasHeight ? bottom - explicitHeight : top;
  const height = hasHeight ? explicitHeight : bottom - top;
  if (width < 0 || height < 0)
    throw new MachinaLayoutError(
      "NegativeResolvedSize",
      `Resolved guide frame size must be non-negative. Received width=${width}, height=${height}.`
    );
  return { x, y, width, height };
}
function resolveStackChildRects(parentRect, arrange, childIds, document) {
  const gap = arrange.gap ?? 0;
  const justify = arrange.justify ?? "start";
  const align = arrange.align ?? "start";
  assertNonNegativeGap(gap, "gap");
  const padding = normalizePadding(arrange.padding);
  const content = {
    x: parentRect.x + padding.left,
    y: parentRect.y + padding.top,
    width: parentRect.width - padding.left - padding.right,
    height: parentRect.height - padding.top - padding.bottom
  };
  if (content.width < 0 || content.height < 0)
    throw new MachinaLayoutError(
      "StackContentNegative",
      "stack content size cannot be negative after applying padding"
    );
  const isHorizontal = arrange.axis === "horizontal";
  const contentMain = isHorizontal ? content.width : content.height;
  const contentCross = isHorizontal ? content.height : content.width;
  const childMainSizes = [];
  const childCrossSizes = [];
  const fillWeights = [];
  for (const childId of childIds) {
    const childNode = document.nodes[childId];
    if (!childNode)
      throw new MachinaLayoutError(
        "UnknownParent",
        `child id ${childId} referenced by arranged parent is missing`
      );
    if (childNode.frame.kind === "fixed") {
      assertNonNegativeSize(childNode.frame.width, `${childId}.frame.width`);
      assertNonNegativeSize(childNode.frame.height, `${childId}.frame.height`);
      childMainSizes.push(isHorizontal ? childNode.frame.width : childNode.frame.height);
      childCrossSizes.push(isHorizontal ? childNode.frame.height : childNode.frame.width);
      fillWeights.push(0);
      continue;
    }
    if (childNode.frame.kind !== "fill")
      throw new MachinaLayoutError(
        "StackChildMustBeFixed",
        `stack child must use fixed or fill frame: ${childId}`
      );
    const weight = childNode.frame.weight ?? 1;
    assertFiniteNumber(weight, `${childId}.frame.weight`);
    if (weight <= 0)
      throw new MachinaLayoutError(
        "InvalidFillWeight",
        `${childId}.frame.weight must be greater than 0`
      );
    const cross = childNode.frame.cross ?? "fill";
    let childCross = contentCross;
    if (cross !== "fill") {
      assertNonNegativeSize(cross, `${childId}.frame.cross`);
      childCross = cross;
    }
    childMainSizes.push(0);
    childCrossSizes.push(childCross);
    fillWeights.push(weight);
  }
  const fixedMainTotal = childIds.reduce(
    (sum, _id, i) => sum + (fillWeights[i] === 0 ? childMainSizes[i] : 0),
    0
  );
  const totalGap = gap * Math.max(0, childIds.length - 1);
  const remainingMain = contentMain - fixedMainTotal - totalGap;
  if (remainingMain < 0) throw new MachinaLayoutError("StackOverflow", "stack main axis overflow");
  const totalFillWeight = fillWeights.reduce((sum, w) => sum + w, 0);
  if (totalFillWeight > 0) {
    for (let i = 0; i < childMainSizes.length; i += 1)
      if (fillWeights[i] > 0)
        childMainSizes[i] = remainingMain * fillWeights[i] / totalFillWeight;
  }
  for (const childCross of childCrossSizes)
    if (childCross > contentCross)
      throw new MachinaLayoutError("StackOverflow", "stack cross axis overflow");
  const occupiedMain = childMainSizes.reduce((sum, size) => sum + size, 0) + totalGap;
  const remainingMainAfterFill = contentMain - occupiedMain;
  let startOffset = 0;
  let actualGap = gap;
  if (totalFillWeight === 0) {
    if (justify === "center") startOffset = remainingMainAfterFill / 2;
    else if (justify === "end") startOffset = remainingMainAfterFill;
    else if (justify === "space-between")
      actualGap = childIds.length <= 1 ? 0 : gap + remainingMainAfterFill / (childIds.length - 1);
  }
  const rects = {};
  let currentMain = startOffset;
  childIds.forEach((childId, index) => {
    const childMain = childMainSizes[index];
    const childCross = childCrossSizes[index];
    let crossOffset = 0;
    if (align === "center") crossOffset = (contentCross - childCross) / 2;
    else if (align === "end") crossOffset = contentCross - childCross;
    rects[childId] = isHorizontal ? {
      x: content.x + currentMain,
      y: content.y + crossOffset,
      width: childMain,
      height: childCross
    } : {
      x: content.x + crossOffset,
      y: content.y + currentMain,
      width: childCross,
      height: childMain
    };
    currentMain += childMain + actualGap;
  });
  return rects;
}
function validateGridTrack(track, axis, index) {
  if (track.kind === "fixed") {
    if (!Number.isFinite(track.size) || track.size < 0)
      throw new MachinaLayoutError(
        "InvalidGridTrack",
        `${axis}[${index}].size must be finite and non-negative`
      );
    return;
  }
  if (track.kind === "fill") {
    const weight = track.weight ?? 1;
    if (!Number.isFinite(weight) || weight <= 0)
      throw new MachinaLayoutError(
        "InvalidGridTrack",
        `${axis}[${index}].weight must be finite and greater than 0`
      );
    return;
  }
  throw new MachinaLayoutError("InvalidGridTrack", `${axis}[${index}] has unknown track kind`);
}
function resolveGridTracks(contentAxisSize, tracks, gap, axis) {
  if (!Number.isFinite(gap) || gap < 0 || tracks.length === 0)
    throw new MachinaLayoutError("InvalidGridTrack", `invalid ${axis} configuration`);
  tracks.forEach((t, i) => {
    validateGridTrack(t, axis, i);
  });
  const fixedTotal = tracks.reduce((s, t) => s + (t.kind === "fixed" ? t.size : 0), 0);
  const gapTotal = gap * Math.max(0, tracks.length - 1);
  const remaining = contentAxisSize - fixedTotal - gapTotal;
  if (remaining < 0) throw new MachinaLayoutError("GridOverflow", `grid ${axis} overflow`);
  const totalWeight = tracks.reduce((s, t) => s + (t.kind === "fill" ? t.weight ?? 1 : 0), 0);
  const sizes = tracks.map(
    (t) => t.kind === "fixed" ? t.size : totalWeight <= 0 ? 0 : remaining * (t.weight ?? 1) / totalWeight
  );
  let current = 0;
  return sizes.map((size) => {
    const r = { start: current, size };
    current += size + gap;
    return r;
  });
}
function resolveGridChildRect(childNode, columns, rows, columnGap, rowGap, content) {
  if (childNode.frame.kind !== "cell")
    throw new MachinaLayoutError(
      "GridChildMustBeCell",
      `grid child must use cell frame: ${childNode.id}`
    );
  const { row, col } = childNode.frame;
  const rowSpan = childNode.frame.rowSpan ?? 1;
  const colSpan = childNode.frame.colSpan ?? 1;
  if (!Number.isInteger(row) || row < 0 || !Number.isInteger(col) || col < 0 || !Number.isInteger(rowSpan) || rowSpan <= 0 || !Number.isInteger(colSpan) || colSpan <= 0)
    throw new MachinaLayoutError(
      "InvalidGridCell",
      `invalid cell coordinates/spans for node ${childNode.id}`
    );
  if (row + rowSpan > rows.length || col + colSpan > columns.length)
    throw new MachinaLayoutError(
      "InvalidGridCell",
      `cell exceeds grid bounds for node ${childNode.id}`
    );
  const x = content.x + columns[col].start;
  const y = content.y + rows[row].start;
  let width = columnGap * (colSpan - 1);
  for (let i = col; i < col + colSpan; i += 1) width += columns[i].size;
  let height = rowGap * (rowSpan - 1);
  for (let i = row; i < row + rowSpan; i += 1) height += rows[i].size;
  return { x, y, width, height };
}
function resolveLayoutDocument(document, rootRect) {
  validateRootRect2(rootRect);
  const rootNode = document.nodes[document.rootId];
  if (!rootNode)
    throw new MachinaLayoutError("MissingRoot", `root node not found for id: ${document.rootId}`);
  const resolvedNodes = {};
  const resolvedChildren = {};
  const visitState = /* @__PURE__ */ new Map();
  const pendingGuides = /* @__PURE__ */ new Map();
  const resolveNode = (nodeId, rect) => {
    const state = visitState.get(nodeId) ?? 0;
    if (state === 1) throw new MachinaLayoutError("Cycle", `cycle detected at node ${nodeId}`);
    if (state === 2) return;
    const node = document.nodes[nodeId];
    if (!node)
      throw new MachinaLayoutError(
        "UnknownParent",
        `node referenced in children but missing from nodes: ${nodeId}`
      );
    visitState.set(nodeId, 1);
    resolvedNodes[nodeId] = {
      id: node.id,
      z: node.z,
      rect: { ...rect },
      frame: node.frame,
      arrange: node.arrange,
      view: node.view,
      slot: node.slot,
      debugLabel: node.debugLabel,
      layer: node.layer,
      offset: node.offset
    };
    const childIds = document.children[nodeId] ?? [];
    resolvedChildren[nodeId] = [...childIds];
    let childRects;
    if (node.arrange?.kind === "stack")
      childRects = resolveStackChildRects(rect, node.arrange, childIds, document);
    else if (node.arrange?.kind === "grid") {
      const columnGap = node.arrange.columnGap ?? 0;
      const rowGap = node.arrange.rowGap ?? 0;
      const padding = normalizePadding(node.arrange.padding);
      const content = {
        x: rect.x + padding.left,
        y: rect.y + padding.top,
        width: rect.width - padding.left - padding.right,
        height: rect.height - padding.top - padding.bottom
      };
      if (content.width < 0 || content.height < 0)
        throw new MachinaLayoutError(
          "GridContentNegative",
          "grid content size cannot be negative after applying padding"
        );
      const columns = resolveGridTracks(content.width, node.arrange.columns, columnGap, "columns");
      const rows = resolveGridTracks(content.height, node.arrange.rows, rowGap, "rows");
      childRects = {};
      for (const childId of childIds) {
        const childNode = document.nodes[childId];
        if (!childNode)
          throw new MachinaLayoutError(
            "UnknownParent",
            `child id ${childId} referenced by ${nodeId} is missing`
          );
        childRects[childId] = resolveGridChildRect(
          childNode,
          columns,
          rows,
          columnGap,
          rowGap,
          content
        );
      }
    }
    for (const childId of childIds) {
      const childNode = document.nodes[childId];
      if (!childNode)
        throw new MachinaLayoutError(
          "UnknownParent",
          `child id ${childId} referenced by ${nodeId} is missing`
        );
      if (childNode.frame.kind === "guide" && !childRects) {
        validateGuideFrame(childId, childNode.frame, document);
        pendingGuides.set(childId, { nodeId: childId, parentId: nodeId });
        continue;
      }
      const normalChildRect = childRects?.[childId] ?? resolveFrame(rect, childNode.frame);
      resolveNode(childId, applyOffset(normalChildRect, rect, childNode.offset));
    }
    visitState.set(nodeId, 2);
  };
  const processPending = () => {
    while (pendingGuides.size > 0) {
      let progressed = false;
      for (const [id, pending] of [...pendingGuides.entries()]) {
        const parentResolved = resolvedNodes[pending.parentId];
        const node = document.nodes[id];
        if (!parentResolved || !node || node.frame.kind !== "guide") continue;
        const refs = [node.frame.left, node.frame.right, node.frame.top, node.frame.bottom].filter(
          isEdgeRef
        );
        if (refs.some((r) => !resolvedNodes[r.ref])) continue;
        const rect = resolveGuideFrame(parentResolved.rect, node.frame, resolvedNodes);
        resolveNode(id, applyOffset(rect, parentResolved.rect, node.offset));
        pendingGuides.delete(id);
        progressed = true;
      }
      if (pendingGuides.size === 0) return;
      if (progressed) continue;
      const remaining = /* @__PURE__ */ new Set([...pendingGuides.keys()]);
      const visiting = /* @__PURE__ */ new Set();
      const visited = /* @__PURE__ */ new Set();
      const hasCycle = (id) => {
        if (visiting.has(id)) return true;
        if (visited.has(id)) return false;
        visiting.add(id);
        const node = document.nodes[id];
        if (node?.frame.kind === "guide") {
          for (const ref of [
            node.frame.left,
            node.frame.right,
            node.frame.top,
            node.frame.bottom
          ].filter(isEdgeRef)) {
            if (remaining.has(ref.ref) && hasCycle(ref.ref)) return true;
          }
        }
        visiting.delete(id);
        visited.add(id);
        return false;
      };
      for (const id of remaining) {
        if (hasCycle(id))
          throw new MachinaLayoutError("GuideReferenceCycle", "guide reference cycle detected");
      }
      throw new MachinaLayoutError(
        "GuideTargetUnresolved",
        "one or more guide targets could not be resolved"
      );
    }
  };
  resolveNode(document.rootId, { ...rootRect });
  processPending();
  if (Object.keys(resolvedNodes).length !== Object.keys(document.nodes).length)
    throw new MachinaLayoutError(
      "UnreachableNode",
      "one or more nodes are unreachable from the root."
    );
  return { rootId: document.rootId, nodes: resolvedNodes, children: resolvedChildren };
}

// src/resolveLayoutRows.ts
function resolveLayoutRows(rows, rootRect) {
  const selectedRows = selectLayoutRowsForRoot(rows, rootRect);
  const document = compileLayoutRows(selectedRows);
  return resolveLayoutDocument(document, rootRect);
}

// src/flattenResolvedTree.ts
function flattenResolvedTree(tree) {
  const out = [];
  const visit = (node) => {
    out.push({
      id: node.id,
      z: node.z,
      rect: { ...node.rect },
      frame: node.frame,
      arrange: node.arrange,
      view: node.view,
      slot: node.slot,
      debugLabel: node.debugLabel,
      layer: node.layer,
      offset: node.offset
    });
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(tree);
  return out;
}

// src/formatRect.ts
function formatRect(rect) {
  return `x=${rect.x} y=${rect.y} w=${rect.width} h=${rect.height}`;
}

// src/lerp.ts
function assertFiniteNumber2(value) {
  if (!Number.isFinite(value)) {
    throw new MachinaLayoutError(
      "NonFiniteNumber",
      `Expected finite number, got ${String(value)}.`
    );
  }
}
function sameStringArray(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}
function assertCompatibleResolvedLayouts(a, b) {
  if (a.rootId !== b.rootId) {
    throw new MachinaLayoutError(
      "IncompatibleLayouts",
      `Layout roots differ: ${a.rootId} !== ${b.rootId}.`
    );
  }
  if (!(a.rootId in a.nodes) || !(b.rootId in b.nodes)) {
    throw new MachinaLayoutError(
      "IncompatibleLayouts",
      `Root id ${a.rootId} must exist in both node maps.`
    );
  }
  const aNodeIds = Object.keys(a.nodes).sort();
  const bNodeIds = Object.keys(b.nodes).sort();
  if (!sameStringArray(aNodeIds, bNodeIds)) {
    throw new MachinaLayoutError(
      "IncompatibleLayouts",
      "Resolved layouts must have the same node ids."
    );
  }
  const aParentIds = Object.keys(a.children).sort();
  const bParentIds = Object.keys(b.children).sort();
  if (!sameStringArray(aParentIds, bParentIds)) {
    throw new MachinaLayoutError(
      "IncompatibleLayouts",
      "Resolved layouts must have the same parent-child map."
    );
  }
  for (const parentId of aParentIds) {
    const aChildren = a.children[parentId] ?? [];
    const bChildren = b.children[parentId] ?? [];
    if (!sameStringArray(aChildren, bChildren)) {
      throw new MachinaLayoutError(
        "IncompatibleLayouts",
        `Child order differs for parent ${parentId}.`
      );
    }
  }
}
function copyChildren(children) {
  const copied = {};
  for (const [parentId, childIds] of Object.entries(children)) {
    copied[parentId] = [...childIds];
  }
  return copied;
}
function lerpNumber(a, b, t) {
  assertFiniteNumber2(a);
  assertFiniteNumber2(b);
  assertFiniteNumber2(t);
  return a + (b - a) * t;
}
function lerpRect(a, b, t) {
  return {
    x: lerpNumber(a.x, b.x, t),
    y: lerpNumber(a.y, b.y, t),
    width: lerpNumber(a.width, b.width, t),
    height: lerpNumber(a.height, b.height, t)
  };
}
function lerpResolvedLayouts(a, b, t) {
  assertFiniteNumber2(t);
  assertCompatibleResolvedLayouts(a, b);
  const nodes = {};
  for (const id of Object.keys(b.nodes)) {
    const aNode = a.nodes[id];
    const bNode = b.nodes[id];
    nodes[id] = {
      ...bNode,
      rect: lerpRect(aNode.rect, bNode.rect, t)
    };
  }
  return {
    rootId: b.rootId,
    nodes,
    children: copyChildren(b.children)
  };
}
export {
  MachinaLayoutError,
  MachinaReactView,
  MachinaTextView,
  MachinaVueTextView,
  applyOffset,
  assertFiniteNumber,
  assertNonNegativeGap,
  assertNonNegativePadding,
  assertNonNegativeSize,
  compileLayoutRows,
  flattenResolvedTree,
  formatRect,
  lerpNumber,
  lerpRect,
  lerpResolvedLayouts,
  normalizePadding,
  parseMachinaText,
  parseMachinaTextInline,
  resolveFrame,
  resolveLayoutDocument,
  resolveLayoutRows,
  resolveUiLength,
  selectLayoutRowsForRoot,
  toResolvedTree
};
