export type NodeId = string;

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AbsoluteFrame = {
  kind: "absolute";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnchorFrame = {
  kind: "anchor";
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  width?: number;
  height?: number;
};

export type RootFrame = {
  kind: "root";
};

export type FixedFrame = {
  kind: "fixed";
  width: number;
  height: number;
};

export type FrameSpec = RootFrame | AbsoluteFrame | AnchorFrame | FixedFrame;

export type StackAxis = "horizontal" | "vertical";

export type StackJustify = "start" | "center" | "end" | "space-between";

export type StackAlign = "start" | "center" | "end";

export type EdgeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type StackArrange = {
  kind: "stack";
  axis: StackAxis;
  gap?: number;
  padding?: number | EdgeInsets;
  justify?: StackJustify;
  align?: StackAlign;
};

export type ArrangeSpec = StackArrange;

export type LayoutRow = {
  id: NodeId;
  parent?: NodeId;
  order?: number;
  z?: number;
  frame: FrameSpec;
  arrange?: ArrangeSpec;
  slot?: string;
  debugLabel?: string;
};

export type LayoutNode = {
  id: NodeId;
  z?: number;
  frame: FrameSpec;
  arrange?: ArrangeSpec;
  slot?: string;
  debugLabel?: string;
};

export type LayoutDocument = {
  rootId: NodeId;
  nodes: Record<NodeId, LayoutNode>;
  children: Record<NodeId, NodeId[]>;
};

export type ResolvedLayoutNode = {
  id: NodeId;
  z?: number;
  rect: Rect;
  frame: FrameSpec;
  arrange?: ArrangeSpec;
  slot?: string;
  debugLabel?: string;
};

export type ResolvedLayoutDocument = {
  rootId: NodeId;
  nodes: Record<NodeId, ResolvedLayoutNode>;
  children: Record<NodeId, NodeId[]>;
};


export type ResolvedLayoutTree = {
  id: NodeId;
  z?: number;
  rect: Rect;
  frame: FrameSpec;
  arrange?: ArrangeSpec;
  slot?: string;
  debugLabel?: string;
  children: ResolvedLayoutTree[];
};
