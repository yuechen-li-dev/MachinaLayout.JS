import { E as EdgeInsets, U as UiLength, R as Rect, O as OffsetSpec, L as LayoutRow, c as LayoutDocument, F as FrameSpec, b as ResolvedLayoutDocument, d as ResolvedLayoutTree, a as ResolvedLayoutNode } from './types-BudfpzZX.js';
export { A as AbsoluteFrame, e as AnchorFrame, f as ArrangeSpec, C as CellFrame, g as EdgeRef, h as FillFrame, i as FixedFrame, G as GridArrange, j as GridTrack, k as GuideFrame, l as GuideLength, m as LayerName, n as LayoutNode, o as LayoutRowVariant, p as LayoutVariantCondition, N as NodeId, q as RectEdge, r as RootFrame, S as StackAlign, s as StackArrange, t as StackAxis, u as StackJustify } from './types-BudfpzZX.js';
export { MachinaReactView, MachinaReactViewProps, MachinaSlotProps } from './react/index.js';
export { c as MachinaBulletItem, d as MachinaInline, e as MachinaTextAlign, f as MachinaTextBlock, g as MachinaTextDiagnostic, h as MachinaTextDiagnosticCode, i as MachinaTextDiagnosticLevel, b as MachinaTextDocument, j as MachinaTextLeading, k as MachinaTextOverflow, a as MachinaTextSource, M as MachinaTextSpec, l as MachinaTextVariant, m as MachinaTextVerticalAlign, n as MachinaTextWrap, P as ParseMachinaTextResult } from './types-C4poVJpR.js';
export { parseMachinaText, parseMachinaTextInline } from './text/index.js';
export { MachinaTextView, MachinaTextViewProps } from './text/react/index.js';
export { MachinaVueTextView, MachinaVueTextViewProps } from './text/vue/index.js';
import 'react';
import 'vue';

type MachinaLayoutErrorCode = "EmptyRows" | "MissingRoot" | "MultipleRoots" | "DuplicateId" | "InvalidId" | "MissingParent" | "UnknownParent" | "SelfParent" | "Cycle" | "UnreachableNode" | "NonFiniteNumber" | "InvalidLengthUnit" | "InvalidZ" | "InvalidVariantCondition" | "NegativeSize" | "NegativeGap" | "NegativePadding" | "InvalidAnchorHorizontal" | "InvalidAnchorVertical" | "NegativeResolvedSize" | "FixedFrameWithoutArranger" | "FillFrameWithoutArranger" | "InvalidFillWeight" | "StackChildMustBeFixed" | "StackContentNegative" | "StackOverflow" | "CellFrameWithoutGrid" | "GridChildMustBeCell" | "InvalidGridTrack" | "InvalidGridCell" | "GridContentNegative" | "GridOverflow" | "RootFrameNotRoot" | "RootFrameWithoutRoot" | "IncompatibleLayouts" | "GuideTargetNotFound" | "GuideSelfReference" | "GuideReferenceCycle" | "GuideInvalidEdgeForAxis" | "GuideTooManyReferencesPerAxis" | "InvalidGuideFrame" | "GuideTargetUnresolved";
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

declare function lerpNumber(a: number, b: number, t: number): number;
declare function lerpRect(a: Rect, b: Rect, t: number): Rect;
declare function lerpResolvedLayouts(a: ResolvedLayoutDocument, b: ResolvedLayoutDocument, t: number): ResolvedLayoutDocument;

export { EdgeInsets, FrameSpec, LayoutDocument, LayoutRow, MachinaLayoutError, type MachinaLayoutErrorCode, OffsetSpec, Rect, ResolvedLayoutDocument, ResolvedLayoutNode, ResolvedLayoutTree, UiLength, applyOffset, assertFiniteNumber, assertNonNegativeGap, assertNonNegativePadding, assertNonNegativeSize, compileLayoutRows, flattenResolvedTree, formatRect, lerpNumber, lerpRect, lerpResolvedLayouts, normalizePadding, resolveFrame, resolveLayoutDocument, resolveLayoutRows, resolveUiLength, selectLayoutRowsForRoot, toResolvedTree };
