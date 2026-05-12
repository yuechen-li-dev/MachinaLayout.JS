import {
  toResolvedTree
} from "./chunk-TR24ERZT.js";

// src/react/MachinaReactView.tsx
import React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function normalizeLayerZ(value) {
  if (value === void 0 || !Number.isFinite(value) || !Number.isInteger(value) || value < -5 || value > 5) {
    return 0;
  }
  return value;
}
function getEffectiveLayer(node, defaultLayer) {
  return node.layer ?? defaultLayer;
}
function getEffectiveLayerZ(node, layers, defaultLayer) {
  const layerName = getEffectiveLayer(node, defaultLayer);
  return normalizeLayerZ(layers[layerName]?.z);
}
function renderNode(node, parentRect, views, viewData, nodeData, nodeClassName, debug, nodeContainment, nodeContentVisibility, nodeContainIntrinsicSize, nodesById, layers, defaultLayer) {
  const viewKey = node.view ?? node.slot;
  const View = viewKey ? views[viewKey] : void 0;
  const selectedViewData = viewKey ? viewData?.[viewKey] : void 0;
  const selectedNodeData = nodeData?.[node.id];
  const left = node.rect.x - parentRect.x;
  const top = node.rect.y - parentRect.y;
  const effectiveLayer = getEffectiveLayer(node, defaultLayer);
  const effectiveLayerZ = getEffectiveLayerZ(node, layers, defaultLayer);
  const style = {
    position: "absolute",
    left,
    top,
    width: node.rect.width,
    height: node.rect.height,
    boxSizing: "border-box",
    zIndex: effectiveLayerZ * 100 + (node.z ?? 0),
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
      "data-machina-layer": effectiveLayer,
      children: [
        debug ? /* @__PURE__ */ jsx("small", { children: node.debugLabel ?? node.id }) : null,
        renderedSlot,
        [...node.children].map((child, index) => ({ child, index })).sort(
          (a, b) => getEffectiveLayerZ(a.child, layers, defaultLayer) - getEffectiveLayerZ(b.child, layers, defaultLayer) || (a.child.z ?? 0) - (b.child.z ?? 0) || a.index - b.index
        ).map(
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
            nodesById,
            layers,
            defaultLayer
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
    nodeContainIntrinsicSize,
    layers = { base: { z: 0 } },
    defaultLayer = "base"
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
    layout.nodes,
    layers,
    defaultLayer
  ) });
}

export {
  MachinaReactView
};
