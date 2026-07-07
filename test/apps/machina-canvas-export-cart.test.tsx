/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportCartPanel } from "../../apps/machina-canvas/src/ExportCartPanel";
import {
  CANVAS_EXPORT_PRESETS,
  applyExportPreset,
  checkoutExportCart,
  collectCanvasExportArtifacts,
  createCanvasCheckpoint,
  createExportCart,
  materializeExportCart,
  toggleExportArtifact,
} from "../../apps/machina-canvas/src/exportCart";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import type { CanvasDocument, CanvasObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  createSpriteSheetScene,
  createWebUiDemoScene,
} from "../../apps/machina-canvas/src/sceneTemplates";

afterEach(() => {
  cleanup();
});

function createSketchDocument(): CanvasDocument {
  const image: Extract<CanvasObject, { kind: "image" }> = {
    id: "source-image",
    name: "Source image",
    kind: "image",
    layerId: "foreground",
    visible: true,
    x: 0,
    y: 0,
    width: 160,
    height: 100,
    src: "/asset.png",
    sketchOverlayId: "source-image-sketch",
  };
  const overlay: Extract<CanvasObject, { kind: "sketchOverlay" }> = {
    id: "source-image-sketch",
    name: "Source sketch",
    kind: "sketchOverlay",
    layerId: "foreground",
    visible: true,
    x: 0,
    y: 0,
    width: 160,
    height: 100,
    targetId: image.id,
    spec: {
      id: "source-image-sketch",
      name: "Source sketch",
      dialect: "sketch",
      targetId: image.id,
      primitives: [
        {
          kind: "box",
          id: "focus",
          ref: { kind: "absoluteRect", x: 10, y: 10, width: 60, height: 30 },
        },
      ],
    },
  };
  return {
    id: "sketch-doc",
    name: "Sketch Doc",
    width: 320,
    height: 180,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [
      { id: "foreground", name: "Foreground", visible: true, objectIds: [image.id, overlay.id] },
    ],
    objects: {
      [image.id]: image,
      [overlay.id]: overlay,
    },
    selectedObjectId: overlay.id,
  };
}

function createGuideDocument(): CanvasDocument {
  const image: Extract<CanvasObject, { kind: "image" }> = {
    id: "source-image",
    name: "Source image",
    kind: "image",
    layerId: "foreground",
    visible: true,
    x: 0,
    y: 0,
    width: 160,
    height: 100,
    src: "/asset.png",
  };
  const guide: Extract<CanvasObject, { kind: "guideSidecar" }> = {
    id: "source-image-guide",
    name: "source-image.guide.toml",
    kind: "guideSidecar",
    layerId: "foreground",
    visible: true,
    x: 0,
    y: 0,
    width: 160,
    height: 100,
    targetId: image.id,
    guide: {
      kind: "canvasGuideSidecar",
      id: "source-image-guide",
      target: image.id,
      units: "px",
      regions: [{ id: "r1", kind: "region", x: 10, y: 10, width: 30, height: 20 }],
      datums: [],
      dimensions: [],
      alignmentMarks: [],
    },
  };
  return {
    id: "guide-doc",
    name: "Guide Doc",
    width: 320,
    height: 180,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [
      { id: "foreground", name: "Foreground", visible: true, objectIds: [image.id, guide.id] },
    ],
    objects: {
      [image.id]: image,
      [guide.id]: guide,
    },
    selectedObjectId: guide.id,
  };
}

describe("MachinaCanvas export cart", () => {
  it("collects always-available artifacts", () => {
    const artifacts = collectCanvasExportArtifacts({ scene: createSketchDocument() });
    expect(artifacts.map((artifact) => artifact.id)).toEqual(
      expect.arrayContaining([
        "document-json",
        "handoff-toml",
        "render-svg",
        "diagnostics-report",
        "checkpoint",
      ]),
    );
  });

  it("collects sprite TOML and sprite audit artifacts for sprite scenes", () => {
    const scene = createSpriteSheetScene();
    const artifacts = collectCanvasExportArtifacts({ scene });
    expect(artifacts.some((artifact) => artifact.kind === "spriteToml")).toBe(true);
    expect(artifacts.some((artifact) => artifact.kind === "spriteAudit")).toBe(true);
    expect(artifacts.find((artifact) => artifact.kind === "spriteToml")?.description).toContain(
      "Runtime target",
    );
  });

  it("collects sketch TOML artifacts when sketch overlays exist", () => {
    const artifacts = collectCanvasExportArtifacts({ scene: createSketchDocument() });
    expect(artifacts.some((artifact) => artifact.kind === "sketchToml")).toBe(true);
  });

  it("collects guide TOML artifacts for guide sidecars", () => {
    const artifacts = collectCanvasExportArtifacts({ scene: createGuideDocument() });
    expect(artifacts.some((artifact) => artifact.kind === "guideToml")).toBe(true);
    expect(artifacts.find((artifact) => artifact.kind === "guideToml")?.description).toContain(
      "Authoring guide IR",
    );
  });

  it("collects TSX lowering artifacts for web/ui scenes", () => {
    const artifacts = collectCanvasExportArtifacts({ scene: createWebUiDemoScene() });
    expect(artifacts.some((artifact) => artifact.filename === "generated-page.tsx")).toBe(true);
  });

  it("keeps artifact ids and filenames stable", () => {
    const first = collectCanvasExportArtifacts({ scene: createSpriteSheetScene() });
    const second = collectCanvasExportArtifacts({ scene: createSpriteSheetScene() });
    expect(first.map((artifact) => artifact.id)).toEqual(second.map((artifact) => artifact.id));
    expect(first.map((artifact) => artifact.filename)).toEqual(
      second.map((artifact) => artifact.filename),
    );
  });

  it("applies sprite handoff preset deterministically", () => {
    const artifacts = collectCanvasExportArtifacts({ scene: createSpriteSheetScene() });
    const preset = CANVAS_EXPORT_PRESETS.find((candidate) => candidate.id === "sprite-handoff");
    const first = applyExportPreset(artifacts, preset!);
    const second = applyExportPreset(artifacts, preset!);
    expect(first).toEqual(second);
    expect(first.selectedArtifactIds.some((id) => id.startsWith("sprite-toml:"))).toBe(true);
    expect(first.selectedArtifactIds.some((id) => id.startsWith("sprite-compile-report:"))).toBe(
      true,
    );
    expect(first.selectedArtifactIds).toContain("handoff-toml");
    expect(first.selectedArtifactIds).toContain("diagnostics-report");
  });

  it("applies visual review, full archive, and source checkpoint presets", () => {
    const artifacts = collectCanvasExportArtifacts({ scene: createSpriteSheetScene() });
    const visual = applyExportPreset(
      artifacts,
      CANVAS_EXPORT_PRESETS.find((candidate) => candidate.id === "visual-review")!,
    );
    const full = applyExportPreset(
      artifacts,
      CANVAS_EXPORT_PRESETS.find((candidate) => candidate.id === "full-archive")!,
    );
    const checkpoint = applyExportPreset(
      artifacts,
      CANVAS_EXPORT_PRESETS.find((candidate) => candidate.id === "source-checkpoint")!,
    );

    expect(visual.selectedArtifactIds).toContain("render-svg");
    expect(visual.selectedArtifactIds).toContain("diagnostics-report");
    expect(full.selectedArtifactIds).toContain("document-json");
    expect(full.selectedArtifactIds).toContain("handoff-toml");
    expect(checkpoint.selectedArtifactIds).toContain("checkpoint");
    expect(checkpoint.selectedArtifactIds).toContain("document-json");
  });

  it("keeps guide sidecars out of sprite handoff but includes them in full archive", () => {
    const artifacts = collectCanvasExportArtifacts({ scene: createGuideDocument() });
    const spriteHandoff = applyExportPreset(
      artifacts,
      CANVAS_EXPORT_PRESETS.find((candidate) => candidate.id === "sprite-handoff")!,
    );
    const fullArchive = applyExportPreset(
      artifacts,
      CANVAS_EXPORT_PRESETS.find((candidate) => candidate.id === "full-archive")!,
    );
    expect(spriteHandoff.selectedArtifactIds.some((id) => id.startsWith("guide-toml:"))).toBe(
      false,
    );
    expect(fullArchive.selectedArtifactIds.some((id) => id.startsWith("guide-toml:"))).toBe(true);
  });

  it("toggles artifact selection and preserves required artifacts", () => {
    const artifacts = [
      {
        id: "required",
        kind: "documentJson",
        title: "Required",
        description: "Required",
        filename: "document.json",
        selectedByDefault: true,
        required: true,
        create: () => "{}",
      },
      {
        id: "optional",
        kind: "diagnostics",
        title: "Optional",
        description: "Optional",
        filename: "diagnostics.txt",
        selectedByDefault: false,
        create: () => "ok",
      },
    ] as const;
    const cart = createExportCart(artifacts);
    const selected = toggleExportArtifact(cart, "optional", artifacts);
    const stillSelected = toggleExportArtifact(selected, "required", artifacts);
    expect(selected.selectedArtifactIds).toContain("optional");
    expect(stillSelected.selectedArtifactIds).toContain("required");
  });

  it("includes scene, mode, selection, and message in checkpoints", () => {
    const scene = createSpriteSheetScene();
    const checkpoint = createCanvasCheckpoint({
      scene,
      activeModeId: "sprites",
      selectedObjectId: scene.selectedObjectId,
      selectedSpriteFrameId: "maya.down.0",
      message: "before cleanup",
    });
    expect(checkpoint.scene).toEqual(scene);
    expect(checkpoint.activeModeId).toBe("sprites");
    expect(checkpoint.selectedObjectId).toBe(scene.selectedObjectId);
    expect(checkpoint.selectedSpriteFrameId).toBe("maya.down.0");
    expect(checkpoint.message).toBe("before cleanup");
  });

  it("materializes selected artifacts and adds a manifest", async () => {
    const artifacts = [
      {
        id: "one",
        kind: "documentJson",
        title: "One",
        description: "One",
        filename: "document.json",
        selectedByDefault: true,
        create: () => "{}\n",
      },
      {
        id: "two",
        kind: "handoffToml",
        title: "Two",
        description: "Two",
        filename: "handoff.toml",
        selectedByDefault: true,
        create: () => 'id = "two"\n',
      },
    ] as const;
    const cart = createExportCart(artifacts);
    const result = await materializeExportCart({ artifacts, cart, activeModeId: "graphics" });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.entries.map((entry) => entry.filename)).toEqual(
      expect.arrayContaining(["document.json", "handoff.toml", "export-manifest.json"]),
    );
    expect(result.manifest?.artifacts.map((artifact) => artifact.id)).toEqual(["one", "two"]);
  });

  it("reports failed artifact ids on checkout errors", async () => {
    const artifacts = [
      {
        id: "bad",
        kind: "diagnostics",
        title: "Bad",
        description: "Bad",
        filename: "diagnostics.txt",
        selectedByDefault: true,
        create: () => {
          throw new Error("boom");
        },
      },
    ] as const;
    const result = await checkoutExportCart({
      artifacts,
      cart: createExportCart(artifacts),
    });
    expect(result).toEqual({
      kind: "err",
      message: "boom",
      failedArtifactId: "bad",
    });
  });
});

describe("ExportCartPanel", () => {
  const artifacts = [
    {
      id: "document-json",
      kind: "documentJson",
      title: "Document index",
      description: "Scene graph export.",
      filename: "document.json",
      selectedByDefault: true,
      create: () => "{}",
    },
    {
      id: "handoff-toml",
      kind: "handoffToml",
      title: "Handoff contract",
      description: "Pipeline metadata.",
      filename: "handoff.toml",
      selectedByDefault: false,
      create: () => "",
    },
  ] as const;

  it("renders artifact cards and the checkpoint action", () => {
    render(
      <ExportCartPanel
        artifacts={artifacts}
        cart={createExportCart(artifacts)}
        checkpointNote=""
        onApplyPreset={() => undefined}
        onCheckpointNoteChange={() => undefined}
        onCheckout={() => undefined}
        onSaveCheckpoint={() => undefined}
        onToggleArtifact={() => undefined}
        presets={CANVAS_EXPORT_PRESETS}
        status=""
      />,
    );

    expect(screen.getByText("Export cart")).toBeInTheDocument();
    expect(screen.getByText("Document index")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save checkpoint" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checkout selected" })).toBeInTheDocument();
  });

  it("applies presets, toggles artifacts, and triggers checkout", () => {
    const onApplyPreset = vi.fn();
    const onToggleArtifact = vi.fn();
    const onCheckout = vi.fn();
    render(
      <ExportCartPanel
        artifacts={artifacts}
        cart={createExportCart(artifacts)}
        checkpointNote=""
        onApplyPreset={onApplyPreset}
        onCheckpointNoteChange={() => undefined}
        onCheckout={onCheckout}
        onSaveCheckpoint={() => undefined}
        onToggleArtifact={onToggleArtifact}
        presets={CANVAS_EXPORT_PRESETS}
        status=""
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Sprite handoff/i }));
    fireEvent.click(screen.getByLabelText(/Handoff contract/i));
    fireEvent.click(screen.getByRole("button", { name: "Checkout selected" }));

    expect(onApplyPreset).toHaveBeenCalledWith("sprite-handoff");
    expect(onToggleArtifact).toHaveBeenCalledWith("handoff-toml");
    expect(onCheckout).toHaveBeenCalled();
  });

  it("lets users type a checkpoint note", () => {
    const onCheckpointNoteChange = vi.fn();
    render(
      <ExportCartPanel
        artifacts={artifacts}
        cart={createExportCart(artifacts)}
        checkpointNote=""
        onApplyPreset={() => undefined}
        onCheckpointNoteChange={onCheckpointNoteChange}
        onCheckout={() => undefined}
        onSaveCheckpoint={() => undefined}
        onToggleArtifact={() => undefined}
        presets={CANVAS_EXPORT_PRESETS}
        status=""
      />,
    );

    fireEvent.change(screen.getByLabelText("Checkpoint note"), {
      target: { value: "snapshot before handoff" },
    });
    expect(onCheckpointNoteChange).toHaveBeenCalledWith("snapshot before handoff");
  });
});
