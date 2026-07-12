import type { CanvasDocument } from "./sceneModel";
import {
  createBlankCanvasScene,
  createGraphicsDemoScene,
  createMechanicalDraftingScene,
  createSpriteSheetScene,
  createWebUiDemoScene,
} from "./sceneTemplates";

export type CanvasEditorModeId = "blank" | "graphics" | "webUi" | "sprites" | "mechanical";

export type CanvasToolGroupId = "geometry" | "image" | "sprite" | "webUi" | "export" | "viewAids";

export type CanvasEditorModeTemplate = {
  readonly id: CanvasEditorModeId;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly createScene: () => CanvasDocument;
  readonly defaultSelectedObjectId?: string;
  readonly visibleToolGroups?: readonly CanvasToolGroupId[];
};

export const CANVAS_EDITOR_MODE_TEMPLATES: readonly CanvasEditorModeTemplate[] = [
  {
    id: "mechanical",
    title: "Mechanical drafting",
    subtitle: "Existing geometry + semantic sheet annotations",
    description:
      "Create semantic 2D technical drawings by reusing canvas geometry and layering dimensions, tolerances, notes, datums, and title/revision/BOM records on top.",
    tags: ["mechanical", "drafting", "annotations"],
    createScene: createMechanicalDraftingScene,
    defaultSelectedObjectId: "mechanical-annotations",
    visibleToolGroups: ["geometry", "export", "viewAids"],
  },
  {
    id: "blank",
    title: "Blank canvas",
    subtitle: "General-purpose artboard",
    description: "Start from an empty artboard with the general canvas tools.",
    tags: ["empty", "general", "grid"],
    createScene: createBlankCanvasScene,
    visibleToolGroups: ["geometry", "image", "export", "viewAids"],
  },
  {
    id: "graphics",
    title: "Graphics editing",
    subtitle: "Poster and scene composition",
    description: "Compose text, shapes, images, overlays, and exportable graphics.",
    tags: ["vector", "poster", "images"],
    createScene: createGraphicsDemoScene,
    defaultSelectedObjectId: "headline",
    visibleToolGroups: ["geometry", "image", "export", "viewAids"],
  },
  {
    id: "webUi",
    title: "Web/UI editing",
    subtitle: "Component records and TSX lowering",
    description:
      "Author UI component records and lower structured canvas objects toward TSX/layout artifacts.",
    tags: ["components", "layout", "tsx"],
    createScene: createWebUiDemoScene,
    defaultSelectedObjectId: "ui-hero-card",
    visibleToolGroups: ["webUi", "geometry", "export", "viewAids"],
  },
  {
    id: "sprites",
    title: "Sprite sheet editing",
    subtitle: "Atlas inspection and sidecars",
    description:
      "Load a sprite sheet and TOML sidecar, inspect cut rectangles, labels, animations, and export sidecars.",
    tags: ["sprites", "sidecars", "toml"],
    createScene: createSpriteSheetScene,
    visibleToolGroups: ["image", "sprite", "export", "viewAids"],
  },
] as const;

export function getCanvasEditorModeTemplate(id: CanvasEditorModeId): CanvasEditorModeTemplate {
  const template = CANVAS_EDITOR_MODE_TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) {
    throw new Error(`Unknown MachinaCanvas editor mode "${id}".`);
  }
  return template;
}
