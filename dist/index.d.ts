import { E as EdgeInsets, U as UiLength, R as Rect, O as OffsetSpec, L as LayoutRow, c as LayoutDocument, F as FrameSpec, b as ResolvedLayoutDocument, d as ResolvedLayoutTree, a as ResolvedLayoutNode, N as NodeId, e as LayerName, S as StackAxis, A as ArrangeSpec } from './types-B90jb3RW.js';
export { f as AbsoluteFrame, g as AnchorFrame, C as CellFrame, h as EdgeRef, i as FillFrame, j as FixedFrame, G as GridArrange, k as GridTrack, l as GuideFrame, m as GuideLength, n as LayoutNode, o as LayoutRowVariant, p as LayoutVariantCondition, q as RectEdge, r as RootFrame, s as StackAlign, t as StackArrange, u as StackJustify } from './types-B90jb3RW.js';
export { MachinaReactView, MachinaReactViewProps, MachinaSlotProps } from './react/index.js';
export { c as MachinaBulletItem, d as MachinaInline, e as MachinaTextAlign, f as MachinaTextBlock, g as MachinaTextDiagnostic, h as MachinaTextDiagnosticCode, i as MachinaTextDiagnosticLevel, b as MachinaTextDocument, j as MachinaTextLeading, k as MachinaTextOverflow, a as MachinaTextSource, M as MachinaTextSpec, l as MachinaTextVariant, m as MachinaTextVerticalAlign, n as MachinaTextWrap, P as ParseMachinaTextResult } from './types-C4poVJpR.js';
export { parseMachinaText, parseMachinaTextInline } from './text/index.js';
export { MachinaTextView, MachinaTextViewProps } from './text/react/index.js';
import 'react';

type MachinaLayoutErrorCode = "EmptyRows" | "MissingRoot" | "MultipleRoots" | "DuplicateId" | "InvalidId" | "MissingParent" | "UnknownParent" | "SelfParent" | "Cycle" | "UnreachableNode" | "NonFiniteNumber" | "InvalidLengthUnit" | "InvalidZ" | "InvalidVariantCondition" | "NegativeSize" | "NegativeGap" | "NegativePadding" | "InvalidAnchorHorizontal" | "InvalidAnchorVertical" | "NegativeResolvedSize" | "FixedFrameWithoutArranger" | "FillFrameWithoutArranger" | "InvalidFillWeight" | "StackChildMustBeFixed" | "StackContentNegative" | "StackOverflow" | "ExpectedStackArrange" | "StackQueryInvalidRange" | "CellFrameWithoutGrid" | "GridChildMustBeCell" | "InvalidGridTrack" | "InvalidGridCell" | "GridContentNegative" | "GridOverflow" | "RootFrameNotRoot" | "RootFrameWithoutRoot" | "IncompatibleLayouts" | "GuideTargetNotFound" | "GuideSelfReference" | "GuideReferenceCycle" | "GuideInvalidEdgeForAxis" | "GuideTooManyReferencesPerAxis" | "InvalidGuideFrame" | "GuideTargetUnresolved";
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

declare function selectLayoutRowsForRoot(rows: LayoutRow[], rootRect: Rect): LayoutRow[];

declare function resolveFrame(parent: Rect, frame: FrameSpec): Rect;

declare function resolveLayoutDocument(document: LayoutDocument, rootRect: Rect): ResolvedLayoutDocument;

declare function resolveLayoutRows(rows: LayoutRow[], rootRect: Rect): ResolvedLayoutDocument;

declare function toResolvedTree(document: ResolvedLayoutDocument): ResolvedLayoutTree;

declare function flattenResolvedTree(tree: ResolvedLayoutTree): ResolvedLayoutNode[];

declare function formatRect(rect: Rect): string;

type StackChildMetric = {
    id: NodeId;
    rect: Rect;
    mainStart: number;
    mainEnd: number;
    mainSize: number;
    crossStart: number;
    crossEnd: number;
    crossSize: number;
    frameKind: FrameSpec["kind"];
    z?: number;
    layer?: LayerName;
};
type StackMainAxisMetrics = {
    parentId: NodeId;
    axis: StackAxis;
    parentRect: Rect;
    contentRect: Rect;
    padding: EdgeInsets;
    gap: number;
    childIds: NodeId[];
    childMetrics: StackChildMetric[];
    contentMainSize: number;
    contentCrossSize: number;
    totalChildMainSize: number;
    totalGapSize: number;
    usedMainSize: number;
    unusedMainSize: number;
};
declare function getArrangeContentRect(parentRect: Rect, arrange?: ArrangeSpec): Rect;
declare function getStackContentRect(layout: ResolvedLayoutDocument, parentId: NodeId): Rect;
declare function getStackMainAxisMetrics(layout: ResolvedLayoutDocument, parentId: NodeId): StackMainAxisMetrics;
declare function getStackChildRects(layout: ResolvedLayoutDocument, parentId: NodeId): Record<NodeId, Rect>;
declare function getRemainingStackRect(layout: ResolvedLayoutDocument, options: {
    parentId: NodeId;
    afterChildren?: NodeId[];
    beforeChildren?: NodeId[];
}): Rect;

declare function lerpNumber(a: number, b: number, t: number): number;
declare function lerpRect(a: Rect, b: Rect, t: number): Rect;
declare function lerpResolvedLayouts(a: ResolvedLayoutDocument, b: ResolvedLayoutDocument, t: number): ResolvedLayoutDocument;

export { ArrangeSpec, EdgeInsets, FrameSpec, LayerName, LayoutDocument, LayoutRow, MachinaLayoutError, type MachinaLayoutErrorCode, NodeId, OffsetSpec, Rect, ResolvedLayoutDocument, ResolvedLayoutNode, ResolvedLayoutTree, StackAxis, type StackChildMetric, type StackMainAxisMetrics, UiLength, applyOffset, assertFiniteNumber, assertNonNegativeGap, assertNonNegativePadding, assertNonNegativeSize, compileLayoutRows, flattenResolvedTree, formatRect, getArrangeContentRect, getRemainingStackRect, getStackChildRects, getStackContentRect, getStackMainAxisMetrics, lerpNumber, lerpRect, lerpResolvedLayouts, normalizePadding, resolveFrame, resolveLayoutDocument, resolveLayoutRows, resolveUiLength, selectLayoutRowsForRoot, toResolvedTree };
