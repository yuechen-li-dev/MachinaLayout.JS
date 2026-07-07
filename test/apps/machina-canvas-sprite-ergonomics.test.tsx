/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  getDefaultInspectorAccordionState,
  getSelectedSpriteFramePreviewModel,
  getSelectedSpriteFrameState,
} from "../../apps/machina-canvas/src/App";
import { InspectorAccordionGroup } from "../../apps/machina-canvas/src/InspectorAccordionGroup";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import { applyCanvasCommands } from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
} from "../../apps/machina-canvas/src/spriteSidecar";

afterEach(() => {
  cleanup();
});

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
    { kind: "select", id: sidecar.id },
    { kind: "selectSpriteFrame", sidecarId: sidecar.id, frameId: "hero.idle" },
  ]).document;
}

describe("MachinaCanvas sprite ergonomics", () => {
  it("renders an inspector accordion title and children", () => {
    render(
      <InspectorAccordionGroup id="test" onToggle={() => undefined} open title="Selected object">
        <p>Inner content</p>
      </InspectorAccordionGroup>,
    );

    expect(screen.getByRole("button", { name: /selected object/i })).toBeInTheDocument();
    expect(screen.getByText("Inner content")).toBeInTheDocument();
  });

  it("collapses and expands an inspector accordion group", () => {
    function Wrapper() {
      const [open, setOpen] = React.useState(true);
      return (
        <InspectorAccordionGroup
          id="test"
          onToggle={() => setOpen((current) => !current)}
          open={open}
          title="Sprite sidecar"
        >
          <p>Accordion body</p>
        </InspectorAccordionGroup>
      );
    }

    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: /sprite sidecar/i }));
    expect(screen.queryByText("Accordion body")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /sprite sidecar/i }));
    expect(screen.getByText("Accordion body")).toBeInTheDocument();
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
});
