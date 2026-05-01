import { MachinaLayoutError } from "./errors";
import { resolveFrame } from "./resolveFrame";
import type { LayoutDocument, NodeId, Rect, ResolvedLayoutDocument, ResolvedLayoutNode } from "./types";
import { assertFiniteNumber, assertNonNegativeSize } from "./validation";

function validateRootRect(rootRect: Rect): void {
  assertFiniteNumber(rootRect.x, "rootRect.x");
  assertFiniteNumber(rootRect.y, "rootRect.y");
  assertNonNegativeSize(rootRect.width, "rootRect.width");
  assertNonNegativeSize(rootRect.height, "rootRect.height");
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

  const resolveNode = (nodeId: NodeId, parentRect: Rect | undefined): void => {
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

    const rect =
      parentRect === undefined
        ? { x: rootRect.x, y: rootRect.y, width: rootRect.width, height: rootRect.height }
        : resolveFrame(parentRect, node.frame);

    resolvedNodes[nodeId] = {
      id: node.id,
      rect,
      frame: node.frame,
      arrange: node.arrange,
      slot: node.slot,
      debugLabel: node.debugLabel,
    };

    const childIds = document.children[nodeId] ?? [];
    resolvedChildren[nodeId] = [...childIds];

    for (const childId of childIds) {
      if (!document.nodes[childId]) {
        throw new MachinaLayoutError("UnknownParent", `child id ${childId} referenced by ${nodeId} is missing`);
      }
      resolveNode(childId, rect);
    }

    visitState.set(nodeId, 2);
  };

  resolveNode(document.rootId, undefined);

  if (visitedCount !== Object.keys(document.nodes).length) {
    throw new MachinaLayoutError("UnreachableNode", "one or more nodes are unreachable from the root.");
  }

  return {
    rootId: document.rootId,
    nodes: resolvedNodes,
    children: resolvedChildren,
  };
}
