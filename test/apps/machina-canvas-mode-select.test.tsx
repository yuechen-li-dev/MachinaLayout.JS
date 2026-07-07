/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasModeStart } from "../../apps/machina-canvas/src/CanvasModeStart";
import {
  CANVAS_EDITOR_MODE_TEMPLATES,
  getCanvasEditorModeTemplate,
} from "../../apps/machina-canvas/src/editorModes";
import { createCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExport";
import { validateCanvasExportBundle } from "../../apps/machina-canvas/src/canvasExportValidation";

afterEach(() => {
  cleanup();
});

describe("MachinaCanvas mode templates", () => {
  it("registers mechanical, blank, graphics, webUi, and sprites modes", () => {
    expect(CANVAS_EDITOR_MODE_TEMPLATES.map((template) => template.id)).toEqual([
      "mechanical",
      "blank",
      "graphics",
      "webUi",
      "sprites",
    ]);
  });

  it("gives every mode descriptive metadata", () => {
    for (const template of CANVAS_EDITOR_MODE_TEMPLATES) {
      expect(template.title.length).toBeGreaterThan(0);
      expect(template.subtitle.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
      expect(template.tags.length).toBeGreaterThan(0);
    }
  });

  it("creates valid exportable scenes for each mode", () => {
    for (const template of CANVAS_EDITOR_MODE_TEMPLATES) {
      const document = template.createScene();
      const bundle = createCanvasExportBundle(document);
      const validation = validateCanvasExportBundle(bundle);

      expect(validation.ok).toBe(true);
      expect(document.id.length).toBeGreaterThan(0);
      expect(document.name.length).toBeGreaterThan(0);
      expect(document.layers.length).toBeGreaterThan(0);
      expect(document.width).toBeGreaterThan(0);
      expect(document.height).toBeGreaterThan(0);

      if (template.defaultSelectedObjectId) {
        expect(document.objects[template.defaultSelectedObjectId]).toBeDefined();
      }
    }
  });

  it("keeps blank mode minimal", () => {
    const document = getCanvasEditorModeTemplate("blank").createScene();

    expect(Object.keys(document.objects)).toHaveLength(0);
    expect(document.selectedObjectId).toBeUndefined();
  });

  it("creates graphics-oriented content for graphics mode", () => {
    const document = getCanvasEditorModeTemplate("graphics").createScene();
    const kinds = new Set(Object.values(document.objects).map((object) => object.kind));

    expect(kinds.has("text") || kinds.has("rect") || kinds.has("ellipse")).toBe(true);
    expect(Object.values(document.objects).some((object) => object.kind === "image")).toBe(true);
    expect(Object.values(document.objects).some((object) => object.kind === "uiComponent")).toBe(
      false,
    );
  });

  it("creates a web-oriented scene for web UI mode", () => {
    const document = getCanvasEditorModeTemplate("webUi").createScene();

    expect(Object.values(document.objects).some((object) => object.kind === "uiComponent")).toBe(
      true,
    );
  });

  it("creates a sprite-oriented scene with a local fixture for audit smoke coverage", () => {
    const document = getCanvasEditorModeTemplate("sprites").createScene();

    expect(Object.keys(document.objects)).toEqual(
      expect.arrayContaining(["tinytown-sheet", "tinytown-sidecar"]),
    );
    expect(document.selectedObjectId).toBe("tinytown-sidecar");
    expect(document.layers.map((layer) => layer.id)).toEqual(["sprite-sheet", "sprite-overlays"]);
  });
});

describe("CanvasModeStart", () => {
  it("renders all available mode choices and notifies selection", () => {
    const onSelectMode = vi.fn();
    render(<CanvasModeStart onSelectMode={onSelectMode} />);

    expect(screen.getByText("Choose what you want to author first.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Mechanical drafting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Blank canvas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Graphics editing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Web/UI editing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Sprite sheet editing" })).toBeInTheDocument();

    screen.getByRole("button", { name: "Open Graphics editing" }).click();
    expect(onSelectMode).toHaveBeenCalledWith("graphics");
  });
});
