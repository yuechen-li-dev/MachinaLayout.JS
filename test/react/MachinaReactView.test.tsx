/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LayoutRow, Rect, ResolvedLayoutDocument, ResolvedLayoutNode } from "../../src";
import { MachinaReactView, resolveLayoutRows } from "../../src";

function makeLayout(rootRect: Rect, childRect: Rect): ResolvedLayoutDocument {
  return {
    rootId: "root",
    nodes: {
      root: { id: "root", rect: rootRect, frame: { kind: "absolute", ...rootRect } },
      child: { id: "child", rect: childRect, frame: { kind: "absolute", ...childRect }, slot: "Sidebar", debugLabel: "child-label" },
    },
    children: {
      root: ["child"],
      child: [],
    },
  };
}

describe("MachinaReactView", () => {
  it("renders without crashing", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 800, height: 600 }, { x: 16, y: 12, width: 100, height: 50 });
    const { container } = render(<MachinaReactView layout={layout} />);

    expect(container.firstElementChild).toBeInTheDocument();
    expect(container.querySelector('[data-machina-node-id="child"]')).toBeInTheDocument();
  });

  it("applies absolute styles from resolved rects", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 800, height: 600 }, { x: 16, y: 12, width: 100, height: 50 });
    render(<MachinaReactView layout={layout} />);

    const child = document.querySelector('[data-machina-node-id="child"]');
    expect(child).toHaveStyle({ position: "absolute", left: "16px", top: "12px", width: "100px", height: "50px", boxSizing: "border-box" });
  });

  it("normalizes coordinates relative to root origin", () => {
    const layout = makeLayout({ x: 100, y: 200, width: 800, height: 600 }, { x: 116, y: 212, width: 100, height: 50 });
    render(<MachinaReactView layout={layout} />);

    const child = document.querySelector('[data-machina-node-id="child"]');
    expect(child).toHaveStyle({ left: "16px", top: "12px" });
  });



  it("normalizes coordinates relative to immediate parent for nested descendants", () => {
    const layout: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 1100, height: 720 }, frame: { kind: "absolute", x: 0, y: 0, width: 1100, height: 720 } },
        main: { id: "main", rect: { x: 268, y: 88, width: 816, height: 616 }, frame: { kind: "absolute", x: 268, y: 88, width: 816, height: 616 } },
        toolbar: { id: "toolbar", rect: { x: 284, y: 104, width: 784, height: 48 }, frame: { kind: "absolute", x: 284, y: 104, width: 784, height: 48 } },
        "tool-run": { id: "tool-run", rect: { x: 292, y: 112, width: 90, height: 32 }, frame: { kind: "absolute", x: 292, y: 112, width: 90, height: 32 } },
      },
      children: {
        root: ["main"],
        main: ["toolbar"],
        toolbar: ["tool-run"],
        "tool-run": [],
      },
    };

    const { container } = render(<MachinaReactView layout={layout} />);

    expect(container.querySelector('[data-machina-node-id="main"]')).toHaveStyle({ left: "268px", top: "88px" });
    expect(container.querySelector('[data-machina-node-id="toolbar"]')).toHaveStyle({ left: "16px", top: "16px" });
    expect(container.querySelector('[data-machina-node-id="tool-run"]')).toHaveStyle({ left: "8px", top: "8px" });
  });

  it("normalizes nested coordinates correctly when root origin is non-zero", () => {
    const layout: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 100, y: 200, width: 800, height: 600 }, frame: { kind: "absolute", x: 100, y: 200, width: 800, height: 600 } },
        panel: { id: "panel", rect: { x: 150, y: 250, width: 300, height: 200 }, frame: { kind: "absolute", x: 150, y: 250, width: 300, height: 200 } },
        child: { id: "child", rect: { x: 175, y: 275, width: 50, height: 40 }, frame: { kind: "absolute", x: 175, y: 275, width: 50, height: 40 } },
      },
      children: { root: ["panel"], panel: ["child"], child: [] },
    };

    const { container } = render(<MachinaReactView layout={layout} />);

    expect(container.querySelector('[data-machina-node-id="panel"]')).toHaveStyle({ left: "50px", top: "50px" });
    expect(container.querySelector('[data-machina-node-id="child"]')).toHaveStyle({ left: "25px", top: "25px" });
  });

  it("outer wrapper uses root size", () => {
    const layout = makeLayout({ x: 100, y: 200, width: 800, height: 600 }, { x: 116, y: 212, width: 100, height: 50 });
    const { container } = render(<MachinaReactView layout={layout} />);

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveStyle({ position: "relative", width: "800px", height: "600px" });
  });

  it("renders slot component", () => {
    const received: { id?: string; rect?: Rect; debugLabel?: string; node?: ResolvedLayoutNode } = {};
    const Sidebar: React.FC<any> = (props) => {
      received.id = props.id;
      received.rect = props.rect;
      received.debugLabel = props.debugLabel;
      received.node = props.node;
      return <div>Sidebar slot {props.id}</div>;
    };
    const layout = makeLayout({ x: 0, y: 0, width: 800, height: 600 }, { x: 16, y: 12, width: 100, height: 50 });
    render(<MachinaReactView layout={layout} views={{ Sidebar }} />);

    expect(screen.getByText("Sidebar slot child")).toBeInTheDocument();
    expect(received.id).toBe("child");
    expect(received.rect).toEqual({ x: 16, y: 12, width: 100, height: 50 });
    expect(received.debugLabel).toBe("child-label");
    expect(received.node?.id).toBe("child");
  });

  it("missing slot component does not crash", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 800, height: 600 }, { x: 16, y: 12, width: 100, height: 50 });
    expect(() => render(<MachinaReactView layout={layout} views={{}} />)).not.toThrow();
    expect(document.querySelector('[data-machina-node-id="child"]')).toBeInTheDocument();
  });

  it("renders children even when parent has no slot", () => {
    const layout: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 300, height: 300 }, frame: { kind: "absolute", x: 0, y: 0, width: 300, height: 300 } },
        parent: { id: "parent", rect: { x: 10, y: 10, width: 100, height: 100 }, frame: { kind: "absolute", x: 10, y: 10, width: 100, height: 100 } },
        child: { id: "child", rect: { x: 12, y: 12, width: 50, height: 30 }, frame: { kind: "absolute", x: 12, y: 12, width: 50, height: 30 }, slot: "ChildSlot" },
      },
      children: { root: ["parent"], parent: ["child"], child: [] },
    };

    render(<MachinaReactView layout={layout} views={{ ChildSlot: ({ id }) => <span>slot-{id}</span> }} />);
    expect(screen.getByText("slot-child")).toBeInTheDocument();
  });

  it("preserves child order in DOM", () => {
    const layout: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 200, height: 100 }, frame: { kind: "absolute", x: 0, y: 0, width: 200, height: 100 } },
        a: { id: "a", rect: { x: 0, y: 0, width: 10, height: 10 }, frame: { kind: "absolute", x: 0, y: 0, width: 10, height: 10 } },
        b: { id: "b", rect: { x: 10, y: 0, width: 10, height: 10 }, frame: { kind: "absolute", x: 10, y: 0, width: 10, height: 10 } },
        c: { id: "c", rect: { x: 20, y: 0, width: 10, height: 10 }, frame: { kind: "absolute", x: 20, y: 0, width: 10, height: 10 } },
      },
      children: { root: ["b", "a", "c"], a: [], b: [], c: [] },
    };

    const { container } = render(<MachinaReactView layout={layout} />);
    const root = container.querySelector('[data-machina-node-id="root"]') as HTMLElement;
    const directIds = Array.from(root.children).map((el) => el.getAttribute("data-machina-node-id"));
    expect(directIds).toEqual(["b", "a", "c"]);
  });

  it("applies zIndex from node z", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 10, height: 10 });
    layout.nodes.child.z = 4;
    const { container } = render(<MachinaReactView layout={layout} />);
    expect(container.querySelector('[data-machina-node-id="child"]')?.getAttribute("style")).toContain("z-index: 4");
  });

  it("renders siblings sorted by z ascending", () => {
    const layout: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 200, height: 100 }, frame: { kind: "absolute", x: 0, y: 0, width: 200, height: 100 } },
        a: { id: "a", z: 5, rect: { x: 0, y: 0, width: 10, height: 10 }, frame: { kind: "absolute", x: 0, y: 0, width: 10, height: 10 } },
        b: { id: "b", z: -5, rect: { x: 10, y: 0, width: 10, height: 10 }, frame: { kind: "absolute", x: 10, y: 0, width: 10, height: 10 } },
        c: { id: "c", z: 0, rect: { x: 20, y: 0, width: 10, height: 10 }, frame: { kind: "absolute", x: 20, y: 0, width: 10, height: 10 } },
      },
      children: { root: ["a", "b", "c"], a: [], b: [], c: [] },
    };
    const { container } = render(<MachinaReactView layout={layout} />);
    const root = container.querySelector('[data-machina-node-id="root"]') as HTMLElement;
    const directIds = Array.from(root.children).map((el) => el.getAttribute("data-machina-node-id"));
    expect(directIds).toEqual(["b", "c", "a"]);
  });

  it("uses original sibling order as tie-break for same z", () => {
    const layout: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 200, height: 100 }, frame: { kind: "absolute", x: 0, y: 0, width: 200, height: 100 } },
        b: { id: "b", rect: { x: 0, y: 0, width: 10, height: 10 }, frame: { kind: "absolute", x: 0, y: 0, width: 10, height: 10 } },
        a: { id: "a", rect: { x: 10, y: 0, width: 10, height: 10 }, frame: { kind: "absolute", x: 10, y: 0, width: 10, height: 10 } },
        c: { id: "c", rect: { x: 20, y: 0, width: 10, height: 10 }, frame: { kind: "absolute", x: 20, y: 0, width: 10, height: 10 } },
      },
      children: { root: ["b", "a", "c"], a: [], b: [], c: [] },
    };
    const { container } = render(<MachinaReactView layout={layout} />);
    const root = container.querySelector('[data-machina-node-id="root"]') as HTMLElement;
    const directIds = Array.from(root.children).map((el) => el.getAttribute("data-machina-node-id"));
    expect(directIds).toEqual(["b", "a", "c"]);
  });

  it("does not mutate input child ordering while rendering z-sorted", () => {
    const layout: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 200, height: 100 }, frame: { kind: "absolute", x: 0, y: 0, width: 200, height: 100 } },
        a: { id: "a", z: 5, rect: { x: 0, y: 0, width: 10, height: 10 }, frame: { kind: "absolute", x: 0, y: 0, width: 10, height: 10 } },
        b: { id: "b", z: -5, rect: { x: 10, y: 0, width: 10, height: 10 }, frame: { kind: "absolute", x: 10, y: 0, width: 10, height: 10 } },
      },
      children: { root: ["a", "b"], a: [], b: [] },
    };
    render(<MachinaReactView layout={layout} />);
    expect(layout.children.root).toEqual(["a", "b"]);
  });

  it("uses default containment policy", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 10, height: 10 });
    render(<MachinaReactView layout={layout} />);
    expect(document.querySelector('[data-machina-node-id="child"]')).toHaveStyle({ contain: "layout paint" });
    expect(document.querySelector('[data-machina-node-id="child"]')?.getAttribute("style")).not.toContain("content-visibility");
  });

  it("supports nodeContainment none and strict", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 10, height: 10 });
    const { rerender, container } = render(<MachinaReactView layout={layout} nodeContainment="none" />);
    expect(container.querySelector('[data-machina-node-id="child"]')?.getAttribute("style")).not.toContain("contain:");

    rerender(<MachinaReactView layout={layout} nodeContainment="strict" />);
    expect(container.querySelector('[data-machina-node-id="child"]')).toHaveStyle({ contain: "strict" });
  });

  it("supports nodeContentVisibility auto and contain intrinsic size", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 10, height: 10 });
    const { container } = render(<MachinaReactView layout={layout} nodeContentVisibility="auto" nodeContainIntrinsicSize="auto 300px" />);
    const styleAttr = container.querySelector('[data-machina-node-id="child"]')?.getAttribute("style") ?? "";
    expect(styleAttr).toContain("content-visibility: auto");
    expect(styleAttr).toContain("contain-intrinsic-size: auto 300px");
  });

  it("containment policy does not change positioning", () => {
    const layout = makeLayout({ x: 100, y: 200, width: 800, height: 600 }, { x: 116, y: 212, width: 100, height: 50 });
    render(<MachinaReactView layout={layout} nodeContainment="strict" nodeContentVisibility="auto" />);
    expect(document.querySelector('[data-machina-node-id="child"]')).toHaveStyle({
      left: "16px",
      top: "12px",
      width: "100px",
      height: "50px",
    });
  });

  it("adds data attributes", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 800, height: 600 }, { x: 16, y: 12, width: 100, height: 50 });
    render(<MachinaReactView layout={layout} />);

    const child = document.querySelector('[data-machina-node-id="child"]');
    expect(child).toHaveAttribute("data-machina-node-id", "child");
    expect(child).toHaveAttribute("data-machina-slot", "Sidebar");
    expect(child).toHaveAttribute("data-machina-view", "Sidebar");
    expect(child).toHaveAttribute("data-machina-debug-label", "child-label");
  });

  it("debug mode adds visible affordance", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 800, height: 600 }, { x: 16, y: 12, width: 100, height: 50 });
    render(<MachinaReactView layout={layout} debug />);

    expect(screen.getByText("child-label")).toBeInTheDocument();
  });

  it("applies className/style/nodeClassName", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 800, height: 600 }, { x: 16, y: 12, width: 100, height: 50 });
    const { container } = render(<MachinaReactView layout={layout} className="root-class" style={{ overflow: "hidden" }} nodeClassName="node-class" />);

    expect(container.firstElementChild).toHaveClass("root-class");
    expect(container.firstElementChild).toHaveStyle({ overflow: "hidden" });
    const nodeClassed = container.querySelectorAll(".node-class");
    expect(nodeClassed.length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('[data-machina-node-id="child"]')).toHaveClass("node-class");
  });

  it("does not mutate input layout", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 800, height: 600 }, { x: 16, y: 12, width: 100, height: 50 });
    const snapshot = JSON.stringify(layout);
    render(<MachinaReactView layout={layout} />);
    expect(JSON.stringify(layout)).toBe(snapshot);
  });

  it("integrates with resolveLayoutRows output", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "fixed", width: 300, height: 200 }, arrange: { kind: "stack", axis: "horizontal", gap: 8 } },
      { id: "sidebar", parent: "root", frame: { kind: "fixed", width: 50, height: 50 }, slot: "Sidebar" },
    ];
    const resolved = resolveLayoutRows(rows, { x: 100, y: 200, width: 300, height: 200 });
    const Sidebar = vi.fn(({ id }: { id: string }) => <div>slot-{id}</div>);

    render(<MachinaReactView layout={resolved} views={{ Sidebar }} />);

    expect(screen.getByText("slot-sidebar")).toBeInTheDocument();
    expect(document.querySelector('[data-machina-node-id="sidebar"]')).toHaveStyle({ left: "0px", top: "0px" });
  });


  it("renders preferred view key", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 800, height: 600 }, { x: 16, y: 12, width: 100, height: 50 });
    layout.nodes.child.view = "Header";
    const Header = () => <div>header-view</div>;

    render(<MachinaReactView layout={layout} views={{ Header }} />);
    expect(screen.getByText("header-view")).toBeInTheDocument();
  });

  it("view wins when both view and slot are provided", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 800, height: 600 }, { x: 16, y: 12, width: 100, height: 50 });
    layout.nodes.child.view = "Preferred";
    layout.nodes.child.slot = "Fallback";

    render(<MachinaReactView layout={layout} views={{ Preferred: () => <div>Preferred</div>, Fallback: () => <div>Fallback</div> }} />);

    expect(screen.getByText("Preferred")).toBeInTheDocument();
    expect(screen.queryByText("Fallback")).not.toBeInTheDocument();
  });

  it("missing view does not crash and children still render", () => {
    const layout: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 100, height: 100 }, frame: { kind: "root" }, view: "Missing" },
        child: { id: "child", rect: { x: 0, y: 0, width: 20, height: 20 }, frame: { kind: "absolute", x: 0, y: 0, width: 20, height: 20 }, view: "Child" },
      },
      children: { root: ["child"], child: [] },
    };

    expect(() => render(<MachinaReactView layout={layout} views={{ Child: () => <div>child-view</div> }} />)).not.toThrow();
    expect(screen.getByText("child-view")).toBeInTheDocument();
  });

  it("node can render its own view and children", () => {
    const layout: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: { id: "root", rect: { x: 0, y: 0, width: 100, height: 100 }, frame: { kind: "root" } },
        panel: { id: "panel", rect: { x: 0, y: 0, width: 100, height: 100 }, frame: { kind: "absolute", x: 0, y: 0, width: 100, height: 100 }, view: "Panel" },
        button: { id: "button", rect: { x: 2, y: 2, width: 20, height: 10 }, frame: { kind: "absolute", x: 2, y: 2, width: 20, height: 10 }, view: "Button" },
      },
      children: { root: ["panel"], panel: ["button"], button: [] },
    };

    render(<MachinaReactView layout={layout} views={{ Panel: () => <div>Panel</div>, Button: () => <div>Button</div> }} />);
    expect(screen.getByText("Panel")).toBeInTheDocument();
    expect(screen.getByText("Button")).toBeInTheDocument();
  });
});
