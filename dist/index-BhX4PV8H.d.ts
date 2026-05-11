import React from 'react';

type NodeId = string;
type LayerName = string;
type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
type AbsoluteFrame = {
    kind: "absolute";
    x: number;
    y: number;
    width: number;
    height: number;
};
type UiLength = number | {
    unit: "px";
    value: number;
} | {
    unit: "ui";
    value: number;
};
type OffsetSpec = {
    x?: UiLength;
    y?: UiLength;
};
type RectEdge = "left" | "right" | "top" | "bottom" | "centerX" | "centerY";
type EdgeRef = {
    ref: NodeId;
    edge: RectEdge;
    offset?: UiLength;
};
type GuideLength = UiLength | EdgeRef;
type AnchorFrame = {
    kind: "anchor";
    left?: UiLength;
    right?: UiLength;
    top?: UiLength;
    bottom?: UiLength;
    width?: UiLength;
    height?: UiLength;
};
type GuideFrame = {
    kind: "guide";
    left?: GuideLength;
    right?: GuideLength;
    top?: GuideLength;
    bottom?: GuideLength;
    width?: UiLength;
    height?: UiLength;
};
type RootFrame = {
    kind: "root";
};
type FixedFrame = {
    kind: "fixed";
    width: number;
    height: number;
};
type FillFrame = {
    kind: "fill";
    weight?: number;
    cross?: number | "fill";
};
type CellFrame = {
    kind: "cell";
    col: number;
    row: number;
    colSpan?: number;
    rowSpan?: number;
};
type FrameSpec = RootFrame | AbsoluteFrame | AnchorFrame | FixedFrame | FillFrame | CellFrame | GuideFrame;
type StackAxis = "horizontal" | "vertical";
type StackJustify = "start" | "center" | "end" | "space-between";
type StackAlign = "start" | "center" | "end";
type EdgeInsets = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};
type StackArrange = {
    kind: "stack";
    axis: StackAxis;
    gap?: number;
    padding?: number | EdgeInsets;
    justify?: StackJustify;
    align?: StackAlign;
};
type GridTrack = {
    kind: "fixed";
    size: number;
} | {
    kind: "fill";
    weight?: number;
};
type GridArrange = {
    kind: "grid";
    columns: GridTrack[];
    rows: GridTrack[];
    columnGap?: number;
    rowGap?: number;
    padding?: number | EdgeInsets;
};
type ArrangeSpec = StackArrange | GridArrange;
type LayoutVariantCondition = {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
};
type LayoutRowVariant = {
    when: LayoutVariantCondition;
    frame?: FrameSpec;
    arrange?: ArrangeSpec;
    offset?: OffsetSpec;
    z?: number;
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: LayerName;
};
type LayoutRow = {
    id: NodeId;
    parent?: NodeId;
    order?: number;
    z?: number;
    frame: FrameSpec;
    arrange?: ArrangeSpec;
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: LayerName;
    offset?: OffsetSpec;
    variants?: LayoutRowVariant[];
};
type LayoutNode = {
    id: NodeId;
    z?: number;
    frame: FrameSpec;
    arrange?: ArrangeSpec;
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: LayerName;
    offset?: OffsetSpec;
};
type LayoutDocument = {
    rootId: NodeId;
    nodes: Record<NodeId, LayoutNode>;
    children: Record<NodeId, NodeId[]>;
};
type ResolvedLayoutNode = {
    id: NodeId;
    z?: number;
    rect: Rect;
    frame: FrameSpec;
    arrange?: ArrangeSpec;
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: LayerName;
    offset?: OffsetSpec;
};
type ResolvedLayoutDocument = {
    rootId: NodeId;
    nodes: Record<NodeId, ResolvedLayoutNode>;
    children: Record<NodeId, NodeId[]>;
};
type ResolvedLayoutTree = {
    id: NodeId;
    z?: number;
    rect: Rect;
    frame: FrameSpec;
    arrange?: ArrangeSpec;
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: LayerName;
    offset?: OffsetSpec;
    children: ResolvedLayoutTree[];
};

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

export { type AbsoluteFrame as A, type CellFrame as C, type EdgeInsets as E, type FrameSpec as F, type GridArrange as G, type LayoutRow as L, MachinaReactView as M, type NodeId as N, type OffsetSpec as O, type Rect as R, type StackAlign as S, type UiLength as U, type LayoutDocument as a, type ResolvedLayoutDocument as b, type ResolvedLayoutTree as c, type ResolvedLayoutNode as d, type AnchorFrame as e, type ArrangeSpec as f, type EdgeRef as g, type FillFrame as h, type FixedFrame as i, type GridTrack as j, type GuideFrame as k, type GuideLength as l, type LayerName as m, type LayoutNode as n, type LayoutRowVariant as o, type LayoutVariantCondition as p, type MachinaReactViewProps as q, type MachinaSlotProps as r, type RectEdge as s, type RootFrame as t, type StackArrange as u, type StackAxis as v, type StackJustify as w };
