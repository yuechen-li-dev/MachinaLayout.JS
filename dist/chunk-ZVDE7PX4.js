import {
  getMachinaDebugOverlayBehavior
} from "./chunk-2ZQ2RFFI.js";
import {
  toResolvedTree
} from "./chunk-SVWYWI7I.js";

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
function collectOverlayNodes(node) {
  return [node, ...node.children.flatMap((child) => collectOverlayNodes(child))];
}
function renderDebugOverlay(tree, options) {
  const board = {
    mode: options.mode ?? "collapsed",
    labels: options.labels ?? true,
    borders: options.borders ?? true,
    selectedNodeId: options.selectedNodeId
  };
  const behavior = getMachinaDebugOverlayBehavior(board);
  if (!behavior.visible) return null;
  const nodes = collectOverlayNodes(tree);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-testid": "machina-debug-overlay",
      "data-machina-debug-overlay-mode": board.mode,
      style: {
        position: "absolute",
        inset: 0,
        pointerEvents: behavior.pointerEvents,
        zIndex: 1e4,
        boxSizing: "border-box"
      },
      children: [
        nodes.map((node) => /* @__PURE__ */ jsx(
          "div",
          {
            "data-testid": `machina-debug-overlay-node-${node.id}`,
            "data-machina-debug-overlay-node-id": node.id,
            style: {
              position: "absolute",
              left: node.rect.x - tree.rect.x,
              top: node.rect.y - tree.rect.y,
              width: node.rect.width,
              height: node.rect.height,
              boxSizing: "border-box",
              border: behavior.showBorders ? "1px solid rgba(14, 165, 233, 0.9)" : "0",
              pointerEvents: behavior.pointerEvents
            },
            children: behavior.showLabels ? /* @__PURE__ */ jsx(
              "span",
              {
                style: {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  fontSize: 10,
                  lineHeight: "12px",
                  background: "rgba(14, 165, 233, 0.9)",
                  color: "white",
                  padding: "0 3px"
                },
                children: node.debugLabel ?? node.id
              }
            ) : null
          },
          node.id
        )),
        behavior.showPanel ? /* @__PURE__ */ jsxs(
          "div",
          {
            "data-testid": "machina-debug-overlay-panel",
            style: {
              position: "absolute",
              right: 8,
              top: 8,
              background: "rgba(15, 23, 42, 0.92)",
              color: "white",
              padding: 8
            },
            children: [
              "Debug overlay",
              board.selectedNodeId ? `: ${board.selectedNodeId}` : ""
            ]
          }
        ) : null
      ]
    }
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
    defaultLayer = "base",
    debugOverlay
  } = props;
  const tree = toResolvedTree(layout);
  const wrapperStyle = {
    position: "relative",
    width: tree.rect.width,
    height: tree.rect.height,
    ...style
  };
  return /* @__PURE__ */ jsxs("div", { className, style: wrapperStyle, "data-machina-root-id": tree.id, children: [
    renderNode(
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
    ),
    debugOverlay ? renderDebugOverlay(tree, debugOverlay) : null
  ] });
}

export {
  MachinaReactView
};
