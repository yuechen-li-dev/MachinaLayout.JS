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

export type { AbsoluteFrame as A, CellFrame as C, EdgeInsets as E, FrameSpec as F, GridArrange as G, LayoutRow as L, NodeId as N, OffsetSpec as O, Rect as R, StackAlign as S, UiLength as U, ResolvedLayoutNode as a, ResolvedLayoutDocument as b, LayoutDocument as c, ResolvedLayoutTree as d, AnchorFrame as e, ArrangeSpec as f, EdgeRef as g, FillFrame as h, FixedFrame as i, GridTrack as j, GuideFrame as k, GuideLength as l, LayerName as m, LayoutNode as n, LayoutRowVariant as o, LayoutVariantCondition as p, RectEdge as q, RootFrame as r, StackArrange as s, StackAxis as t, StackJustify as u };
