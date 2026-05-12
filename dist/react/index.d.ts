import React from 'react';
import { b as ResolvedLayoutDocument, N as NodeId, R as Rect, a as ResolvedLayoutNode } from '../types-BudfpzZX.js';

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
};
declare function MachinaReactView(props: MachinaReactViewProps): React.JSX.Element;

export { MachinaReactView, type MachinaReactViewProps, type MachinaSlotProps };
