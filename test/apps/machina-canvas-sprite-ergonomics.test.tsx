/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  getDefaultInspectorAccordionState,
  getSelectedSpriteFrameDatumTargets,
  getSelectedSpriteFramePreviewModel,
  getSelectedSpriteFrameState,
} from "../../apps/machina-canvas/src/App";
import { InspectorAccordionGroup } from "../../apps/machina-canvas/src/InspectorAccordionGroup";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import { applyCanvasCommands } from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  createGuideSidecarObject,
  parseGuideSidecarToml,
} from "../../apps/machina-canvas/src/guideSidecar";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
} from "../../apps/machina-canvas/src/spriteSidecar";

afterEach(() => {
  cleanup();
});

function AccordionHarness({
  children,
  id = "test",
  initialOpen = true,
  title = "Selected object",
}: {
  children: React.ReactNode;
  id?: string;
  initialOpen?: boolean;
  title?: string;
}) {
  const [open, setOpen] = React.useState(initialOpen);

  return (
    <InspectorAccordionGroup id={id} onOpenChange={setOpen} open={open} title={title}>
      {children}
    </InspectorAccordionGroup>
  );
}

const spriteToml = `
[atlas]
width = 64
height = 64

[frames."hero.idle"]
x = 2
y = 3
width = 16
height = 18
`;

const guideToml = `
[guide]
id = "sheet-guide"
target = "sheet"
units = "px"

[[regions]]
id = "hero"
kind = "sprite-region"
x = 0
y = 0
width = 24
height = 24

[[datums]]
id = "hero_left"
kind = "vertical"
x = 2
region = "hero"
`;

function createSpriteDocument() {
  const image: ImageObject = {
    id: "sheet",
    name: "Sheet",
    kind: "image",
    layerId: "sprites",
    visible: true,
    x: 20,
    y: 30,
    width: 64,
    height: 64,
    src: "/sheet.png",
    intrinsicWidth: 64,
    intrinsicHeight: 64,
  };
  const base: CanvasDocument = {
    id: "doc",
    name: "Sprite Doc",
    width: 320,
    height: 240,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [{ id: "sprites", name: "Sprites", visible: true, objectIds: [image.id] }],
    objects: { [image.id]: image },
    selectedObjectId: image.id,
  };
  const spec = parseSpriteSidecarToml(spriteToml, {
    id: "sheet-sidecar",
    name: "Sheet sidecar",
    targetId: image.id,
  });
  const sidecar = createSpriteSidecarObject(image, spec);
  return applyCanvasCommands(base, [
    { kind: "addSpriteSidecarObject", object: sidecar, attach: true },
    {
      kind: "addGuideSidecarObject",
      object: createGuideSidecarObject(image, parseGuideSidecarToml(guideToml)),
      attach: true,
    },
    { kind: "select", id: sidecar.id },
    { kind: "selectSpriteFrame", sidecarId: sidecar.id, frameId: "hero.idle" },
  ]).document;
}

describe("MachinaCanvas sprite ergonomics", () => {
  it("renders an inspector accordion title and children", () => {
    render(
      <AccordionHarness id="test" title="Selected object">
        <p>Inner content</p>
      </AccordionHarness>,
    );

    expect(screen.getByRole("button", { name: /selected object/i })).toBeInTheDocument();
    expect(screen.getByText("Inner content")).toBeInTheDocument();
  });

  it("defaultOpen=true shows content", () => {
    render(
      <AccordionHarness id="open" initialOpen title="Selected object">
        <p>Visible body</p>
      </AccordionHarness>,
    );

    expect(screen.getByText("Visible body")).toBeVisible();
    expect(screen.getByRole("button", { name: /selected object/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("defaultOpen=false hides content", () => {
    render(
      <AccordionHarness id="closed" initialOpen={false} title="Geometry">
        <p>Hidden body</p>
      </AccordionHarness>,
    );

    expect(screen.getByText("Hidden body").closest("[hidden]")).not.toBeNull();
    expect(screen.getByRole("button", { name: /geometry/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("clicking the header toggles closed and open again", () => {
    render(
      <AccordionHarness id="test" initialOpen title="Sprite sidecar">
        <p>Accordion body</p>
      </AccordionHarness>,
    );

    fireEvent.click(screen.getByRole("button", { name: /sprite sidecar/i }));
    expect(screen.getByRole("button", { name: /sprite sidecar/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("Accordion body").closest("[hidden]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /sprite sidecar/i }));
    expect(screen.getByRole("button", { name: /sprite sidecar/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Accordion body")).toBeVisible();
  });

  it("clicking a button inside content does not toggle the accordion", () => {
    render(
      <AccordionHarness id="content" initialOpen title="Sprite audit">
        <button type="button">Run audit</button>
      </AccordionHarness>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run audit" }));
    expect(screen.getByRole("button", { name: /sprite audit/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Run audit" })).toBeVisible();
  });

  it("multiple accordions maintain independent state", () => {
    render(
      <>
        <AccordionHarness id="one" initialOpen title="Selected object">
          <p>First panel</p>
        </AccordionHarness>
        <AccordionHarness id="two" initialOpen title="Geometry">
          <p>Second panel</p>
        </AccordionHarness>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: /selected object/i }));
    expect(screen.getByRole("button", { name: /selected object/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: /geometry/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Second panel")).toBeVisible();
  });

  it("uses sprite-mode accordion defaults that prioritize selected frame editing", () => {
    const document = createSpriteDocument();
    const selected = document.objects[document.selectedObjectId as string];
    const state = getDefaultInspectorAccordionState({
      modeId: "sprites",
      selected,
      showViewAids: true,
      showImageTools: true,
      showExport: true,
      hasSelectedSpriteFrame: true,
      hasSpriteAuditResults: false,
    });

    expect(state["selected-object"]).toBe(true);
    expect(state["selected-sprite-frame"]).toBe(true);
    expect(state["sprite-sidecar"]).toBe(true);
    expect(state["view-aids"]).toBe(false);
    expect(state["image-assets"]).toBe(false);
    expect(state.export).toBe(false);
  });

  it("recognizes a selected sprite frame for the focused group", () => {
    const document = createSpriteDocument();
    const selection = getSelectedSpriteFrameState(document, document.objects["sheet-sidecar"]);

    expect(selection?.frame.id).toBe("hero.idle");
    expect(selection?.sidecar.id).toBe("sheet-sidecar");
  });

  it("finds selected frame datum targets for the inspector's datum snapping section", () => {
    const document = createSpriteDocument();
    const targets = getSelectedSpriteFrameDatumTargets(document, document.objects["sheet-sidecar"]);

    expect(targets.some((target) => target.datumId === "hero_left")).toBe(true);
  });

  it("creates a selected frame preview model when a linked image exists", () => {
    const document = createSpriteDocument();
    const selection = getSelectedSpriteFrameState(document, document.objects["sheet-sidecar"]);
    if (!selection) throw new Error("Expected selected frame.");
    const preview = getSelectedSpriteFramePreviewModel({
      image: selection.image,
      frame: selection.frame,
    });

    expect("reason" in preview).toBe(false);
    if ("reason" in preview) return;
    expect(preview.style.backgroundImage).toContain("/sheet.png");
    expect(preview.width).toBeGreaterThan(0);
    expect(preview.height).toBeGreaterThan(0);
  });

  it("returns a preview fallback when the linked image is missing", () => {
    const preview = getSelectedSpriteFramePreviewModel({
      image: undefined,
      frame: { x: 0, y: 0, width: 16, height: 16 },
    });

    expect(preview).toEqual({
      reason: "Preview unavailable: missing linked image",
    });
  });

  it("uses sprite-mode defaults that keep the selected sprite frame accordion open", () => {
    const document = createSpriteDocument();
    const selected = document.objects[document.selectedObjectId as string];
    const state = getDefaultInspectorAccordionState({
      modeId: "sprites",
      selected,
      showViewAids: true,
      showImageTools: true,
      showExport: true,
      hasSelectedSpriteFrame: true,
      hasSpriteAuditResults: false,
    });

    render(
      <InspectorAccordionGroup
        id="selected-sprite-frame"
        onOpenChange={() => undefined}
        open={state["selected-sprite-frame"]}
        title="Selected sprite frame"
      >
        <button type="button">Zoom to selected frame</button>
      </InspectorAccordionGroup>,
    );

    expect(screen.getByRole("button", { name: /selected sprite frame/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Zoom to selected frame" })).toBeVisible();
  });

  it("command terminal collapse behavior still works", () => {
    function Wrapper() {
      const [collapsed, setCollapsed] = React.useState(true);
      return (
        <button onClick={() => setCollapsed((current) => !current)} type="button">
          {collapsed ? "Expand" : "Collapse"}
        </button>
      );
    }

    render(<Wrapper />);
    expect(screen.getByRole("button", { name: "Expand" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByRole("button", { name: "Collapse" })).toBeInTheDocument();
  });
});
