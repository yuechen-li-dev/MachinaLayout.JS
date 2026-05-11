import React from "react";
import renderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { ResolvedLayoutDocument } from "../../src";
import { MachinaReactNativeView } from "../../src/react-native";

vi.mock("react-native", () => ({
  View: ({ children, ...props }: any) => React.createElement("rn-view", props, children),
  Text: ({ children, ...props }: any) => React.createElement("rn-text", props, children),
}));

describe("MachinaReactNativeView", () => {
  it("renders and exports public api", async () => {
    expect(MachinaReactNativeView).toBeTypeOf("function");
  });

  it("applies numeric absolute styles and nested normalization", async () => {
    const layout: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 1100, height: 720 }, frame: { kind: "absolute", x: 0, y: 0, width: 1100, height: 720 } },
        main: { id: "main", rect: { x: 268, y: 88, width: 816, height: 616 }, frame: { kind: "absolute", x: 268, y: 88, width: 816, height: 616 } },
        toolbar: { id: "toolbar", rect: { x: 284, y: 104, width: 784, height: 48 }, frame: { kind: "absolute", x: 284, y: 104, width: 784, height: 48 } },
      },
      children: { root: ["main"], main: ["toolbar"], toolbar: [] },
    };
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<MachinaReactNativeView layout={layout} />);
    });
    const main = tree.root.findByProps({ testID: "machina-node-main" });
    const toolbar = tree.root.findByProps({ testID: "machina-node-toolbar" });
    expect(main.props.style[0]).toMatchObject({ position: "absolute", left: 268, top: 88, width: 816, height: 616 });
    expect(toolbar.props.style[0]).toMatchObject({ left: 16, top: 16 });
  });

  it("supports view/slot, view precedence, data, z sorting, debug and no mutation", async () => {
    const seen: any[] = [];
    const Panel = (props: any) => { seen.push(props); return React.createElement("rn-panel", { id: props.id }); };
    const Slot = () => React.createElement("rn-slot");
    const layout: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 100, y: 200, width: 800, height: 600 }, frame: { kind: "absolute", x: 100, y: 200, width: 800, height: 600 } },
        panel: { id: "panel", rect: { x: 150, y: 250, width: 300, height: 200 }, frame: { kind: "absolute", x: 150, y: 250, width: 300, height: 200 }, slot: "Slot", view: "Panel", layer: "overlay", z: 2 },
        child: { id: "child", rect: { x: 175, y: 275, width: 50, height: 40 }, frame: { kind: "absolute", x: 175, y: 275, width: 50, height: 40 }, slot: "Slot", layer: "missing", z: 1 },
      },
      children: { root: ["panel", "child"], panel: [], child: [] },
    };
    const before = JSON.stringify(layout);
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<MachinaReactNativeView layout={layout} debug views={{ Panel, Slot }} viewData={{ Panel: { value: 1 }, Slot: { value: 2 } }} nodeData={{ panel: { p: true } }} layers={{ base: { z: 0 }, overlay: { z: 3 } }} />);
    });
    const panel = tree.root.findByProps({ testID: "machina-node-panel" });
    const child = tree.root.findByProps({ testID: "machina-node-child" });
    expect(panel.props.style[0]).toMatchObject({ left: 50, top: 50, zIndex: 302 });
    expect(child.props.style[0]).toMatchObject({ left: 75, top: 75, zIndex: 1 });
    expect(panel.props.style[1]).toMatchObject({ borderWidth: 1 });
    expect(seen[0].viewKey).toBe("Panel");
    expect(seen[0].viewData).toEqual({ value: 1 });
    expect(seen[0].nodeData).toEqual({ p: true });
    expect(tree.root.findAll((n) => (n.type as any) === "rn-slot").length).toBe(1);
    expect(JSON.stringify(layout)).toBe(before);
  });
});
