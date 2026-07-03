import { l as MachinaTextVariant, n as MachinaTextWrap, k as MachinaTextOverflow, e as MachinaTextAlign, j as MachinaTextLeading, m as MachinaTextVerticalAlign, M as MachinaTextSpec } from '../types-C4poVJpR.js';
import { L as LayoutRow, A as ArrangeSpec, o as LayoutRowVariant, F as FrameSpec, U as UiLength, k as GridTrack, E as EdgeInsets, q as RectEdge } from '../types-CYgsjDai.js';
import { b as MachinaScreen, M as MachinaViewport } from '../screenCatalog-ZjonGiOi.js';
import { D as DeusEvent, e as DeusMachine, b as DeusStatePath, g as DeusAction, i as DeusStateRow, j as DeusTransitionRow } from '../types-CWaup8Z6.js';
import { M as MachinaAtlasSection, a as MachinaAtlas } from '../types-CqWMheJe.js';

type TextOptions = {
    variant?: MachinaTextVariant;
    wrap?: MachinaTextWrap;
    overflow?: MachinaTextOverflow;
    align?: MachinaTextAlign;
    leading?: MachinaTextLeading;
    blockGap?: number;
    listGap?: number;
    valign?: MachinaTextVerticalAlign;
};
type MachinaTextBuilder = {
    (content: string, options?: TextOptions): MachinaTextSpec;
    plain(content: string, options?: TextOptions): MachinaTextSpec;
    mono(content: string, options?: TextOptions): MachinaTextSpec;
};
declare const text: MachinaTextBuilder;

type MachinaNodeId = string;
type MachinaStackAxis = "vertical" | "horizontal";
type MachinaLowerContext = {
    parentId?: MachinaNodeId;
    parentStackAxis?: MachinaStackAxis;
};
interface MachinaNode {
    readonly id: MachinaNodeId;
    rows(): LayoutRow[];
    lower(context?: MachinaLowerContext): LayoutRow[];
}

type StackOptions = {
    gap?: number;
    padding?: number | {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
    };
    justify?: "start" | "center" | "end" | "space-between";
    align?: "start" | "center" | "end";
};
type StackContainerOptions = StackOptions & {
    parent?: MachinaNodeId;
    frame?: FrameSpec;
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: string;
    z?: number;
    variants?: readonly LayoutRowVariant[];
};
type FixedNodeOptions = {
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: string;
    z?: number;
    arrange?: ArrangeSpec;
    variants?: readonly LayoutRowVariant[];
};
type FillNodeOptions = FixedNodeOptions & {
    cross?: number | "fill";
};
declare function stackArrange(axis: MachinaStackAxis, options?: StackOptions): ArrangeSpec;
declare const vstack: (id: MachinaNodeId, options?: StackContainerOptions, children?: readonly MachinaNode[]) => MachinaNode;
declare const hstack: (id: MachinaNodeId, options?: StackContainerOptions, children?: readonly MachinaNode[]) => MachinaNode;
declare function fixed(id: MachinaNodeId, mainSize: number, viewOrOptions?: string | FixedNodeOptions, options?: FixedNodeOptions, children?: readonly MachinaNode[]): MachinaNode;
declare function fill(id: MachinaNodeId, weight?: number, viewOrOptions?: string | FillNodeOptions, options?: FillNodeOptions, children?: readonly MachinaNode[]): MachinaNode;
declare function space(id: MachinaNodeId, weight?: number): MachinaNode;

type MachinaAuthoringErrorCode = "InvalidNodeId" | "DuplicateNodeId" | "InvalidAuthoringTree" | "InvalidStackChild" | "InvalidFixedFrameContext" | "InvalidSpaceNode" | "InvalidAnchorFrame" | "InvalidLength" | "InvalidVariant" | "InvalidGridTrack" | "InvalidGridMatrix" | "GridMatrixOverlap" | "GridMatrixOutOfBounds" | "InvalidGridArea" | "InvalidGuideFrame" | "InvalidGuideEdge" | "InvalidTextSpec" | "InvalidLayer" | "InvalidScreen";
declare class MachinaAuthoringError extends Error {
    readonly code: MachinaAuthoringErrorCode;
    constructor(code: MachinaAuthoringErrorCode, message: string);
}

type NodeOptions = Omit<LayoutRow, "id" | "parent" | "variants"> & {
    parent?: MachinaNodeId;
    variants?: readonly LayoutRowVariant[];
};
type RootOptions = Omit<NodeOptions, "frame" | "parent">;
type LowerRow = (context?: MachinaLowerContext) => LayoutRow;
declare function makeNode(id: MachinaNodeId, lowerRow: LowerRow, children?: readonly MachinaNode[]): MachinaNode;
declare function node(id: MachinaNodeId, options: NodeOptions, children?: readonly MachinaNode[]): MachinaNode;
declare function root(id: MachinaNodeId, options?: RootOptions, children?: readonly MachinaNode[]): MachinaNode;
declare function rows(node: MachinaNode): LayoutRow[];

type AnchorOptions = {
    left?: UiLength;
    right?: UiLength;
    top?: UiLength;
    bottom?: UiLength;
    width?: UiLength;
    height?: UiLength;
    parent?: MachinaNodeId;
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: string;
    z?: number;
    arrange?: ArrangeSpec;
    variants?: readonly LayoutRowVariant[];
};
declare function anchor(id: MachinaNodeId, options: AnchorOptions, children?: readonly MachinaNode[]): MachinaNode;

declare function px(value: number): UiLength;
declare function ui(value: number): UiLength;

type VariantCondition = {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
};
type VariantOverrides = {
    frame?: FrameSpec;
    arrange?: ArrangeSpec;
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: string;
    z?: number;
};
declare function when(condition: VariantCondition, overrides: VariantOverrides): LayoutRowVariant;

type MachinaGridTrack = GridTrack;
type CellOptions = {
    colSpan?: number;
    rowSpan?: number;
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: string;
    z?: number;
    arrange?: ArrangeSpec;
    variants?: readonly LayoutRowVariant[];
};
type GridAreaOptions = CellOptions;
interface MachinaGridArea {
    readonly kind: "area";
    readonly id: MachinaNodeId;
    readonly options: GridAreaOptions;
    readonly children: readonly MachinaNode[];
}
interface MachinaGridSkip {
    readonly kind: "skip";
    readonly span?: number;
}
type MachinaGridMatrixItem = MachinaGridArea | MachinaGridSkip;
interface MachinaGridRows {
    readonly kind: "gridRows";
    readonly rows: readonly (readonly MachinaGridMatrixItem[])[];
}
type GridOptions = {
    columns: readonly MachinaGridTrack[];
    rows: readonly MachinaGridTrack[];
    columnGap?: number;
    rowGap?: number;
    padding?: number | Partial<EdgeInsets>;
    parent?: MachinaNodeId;
    frame?: FrameSpec;
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: string;
    z?: number;
    variants?: readonly LayoutRowVariant[];
};
declare function trackFixed(size: number): MachinaGridTrack;
declare function trackFill(weight?: number): MachinaGridTrack;
declare function cell(id: MachinaNodeId, col: number, row: number, options?: CellOptions, children?: readonly MachinaNode[]): MachinaNode;
declare function area(id: MachinaNodeId, options?: GridAreaOptions, children?: readonly MachinaNode[]): MachinaGridArea;
declare function skip(span?: number): MachinaGridSkip;
declare function gridRows(rows: readonly (readonly MachinaGridMatrixItem[])[]): MachinaGridRows;
declare function grid(id: MachinaNodeId, options: GridOptions, children?: MachinaGridRows | readonly MachinaNode[]): MachinaNode;

type MachinaGuideEdgeName = RectEdge;
type MachinaGuideEdgeRef = {
    ref: MachinaNodeId;
    edge: MachinaGuideEdgeName;
    offset?: UiLength;
};
declare function edge(ref: MachinaNodeId, edge: MachinaGuideEdgeName, offset?: UiLength): MachinaGuideEdgeRef;
type GuideOptions = {
    left?: UiLength | MachinaGuideEdgeRef;
    right?: UiLength | MachinaGuideEdgeRef;
    top?: UiLength | MachinaGuideEdgeRef;
    bottom?: UiLength | MachinaGuideEdgeRef;
    width?: UiLength;
    height?: UiLength;
    parent?: MachinaNodeId;
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: string;
    z?: number;
    arrange?: ArrangeSpec;
    variants?: readonly LayoutRowVariant[];
};
declare function guide(id: MachinaNodeId, options: GuideOptions, children?: readonly MachinaNode[]): MachinaNode;

type MachinaLayerMap = Record<string, {
    z: number;
}>;
declare function onLayer(name: string): string;
declare function defineLayers<T extends MachinaLayerMap>(layers: T): T;

type MachinaScreenLayoutBuilder = (viewport: MachinaViewport) => LayoutRow[];
type MachinaScreenDefinition = MachinaScreen & {
    layout?: MachinaScreenLayoutBuilder;
};
type ScreenOptions = Omit<MachinaScreenDefinition, "key">;
declare function screen(key: string, definition: ScreenOptions): MachinaScreenDefinition;

type MachinaStateOptions<TBoard, TEvent extends DeusEvent> = {
    onEnter?: DeusAction<TBoard, TEvent>;
    onExit?: DeusAction<TBoard, TEvent>;
};
type MachinaOnOptions<TBoard, TEvent extends DeusEvent> = {
    key?: string;
    when?: (board: TBoard, event: TEvent) => boolean;
    score?: number | ((board: TBoard, event: TEvent) => number);
    reason?: string | ((board: TBoard, event: TEvent) => string);
};
type MachinaChooseCandidate<TBoard, TEvent extends DeusEvent> = {
    key: string;
    when?: (board: TBoard, event: TEvent) => boolean;
    score: number | ((board: TBoard, event: TEvent) => number);
    reason?: string | ((board: TBoard, event: TEvent) => string);
    do?: DeusAction<TBoard, TEvent>;
};
type MachinaChooseOptions<TBoard, TEvent extends DeusEvent> = MachinaOnOptions<TBoard, TEvent> & {
    hysteresis?: {
        previous: (board: TBoard) => string | undefined;
        margin: number;
    };
    do?: DeusAction<TBoard, TEvent>;
};
declare function state<TBoard, TEvent extends DeusEvent>(path: DeusStatePath, options?: MachinaStateOptions<TBoard, TEvent>): DeusStateRow<TBoard, TEvent>;
declare function on<TBoard, TEvent extends DeusEvent>(eventType: TEvent["type"], from: DeusStatePath, to: DeusStatePath | ((board: TBoard, event: TEvent) => DeusStatePath), action?: DeusAction<TBoard, TEvent>, options?: MachinaOnOptions<TBoard, TEvent>): DeusTransitionRow<TBoard, TEvent>;
declare function choose<TBoard, TEvent extends DeusEvent>(eventType: TEvent["type"], from: DeusStatePath, to: DeusStatePath | ((board: TBoard, event: TEvent) => DeusStatePath), candidates: readonly MachinaChooseCandidate<TBoard, TEvent>[], options?: MachinaChooseOptions<TBoard, TEvent>): DeusTransitionRow<TBoard, TEvent>;
declare function machine<TBoard, TEvent extends DeusEvent>(definition: DeusMachine<TBoard, TEvent>): DeusMachine<TBoard, TEvent>;

type MachinaSectionOptions = Omit<MachinaAtlasSection, "key">;
declare function section(key: string, options: MachinaSectionOptions): MachinaAtlasSection;
type MachinaAtlasOptions = {
    app: string;
    sections?: readonly MachinaAtlasSection[];
    tags?: readonly string[];
    notes?: string;
    metadata?: Record<string, unknown>;
};
declare function atlas(options: MachinaAtlasOptions): MachinaAtlas;

declare const M: {
    readonly node: typeof node;
    readonly root: typeof root;
    readonly vstack: (id: MachinaNodeId, options?: StackContainerOptions, children?: readonly MachinaNode[]) => MachinaNode;
    readonly hstack: (id: MachinaNodeId, options?: StackContainerOptions, children?: readonly MachinaNode[]) => MachinaNode;
    readonly stackArrange: typeof stackArrange;
    readonly fixed: typeof fixed;
    readonly fill: typeof fill;
    readonly space: typeof space;
    readonly anchor: typeof anchor;
    readonly px: typeof px;
    readonly ui: typeof ui;
    readonly when: typeof when;
    readonly rows: typeof rows;
    readonly grid: typeof grid;
    readonly gridRows: typeof gridRows;
    readonly area: typeof area;
    readonly skip: typeof skip;
    readonly cell: typeof cell;
    readonly trackFixed: typeof trackFixed;
    readonly trackFill: typeof trackFill;
    readonly edge: typeof edge;
    readonly guide: typeof guide;
    readonly text: {
        (content: string, options?: TextOptions): MachinaTextSpec;
        plain(content: string, options?: TextOptions): MachinaTextSpec;
        mono(content: string, options?: TextOptions): MachinaTextSpec;
    };
    readonly onLayer: typeof onLayer;
    readonly defineLayers: typeof defineLayers;
    readonly screen: typeof screen;
    readonly machine: typeof machine;
    readonly state: typeof state;
    readonly on: typeof on;
    readonly choose: typeof choose;
    readonly section: typeof section;
    readonly atlas: typeof atlas;
};

export { type AnchorOptions, type CellOptions, type FillNodeOptions, type FixedNodeOptions, type GridAreaOptions, type GridOptions, type GuideOptions, M, type MachinaAtlasOptions, MachinaAuthoringError, type MachinaAuthoringErrorCode, type MachinaChooseCandidate, type MachinaChooseOptions, type MachinaGridArea, type MachinaGridMatrixItem, type MachinaGridRows, type MachinaGridSkip, type MachinaGridTrack, type MachinaGuideEdgeName, type MachinaGuideEdgeRef, type MachinaLayerMap, type MachinaLowerContext, type MachinaNode, type MachinaNodeId, type MachinaOnOptions, type MachinaScreenDefinition, type MachinaScreenLayoutBuilder, type MachinaSectionOptions, type MachinaStackAxis, type MachinaStateOptions, type NodeOptions, type RootOptions, type ScreenOptions, type StackContainerOptions, type StackOptions, type TextOptions, type VariantCondition, type VariantOverrides, anchor, area, atlas, cell, choose, defineLayers, edge, fill, fixed, grid, gridRows, guide, hstack, machine, makeNode, node, on, onLayer, px, root, rows, screen, section, skip, space, stackArrange, state, text, trackFill, trackFixed, ui, vstack, when };
