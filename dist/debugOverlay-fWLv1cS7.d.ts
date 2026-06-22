import { e as DeusMachine } from './types-CWaup8Z6.js';

type MachinaDebugOverlayMode = "collapsed" | "nonInteractiveOverlay" | "interactivePanel";
type MachinaDebugOverlayBoard = {
    mode: MachinaDebugOverlayMode;
    labels: boolean;
    borders: boolean;
    selectedNodeId?: string;
};
type MachinaDebugOverlayEvent = {
    type: "showOverlay";
} | {
    type: "openPanel";
    nodeId?: string;
} | {
    type: "collapse";
} | {
    type: "toggleLabels";
} | {
    type: "toggleBorders";
} | {
    type: "selectNode";
    nodeId: string;
};
type MachinaDebugOverlayBehavior = {
    visible: boolean;
    pointerEvents: "none" | "auto";
    consumesLayoutSpace: boolean;
    showPanel: boolean;
    showLabels: boolean;
    showBorders: boolean;
};
declare function createMachinaDebugOverlayMachine(): DeusMachine<MachinaDebugOverlayBoard, MachinaDebugOverlayEvent>;
declare function getMachinaDebugOverlayBehavior(board: MachinaDebugOverlayBoard): MachinaDebugOverlayBehavior;

export { type MachinaDebugOverlayMode as M, type MachinaDebugOverlayBehavior as a, type MachinaDebugOverlayBoard as b, type MachinaDebugOverlayEvent as c, createMachinaDebugOverlayMachine as d, getMachinaDebugOverlayBehavior as g };
