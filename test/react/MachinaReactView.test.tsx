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

  it("adds data attributes", () => {
    const layout = makeLayout({ x: 0, y: 0, width: 800, height: 600 }, { x: 16, y: 12, width: 100, height: 50 });
    render(<MachinaReactView layout={layout} />);

    const child = document.querySelector('[data-machina-node-id="child"]');
    expect(child).toHaveAttribute("data-machina-node-id", "child");
    expect(child).toHaveAttribute("data-machina-slot", "Sidebar");
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
});
