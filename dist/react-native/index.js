import {
  toResolvedTree
} from "../chunk-LTYAYHGT.js";

// src/react-native/MachinaReactNativeView.tsx
import React from "react";
import { Text, View } from "react-native";
import { jsx, jsxs } from "react/jsx-runtime";
function normalizeLayerZ(value) {
  if (value === void 0 || !Number.isFinite(value)) return 0;
  return value;
}
function getLayerZ(node, layers, defaultLayer) {
  return normalizeLayerZ(layers[node.layer ?? defaultLayer]?.z);
}
function renderNode(node, parentRect, props) {
  const left = node.rect.x - parentRect.x;
  const top = node.rect.y - parentRect.y;
  const viewKey = node.view ?? node.slot;
  const ViewComponent = viewKey ? props.views[viewKey] : void 0;
  const layerZ = getLayerZ(node, props.layers, props.defaultLayer);
  const nodeZ = node.z ?? 0;
  return /* @__PURE__ */ jsxs(View, { testID: `machina-node-${node.id}`, style: [{ position: "absolute", left, top, width: node.rect.width, height: node.rect.height, zIndex: layerZ * 100 + nodeZ }, props.debug ? { borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.9)" } : null, props.nodeStyle], children: [
    props.debug ? /* @__PURE__ */ jsx(Text, { children: node.debugLabel ?? node.id }) : null,
    ViewComponent && props.nodes[node.id] && viewKey ? React.createElement(ViewComponent, { id: node.id, rect: { ...node.rect }, debugLabel: node.debugLabel, node: { ...props.nodes[node.id], rect: { ...props.nodes[node.id].rect } }, viewKey, viewData: props.viewData?.[viewKey], nodeData: props.nodeData?.[node.id] }) : null,
    [...node.children].map((child, index) => ({ child, index })).sort((a, b) => getLayerZ(a.child, props.layers, props.defaultLayer) - getLayerZ(b.child, props.layers, props.defaultLayer) || (a.child.z ?? 0) - (b.child.z ?? 0) || a.index - b.index).map(({ child }) => renderNode(child, node.rect, props))
  ] }, node.id);
}
function MachinaReactNativeView(props) {
  const tree = toResolvedTree(props.layout);
  return /* @__PURE__ */ jsx(View, { testID: "machina-root-wrapper", style: [{ position: "relative", width: tree.rect.width, height: tree.rect.height }, props.style], children: renderNode(tree, tree.rect, { views: props.views ?? {}, viewData: props.viewData, nodeData: props.nodeData, nodes: props.layout.nodes, layers: props.layers ?? { base: { z: 0 } }, defaultLayer: props.defaultLayer ?? "base", debug: props.debug, nodeStyle: props.nodeStyle }) });
}
export {
  MachinaReactNativeView
};
