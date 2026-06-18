import React from 'react';
import { o as MachinaDebugOverlayMode } from '../debugOverlay-ae9DqI9R.js';
import { b as ResolvedLayoutDocument, N as NodeId, R as Rect, a as ResolvedLayoutNode } from '../types-B90jb3RW.js';

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

export { type MachinaReactDebugOverlayOptions, MachinaReactView, type MachinaReactViewProps, type MachinaSlotProps };
