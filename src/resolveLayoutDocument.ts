import { MachinaLayoutError } from "./errors";
import { normalizePadding } from "./padding";
import { applyOffset } from "./offset";
import { resolveFrame } from "./resolveFrame";
import type {
  GridTrack,
  LayoutDocument,
  NodeId,
  Rect,
  ResolvedLayoutDocument,
  ResolvedLayoutNode,
  StackAlign,
  StackArrange,
  StackAxis,
  StackJustify,
} from "./types";
import { assertFiniteNumber, assertNonNegativeGap, assertNonNegativeSize } from "./validation";

function validateRootRect(rootRect: Rect): void {
  assertFiniteNumber(rootRect.x, "rootRect.x");
  assertFiniteNumber(rootRect.y, "rootRect.y");
  assertNonNegativeSize(rootRect.width, "rootRect.width");
  assertNonNegativeSize(rootRect.height, "rootRect.height");
}

function resolveStackChildRects(parentRect: Rect, arrange: StackArrange, childIds: NodeId[], document: LayoutDocument): Record<NodeId, Rect> {
  const gap = arrange.gap ?? 0;
  const justify: StackJustify = arrange.justify ?? "start";
  const align: StackAlign = arrange.align ?? "start";
  assertNonNegativeGap(gap, "gap");
  const padding = normalizePadding(arrange.padding);

  const content: Rect = {
    x: parentRect.x + padding.left,
    y: parentRect.y + padding.top,
    width: parentRect.width - padding.left - padding.right,
    height: parentRect.height - padding.top - padding.bottom,
  };

  if (content.width < 0 || content.height < 0) {
    throw new MachinaLayoutError("StackContentNegative", "stack content size cannot be negative after applying padding");
  }

  const isHorizontal = arrange.axis === "horizontal";
  const contentMain = isHorizontal ? content.width : content.height;
  const contentCross = isHorizontal ? content.height : content.width;

  const childMainSizes: number[] = [];
  const childCrossSizes: number[] = [];
  const fillWeights: number[] = [];

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
        childMainSizes[i] = (remainingMain * fillWeights[i]) / totalFillWeight;
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

  const rects: Record<NodeId, Rect> = {};
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

    rects[childId] = isHorizontal
      ? { x: content.x + currentMain, y: content.y + crossOffset, width: childMain, height: childCross }
      : { x: content.x + crossOffset, y: content.y + currentMain, width: childCross, height: childMain };

    currentMain += childMain + actualGap;
  });

  return rects;
}

type ResolvedGridTrack = { start: number; size: number };

function validateGridTrack(track: GridTrack, axis: "columns" | "rows", index: number): void {
  if (track.kind === "fixed") {
    if (!Number.isFinite(track.size) || track.size < 0) {
      throw new MachinaLayoutError("InvalidGridTrack", `${axis}[${index}].size must be finite and non-negative`);
    }
    return;
  }
  if (track.kind === "fill") {
    const weight = track.weight ?? 1;
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new MachinaLayoutError("InvalidGridTrack", `${axis}[${index}].weight must be finite and greater than 0`);
    }
    return;
  }
  throw new MachinaLayoutError("InvalidGridTrack", `${axis}[${index}] has unknown track kind`);
}

function resolveGridTracks(contentAxisSize: number, tracks: GridTrack[], gap: number, axis: "columns" | "rows"): ResolvedGridTrack[] {
  if (!Number.isFinite(gap) || gap < 0 || tracks.length === 0) {
    throw new MachinaLayoutError("InvalidGridTrack", `invalid ${axis} configuration`);
  }
  tracks.forEach((track, index) => validateGridTrack(track, axis, index));

  const fixedTotal = tracks.reduce((sum, track) => sum + (track.kind === "fixed" ? track.size : 0), 0);
  const gapTotal = gap * Math.max(0, tracks.length - 1);
  const remaining = contentAxisSize - fixedTotal - gapTotal;
  if (remaining < 0) {
    throw new MachinaLayoutError("GridOverflow", `grid ${axis} overflow`);
  }

  const totalWeight = tracks.reduce((sum, track) => sum + (track.kind === "fill" ? (track.weight ?? 1) : 0), 0);
  const sizes = tracks.map((track) => {
    if (track.kind === "fixed") return track.size;
    if (totalWeight <= 0) return 0;
    return (remaining * (track.weight ?? 1)) / totalWeight;
  });

  let current = 0;
  return sizes.map((size) => {
    const resolved = { start: current, size };
    current += size + gap;
    return resolved;
  });
}

function resolveGridChildRect(parentRect: Rect, childNode: LayoutDocument["nodes"][NodeId], columns: ResolvedGridTrack[], rows: ResolvedGridTrack[], columnGap: number, rowGap: number, content: Rect): Rect {
  if (childNode.frame.kind !== "cell") {
    throw new MachinaLayoutError("GridChildMustBeCell", `grid child must use cell frame: ${childNode.id}`);
  }
  const { row, col } = childNode.frame;
  const rowSpan = childNode.frame.rowSpan ?? 1;
  const colSpan = childNode.frame.colSpan ?? 1;
  if (!Number.isInteger(row) || row < 0 || !Number.isInteger(col) || col < 0 || !Number.isInteger(rowSpan) || rowSpan <= 0 || !Number.isInteger(colSpan) || colSpan <= 0) {
    throw new MachinaLayoutError("InvalidGridCell", `invalid cell coordinates/spans for node ${childNode.id}`);
  }
  if (row + rowSpan > rows.length || col + colSpan > columns.length) {
    throw new MachinaLayoutError("InvalidGridCell", `cell exceeds grid bounds for node ${childNode.id}`);
  }

  const x = content.x + columns[col].start;
  const y = content.y + rows[row].start;
  let width = columnGap * (colSpan - 1);
  for (let i = col; i < col + colSpan; i += 1) width += columns[i].size;
  let height = rowGap * (rowSpan - 1);
  for (let i = row; i < row + rowSpan; i += 1) height += rows[i].size;
  return { x, y, width, height };
}


export function resolveLayoutDocument(document: LayoutDocument, rootRect: Rect): ResolvedLayoutDocument {
  validateRootRect(rootRect);

  const rootNode = document.nodes[document.rootId];
  if (!rootNode) {
    throw new MachinaLayoutError("MissingRoot", `root node not found for id: ${document.rootId}`);
  }

  const resolvedNodes: Record<NodeId, ResolvedLayoutNode> = {};
  const resolvedChildren: Record<NodeId, NodeId[]> = {};

  const visitState = new Map<NodeId, 0 | 1 | 2>();
  let visitedCount = 0;

  const resolveNode = (nodeId: NodeId, rect: Rect): void => {
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
      offset: node.offset,
    };

    const childIds = document.children[nodeId] ?? [];
    resolvedChildren[nodeId] = [...childIds];

    let childRects: Record<NodeId, Rect> | undefined;
    if (node.arrange?.kind === "stack") {
      childRects = resolveStackChildRects(rect, node.arrange, childIds, document);
    } else if (node.arrange?.kind === "grid") {
      const columnGap = node.arrange.columnGap ?? 0;
      const rowGap = node.arrange.rowGap ?? 0;
      const padding = normalizePadding(node.arrange.padding);
      const content: Rect = {
        x: rect.x + padding.left,
        y: rect.y + padding.top,
        width: rect.width - padding.left - padding.right,
        height: rect.height - padding.top - padding.bottom,
      };
      if (content.width < 0 || content.height < 0) {
        throw new MachinaLayoutError("GridContentNegative", "grid content size cannot be negative after applying padding");
      }
      const columns = resolveGridTracks(content.width, node.arrange.columns, columnGap, "columns");
      const rows = resolveGridTracks(content.height, node.arrange.rows, rowGap, "rows");
      childRects = {};
      for (const childId of childIds) {
        const childNode = document.nodes[childId];
        if (!childNode) {
          throw new MachinaLayoutError("UnknownParent", `child id ${childId} referenced by ${nodeId} is missing`);
        }
        childRects[childId] = resolveGridChildRect(rect, childNode, columns, rows, columnGap, rowGap, content);
      }
    }

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
    children: resolvedChildren,
  };
}
