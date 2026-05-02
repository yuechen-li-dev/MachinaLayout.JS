import React from 'react';

type NodeId = string;
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
type AnchorFrame = {
    kind: "anchor";
    left?: UiLength;
    right?: UiLength;
    top?: UiLength;
    bottom?: UiLength;
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
type FrameSpec = RootFrame | AbsoluteFrame | AnchorFrame | FixedFrame | FillFrame;
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
type ArrangeSpec = StackArrange;
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
    offset?: OffsetSpec;
};
type LayoutNode = {
    id: NodeId;
    z?: number;
    frame: FrameSpec;
    arrange?: ArrangeSpec;
    view?: string;
    slot?: string;
    debugLabel?: string;
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
    offset?: OffsetSpec;
    children: ResolvedLayoutTree[];
};

type MachinaLayoutErrorCode = "EmptyRows" | "MissingRoot" | "MultipleRoots" | "DuplicateId" | "InvalidId" | "MissingParent" | "UnknownParent" | "SelfParent" | "Cycle" | "UnreachableNode" | "NonFiniteNumber" | "InvalidLengthUnit" | "InvalidZ" | "NegativeSize" | "NegativeGap" | "NegativePadding" | "InvalidAnchorHorizontal" | "InvalidAnchorVertical" | "NegativeResolvedSize" | "FixedFrameWithoutArranger" | "FillFrameWithoutArranger" | "InvalidFillWeight" | "StackChildMustBeFixed" | "StackContentNegative" | "StackOverflow" | "RootFrameNotRoot" | "RootFrameWithoutRoot";
declare class MachinaLayoutError extends Error {
    readonly code: MachinaLayoutErrorCode;
    constructor(code: MachinaLayoutErrorCode, message: string);
}

declare function assertFiniteNumber(value: number, fieldName: string): void;
declare function assertNonNegativeSize(value: number, fieldName: string): void;
declare function assertNonNegativeGap(value: number, fieldName?: string): void;
declare function assertNonNegativePadding(value: number, fieldName?: string): void;

declare function normalizePadding(padding?: number | EdgeInsets): EdgeInsets;

declare function resolveUiLength(length: UiLength, axisSize: number, fieldName?: string): number;

declare function applyOffset(rect: Rect, parentRect: Rect, offset?: OffsetSpec): Rect;

declare function compileLayoutRows(rows: LayoutRow[]): LayoutDocument;

declare function resolveFrame(parent: Rect, frame: FrameSpec): Rect;

declare function resolveLayoutDocument(document: LayoutDocument, rootRect: Rect): ResolvedLayoutDocument;

declare function resolveLayoutRows(rows: LayoutRow[], rootRect: Rect): ResolvedLayoutDocument;

declare function toResolvedTree(document: ResolvedLayoutDocument): ResolvedLayoutTree;

declare function flattenResolvedTree(tree: ResolvedLayoutTree): ResolvedLayoutNode[];

declare function formatRect(rect: Rect): string;

type MachinaSlotProps<TViewData = unknown, TNodeData = unknown> = {
    id: NodeId;
    rect: Rect;
    debugLabel?: string;
    node: ResolvedLayoutNode;
    viewKey?: string;
    viewData?: TViewData;
    nodeData?: TNodeData;
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
};
declare function MachinaReactView(props: MachinaReactViewProps): React.JSX.Element;

type MachinaTextSource = {
    kind: "plain";
    text: string;
} | {
    kind: "machina-text";
    text: string;
};
type MachinaTextVariant = "body" | "label" | "caption" | "title" | "mono";
type MachinaTextWrap = "word" | "none";
type MachinaTextOverflow = "clip" | "ellipsis" | "scroll";
type MachinaTextAlign = "start" | "center" | "end";
type MachinaTextLeading = "tight" | "normal" | "loose" | number;
type MachinaTextVerticalAlign = "top" | "center" | "bottom";
type MachinaTextSpec = {
    kind: "text";
    source: MachinaTextSource;
    variant?: MachinaTextVariant;
    wrap?: MachinaTextWrap;
    overflow?: MachinaTextOverflow;
    align?: MachinaTextAlign;
    leading?: MachinaTextLeading;
    blockGap?: number;
    listGap?: number;
    valign?: MachinaTextVerticalAlign;
};
type MachinaTextDocument = {
    blocks: MachinaTextBlock[];
};
type MachinaTextBlock = {
    kind: "paragraph";
    inline: MachinaInline[];
} | {
    kind: "bulletList";
    items: MachinaBulletItem[];
};
type MachinaBulletItem = {
    inline: MachinaInline[];
    children?: MachinaBulletItem[];
};
type MachinaInline = {
    kind: "text";
    text: string;
} | {
    kind: "strong";
    children: MachinaInline[];
} | {
    kind: "emphasis";
    children: MachinaInline[];
} | {
    kind: "code";
    text: string;
} | {
    kind: "link";
    href: string;
    children: MachinaInline[];
};
type MachinaTextDiagnosticLevel = "error" | "warning";
type MachinaTextDiagnosticCode = "unsupported_syntax" | "heading_forbidden" | "max_list_depth_exceeded" | "malformed_link" | "unclosed_inline" | "invalid_escape";
type MachinaTextDiagnostic = {
    code: MachinaTextDiagnosticCode;
    message: string;
    index: number;
    length: number;
    line: number;
    column: number;
    level: MachinaTextDiagnosticLevel;
};
type ParseMachinaTextResult = {
    ok: boolean;
    document: MachinaTextDocument;
    diagnostics: MachinaTextDiagnostic[];
};

declare function parseMachinaTextInline(text: string): {
    inline: MachinaInline[];
    diagnostics: MachinaTextDiagnostic[];
};
declare function parseMachinaText(source: MachinaTextSource | string): ParseMachinaTextResult;

type MachinaTextViewProps = {
    text: MachinaTextSpec | MachinaTextSource | MachinaTextDocument | string;
    className?: string;
    style?: React.CSSProperties;
    linkTarget?: React.HTMLAttributeAnchorTarget;
    onLinkClick?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
    showDiagnostics?: boolean;
};
declare function MachinaTextView(props: MachinaTextViewProps): React.JSX.Element;

export { type AbsoluteFrame, type AnchorFrame, type ArrangeSpec, type EdgeInsets, type FillFrame, type FixedFrame, type FrameSpec, type LayoutDocument, type LayoutNode, type LayoutRow, type MachinaBulletItem, type MachinaInline, MachinaLayoutError, type MachinaLayoutErrorCode, MachinaReactView, type MachinaReactViewProps, type MachinaSlotProps, type MachinaTextAlign, type MachinaTextBlock, type MachinaTextDiagnostic, type MachinaTextDiagnosticCode, type MachinaTextDiagnosticLevel, type MachinaTextDocument, type MachinaTextLeading, type MachinaTextOverflow, type MachinaTextSource, type MachinaTextSpec, type MachinaTextVariant, type MachinaTextVerticalAlign, MachinaTextView, type MachinaTextViewProps, type MachinaTextWrap, type NodeId, type OffsetSpec, type ParseMachinaTextResult, type Rect, type ResolvedLayoutDocument, type ResolvedLayoutNode, type ResolvedLayoutTree, type RootFrame, type StackAlign, type StackArrange, type StackAxis, type StackJustify, type UiLength, applyOffset, assertFiniteNumber, assertNonNegativeGap, assertNonNegativePadding, assertNonNegativeSize, compileLayoutRows, flattenResolvedTree, formatRect, normalizePadding, parseMachinaText, parseMachinaTextInline, resolveFrame, resolveLayoutDocument, resolveLayoutRows, resolveUiLength, toResolvedTree };
