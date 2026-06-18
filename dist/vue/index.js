import {
  toResolvedTree
} from "../chunk-SVWYWI7I.js";
import "../chunk-VREK57S3.js";

// src/vue/MachinaVueView.ts
import { computed, defineComponent, h } from "vue";
var normalizeLayerZ = (v) => v === void 0 || !Number.isFinite(v) || !Number.isInteger(v) || v < -5 || v > 5 ? 0 : v;
var getEffectiveLayer = (n, d) => n.layer ?? d;
var getEffectiveLayerZ = (n, l, d) => normalizeLayerZ(l[getEffectiveLayer(n, d)]?.z);
var MachinaVueView = defineComponent({
  name: "MachinaVueView",
  props: {
    layout: { type: Object, required: true },
    views: { type: Object, default: () => ({}) },
    viewData: { type: Object, default: () => ({}) },
    nodeData: { type: Object, default: () => ({}) },
    layers: {
      type: Object,
      default: () => ({ base: { z: 0 } })
    },
    defaultLayer: { type: String, default: "base" },
    debug: { type: Boolean, default: false },
    rootClass: { type: null, default: void 0 },
    rootStyle: { type: null, default: void 0 },
    nodeClass: { type: null, default: void 0 },
    nodeStyle: { type: null, default: void 0 },
    nodeContainment: {
      type: String,
      default: "layout-paint"
    },
    nodeContentVisibility: { type: String, default: "none" },
    nodeContainIntrinsicSize: { type: String, default: void 0 }
  },
  setup(props) {
    const tree = computed(() => toResolvedTree(props.layout));
    const renderNode = (node, parentRect) => {
      const viewKey = node.view ?? node.slot;
      const View = viewKey ? props.views[viewKey] : void 0;
      const left = node.rect.x - parentRect.x;
      const top = node.rect.y - parentRect.y;
      const layer = getEffectiveLayer(node, props.defaultLayer);
      const layerZ = getEffectiveLayerZ(node, props.layers, props.defaultLayer);
      const baseStyle = {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${node.rect.width}px`,
        height: `${node.rect.height}px`,
        boxSizing: "border-box",
        zIndex: `${layerZ * 100 + (node.z ?? 0)}`,
        ...props.nodeContainment === "layout-paint" ? { contain: "layout paint" } : null,
        ...props.nodeContainment === "strict" ? { contain: "strict" } : null,
        ...props.nodeContentVisibility === "auto" ? { contentVisibility: "auto" } : null,
        ...props.nodeContainIntrinsicSize !== void 0 ? { containIntrinsicSize: props.nodeContainIntrinsicSize } : null,
        ...props.debug ? { outline: "1px dashed rgba(59, 130, 246, 0.9)" } : null
      };
      const rendered = View && props.layout.nodes[node.id] ? h(View, {
        id: node.id,
        rect: { ...node.rect },
        debugLabel: node.debugLabel,
        node: {
          ...props.layout.nodes[node.id],
          rect: { ...props.layout.nodes[node.id].rect }
        },
        viewKey,
        viewData: viewKey ? props.viewData[viewKey] : void 0,
        nodeData: props.nodeData[node.id]
      }) : null;
      const kids = [...node.children].map((child, index) => ({ child, index })).sort(
        (a, b) => getEffectiveLayerZ(a.child, props.layers, props.defaultLayer) - getEffectiveLayerZ(b.child, props.layers, props.defaultLayer) || (a.child.z ?? 0) - (b.child.z ?? 0) || a.index - b.index
      ).map(({ child }) => renderNode(child, node.rect));
      return h(
        "div",
        {
          key: node.id,
          class: props.nodeClass,
          style: [baseStyle, props.nodeStyle],
          "data-machina-node-id": node.id,
          "data-machina-slot": node.slot,
          "data-machina-view": viewKey,
          "data-machina-debug-label": node.debugLabel,
          "data-machina-layer": layer
        },
        [props.debug ? h("small", {}, node.debugLabel ?? node.id) : null, rendered, ...kids]
      );
    };
    return () => {
      const root = tree.value;
      return h(
        "div",
        {
          class: props.rootClass,
          style: [
            {
              position: "relative",
              width: `${root.rect.width}px`,
              height: `${root.rect.height}px`,
              boxSizing: "border-box"
            },
            props.rootStyle
          ],
          "data-machina-root-id": root.id
        },
        [renderNode(root, root.rect)]
      );
    };
  }
});
export {
  MachinaVueView
};
