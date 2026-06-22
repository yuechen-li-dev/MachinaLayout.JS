import React from 'react';
import { M as MachinaDebugOverlayMode } from './debugOverlay-fWLv1cS7.js';
import { R as ResolvedLayoutDocument, N as NodeId, a as Rect, b as ResolvedLayoutNode } from './types-CYgsjDai.js';

type MachinaSlotProps<TViewData = unknown, TNodeData = unknown> = {
    id: NodeId;
    rect: Rect;
    debugLabel?: string;
    node: ResolvedLayoutNode;
    viewKey?: string;
    viewData?: TViewData;
    nodeData?: TNodeData;
};
type MachinaRenderLayer = {
    z: number;
};
type MachinaReactDebugOverlayOptions = {
    mode?: MachinaDebugOverlayMode;
    labels?: boolean;
    borders?: boolean;
    selectedNodeId?: string;
};
type MachinaReactViewProps = {
    layout: ResolvedLayoutDocument;
    views?: Record<string, React.ComponentType<MachinaSlotProps>>;
    viewData?: Record<string, unknown>;
    nodeData?: Record<NodeId, unknown>;
    className?: string;
    style?: React.CSSProperties;
    nodeClassName?: string;
    debug?: boolean;
    nodeContainment?: "none" | "layout-paint" | "strict";
    nodeContentVisibility?: "none" | "auto";
    nodeContainIntrinsicSize?: string;
    layers?: Record<string, MachinaRenderLayer>;
    defaultLayer?: string;
    debugOverlay?: MachinaReactDebugOverlayOptions;
};
declare function MachinaReactView(props: MachinaReactViewProps): React.JSX.Element;

export { type MachinaReactDebugOverlayOptions as M, MachinaReactView as a, type MachinaReactViewProps as b, type MachinaSlotProps as c };
