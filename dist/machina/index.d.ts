import { L as LayoutRow, A as ArrangeSpec, c as LayoutRowVariant, F as FrameSpec, U as UiLength } from '../types-CnwWk0HF.js';

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

type MachinaAuthoringErrorCode = "InvalidNodeId" | "DuplicateNodeId" | "InvalidAuthoringTree" | "InvalidStackChild" | "InvalidFixedFrameContext" | "InvalidSpaceNode" | "InvalidAnchorFrame" | "InvalidLength" | "InvalidVariant";
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
};

export { type AnchorOptions, type FillNodeOptions, type FixedNodeOptions, M, MachinaAuthoringError, type MachinaAuthoringErrorCode, type MachinaLowerContext, type MachinaNode, type MachinaNodeId, type MachinaStackAxis, type NodeOptions, type RootOptions, type StackContainerOptions, type StackOptions, type VariantCondition, type VariantOverrides, anchor, fill, fixed, hstack, makeNode, node, px, root, rows, space, stackArrange, ui, vstack, when };
