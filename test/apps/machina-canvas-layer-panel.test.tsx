/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasLayerPanelView } from "../../apps/machina-canvas/src/LayerPanel";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import { buildCanvasLayerTree } from "../../apps/machina-canvas/src/layerTree";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";

afterEach(() => {
  cleanup();
});

function createPanelDocument(): CanvasDocument {
  return {
    id: "panel-doc",
    name: "Panel Doc",
    width: 640,
    height: 480,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [
      { id: "sheet", name: "Sprite Sheet", visible: true, objectIds: ["sheet-image", "alpha"] },
      { id: "overlays", name: "Overlays", visible: true, objectIds: ["sidecar", "orphan-sidecar"] },
    ],
    layerGroups: [{ id: "sheet-group", title: "Sprite Sheet", objectIds: ["sheet-image"] }],
    objects: {
      "sheet-image": {
        id: "sheet-image",
        name: "Sheet image",
        kind: "image",
        layerId: "sheet",
        visible: true,
        x: 0,
        y: 0,
        width: 320,
        height: 160,
        src: "/assets/tinytown_sprite_alpha.png",
        intrinsicWidth: 1440,
        intrinsicHeight: 720,
        alphaMapId: "alpha",
        spriteSidecarId: "sidecar",
      },
      alpha: {
        id: "alpha",
        name: "Alpha",
        kind: "image",
        layerId: "sheet",
        visible: false,
        x: 0,
        y: 0,
        width: 320,
        height: 160,
        src: "/assets/tinytown_alpha.png",
        role: "alphaMap",
      },
      sidecar: {
        id: "sidecar",
        name: "Sidecar",
        kind: "spriteSidecar",
        layerId: "overlays",
        visible: true,
        x: 0,
        y: 0,
        width: 320,
        height: 160,
        targetId: "sheet-image",
        spec: {
          id: "sidecar",
          name: "Sidecar",
          dialect: "sprite",
          targetId: "sheet-image",
          frames: [{ id: "idle", label: "idle", x: 0, y: 0, width: 16, height: 16 }],
          grids: [],
          stackframes: [],
          animations: [],
          diagnostics: [],
          overlay: {
            displayMode: "focus",
            showBounds: true,
            showLabels: true,
            selectedOnly: false,
            showSubgrids: true,
            showExactFrames: true,
          },
        },
      },
      "orphan-sidecar": {
        id: "orphan-sidecar",
        name: "Orphan",
        kind: "spriteSidecar",
        layerId: "overlays",
        visible: true,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        spec: {
          id: "orphan-sidecar",
          name: "Orphan",
          dialect: "sprite",
          frames: [],
          grids: [],
          stackframes: [],
          animations: [],
          diagnostics: [],
          overlay: {
            displayMode: "focus",
            showBounds: true,
            showLabels: true,
            selectedOnly: false,
            showSubgrids: true,
            showExactFrames: true,
          },
        },
      },
    },
    selectedObjectId: "sidecar",
  };
}

type PanelHarnessProps = {
  onAddAlphaMask?: () => void;
  onAddBlockoutToml?: () => void;
  onAddGuideToml?: () => void;
  onAddGroup?: () => void;
  onAddImage?: () => void;
  onAddMechanicalAnnotations?: () => void;
  onAddSketchToml?: () => void;
  onAddSpriteToml?: () => void;
  onClearSelection?: () => void;
  onReturnToModeSelection?: () => void;
  onSelectObject?: (id: string) => void;
  onToggleGroup?: (id: string) => void;
};

function renderLayerPanel(overrides: PanelHarnessProps = {}) {
  const document = createPanelDocument();
  const tree = buildCanvasLayerTree(document);

  function TestPanel() {
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    return (
      <CanvasLayerPanelView
        activeModeTitle="Sprite Sheet Editing"
        collapsedGroups={new Set()}
        document={document}
        isAddMenuOpen={isAddMenuOpen}
        tree={tree}
        onAddAlphaMask={overrides.onAddAlphaMask ?? (() => undefined)}
        onAddBlockoutToml={overrides.onAddBlockoutToml ?? (() => undefined)}
        onAddGuideToml={overrides.onAddGuideToml ?? (() => undefined)}
        onAddGroup={overrides.onAddGroup ?? (() => undefined)}
        onAddImage={overrides.onAddImage ?? (() => undefined)}
        onAddMechanicalAnnotations={overrides.onAddMechanicalAnnotations ?? (() => undefined)}
        onAddSketchToml={overrides.onAddSketchToml ?? (() => undefined)}
        onAddSpriteToml={overrides.onAddSpriteToml ?? (() => undefined)}
        onClearSelection={overrides.onClearSelection ?? (() => undefined)}
        onCloseAddMenu={() => setIsAddMenuOpen(false)}
        onReturnToModeSelection={overrides.onReturnToModeSelection ?? (() => undefined)}
        onSelectObject={overrides.onSelectObject ?? (() => undefined)}
        onToggleAddMenu={() => setIsAddMenuOpen((current) => !current)}
        onToggleGroup={overrides.onToggleGroup ?? (() => undefined)}
      />
    );
  }

  return render(<TestPanel />);
}

describe("MachinaCanvas layer panel", () => {
  it("renders groups, nested attachments, a compact add trigger, and unattached warnings", () => {
    renderLayerPanel();

    expect(screen.getByText("Sprite Sheet")).toBeInTheDocument();
    expect(screen.getByText("tinytown_sprite_alpha.png")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Group" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Image" })).not.toBeInTheDocument();
    expect(screen.getByText("Unattached Sidecars")).toBeInTheDocument();
    expect(screen.getByText("No image owner")).toBeVisible();
  });

  it("selects nested attachments and marks the selected row", () => {
    const onSelectObject = vi.fn();
    renderLayerPanel({ onSelectObject });

    const sidecarRow = screen.getByTitle("Sidecar");
    fireEvent.click(sidecarRow);

    expect(onSelectObject).toHaveBeenCalledWith("sidecar");
    expect(sidecarRow).toHaveClass("is-selected");
  });

  it("opens the add menu and lists the existing add actions", () => {
    renderLayerPanel();

    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^GroupOrganize layers$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^ImageAdd a source image$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^Blockout TOMLAttach blockout feature IR$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^Guide TOMLAttach authoring guide IR$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", {
        name: /^Mechanical annotationsAdd drafting dimensions and notes$/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^Sprite TOMLAttach sprite metadata$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^Sketch TOMLAttach sketch overlay$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^Alpha maskAttach alpha mask to image$/i }),
    ).toBeInTheDocument();
  });

  it("selecting Group calls the existing group creation behavior and closes the menu", () => {
    const onCreateGroup = vi.fn();
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("Review notes");
    renderLayerPanel({
      onAddGroup: () => onCreateGroup(window.prompt("Group name", "New group") ?? "New group"),
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^GroupOrganize layers$/i }));

    expect(onCreateGroup).toHaveBeenCalledWith("Review notes");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    prompt.mockRestore();
  });

  it("keeps sprite, sketch, and alpha handlers wired through the add menu", () => {
    const onAddSpriteToml = vi.fn();
    const onAddSketchToml = vi.fn();
    const onAddAlphaMask = vi.fn();
    renderLayerPanel({ onAddAlphaMask, onAddSketchToml, onAddSpriteToml });

    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^Sprite TOMLAttach sprite metadata$/i }));
    expect(onAddSpriteToml).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^Sketch TOMLAttach sketch overlay$/i }));
    expect(onAddSketchToml).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: /^Alpha maskAttach alpha mask to image$/i }),
    );
    expect(onAddAlphaMask).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the add menu on Escape", () => {
    renderLayerPanel();

    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: "+ Add" }), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
