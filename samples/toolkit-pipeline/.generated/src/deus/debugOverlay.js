import { defineDeusMachine } from "./machine";
import { matchEnum } from "../match";
const collapsed = ["debugOverlay", "collapsed"];
const overlay = ["debugOverlay", "nonInteractiveOverlay"];
const panel = ["debugOverlay", "interactivePanel"];
export function createMachinaDebugOverlayMachine() {
    return defineDeusMachine({
        initial: collapsed,
        states: [
            {
                path: collapsed,
                onEnter: (b) => {
                    b.mode = "collapsed";
                    b.selectedNodeId = undefined;
                },
            },
            {
                path: overlay,
                onEnter: (b) => {
                    b.mode = "nonInteractiveOverlay";
                },
            },
            {
                path: panel,
                onEnter: (b) => {
                    b.mode = "interactivePanel";
                },
            },
        ],
        transitions: [
            { key: "collapsed.showOverlay", from: collapsed, event: "showOverlay", to: overlay },
            {
                key: "overlay.openPanel",
                from: overlay,
                event: "openPanel",
                to: panel,
                do: (b, e) => {
                    if (e.type === "openPanel")
                        b.selectedNodeId = e.nodeId;
                },
            },
            { key: "panel.showOverlay", from: panel, event: "showOverlay", to: overlay },
            { key: "overlay.collapse", from: overlay, event: "collapse", to: collapsed },
            { key: "panel.collapse", from: panel, event: "collapse", to: collapsed },
            {
                key: "overlay.toggleLabels",
                from: overlay,
                event: "toggleLabels",
                do: (b) => {
                    b.labels = !b.labels;
                },
            },
            {
                key: "panel.toggleLabels",
                from: panel,
                event: "toggleLabels",
                do: (b) => {
                    b.labels = !b.labels;
                },
            },
            {
                key: "overlay.toggleBorders",
                from: overlay,
                event: "toggleBorders",
                do: (b) => {
                    b.borders = !b.borders;
                },
            },
            {
                key: "panel.toggleBorders",
                from: panel,
                event: "toggleBorders",
                do: (b) => {
                    b.borders = !b.borders;
                },
            },
            {
                key: "panel.selectNode",
                from: panel,
                event: "selectNode",
                do: (b, e) => {
                    if (e.type === "selectNode")
                        b.selectedNodeId = e.nodeId;
                },
            },
        ],
    });
}
export function getMachinaDebugOverlayBehavior(board) {
    return matchEnum(board.mode, {
        collapsed: () => ({
            visible: false,
            pointerEvents: "none",
            consumesLayoutSpace: false,
            showPanel: false,
            showLabels: false,
            showBorders: false,
        }),
        nonInteractiveOverlay: () => ({
            visible: true,
            pointerEvents: "none",
            consumesLayoutSpace: false,
            showPanel: false,
            showLabels: board.labels,
            showBorders: board.borders,
        }),
        interactivePanel: () => ({
            visible: true,
            pointerEvents: "auto",
            consumesLayoutSpace: true,
            showPanel: true,
            showLabels: board.labels,
            showBorders: board.borders,
        }),
    });
}
