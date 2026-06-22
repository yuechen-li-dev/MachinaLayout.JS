export { U as UseDeusMachineResult, u as useDeusMachine } from '../useDeusMachine-2w2u_dki.js';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { N as NodeId, a as Rect, b as ResolvedLayoutNode, R as ResolvedLayoutDocument } from '../types-CYgsjDai.js';
import '../types-CWaup8Z6.js';

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
