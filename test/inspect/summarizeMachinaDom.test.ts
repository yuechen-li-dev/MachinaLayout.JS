/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { summarizeMachinaDom } from "../../src/inspect";

function mockRect(element: Element, rect: { x: number; y: number; width: number; height: number }) {
  element.getBoundingClientRect = () => ({
    ...rect,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON: () => rect,
  });
}

describe("summarizeMachinaDom", () => {
  it("extracts Machina data attributes, rects, and hierarchy", () => {
    document.body.innerHTML = `<div data-machina-node-id="root" data-machina-view="Root" data-machina-layer="base"><div data-machina-node-id="child" data-machina-slot="Child" data-machina-debug-label="Child Label">Hello world</div></div>`;
    const root = document.querySelector('[data-machina-node-id="root"]')!;
    const child = document.querySelector('[data-machina-node-id="child"]')!;
    mockRect(root, { x: 1, y: 2, width: 300, height: 200 });
    mockRect(child, { x: 3, y: 4, width: 50, height: 20 });

    const summary = summarizeMachinaDom({ generatedAt: "2026-01-01T00:00:00.000Z" });

    expect(summary).toMatchObject({
      schemaVersion: 1,
      rootSelector: "[data-machina-node-id]",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(summary.nodes).toHaveLength(1);
    expect(summary.nodes[0]).toMatchObject({
      nodeId: "root",
      view: "Root",
      layer: "base",
      tagName: "div",
      rect: { x: 1, y: 2, width: 300, height: 200 },
    });
    expect(summary.nodes[0].children[0]).toMatchObject({
      nodeId: "child",
      slot: "Child",
      debugLabel: "Child Label",
      rect: { x: 3, y: 4, width: 50, height: 20 },
    });
  });

  it("reconstructs nearest matching ancestor hierarchy in DOM order", () => {
    document.body.innerHTML = `<section data-machina-node-id="root"><div><span data-machina-node-id="a"></span></div><div data-machina-node-id="b"><em data-machina-node-id="c"></em></div></section>`;
    const summary = summarizeMachinaDom(document.body);
    expect(summary.nodes.map((node) => node.nodeId)).toEqual(["root"]);
    expect(summary.nodes[0].children.map((node) => node.nodeId)).toEqual(["a", "b"]);
    expect(summary.nodes[0].children[1].children.map((node) => node.nodeId)).toEqual(["c"]);
  });

  it("normalizes and truncates text excerpts", () => {
    document.body.innerHTML = `<div data-machina-node-id="root">  Hello\n   spacious     world  </div>`;
    const summary = summarizeMachinaDom({ includeTextExcerpt: true, maxTextLength: 14 });
    expect(summary.nodes[0].textExcerpt).toBe("Hello spacious");
  });

  it("includes role and aria-label only when includeA11y is true", () => {
    document.body.innerHTML = `<button data-machina-node-id="button" role="switch" aria-label="Power"></button>`;
    expect(summarizeMachinaDom().nodes[0]).not.toHaveProperty("role");
    expect(summarizeMachinaDom({ includeA11y: true }).nodes[0]).toMatchObject({
      role: "switch",
      ariaLabel: "Power",
    });
  });

  it("supports custom selectors without requiring Machina node ids", () => {
    document.body.innerHTML = `<div data-inspect="yes" data-machina-view="Custom"></div>`;
    const summary = summarizeMachinaDom({ selector: "[data-inspect='yes']" });
    expect(summary.nodes[0]).toMatchObject({ view: "Custom", tagName: "div" });
  });

  it("does not mutate DOM", () => {
    document.body.innerHTML = `<div data-machina-node-id="root"><p>Stable</p></div>`;
    const before = document.body.innerHTML;
    summarizeMachinaDom({ includeTextExcerpt: true, includeA11y: true });
    expect(document.body.innerHTML).toBe(before);
  });
});
