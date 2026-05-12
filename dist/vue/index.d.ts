import * as vue from 'vue';
import { PropType, Component, StyleValue } from 'vue';
import { N as NodeId, R as Rect, a as ResolvedLayoutNode, b as ResolvedLayoutDocument } from '../types-BudfpzZX.js';

type MachinaVueSlotProps<TViewData = unknown, TNodeData = unknown> = {
    id: NodeId;
    rect: Rect;
    debugLabel?: string;
    node: ResolvedLayoutNode;
    viewKey?: string;
    viewData?: TViewData;
    nodeData?: TNodeData;
};
type MachinaVueLayer = {
    z: number;
};
type MachinaVueViewProps = {
    layout: ResolvedLayoutDocument;
    views?: Record<string, Component>;
    viewData?: Record<string, unknown>;
    nodeData?: Record<NodeId, unknown>;
    layers?: Record<string, MachinaVueLayer>;
    defaultLayer?: string;
    debug?: boolean;
    rootClass?: unknown;
    rootStyle?: StyleValue;
    nodeClass?: unknown;
    nodeStyle?: StyleValue;
    nodeContainment?: "none" | "layout-paint" | "strict";
    nodeContentVisibility?: "none" | "auto";
    nodeContainIntrinsicSize?: string;
};
declare const MachinaVueView: vue.DefineComponent<vue.ExtractPropTypes<{
    layout: {
        type: PropType<ResolvedLayoutDocument>;
        required: true;
    };
    views: {
        type: PropType<Record<string, Component>>;
        default: () => {};
    };
    viewData: {
        type: PropType<Record<string, unknown>>;
        default: () => {};
    };
    nodeData: {
        type: PropType<Record<NodeId, unknown>>;
        default: () => {};
    };
    layers: {
        type: PropType<Record<string, MachinaVueLayer>>;
        default: () => {
            base: {
                z: number;
            };
        };
    };
    defaultLayer: {
        type: StringConstructor;
        default: string;
    };
    debug: {
        type: BooleanConstructor;
        default: boolean;
    };
    rootClass: {
        type: PropType<unknown>;
        default: undefined;
    };
    rootStyle: {
        type: PropType<StyleValue>;
        default: undefined;
    };
    nodeClass: {
        type: PropType<unknown>;
        default: undefined;
    };
    nodeStyle: {
        type: PropType<StyleValue>;
        default: undefined;
    };
    nodeContainment: {
        type: PropType<"none" | "layout-paint" | "strict">;
        default: string;
    };
    nodeContentVisibility: {
        type: PropType<"none" | "auto">;
        default: string;
    };
    nodeContainIntrinsicSize: {
        type: StringConstructor;
        default: undefined;
    };
}>, () => vue.VNode<vue.RendererNode, vue.RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, vue.ComponentOptionsMixin, vue.ComponentOptionsMixin, {}, string, vue.PublicProps, Readonly<vue.ExtractPropTypes<{
    layout: {
        type: PropType<ResolvedLayoutDocument>;
        required: true;
    };
    views: {
        type: PropType<Record<string, Component>>;
        default: () => {};
    };
    viewData: {
        type: PropType<Record<string, unknown>>;
        default: () => {};
    };
    nodeData: {
        type: PropType<Record<NodeId, unknown>>;
        default: () => {};
    };
    layers: {
        type: PropType<Record<string, MachinaVueLayer>>;
        default: () => {
            base: {
                z: number;
            };
        };
    };
    defaultLayer: {
        type: StringConstructor;
        default: string;
    };
    debug: {
        type: BooleanConstructor;
        default: boolean;
    };
    rootClass: {
        type: PropType<unknown>;
        default: undefined;
    };
    rootStyle: {
        type: PropType<StyleValue>;
        default: undefined;
    };
    nodeClass: {
        type: PropType<unknown>;
        default: undefined;
    };
    nodeStyle: {
        type: PropType<StyleValue>;
        default: undefined;
    };
    nodeContainment: {
        type: PropType<"none" | "layout-paint" | "strict">;
        default: string;
    };
    nodeContentVisibility: {
        type: PropType<"none" | "auto">;
        default: string;
    };
    nodeContainIntrinsicSize: {
        type: StringConstructor;
        default: undefined;
    };
}>> & Readonly<{}>, {
    views: Record<string, Component>;
    viewData: Record<string, unknown>;
    nodeData: Record<string, unknown>;
    layers: Record<string, MachinaVueLayer>;
    defaultLayer: string;
    debug: boolean;
    rootClass: undefined;
    rootStyle: StyleValue;
    nodeClass: undefined;
    nodeStyle: StyleValue;
    nodeContainment: "none" | "layout-paint" | "strict";
    nodeContentVisibility: "none" | "auto";
    nodeContainIntrinsicSize: string;
}, {}, {}, {}, string, vue.ComponentProvideOptions, true, {}, any>;

export { type MachinaVueLayer, type MachinaVueSlotProps, MachinaVueView, type MachinaVueViewProps };
