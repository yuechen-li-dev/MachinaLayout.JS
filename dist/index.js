// src/errors.ts
var MachinaLayoutError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "MachinaLayoutError";
    this.code = code;
  }
};

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
  throw new MachinaLayoutError("InvalidLengthUnit", `Invalid UiLength unit for ${fieldName}: ${String(unit)}.`);
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
      throw new MachinaLayoutError("RootFrameNotRoot", `row ${row.id} uses RootFrame but is not a root row.`);
    }
    if (row.z !== void 0) {
      assertFiniteNumber(row.z, `rows[${rowIndex}].z`);
      if (!Number.isInteger(row.z) || row.z < -5 || row.z > 5) {
        throw new MachinaLayoutError("InvalidZ", `rows[${rowIndex}].z must be an integer in range -5..5`);
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
    throw new MachinaLayoutError("FillFrameWithoutArranger", "FillFrame cannot be used as the root frame.");
  }
  if (nodes[rootId].frame.kind === "fixed") {
    throw new MachinaLayoutError("FixedFrameWithoutArranger", "FixedFrame cannot be used as the root frame.");
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
      throw new MachinaLayoutError("UnknownParent", `node ${row.id} references unknown parent: ${row.parent}`);
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
    throw new MachinaLayoutError("InvalidAnchorHorizontal", "Anchor frame must specify exactly two horizontal constraints: left, right, width.");
  }
  const verticalCount = Number(hasTop) + Number(hasBottom) + Number(hasHeight);
  if (verticalCount !== 2) {
    throw new MachinaLayoutError("InvalidAnchorVertical", "Anchor frame must specify exactly two vertical constraints: top, bottom, height.");
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
      return { x: parent.x + frame.x, y: parent.y + frame.y, width: frame.width, height: frame.height };
    }
    case "anchor":
      return resolveAnchor(parent, frame);
    case "root":
      throw new MachinaLayoutError("RootFrameWithoutRoot", "RootFrame can only be declared on the root row.");
    case "fixed": {
      assertNonNegativeSize(frame.width, "frame.width");
      assertNonNegativeSize(frame.height, "frame.height");
      throw new MachinaLayoutError("FixedFrameWithoutArranger", "Fixed frames require an arranger to determine placement.");
    }
    case "fill":
      throw new MachinaLayoutError("FillFrameWithoutArranger", "Fill frames require a stack arranger to determine placement.");
  }
}

// src/resolveLayoutDocument.ts
function validateRootRect(rootRect) {
  assertFiniteNumber(rootRect.x, "rootRect.x");
  assertFiniteNumber(rootRect.y, "rootRect.y");
  assertNonNegativeSize(rootRect.width, "rootRect.width");
  assertNonNegativeSize(rootRect.height, "rootRect.height");
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
  if (content.width < 0 || content.height < 0) {
    throw new MachinaLayoutError("StackContentNegative", "stack content size cannot be negative after applying padding");
  }
  const isHorizontal = arrange.axis === "horizontal";
  const contentMain = isHorizontal ? content.width : content.height;
  const contentCross = isHorizontal ? content.height : content.width;
  const childMainSizes = [];
  const childCrossSizes = [];
  const fillWeights = [];
  for (const childId of childIds) {
    const childNode = document.nodes[childId];
    if (!childNode) {
      throw new MachinaLayoutError("UnknownParent", `child id ${childId} referenced by arranged parent is missing`);
    }
    if (childNode.frame.kind === "fixed") {
      assertNonNegativeSize(childNode.frame.width, `${childId}.frame.width`);
      assertNonNegativeSize(childNode.frame.height, `${childId}.frame.height`);
      childMainSizes.push(isHorizontal ? childNode.frame.width : childNode.frame.height);
      childCrossSizes.push(isHorizontal ? childNode.frame.height : childNode.frame.width);
      fillWeights.push(0);
      continue;
    }
    if (childNode.frame.kind !== "fill") {
      throw new MachinaLayoutError("StackChildMustBeFixed", `stack child must use fixed or fill frame: ${childId}`);
    }
    const weight = childNode.frame.weight ?? 1;
    assertFiniteNumber(weight, `${childId}.frame.weight`);
    if (weight <= 0) {
      throw new MachinaLayoutError("InvalidFillWeight", `${childId}.frame.weight must be greater than 0`);
    }
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
  const fixedMainTotal = childIds.reduce((sum, _id, i) => sum + (fillWeights[i] === 0 ? childMainSizes[i] : 0), 0);
  const totalGap = gap * Math.max(0, childIds.length - 1);
  const remainingMain = contentMain - fixedMainTotal - totalGap;
  if (remainingMain < 0) {
    throw new MachinaLayoutError("StackOverflow", "stack main axis overflow");
  }
  const totalFillWeight = fillWeights.reduce((sum, w) => sum + w, 0);
  if (totalFillWeight > 0) {
    for (let i = 0; i < childMainSizes.length; i += 1) {
      if (fillWeights[i] > 0) {
        childMainSizes[i] = remainingMain * fillWeights[i] / totalFillWeight;
      }
    }
  }
  for (const childCross of childCrossSizes) {
    if (childCross > contentCross) {
      throw new MachinaLayoutError("StackOverflow", "stack cross axis overflow");
    }
  }
  const occupiedMain = childMainSizes.reduce((sum, size) => sum + size, 0) + totalGap;
  const remainingMainAfterFill = contentMain - occupiedMain;
  let startOffset = 0;
  let actualGap = gap;
  if (totalFillWeight === 0) {
    switch (justify) {
      case "start":
        break;
      case "center":
        startOffset = remainingMainAfterFill / 2;
        break;
      case "end":
        startOffset = remainingMainAfterFill;
        break;
      case "space-between":
        if (childIds.length <= 1) {
          actualGap = 0;
        } else {
          actualGap = gap + remainingMainAfterFill / (childIds.length - 1);
        }
        break;
      default:
        throw new Error(`Unsupported stack justify: ${String(justify)}`);
    }
  }
  const rects = {};
  let currentMain = startOffset;
  childIds.forEach((childId, index) => {
    const childMain = childMainSizes[index];
    const childCross = childCrossSizes[index];
    let crossOffset = 0;
    switch (align) {
      case "start":
        break;
      case "center":
        crossOffset = (contentCross - childCross) / 2;
        break;
      case "end":
        crossOffset = contentCross - childCross;
        break;
      default:
        throw new Error(`Unsupported stack align: ${String(align)}`);
    }
    rects[childId] = isHorizontal ? { x: content.x + currentMain, y: content.y + crossOffset, width: childMain, height: childCross } : { x: content.x + crossOffset, y: content.y + currentMain, width: childCross, height: childMain };
    currentMain += childMain + actualGap;
  });
  return rects;
}
function resolveLayoutDocument(document, rootRect) {
  validateRootRect(rootRect);
  const rootNode = document.nodes[document.rootId];
  if (!rootNode) {
    throw new MachinaLayoutError("MissingRoot", `root node not found for id: ${document.rootId}`);
  }
  const resolvedNodes = {};
  const resolvedChildren = {};
  const visitState = /* @__PURE__ */ new Map();
  let visitedCount = 0;
  const resolveNode = (nodeId, rect) => {
    const state = visitState.get(nodeId) ?? 0;
    if (state === 1) {
      throw new MachinaLayoutError("Cycle", `cycle detected at node ${nodeId}`);
    }
    if (state === 2) {
      return;
    }
    const node = document.nodes[nodeId];
    if (!node) {
      throw new MachinaLayoutError("UnknownParent", `node referenced in children but missing from nodes: ${nodeId}`);
    }
    visitState.set(nodeId, 1);
    visitedCount += 1;
    resolvedNodes[nodeId] = {
      id: node.id,
      z: node.z,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      frame: node.frame,
      arrange: node.arrange,
      view: node.view,
      slot: node.slot,
      debugLabel: node.debugLabel,
      offset: node.offset
    };
    const childIds = document.children[nodeId] ?? [];
    resolvedChildren[nodeId] = [...childIds];
    const childRects = node.arrange?.kind === "stack" ? resolveStackChildRects(rect, node.arrange, childIds, document) : void 0;
    for (const childId of childIds) {
      const childNode = document.nodes[childId];
      if (!childNode) {
        throw new MachinaLayoutError("UnknownParent", `child id ${childId} referenced by ${nodeId} is missing`);
      }
      const normalChildRect = childRects?.[childId] ?? resolveFrame(rect, childNode.frame);
      const childRect = applyOffset(normalChildRect, rect, childNode.offset);
      resolveNode(childId, childRect);
    }
    visitState.set(nodeId, 2);
  };
  resolveNode(document.rootId, { x: rootRect.x, y: rootRect.y, width: rootRect.width, height: rootRect.height });
  if (visitedCount !== Object.keys(document.nodes).length) {
    throw new MachinaLayoutError("UnreachableNode", "one or more nodes are unreachable from the root.");
  }
  return {
    rootId: document.rootId,
    nodes: resolvedNodes,
    children: resolvedChildren
  };
}

// src/resolveLayoutRows.ts
function resolveLayoutRows(rows, rootRect) {
  const document = compileLayoutRows(rows);
  return resolveLayoutDocument(document, rootRect);
}

// src/toResolvedTree.ts
function toResolvedTree(document) {
  const root = document.nodes[document.rootId];
  if (!root) {
    throw new MachinaLayoutError("MissingRoot", `root node '${document.rootId}' is missing`);
  }
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  const build = (node) => {
    if (visiting.has(node.id)) {
      throw new MachinaLayoutError("Cycle", `cycle detected at '${node.id}'`);
    }
    visiting.add(node.id);
    visited.add(node.id);
    const childIds = document.children[node.id] ?? [];
    const children = childIds.map((childId) => {
      const child = document.nodes[childId];
      if (!child) {
        throw new MachinaLayoutError("UnknownParent", `missing child node '${childId}' referenced by '${node.id}'`);
      }
      return build(child);
    });
    visiting.delete(node.id);
    return {
      id: node.id,
      z: node.z,
      rect: { ...node.rect },
      frame: node.frame,
      arrange: node.arrange,
      view: node.view,
      slot: node.slot,
      debugLabel: node.debugLabel,
      offset: node.offset,
      children
    };
  };
  const tree = build(root);
  for (const nodeId of Object.keys(document.nodes)) {
    if (!visited.has(nodeId)) {
      throw new MachinaLayoutError("UnreachableNode", `node '${nodeId}' is unreachable from root '${document.rootId}'`);
    }
  }
  return tree;
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

// src/react/MachinaReactView.tsx
import React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function renderNode(node, parentRect, views, viewData, nodeData, nodeClassName, debug, nodeContainment, nodeContentVisibility, nodeContainIntrinsicSize, nodesById) {
  const viewKey = node.view ?? node.slot;
  const View = viewKey ? views[viewKey] : void 0;
  const selectedViewData = viewKey ? viewData?.[viewKey] : void 0;
  const selectedNodeData = nodeData?.[node.id];
  const left = node.rect.x - parentRect.x;
  const top = node.rect.y - parentRect.y;
  const style = {
    position: "absolute",
    left,
    top,
    width: node.rect.width,
    height: node.rect.height,
    boxSizing: "border-box",
    zIndex: node.z ?? 0,
    ...nodeContainment === "layout-paint" ? { contain: "layout paint" } : null,
    ...nodeContainment === "strict" ? { contain: "strict" } : null,
    ...nodeContentVisibility === "auto" ? { contentVisibility: "auto" } : null,
    ...nodeContainIntrinsicSize !== void 0 ? { containIntrinsicSize: nodeContainIntrinsicSize } : null,
    ...debug ? { outline: "1px dashed rgba(59, 130, 246, 0.9)" } : null
  };
  const renderedSlot = View && nodesById[node.id] ? React.createElement(View, {
    id: node.id,
    rect: { ...node.rect },
    debugLabel: node.debugLabel,
    node: { ...nodesById[node.id], rect: { ...nodesById[node.id].rect } },
    viewKey,
    viewData: selectedViewData,
    nodeData: selectedNodeData
  }) : null;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-testid": `machina-node-${node.id}`,
      className: nodeClassName,
      style,
      "data-machina-node-id": node.id,
      "data-machina-slot": node.slot,
      "data-machina-view": viewKey,
      "data-machina-debug-label": node.debugLabel,
      children: [
        debug ? /* @__PURE__ */ jsx("small", { children: node.debugLabel ?? node.id }) : null,
        renderedSlot,
        [...node.children].map((child, index) => ({ child, index })).sort((a, b) => (a.child.z ?? 0) - (b.child.z ?? 0) || a.index - b.index).map(
          ({ child }) => renderNode(
            child,
            node.rect,
            views,
            viewData,
            nodeData,
            nodeClassName,
            debug,
            nodeContainment,
            nodeContentVisibility,
            nodeContainIntrinsicSize,
            nodesById
          )
        )
      ]
    },
    node.id
  );
}
function MachinaReactView(props) {
  const {
    layout,
    views = {},
    viewData,
    nodeData,
    className,
    style,
    nodeClassName,
    debug,
    nodeContainment = "layout-paint",
    nodeContentVisibility = "none",
    nodeContainIntrinsicSize
  } = props;
  const tree = toResolvedTree(layout);
  const wrapperStyle = {
    position: "relative",
    width: tree.rect.width,
    height: tree.rect.height,
    ...style
  };
  return /* @__PURE__ */ jsx("div", { className, style: wrapperStyle, "data-machina-root-id": tree.id, children: renderNode(
    tree,
    tree.rect,
    views,
    viewData,
    nodeData,
    nodeClassName,
    debug,
    nodeContainment,
    nodeContentVisibility,
    nodeContainIntrinsicSize,
    layout.nodes
  ) });
}

// src/text/parseMachinaText.ts
function makeDiagnostic(code, message, index, length, line, column) {
  return { code, message, index, length, line, column, level: "error" };
}
function toLines(source) {
  const lines = [];
  let i = 0;
  let line = 1;
  while (i <= source.length) {
    const start = i;
    while (i < source.length && source[i] !== "\n" && source[i] !== "\r") i += 1;
    const text = source.slice(start, i);
    lines.push({ text, index: start, line });
    if (i >= source.length) break;
    if (source[i] === "\r" && source[i + 1] === "\n") i += 2;
    else i += 1;
    line += 1;
  }
  return lines;
}
function parseInline(text, lineIndex, line) {
  const diagnostics = [];
  const inline = [];
  let cursor = 0;
  const pushText = (t) => {
    if (!t) return;
    const prev = inline[inline.length - 1];
    if (prev?.kind === "text") prev.text += t;
    else inline.push({ kind: "text", text: t });
  };
  const allowedEscapes = /* @__PURE__ */ new Set(["\\", "*", "`", "[", "]", "(", ")", "-"]);
  const consumeEscape = () => {
    if (text[cursor] !== "\\") return false;
    if (cursor === text.length - 1) {
      diagnostics.push(makeDiagnostic("invalid_escape", "Dangling escape sequence.", lineIndex + cursor, 1, line, cursor + 1));
      pushText("\\");
      cursor += 1;
      return true;
    }
    const escaped = text[cursor + 1];
    if (allowedEscapes.has(escaped)) {
      pushText(escaped);
      cursor += 2;
      return true;
    }
    diagnostics.push(makeDiagnostic("invalid_escape", `Unsupported escape sequence: \\${escaped}`, lineIndex + cursor, 2, line, cursor + 1));
    pushText(escaped);
    cursor += 2;
    return true;
  };
  while (cursor < text.length) {
    if (consumeEscape()) continue;
    if (text.startsWith("![", cursor)) {
      diagnostics.push(makeDiagnostic("unsupported_syntax", "Images are not supported.", lineIndex + cursor, 2, line, cursor + 1));
      pushText("![");
      cursor += 2;
      continue;
    }
    if (text[cursor] === "`") {
      const close = text.indexOf("`", cursor + 1);
      if (close < 0) {
        diagnostics.push(makeDiagnostic("unclosed_inline", "Unclosed inline code marker.", lineIndex + cursor, text.length - cursor, line, cursor + 1));
        pushText(text.slice(cursor));
        break;
      }
      inline.push({ kind: "code", text: text.slice(cursor + 1, close) });
      cursor = close + 1;
      continue;
    }
    if (text.startsWith("**", cursor)) {
      const close = text.indexOf("**", cursor + 2);
      if (close < 0) {
        diagnostics.push(makeDiagnostic("unclosed_inline", "Unclosed strong marker.", lineIndex + cursor, text.length - cursor, line, cursor + 1));
        pushText(text.slice(cursor));
        break;
      }
      const children = parseInline(text.slice(cursor + 2, close), lineIndex + cursor + 2, line);
      diagnostics.push(...children.diagnostics);
      inline.push({ kind: "strong", children: children.inline });
      cursor = close + 2;
      continue;
    }
    if (text[cursor] === "*") {
      const close = text.indexOf("*", cursor + 1);
      if (close < 0) {
        diagnostics.push(makeDiagnostic("unclosed_inline", "Unclosed emphasis marker.", lineIndex + cursor, text.length - cursor, line, cursor + 1));
        pushText(text.slice(cursor));
        break;
      }
      const children = parseInline(text.slice(cursor + 1, close), lineIndex + cursor + 1, line);
      diagnostics.push(...children.diagnostics);
      inline.push({ kind: "emphasis", children: children.inline });
      cursor = close + 1;
      continue;
    }
    if (text[cursor] === "[") {
      const closeBracket = text.indexOf("]", cursor + 1);
      if (closeBracket < 0 || text[closeBracket + 1] !== "(") {
        diagnostics.push(makeDiagnostic("malformed_link", "Malformed link syntax.", lineIndex + cursor, Math.max(1, text.length - cursor), line, cursor + 1));
        pushText("[");
        cursor += 1;
        continue;
      }
      const closeParen = text.indexOf(")", closeBracket + 2);
      if (closeParen < 0) {
        diagnostics.push(makeDiagnostic("malformed_link", "Malformed link syntax.", lineIndex + cursor, text.length - cursor, line, cursor + 1));
        pushText(text.slice(cursor));
        break;
      }
      const label = text.slice(cursor + 1, closeBracket);
      const href = text.slice(closeBracket + 2, closeParen);
      if (label.length === 0) {
        diagnostics.push(makeDiagnostic("malformed_link", "Link label cannot be empty.", lineIndex + cursor, closeParen - cursor + 1, line, cursor + 1));
        pushText(text.slice(cursor, closeParen + 1));
        cursor = closeParen + 1;
        continue;
      }
      const labelInline = parseInline(label, lineIndex + cursor + 1, line);
      diagnostics.push(...labelInline.diagnostics);
      inline.push({ kind: "link", href, children: labelInline.inline });
      cursor = closeParen + 1;
      continue;
    }
    const specials = ["![", "`", "**", "*", "[", "\\"];
    let next = text.length;
    for (const special of specials) {
      const p = text.indexOf(special, cursor);
      if (p >= 0 && p < next) next = p;
    }
    if (next === cursor) {
      pushText(text[cursor]);
      cursor += 1;
      continue;
    }
    pushText(text.slice(cursor, next));
    cursor = next;
  }
  return { inline, diagnostics };
}
function classifyForbiddenBlock(line) {
  if (/^#{1,6}\s+/.test(line)) return "heading_forbidden";
  if (/^\d+\.\s+/.test(line)) return "unsupported_syntax";
  if (/^\s*-\s+\[[ xX]\]\s+/.test(line)) return "unsupported_syntax";
  if (/^>\s+/.test(line)) return "unsupported_syntax";
  if (/^```/.test(line)) return "unsupported_syntax";
  if (/^\s*<\/?[a-zA-Z][^>]*>/.test(line)) return "unsupported_syntax";
  if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) return "unsupported_syntax";
  return void 0;
}
function parseBulletLine(line) {
  if (line.startsWith("\\- ")) return void 0;
  if (line.startsWith("- ")) return { depth: 1, text: line.slice(2) };
  if (line.startsWith("  - ")) return { depth: 2, text: line.slice(4) };
  if (line.startsWith("    - ")) return { depth: 3, text: line.slice(6) };
  return void 0;
}
function parseMachinaTextInline(text) {
  return parseInline(text, 0, 1);
}
function parseMachinaText(source) {
  const src = typeof source === "string" ? { kind: "machina-text", text: source } : source;
  if (src?.kind !== "plain" && src?.kind !== "machina-text") {
    const diagnostic = makeDiagnostic("unsupported_syntax", "Unsupported MachinaText source kind.", 0, 0, 1, 1);
    return { ok: false, document: { blocks: [] }, diagnostics: [diagnostic] };
  }
  if (src.kind === "plain") {
    return {
      ok: true,
      document: { blocks: [{ kind: "paragraph", inline: [{ kind: "text", text: src.text }] }] },
      diagnostics: []
    };
  }
  const blocks = [];
  const diagnostics = [];
  const lines = toLines(src.text);
  let i = 0;
  while (i < lines.length) {
    const lineInfo = lines[i];
    const trimmed = lineInfo.text.trim();
    if (trimmed.length === 0) {
      i += 1;
      continue;
    }
    const forbiddenCode = classifyForbiddenBlock(lineInfo.text);
    if (forbiddenCode) {
      const code = forbiddenCode;
      diagnostics.push(makeDiagnostic(code, "Unsupported block syntax.", lineInfo.index, lineInfo.text.length || 1, lineInfo.line, 1));
      blocks.push({ kind: "paragraph", inline: [{ kind: "text", text: lineInfo.text }] });
      i += 1;
      continue;
    }
    const bullet = parseBulletLine(lineInfo.text);
    if (bullet) {
      const items = [];
      let lastTop;
      while (i < lines.length) {
        const current = lines[i];
        if (current.text.trim().length === 0) break;
        const currentBullet = parseBulletLine(current.text);
        if (!currentBullet) break;
        if (/^\s*-\s+\[[ xX]\]\s+/.test(current.text)) {
          diagnostics.push(makeDiagnostic("unsupported_syntax", "Task lists are not supported.", current.index, current.text.length || 1, current.line, 1));
        }
        if (currentBullet.depth > 2) {
          diagnostics.push(makeDiagnostic("max_list_depth_exceeded", "Maximum bullet depth is 2.", current.index, current.text.length || 1, current.line, 1));
          const parsed3 = parseInline(current.text.trim(), current.index + (current.text.length - current.text.trimStart().length), current.line);
          diagnostics.push(...parsed3.diagnostics);
          blocks.push({ kind: "paragraph", inline: parsed3.inline.length ? parsed3.inline : [{ kind: "text", text: current.text }] });
          i += 1;
          continue;
        }
        const parsed2 = parseInline(currentBullet.text, current.index + (currentBullet.depth === 1 ? 2 : 4), current.line);
        diagnostics.push(...parsed2.diagnostics);
        const item = { inline: parsed2.inline };
        if (currentBullet.depth === 1) {
          items.push(item);
          lastTop = item;
        } else if (lastTop) {
          if (!lastTop.children) lastTop.children = [];
          lastTop.children.push(item);
        } else {
          diagnostics.push(makeDiagnostic("unsupported_syntax", "Nested bullet requires a parent bullet.", current.index, current.text.length || 1, current.line, 1));
          blocks.push({ kind: "paragraph", inline: [{ kind: "text", text: current.text }] });
        }
        i += 1;
      }
      blocks.push({ kind: "bulletList", items });
      continue;
    }
    const paragraphLines = [];
    while (i < lines.length && lines[i].text.trim().length > 0 && !parseBulletLine(lines[i].text) && !classifyForbiddenBlock(lines[i].text)) {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    const paragraphText = paragraphLines.map((line) => line.text).join("\n");
    const first = paragraphLines[0];
    const parsed = parseInline(paragraphText, first?.index ?? 0, first?.line ?? 1);
    diagnostics.push(...parsed.diagnostics);
    blocks.push({ kind: "paragraph", inline: parsed.inline });
  }
  return { ok: diagnostics.every((d) => d.level !== "error"), document: { blocks }, diagnostics };
}

// src/text/react/MachinaTextView.tsx
import React2 from "react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var DEFAULT_POLICY = { variant: "body", wrap: "word", overflow: "clip", align: "start", leading: "normal", blockGap: 8, listGap: 2, valign: "top" };
var INLINE_CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
var VARIANT_STYLE = {
  body: { fontSize: "14px", fontWeight: 400, lineHeight: 1.4 },
  label: { fontSize: "12px", fontWeight: 500, lineHeight: 1.3 },
  caption: { fontSize: "11px", fontWeight: 400, lineHeight: 1.25, opacity: 0.8 },
  title: { fontSize: "18px", fontWeight: 700, lineHeight: 1.25 },
  mono: { fontSize: "12px", lineHeight: 1.35, fontFamily: INLINE_CODE_FONT }
};
function isMachinaTextDocument(value) {
  return typeof value === "object" && value !== null && "blocks" in value;
}
function isMachinaTextSpec(value) {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "text";
}
function normalizePositive(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
function normalizeNonNegative(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
function normalizeLeading(value) {
  if (value === void 0) return DEFAULT_POLICY.leading;
  if (value === "tight" || value === "normal" || value === "loose") return value;
  return normalizePositive(value, resolveLineHeight(DEFAULT_POLICY));
}
function normalizeSpecPolicy(spec) {
  return {
    variant: spec.variant ?? DEFAULT_POLICY.variant,
    wrap: spec.wrap ?? DEFAULT_POLICY.wrap,
    overflow: spec.overflow ?? DEFAULT_POLICY.overflow,
    align: spec.align ?? DEFAULT_POLICY.align,
    leading: normalizeLeading(spec.leading),
    blockGap: normalizeNonNegative(spec.blockGap, DEFAULT_POLICY.blockGap),
    listGap: normalizeNonNegative(spec.listGap, DEFAULT_POLICY.listGap),
    valign: spec.valign ?? DEFAULT_POLICY.valign
  };
}
function normalizeText(text) {
  if (isMachinaTextDocument(text)) return { document: text, diagnostics: [], policy: DEFAULT_POLICY };
  if (isMachinaTextSpec(text)) {
    const result2 = parseMachinaText(text.source);
    return { document: result2.document, diagnostics: result2.diagnostics, policy: normalizeSpecPolicy(text) };
  }
  const result = parseMachinaText(typeof text === "string" ? { kind: "machina-text", text } : text);
  return { document: result.document, diagnostics: result.diagnostics, policy: DEFAULT_POLICY };
}
function resolveLineHeight(policy) {
  if (policy.leading === "tight") return 1.15;
  if (policy.leading === "loose") return 1.6;
  if (typeof policy.leading === "number") return policy.leading;
  return VARIANT_STYLE[policy.variant].lineHeight;
}
function policyStyle(policy) {
  const wrapStyle = { word: { whiteSpace: "normal", overflowWrap: "anywhere" }, none: { whiteSpace: "nowrap" } };
  const overflowStyle = {
    clip: { overflow: "hidden" },
    ellipsis: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    scroll: { overflow: "auto" }
  };
  const alignStyle = { start: { textAlign: "left" }, center: { textAlign: "center" }, end: { textAlign: "right" } };
  const justifyContent = {
    top: "flex-start",
    center: "center",
    bottom: "flex-end"
  };
  return {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: justifyContent[policy.valign],
    minWidth: 0,
    ...VARIANT_STYLE[policy.variant],
    lineHeight: resolveLineHeight(policy),
    ...wrapStyle[policy.wrap],
    ...overflowStyle[policy.overflow],
    ...alignStyle[policy.align]
  };
}
function renderInline(inline, key, props) {
  switch (inline.kind) {
    case "text":
      return /* @__PURE__ */ jsx2(React2.Fragment, { children: inline.text }, key);
    case "strong":
      return /* @__PURE__ */ jsx2("strong", { children: inline.children.map((c, i) => renderInline(c, `${key}-s-${i}`, props)) }, key);
    case "emphasis":
      return /* @__PURE__ */ jsx2("em", { children: inline.children.map((c, i) => renderInline(c, `${key}-e-${i}`, props)) }, key);
    case "code":
      return /* @__PURE__ */ jsx2("code", { style: { fontFamily: INLINE_CODE_FONT, backgroundColor: "rgba(127, 127, 127, 0.15)", borderRadius: 3, padding: "0 0.25em" }, children: inline.text }, key);
    case "link": {
      const rel = props.linkTarget === "_blank" ? "noreferrer noopener" : void 0;
      return /* @__PURE__ */ jsx2("a", { href: inline.href, target: props.linkTarget, rel, onClick: (event) => props.onLinkClick?.(inline.href, event), children: inline.children.map((c, i) => renderInline(c, `${key}-l-${i}`, props)) }, key);
    }
  }
}
function renderBulletItem(item, path, props, listGap) {
  return /* @__PURE__ */ jsxs2("li", { style: { marginBottom: listGap }, children: [
    item.inline.map((i, idx) => renderInline(i, `${path}-i-${idx}`, props)),
    item.children?.length ? /* @__PURE__ */ jsx2("ul", { style: { margin: "0.25em 0 0 0", paddingLeft: "1.25em" }, children: item.children.map((c, idx) => renderBulletItem(c, `${path}-c-${idx}`, props, listGap)) }) : null
  ] }, path);
}
function MachinaTextView(props) {
  const normalized = normalizeText(props.text);
  return /* @__PURE__ */ jsx2("div", { className: props.className, style: { ...policyStyle(normalized.policy), ...props.style }, children: /* @__PURE__ */ jsxs2("div", { style: { minWidth: 0 }, children: [
    normalized.document.blocks.map((block, index) => block.kind === "paragraph" ? /* @__PURE__ */ jsx2("p", { style: { margin: index === normalized.document.blocks.length - 1 ? "0" : `0 0 ${normalized.policy.blockGap}px 0` }, children: block.inline.map((i, idx) => renderInline(i, `b-${index}-${idx}`, props)) }, `b-${index}`) : /* @__PURE__ */ jsx2("ul", { style: { margin: index === normalized.document.blocks.length - 1 ? "0" : `0 0 ${normalized.policy.blockGap}px 0`, paddingLeft: "1.25em" }, children: block.items.map((item, itemIndex) => renderBulletItem(item, `b-${index}-item-${itemIndex}`, props, normalized.policy.listGap)) }, `b-${index}`)),
    props.showDiagnostics && normalized.diagnostics.length > 0 ? /* @__PURE__ */ jsx2("pre", { style: { margin: `${normalized.policy.blockGap}px 0 0 0`, padding: "0.5em", fontSize: "11px", fontFamily: INLINE_CODE_FONT, whiteSpace: "pre-wrap", background: "rgba(127, 127, 127, 0.12)" }, children: normalized.diagnostics.map((d) => `${d.code} (${d.line}:${d.column}) ${d.message}`).join("\n") }) : null
  ] }) });
}
export {
  MachinaLayoutError,
  MachinaReactView,
  MachinaTextView,
  applyOffset,
  assertFiniteNumber,
  assertNonNegativeGap,
  assertNonNegativePadding,
  assertNonNegativeSize,
  compileLayoutRows,
  flattenResolvedTree,
  formatRect,
  normalizePadding,
  parseMachinaText,
  parseMachinaTextInline,
  resolveFrame,
  resolveLayoutDocument,
  resolveLayoutRows,
  resolveUiLength,
  toResolvedTree
};
