import React from "react";

import { toResolvedTree } from "../toResolvedTree";
import type { NodeId, Rect, ResolvedLayoutDocument, ResolvedLayoutNode, ResolvedLayoutTree } from "../types";

export type MachinaSlotProps = {
  id: NodeId;
  rect: Rect;
  debugLabel?: string;
  node: ResolvedLayoutNode;
};

export type MachinaReactViewProps = {
  layout: ResolvedLayoutDocument;
  views?: Record<string, React.ComponentType<MachinaSlotProps>>;
  className?: string;
  style?: React.CSSProperties;
  nodeClassName?: string;
  debug?: boolean;
  nodeContainment?: "none" | "layout-paint" | "strict";
  nodeContentVisibility?: "none" | "auto";
  nodeContainIntrinsicSize?: string;
};

function renderNode(
  node: ResolvedLayoutTree,
  rootRect: Rect,
  views: Record<string, React.ComponentType<MachinaSlotProps>>,
  nodeClassName: string | undefined,
  debug: boolean | undefined,
  nodeContainment: "none" | "layout-paint" | "strict",
  nodeContentVisibility: "none" | "auto",
  nodeContainIntrinsicSize: string | undefined,
  nodesById: ResolvedLayoutDocument["nodes"],
): React.ReactElement {
  const slotView = node.slot ? views[node.slot] : undefined;
  const left = node.rect.x - rootRect.x;
  const top = node.rect.y - rootRect.y;

  const style: React.CSSProperties = {
    position: "absolute",
    left,
    top,
    width: node.rect.width,
    height: node.rect.height,
    boxSizing: "border-box",
    zIndex: node.z ?? 0,
    ...(nodeContainment === "layout-paint" ? { contain: "layout paint" } : null),
    ...(nodeContainment === "strict" ? { contain: "strict" } : null),
    ...(nodeContentVisibility === "auto" ? { contentVisibility: "auto" } : null),
    ...(nodeContainIntrinsicSize !== undefined ? { containIntrinsicSize: nodeContainIntrinsicSize } : null),
    ...(debug ? { outline: "1px dashed rgba(59, 130, 246, 0.9)" } : null),
  };

  const renderedSlot =
    slotView && nodesById[node.id]
      ? React.createElement(slotView, {
          id: node.id,
          rect: { ...node.rect },
          debugLabel: node.debugLabel,
          node: { ...nodesById[node.id], rect: { ...nodesById[node.id].rect } },
        })
      : null;

  return (
    <div
      key={node.id}
      data-testid={`machina-node-${node.id}`}
      className={nodeClassName}
      style={style}
      data-machina-node-id={node.id}
      data-machina-slot={node.slot}
      data-machina-debug-label={node.debugLabel}
    >
      {debug ? <small>{node.debugLabel ?? node.id}</small> : null}
      {renderedSlot}
      {[...node.children]
        .map((child, index) => ({ child, index }))
        .sort((a, b) => (a.child.z ?? 0) - (b.child.z ?? 0) || a.index - b.index)
        .map(({ child }) =>
          renderNode(
            child,
            rootRect,
            views,
            nodeClassName,
            debug,
            nodeContainment,
            nodeContentVisibility,
            nodeContainIntrinsicSize,
            nodesById
          )
        )}
    </div>
  );
}

/**
 * Renders resolved nodes in a root-local coordinate space.
 *
 * Coordinates are normalized relative to the resolved root rect origin
 * (`node.rect.x - root.rect.x`, `node.rect.y - root.rect.y`) so the output
 * embeds cleanly in local React trees even when root rect x/y is non-zero.
 */
export function MachinaReactView(props: MachinaReactViewProps): React.JSX.Element {
  const {
    layout,
    views = {},
    className,
    style,
    nodeClassName,
    debug,
    nodeContainment = "layout-paint",
    nodeContentVisibility = "none",
    nodeContainIntrinsicSize,
  } = props;
  const tree = toResolvedTree(layout);

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    width: tree.rect.width,
    height: tree.rect.height,
    ...style,
  };

  return (
    <div className={className} style={wrapperStyle} data-machina-root-id={tree.id}>
      {renderNode(
        tree,
        tree.rect,
        views,
        nodeClassName,
        debug,
        nodeContainment,
        nodeContentVisibility,
        nodeContainIntrinsicSize,
        layout.nodes
      )}
    </div>
  );
}
