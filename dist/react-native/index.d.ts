import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { N as NodeId, R as Rect, a as ResolvedLayoutNode, b as ResolvedLayoutDocument } from '../types-BudfpzZX.js';

type MachinaNativeSlotProps<TViewData = unknown, TNodeData = unknown> = {
    id: NodeId;
    rect: Rect;
    debugLabel?: string;
    node: ResolvedLayoutNode;
    viewKey?: string;
    viewData?: TViewData;
    nodeData?: TNodeData;
};
type MachinaReactNativeLayer = {
    z: number;
};
type MachinaReactNativeViewProps = {
    layout: ResolvedLayoutDocument;
    views?: Record<string, React.ComponentType<MachinaNativeSlotProps>>;
    viewData?: Record<string, unknown>;
    nodeData?: Record<NodeId, unknown>;
    layers?: Record<string, MachinaReactNativeLayer>;
    defaultLayer?: string;
    debug?: boolean;
    style?: StyleProp<ViewStyle>;
    nodeStyle?: StyleProp<ViewStyle>;
};
declare function MachinaReactNativeView(props: MachinaReactNativeViewProps): React.ReactElement;

export { type MachinaNativeSlotProps, type MachinaReactNativeLayer, MachinaReactNativeView, type MachinaReactNativeViewProps };
