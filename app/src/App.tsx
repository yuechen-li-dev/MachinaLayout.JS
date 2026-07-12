import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { Rect } from "machinalayout";
import { enumTable, matchEnum } from "machinalayout/match";
import { MachinaReactView, type MachinaSlotProps } from "machinalayout/react";
import { CanvasModeStart } from "./CanvasModeStart";
import { CanvasCommandTerminal } from "./CanvasCommandTerminal";
import { CanvasLayerPanel } from "./LayerPanel";
import { ExportCartPanel } from "./ExportCartPanel";
import { InspectorAccordionGroup } from "./InspectorAccordionGroup";
import { resolveAppLayout } from "./appLayout";
import { getDefaultCanvasAidToggles, type CanvasAidToggles } from "./canvasViewAids";
import {
  createCanvasExportBundle,
  type CanvasExportBundle,
  type CanvasExportFile,
} from "./canvasExport";
import {
  getRasterExportFileName,
  lowerCanvasDocumentToRasterBlob,
  normalizeRasterExportOptions,
  type NormalizedRasterExportOptions,
  type RasterExportBackground,
} from "./rasterExport";
import {
  CANVAS_ZOOM_STEPS,
  createCanvasViewport,
  fitCanvasViewport,
  getCanvasViewportViewBox,
  nextZoomStep,
  panCanvasViewport,
  setCanvasViewportZoom,
  viewportForGridRef,
  viewportForGridSpan,
  viewportForObject,
  viewportForSpriteFrame,
  type CanvasViewport,
} from "./canvasViewport";
import { formatCanvasMeasurement, getCanvasUnitSystem } from "./canvasUnits";
import {
  formatCanvasExportValidationReport,
  validateCanvasExportBundle,
  type CanvasExportValidationResult,
} from "./canvasExportValidation";
import {
  executeCanvasTerminalCommand,
  type CanvasTerminalLogEntry,
  type CanvasTerminalSideEffect,
} from "./canvasCommandsTerminal";
import {
  addObjectToLayerGroup,
  applyCanvasCommands,
  attachAlphaMapToImage,
  attachGuideSidecarToImage,
  attachSketchOverlayToImage,
  attachSpriteSidecarToImage,
  type CanvasCommandApplyContext,
  createLayerGroup,
  type CanvasCommand,
  type CanvasCommandApplyResult,
  type CanvasCommandValidationResult,
  validateCanvasCommands,
} from "./sceneCommands";
import {
  createImageObjectFromAsset,
  loadImageAssetFromFile,
  makeUniqueObjectId,
} from "./imageAssets";
import {
  getCanvasEditorModeTemplate,
  type CanvasEditorModeId,
  type CanvasEditorModeTemplate,
  type CanvasToolGroupId,
} from "./editorModes";
import { getSceneGeometryDiagnostics, type GeometryDiagnostic } from "./sceneGeometry";
import { getSelectedObjectMeasurements } from "./sceneMeasurement";
import {
  createBlockoutSidecarObject,
  createUnattachedBlockoutSidecarObject,
  parseBlockoutSidecarToml,
  validateBlockoutSidecar,
} from "./blockoutSidecar";
import {
  createGuideSidecarObject,
  createUnattachedGuideSidecarObject,
  parseGuideSidecarToml,
  validateGuideSidecar,
} from "./guideSidecar";
import {
  createMechanicalAnnotationSet,
  createMechanicalAnnotationSidecarObject,
  createDefaultMechanicalSheetMetadata,
  formatMechanicalDimensionText,
  getMechanicalInspectorSummary,
  getMechanicalSheetLayout,
  getMechanicalTableRenderMetrics,
  getMechanicalTitleBlockEntries,
  validateMechanicalAnnotationsForScene,
} from "./mechanicalAnnotations";
import {
  resolveGuideAlignmentMarks,
  validateGuideAlignmentMarks,
  type ResolvedGuideAlignmentMark,
} from "./guideAlignment";
import { resolveSketchSpec } from "./sketchOverlay";
import { createSketchOverlayObject, parseSketchOverlayToml } from "./sketchOverlay";
import {
  createUnattachedSpriteSidecarObject,
  createSpriteSidecarObject,
  getSpriteExpectedSourceRect,
  getSpriteFrameSourceKind,
  getSpriteFrameSummary,
  parseSpriteSidecarToml,
} from "./spriteSidecar";
import {
  type SpriteAlphaMask,
  buildSpriteAuditReport,
  createSpriteAuditScreenshotDocument,
  formatSpriteAuditReport,
  type SpriteAuditReport,
  type SpriteAuditScope,
} from "./spriteAudit";
import {
  hitTestSpriteFrameAtPoint,
  mapSpriteFrameToCanvasRect,
  snapSpriteFrameRect,
  type SpriteFrameRect,
} from "./spriteFrameEditor";
import {
  clampSpriteFrameRectToGuideRegion,
  findGuideRegionForSpriteFrame,
  getGuideSidecarsForSpriteSidecar,
  type SpriteFrameGuideRegionContext,
} from "./spriteGuideRegions";
import {
  DEFAULT_SPRITE_FRAME_DATUM_SNAP_DISTANCE,
  findDatumSnapTargetsForSpriteFrame,
  type SpriteFrameDatumAnchor,
  type SpriteFrameDatumSnapTarget,
} from "./spriteGuideDatums";
import {
  buildSpriteOverlayLabelChip,
  createSpriteOverlayRenderPlan,
  getSpriteOverlayDisplayModeLabel,
  getSpriteOverlayFrameClassNames,
  getSpriteOverlaySubgridClassNames,
  layoutSpriteOverlayLabelChip,
  SPRITE_OVERLAY_DISPLAY_MODES,
} from "./spriteOverlay";
import type {
  CanvasDocument,
  CanvasFrame,
  CanvasImageRole,
  CanvasObject,
  CanvasObjectKind,
  CanvasSpriteFrame,
  BlockoutSidecarObject,
  GuideSidecarObject,
  ImageObject,
  MechanicalAnnotationSidecarObject,
  SpriteSidecarObject,
  TextObject,
} from "./sceneModel";
import { getObjectBoundsSummary, summarizeScene } from "./sceneSummary";
import { summarizeViewport } from "./viewportSummary";
import { createReferenceGridConfig, getColumnLabel, objectToGridRef } from "./referenceGrid";
import { getCanvasImageMaskId, getImagePreserveAspectRatio } from "./canvasImageSvg";
import {
  CANVAS_EXPORT_PRESETS,
  applyExportPreset,
  checkoutExportCart,
  collectCanvasExportArtifacts,
  createCanvasCheckpointArtifact,
  createExportCart,
  reconcileExportCart,
  toggleExportArtifact,
  type CanvasExportArtifact,
  type CanvasExportCart,
  type CanvasExportCheckoutResult,
  type CanvasExportPreset,
} from "./exportCart";
import {
  GENERATE_ALPHA_MAP_TOOL_ID,
  canvasTools,
  listCanvasTools,
  runCanvasTool as runRegisteredCanvasTool,
  type CanvasToolResult,
} from "./tools";
import {
  getCanvasUiComponentDefinition,
  type CanvasUiPropDefinition,
} from "./uiComponents/catalog";
import {
  formatCoordinateProfileSummary,
  getCoordinateProfile,
  visualDirectionDelta,
} from "./coordinateProfiles";

const MIN_WIDTH = 760;
const MIN_HEIGHT = 640;
const INITIAL_MODE_TEMPLATE = getCanvasEditorModeTemplate("blank");
const INITIAL_EDITOR_DOCUMENT = INITIAL_MODE_TEMPLATE.createScene();

const objectKindLabels = enumTable<CanvasObjectKind, string>({
  rect: "Rectangle",
  ellipse: "Ellipse",
  path: "Path",
  text: "Text",
  image: "Image",
  uiComponent: "UI Component",
  sketchOverlay: "Sketch Overlay",
  spriteSidecar: "Sprite Sidecar",
  guideSidecar: "Guide Sidecar",
  blockoutSidecar: "Blockout Sidecar",
  mechanicalAnnotationSidecar: "Mechanical Annotations",
});

const commandKindLabels = enumTable<CanvasCommand["kind"], string>({
  select: "Select",
  move: "Move",
  resize: "Resize",
  setFill: "Set fill",
  setStroke: "Set stroke",
  align: "Align",
  distribute: "Distribute",
  moveToGrid: "Move to grid",
  alignToGrid: "Align to grid",
  resizeToGridSpan: "Resize to grid span",
  setFrame: "Set frame",
  setUiProp: "Set UI prop",
  alignObjectByGuideMarks: "Align by guide mark",
  addImageObject: "Add image object",
  addSpriteSidecarObject: "Add sprite sidecar",
  addGuideSidecarObject: "Add guide sidecar",
  addBlockoutSidecarObject: "Add blockout sidecar",
  removeObject: "Remove object",
  attachAlphaMap: "Attach alpha map",
  detachAlphaMap: "Detach alpha map",
  attachSketchOverlay: "Attach sketch overlay",
  detachSketchOverlay: "Detach sketch overlay",
  setSketchOverlayVisible: "Set sketch overlay visible",
  attachGuideSidecar: "Attach guide sidecar",
  detachGuideSidecar: "Detach guide sidecar",
  setGuideSidecarVisible: "Set guide sidecar visible",
  setGuideSidecarOpacity: "Set guide sidecar opacity",
  attachBlockoutSidecar: "Attach blockout sidecar",
  detachBlockoutSidecar: "Detach blockout sidecar",
  setBlockoutSidecarVisible: "Set blockout sidecar visible",
  setBlockoutSidecarOpacity: "Set blockout sidecar opacity",
  attachSpriteSidecar: "Attach sprite sidecar",
  detachSpriteSidecar: "Detach sprite sidecar",
  setSpriteSidecarVisible: "Set sprite sidecar visible",
  setSpriteOverlayOption: "Set sprite overlay option",
  setSpriteOverlayDisplayMode: "Set sprite overlay mode",
  selectSpriteFrame: "Select sprite frame",
  updateSpriteFrameRect: "Set sprite frame rect",
  nudgeSpriteFrame: "Nudge sprite frame",
  resizeSpriteFrame: "Resize sprite frame",
  clampSpriteFrameToGuideRegion: "Clamp sprite frame to guide region",
  snapSpriteFrameToDatum: "Snap sprite frame to datum",
  snapSpriteFrameToNearestDatum: "Snap sprite frame to nearest datum",
});

const exampleCommandJson = JSON.stringify(
  [
    {
      kind: "moveToGrid",
      id: "feature-chip-1",
      ref: "B4.c",
      anchor: "center",
    },
    {
      kind: "alignToGrid",
      ids: ["logo", "headline"],
      axis: "left",
      ref: "A1.w",
    },
    {
      kind: "attachAlphaMap",
      sourceId: "generated-product-image",
      alphaId: "generated-product-alpha",
    },
    {
      kind: "setSketchOverlayVisible",
      overlayId: "generated-product-sketch",
      visible: true,
    },
    {
      kind: "setFrame",
      id: "cta-bg",
      frame: {
        kind: "anchor",
        left: 72,
        top: 390,
        width: 188,
        height: 48,
      },
    },
  ],
  null,
  2,
);

type CommandLogEntry = {
  id: string;
  timestamp: string;
  commands: CanvasCommand[];
  results: CanvasCommandApplyResult[];
};

type SpriteFrameEditSettings = {
  snapToGrid: boolean;
  gridSize: number;
  constrainFrameEditsToGuideRegion: boolean;
  datumSnapDistance: number;
  restrictDatumSnapsToGuideRegion: boolean;
};

type SpriteDragState = {
  sidecarId: string;
  frameId: string;
  imageId: string;
  mode: "move" | "resize";
  startPoint: { x: number; y: number };
  currentPoint: { x: number; y: number };
  startRect: SpriteFrameRect;
};

type CanvasPanState = {
  startClientX: number;
  startClientY: number;
  startViewport: CanvasViewport;
};

type InspectorGroupId =
  | "selected-object"
  | "selected-sprite-frame"
  | "geometry"
  | "viewport"
  | "alignment"
  | "sprite-sidecar"
  | "sprite-audit"
  | "ui-component"
  | "view-aids"
  | "image-assets"
  | "export"
  | "command-diagnostics"
  | "metadata";

type AppViewData = {
  activeMode: CanvasEditorModeTemplate;
  document: CanvasDocument;
  viewport: CanvasViewport;
  aidToggles: CanvasAidToggles;
  lastCommand: string;
  commandJson: string;
  commandValidation: CanvasCommandValidationResult | undefined;
  commandLog: CommandLogEntry[];
  commandLogCollapsed: boolean;
  lastApplyResults: CanvasCommandApplyResult[];
  terminalLog: CanvasTerminalLogEntry[];
  terminalCollapsed: boolean;
  terminalInput: string;
  spriteFrameEditSettings: SpriteFrameEditSettings;
  lastToolResult: CanvasToolResult | undefined;
  geometryDiagnostics: GeometryDiagnostic[];
  exportArtifacts: readonly CanvasExportArtifact[];
  exportCart: CanvasExportCart;
  exportPresets: readonly CanvasExportPreset[];
  checkpointNote: string;
  lastCheckout: CanvasExportCheckoutResult | undefined;
  exportBundle: CanvasExportBundle | undefined;
  exportValidation: CanvasExportValidationResult | undefined;
  selectedExportPath: string | undefined;
  exportStatus: string;
  rasterScale: number;
  rasterBackground: RasterExportBackground;
  rasterArtifact: RasterExportArtifact | undefined;
  rasterStatus: string;
  isToolGroupVisible: (group: CanvasToolGroupId) => boolean;
  returnToModeSelection: () => void;
  setViewport: (viewport: CanvasViewport | ((current: CanvasViewport) => CanvasViewport)) => void;
  setAidToggle: (key: keyof CanvasAidToggles, value: boolean) => void;
  fitViewport: () => void;
  setZoom: (zoom: number) => void;
  zoomToSelected: () => void;
  zoomToGridRef: (ref: string) => void;
  zoomToGridSpan: (span: string) => void;
  runCommand: (command: CanvasCommand) => void;
  runCommands: (commands: CanvasCommand[]) => void;
  runTerminalCommand: (input: string) => void;
  setCommandLogCollapsed: (collapsed: boolean) => void;
  setTerminalCollapsed: (collapsed: boolean) => void;
  setSpriteFrameEditSettings: (settings: SpriteFrameEditSettings) => void;
  setTerminalInput: (input: string) => void;
  runCanvasTool: (
    toolId: string,
    input: { targetObjectId?: string; options?: Record<string, unknown> },
  ) => Promise<void>;
  createLayerGroup: (title: string) => void;
  loadImageFile: (
    file: File,
    options?: { role?: CanvasImageRole; groupId?: string; attachToImageId?: string },
  ) => Promise<void>;
  loadSketchOverlayFile: (
    file: File,
    options?: { targetId?: string; groupId?: string },
  ) => Promise<void>;
  loadGuideSidecarFile: (
    file: File,
    options?: { targetId?: string; groupId?: string },
  ) => Promise<void>;
  loadBlockoutSidecarFile: (
    file: File,
    options?: { targetObjectId?: string; groupId?: string },
  ) => Promise<void>;
  createMechanicalAnnotationsSidecar: (options?: {
    targetObjectId?: string;
    groupId?: string;
  }) => Promise<void>;
  loadSpriteSidecarFile: (
    file: File,
    options?: { targetId?: string; groupId?: string },
  ) => Promise<void>;
  setCommandJson: (commandJson: string) => void;
  loadExampleCommands: () => void;
  validateCommandJson: () => void;
  applyCommandJson: () => void;
  generateExport: () => void;
  generateTsxExport: () => void;
  applyExportPreset: (presetId: string) => void;
  toggleExportArtifact: (artifactId: string) => void;
  checkoutExportCart: () => Promise<void>;
  saveCheckpoint: (message?: string) => Promise<void>;
  setCheckpointNote: (value: string) => void;
  setRasterScale: (scale: number) => void;
  setRasterBackground: (background: RasterExportBackground) => void;
  generatePngExport: () => Promise<void>;
  selectExportFile: (path: string) => void;
  copySelectedExportFile: () => void;
  copyValidationReport: () => void;
  downloadSelectedExportFile: () => void;
  downloadRasterArtifact: () => void;
};

type RasterExportArtifact = {
  path: string;
  mimeType: string;
  blob: Blob;
  size: number;
};

function getRootRect(): Rect {
  if (typeof window === "undefined") {
    return { x: 0, y: 0, width: 1440, height: 900 };
  }

  return {
    x: 0,
    y: 0,
    width: Math.max(MIN_WIDTH, window.innerWidth),
    height: Math.max(MIN_HEIGHT, window.innerHeight),
  };
}

function useRootRect(): Rect {
  const [rect, setRect] = useState(getRootRect);

  useEffect(() => {
    const update = () => setRect(getRootRect());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return rect;
}

function readViewData(props: MachinaSlotProps): AppViewData {
  return props.viewData as AppViewData;
}

function getSelectedObject(document: CanvasDocument): CanvasObject | undefined {
  return document.selectedObjectId ? document.objects[document.selectedObjectId] : undefined;
}

function getOwnerImageForSelection(
  document: CanvasDocument,
  object: CanvasObject | undefined,
): ImageObject | undefined {
  if (!object) return undefined;
  if (object.kind === "image" && (object.role === undefined || object.role === "image")) {
    return object;
  }
  if (object.kind === "spriteSidecar" || object.kind === "sketchOverlay") {
    const targetId = object.targetId ?? object.spec.targetId;
    const target = targetId ? document.objects[targetId] : undefined;
    return target?.kind === "image" ? target : undefined;
  }
  if (object.kind === "mechanicalAnnotationSidecar") {
    const target = object.targetObjectId ? document.objects[object.targetObjectId] : undefined;
    return target?.kind === "image" ? target : undefined;
  }
  if (object.kind === "blockoutSidecar") {
    const target = object.targetObjectId ? document.objects[object.targetObjectId] : undefined;
    return target?.kind === "image" ? target : undefined;
  }
  if (object.kind === "guideSidecar") {
    const targetId = object.targetId ?? object.guide.target;
    const target = targetId ? document.objects[targetId] : undefined;
    return target?.kind === "image" ? target : undefined;
  }
  if (object.kind === "image" && (object.role === "alphaMap" || object.role === "mask")) {
    return Object.values(document.objects).find(
      (candidate): candidate is ImageObject =>
        candidate.kind === "image" &&
        (candidate.role === undefined || candidate.role === "image") &&
        candidate.alphaMapId === object.id,
    );
  }
  return undefined;
}

function getObjectLayer(document: CanvasDocument, object: CanvasObject | undefined) {
  if (!object) return undefined;
  return document.layers.find((layer) => layer.id === object.layerId);
}

function getDefaultImageLayerId(document: CanvasDocument): string {
  const selected = getSelectedObject(document);
  if (selected && document.layers.some((layer) => layer.id === selected.layerId)) {
    return selected.layerId;
  }

  return (
    document.layers.find((layer) => layer.id === "foreground")?.id ??
    document.layers.find((layer) => layer.visible)?.id ??
    document.layers[0]?.id ??
    "foreground"
  );
}

function getKindClass(object: CanvasObject): string {
  return matchEnum(object.kind, {
    rect: () => "kind-rect",
    ellipse: () => "kind-ellipse",
    path: () => "kind-rect",
    text: () => "kind-text",
    image: () => "kind-image",
    uiComponent: () => "kind-ui",
    sketchOverlay: () => "kind-sketch",
    spriteSidecar: () => "kind-sprite",
    guideSidecar: () => "kind-guide",
    blockoutSidecar: () => "kind-blockout",
    mechanicalAnnotationSidecar: () => "kind-guide",
  });
}

function getKindShortLabel(object: CanvasObject): string {
  return matchEnum(object.kind, {
    rect: () => "RECT",
    ellipse: () => "OVAL",
    path: () => "PATH",
    text: () => "TEXT",
    image: () =>
      object.kind === "image"
        ? object.role === "alphaMap"
          ? "ALPHA"
          : object.role === "mask"
            ? "MASK"
            : "IMG"
        : "IMG",
    uiComponent: () => "UI",
    sketchOverlay: () => "SKETCH",
    spriteSidecar: () => "SPRITE",
    guideSidecar: () => "GUIDE",
    blockoutSidecar: () => "BLOCK",
    mechanicalAnnotationSidecar: () => "ANNO",
  });
}

function getSketchOverlayForImage(document: CanvasDocument, object: ImageObject) {
  if (!object.sketchOverlayId) return undefined;
  const overlay = document.objects[object.sketchOverlayId];
  if (overlay?.kind !== "sketchOverlay" || overlay.targetId !== object.id) return undefined;
  return overlay;
}

function getSpriteSidecarForImage(document: CanvasDocument, object: ImageObject) {
  if (!object.spriteSidecarId) return undefined;
  const sidecar = document.objects[object.spriteSidecarId];
  if (sidecar?.kind !== "spriteSidecar" || sidecar.targetId !== object.id) return undefined;
  return sidecar;
}

function getSpriteSidecarTarget(document: CanvasDocument, object: SpriteSidecarObject) {
  if (!object.targetId) return undefined;
  const target = document.objects[object.targetId];
  if (target?.kind !== "image") return undefined;
  return target;
}

function getGuideSidecarsForImage(
  document: CanvasDocument,
  object: ImageObject,
): readonly GuideSidecarObject[] {
  return Object.values(document.objects).filter(
    (candidate): candidate is GuideSidecarObject =>
      candidate.kind === "guideSidecar" && candidate.targetId === object.id,
  );
}

function getBlockoutSidecarsForObject(
  document: CanvasDocument,
  object: CanvasObject,
): readonly BlockoutSidecarObject[] {
  return Object.values(document.objects).filter(
    (candidate): candidate is BlockoutSidecarObject =>
      candidate.kind === "blockoutSidecar" && candidate.targetObjectId === object.id,
  );
}

function getMechanicalAnnotationSidecarsForObject(
  document: CanvasDocument,
  object: CanvasObject,
): readonly MechanicalAnnotationSidecarObject[] {
  return Object.values(document.objects).filter(
    (candidate): candidate is MechanicalAnnotationSidecarObject =>
      candidate.kind === "mechanicalAnnotationSidecar" && candidate.targetObjectId === object.id,
  );
}

function formatSpriteAuditScope(scope: SpriteAuditScope) {
  return scope === "selectedFrame" ? "selected frame only" : "all frames";
}

function downloadBlobFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  window.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

type SpriteAuditArtifact = {
  scope: SpriteAuditScope;
  report: SpriteAuditReport;
  text: string;
};

type SpriteAuditScreenshotArtifact = {
  path: string;
  mimeType: string;
  blob: Blob;
  size: number;
  url: string;
};

function getDiagnosticClass(diagnostic: GeometryDiagnostic): string {
  return matchEnum(diagnostic.severity, {
    info: () => "diagnostic-info",
    warning: () => "diagnostic-warning",
  });
}

function makeInvalidJsonResult(message: string): CanvasCommandValidationResult {
  return {
    ok: false,
    diagnostics: [
      {
        severity: "error",
        code: "InvalidJson",
        message,
      },
    ],
  };
}

function parseCommandJson(
  commandJson: string,
): { ok: true; value: unknown } | { ok: false; validation: CanvasCommandValidationResult } {
  try {
    return { ok: true, value: JSON.parse(commandJson) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command JSON could not be parsed.";
    return { ok: false, validation: makeInvalidJsonResult(message) };
  }
}

function normalizeCommands(commands: unknown): CanvasCommand[] {
  return (Array.isArray(commands) ? commands : [commands]) as CanvasCommand[];
}

function formatCommandKinds(commands: readonly CanvasCommand[]): string {
  return commands.map((command) => commandKindLabels[command.kind]).join(", ");
}

function formatChange(change: CanvasCommandApplyResult["changes"][number]): string {
  return `${change.objectId}.${change.field}: ${String(change.before)} -> ${String(change.after)}`;
}

function formatBlobSize(size: number): string {
  if (size < 1024) return `${size.toLocaleString()} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 1024 / 102.4) / 10} MB`;
}

function formatDocumentSize(document: CanvasDocument): string {
  const unitSystem = getCanvasUnitSystem(document);
  return `${formatCanvasMeasurement(document.width, unitSystem)} x ${formatCanvasMeasurement(
    document.height,
    unitSystem,
  )}`;
}

function formatFrameIntent(frame: CanvasFrame | undefined): string {
  if (!frame) return "kind: implicit absolute";

  const entries = Object.entries(frame).filter(([, value]) => value !== undefined);
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join("; ");
}

function getSelectedExportFile(
  bundle: CanvasExportBundle | undefined,
  selectedPath: string | undefined,
): CanvasExportFile | undefined {
  if (!bundle) return undefined;
  return bundle.files.find((file) => file.path === selectedPath) ?? bundle.files[0];
}

function isToolGroupVisibleForMode(
  mode: CanvasEditorModeTemplate,
  group: CanvasToolGroupId,
): boolean {
  return mode.visibleToolGroups?.includes(group) ?? true;
}

function SceneTree(props: MachinaSlotProps) {
  const {
    activeMode,
    createLayerGroup,
    createMechanicalAnnotationsSidecar,
    document,
    loadBlockoutSidecarFile,
    loadGuideSidecarFile,
    loadImageFile,
    loadSketchOverlayFile,
    loadSpriteSidecarFile,
    returnToModeSelection,
    runCommand,
  } = readViewData(props);

  return (
    <CanvasLayerPanel
      activeModeTitle={activeMode.title}
      document={document}
      onClearSelection={() => runCommand({ kind: "select" })}
      onCreateGroup={createLayerGroup}
      onCreateMechanicalAnnotations={(options) => createMechanicalAnnotationsSidecar(options)}
      onLoadAlphaMask={(file, options) =>
        loadImageFile(file, {
          role: "alphaMap",
          groupId: options?.groupId,
          attachToImageId: options?.attachToImageId,
        })
      }
      onLoadImage={(file, options) =>
        loadImageFile(file, {
          role: options?.role ?? "image",
          groupId: options?.groupId,
        })
      }
      onLoadGuideToml={(file, options) => loadGuideSidecarFile(file, options)}
      onLoadBlockoutToml={(file, options) => loadBlockoutSidecarFile(file, options)}
      onLoadSketchToml={(file, options) => loadSketchOverlayFile(file, options)}
      onLoadSpriteToml={(file, options) => loadSpriteSidecarFile(file, options)}
      onReturnToModeSelection={returnToModeSelection}
      onSelectObject={(id) => runCommand({ kind: "select", id })}
      onToggleObjectVisibility={(id, visible) => {
        const object = document.objects[id];
        if (!object) return;
        if (object.kind === "guideSidecar") {
          runCommand({ kind: "setGuideSidecarVisible", guideId: id, visible });
          return;
        }
        if (object.kind === "blockoutSidecar") {
          runCommand({ kind: "setBlockoutSidecarVisible", blockoutId: id, visible });
          return;
        }
        if (object.kind === "spriteSidecar") {
          runCommand({ kind: "setSpriteSidecarVisible", sidecarId: id, visible });
          return;
        }
        if (object.kind === "sketchOverlay") {
          runCommand({ kind: "setSketchOverlayVisible", overlayId: id, visible });
        }
      }}
    />
  );
}

function wrapText(object: TextObject): string[] {
  const maxChars = Math.max(8, Math.floor(object.width / (object.fontSize * 0.48)));
  const words = object.text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function SceneObjectSvg({
  object,
  alphaMap,
  selected,
  onSelect,
}: {
  object: CanvasObject;
  alphaMap?: ImageObject;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  if (!object.visible) return null;
  if (
    object.kind === "sketchOverlay" ||
    object.kind === "spriteSidecar" ||
    object.kind === "guideSidecar" ||
    object.kind === "blockoutSidecar" ||
    object.kind === "mechanicalAnnotationSidecar"
  ) {
    return null;
  }

  const common = {
    "data-canvas-object-id": object.id,
    "data-canvas-kind": object.kind,
    "data-canvas-name": object.name,
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      onSelect(object.id);
    },
  };

  const shape =
    object.kind === "rect" ? (
      <rect
        {...common}
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        rx={object.radius ?? 0}
        fill={object.fill ?? "transparent"}
        stroke={object.stroke ?? "none"}
      />
    ) : object.kind === "ellipse" ? (
      <ellipse
        {...common}
        cx={object.x + object.width / 2}
        cy={object.y + object.height / 2}
        rx={object.width / 2}
        ry={object.height / 2}
        fill={object.fill ?? "transparent"}
        stroke={object.stroke ?? "none"}
      />
    ) : object.kind === "path" ? (
      <path
        {...common}
        d={object.d}
        fill={object.fill ?? "transparent"}
        fillRule={object.fillRule}
        stroke={object.stroke ?? "none"}
        strokeWidth={object.strokeWidth ?? 1}
        strokeDasharray={object.strokeDasharray}
      />
    ) : object.kind === "text" ? (
      <text
        {...common}
        x={object.x}
        y={object.y + object.fontSize}
        fill={object.fill ?? "#111111"}
        fontSize={object.fontSize}
        fontWeight={object.fontWeight}
      >
        {wrapText(object).map((line, index) => (
          <tspan key={line} x={object.x} dy={index === 0 ? 0 : object.fontSize * 1.12}>
            {line}
          </tspan>
        ))}
      </text>
    ) : object.kind === "uiComponent" ? (
      <foreignObject
        {...common}
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
      >
        <div className="canvas-ui-preview-shell">
          {(() => {
            try {
              const PreviewComponent = getCanvasUiComponentDefinition(object.componentId).preview;
              return <PreviewComponent object={object} selected={selected} />;
            } catch {
              return (
                <div className="canvas-ui-preview-missing">
                  Unknown component {object.componentId}
                </div>
              );
            }
          })()}
        </div>
      </foreignObject>
    ) : (
      <image
        {...common}
        href={object.src}
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        preserveAspectRatio={getImagePreserveAspectRatio(object.fit)}
        opacity={object.opacity}
        mask={alphaMap ? `url(#${getCanvasImageMaskId(object.id)})` : undefined}
      />
    );

  return (
    <g className={`canvas-object ${selected ? "is-selected" : ""}`}>
      {shape}
      {selected ? (
        <rect
          className="selection-box"
          x={object.x - 5}
          y={object.y - 5}
          width={object.width + 10}
          height={object.height + 10}
          rx={4}
        />
      ) : null}
    </g>
  );
}

function SketchOverlaySvg({
  document,
  overlay,
  selected,
}: {
  document: CanvasDocument;
  overlay: Extract<CanvasObject, { kind: "sketchOverlay" }>;
  selected: boolean;
}) {
  const primitives = resolveSketchSpec(document, overlay.spec);

  return (
    <g
      className={`canvas-sketch-overlay ${selected ? "is-selected" : ""}`}
      data-canvas-object-id={overlay.id}
      data-canvas-kind={overlay.kind}
      data-canvas-name={overlay.name}
      pointerEvents="none"
    >
      {primitives.map((primitive) => {
        if (primitive.kind === "box") {
          return (
            <rect
              className="canvas-sketch-box"
              data-canvas-sketch-id={primitive.id}
              fill={primitive.fill ?? "transparent"}
              height={primitive.rect.height}
              key={primitive.id}
              stroke={primitive.stroke ?? "#2364d2"}
              width={primitive.rect.width}
              x={primitive.rect.x}
              y={primitive.rect.y}
            />
          );
        }
        if (primitive.kind === "line") {
          return (
            <line
              className="canvas-sketch-line"
              data-canvas-sketch-id={primitive.id}
              key={primitive.id}
              stroke={primitive.stroke ?? "#2364d2"}
              x1={primitive.from.x}
              x2={primitive.to.x}
              y1={primitive.from.y}
              y2={primitive.to.y}
            />
          );
        }
        if (primitive.kind === "point") {
          return (
            <circle
              className="canvas-sketch-point"
              cx={primitive.point.x}
              cy={primitive.point.y}
              data-canvas-sketch-id={primitive.id}
              fill={primitive.fill ?? "#ffffff"}
              key={primitive.id}
              r={5}
              stroke={primitive.stroke ?? "#2364d2"}
            />
          );
        }
        return (
          <text
            className="canvas-sketch-label"
            data-canvas-sketch-id={primitive.id}
            key={primitive.id}
            x={primitive.point.x}
            y={primitive.point.y}
          >
            {primitive.text}
          </text>
        );
      })}
      {selected ? (
        <rect
          className="selection-box"
          height={overlay.height + 10}
          rx={4}
          width={overlay.width + 10}
          x={overlay.x - 5}
          y={overlay.y - 5}
        />
      ) : null}
    </g>
  );
}

function SpriteSidecarSvg({
  image,
  sidecar,
  selected,
  selectedGuideRegionContext,
  draftRect,
  hoveredFrameId,
  onFramePointerDown,
  onFramePointerEnter,
  onFramePointerLeave,
  onResizeHandlePointerDown,
}: {
  image: ImageObject;
  sidecar: SpriteSidecarObject;
  selected: boolean;
  selectedGuideRegionContext?: SpriteFrameGuideRegionContext;
  draftRect?: SpriteFrameRect;
  hoveredFrameId?: string;
  onFramePointerDown: (event: ReactPointerEvent<SVGRectElement>, frame: CanvasSpriteFrame) => void;
  onFramePointerEnter: (frameId: string) => void;
  onFramePointerLeave: (frameId: string) => void;
  onResizeHandlePointerDown: (
    event: ReactPointerEvent<SVGRectElement>,
    frame: CanvasSpriteFrame,
  ) => void;
}) {
  if (!sidecar.visible) return null;

  const selectedFrameId = sidecar.spec.selectedFrameId;
  const plan = createSpriteOverlayRenderPlan(sidecar, { hoveredFrameId });
  const imageRect = { x: image.x, y: image.y, width: image.width, height: image.height };

  return (
    <g
      className={`canvas-sprite-overlay ${selected ? "is-selected" : ""}`}
      data-canvas-object-id={sidecar.id}
      data-canvas-kind={sidecar.kind}
      data-canvas-name={sidecar.name}
    >
      {sidecar.spec.grids.map((grid) => {
        const presentation = plan.subgridPresentations.get(grid.id);
        if (!presentation?.showRect) return null;
        const rect = mapSpriteFrameToCanvasRect(image, grid);
        const fill =
          presentation.emphasis === "context"
            ? "rgba(23, 91, 201, 0.06)"
            : "rgba(23, 91, 201, 0.02)";
        const stroke = presentation.emphasis === "context" ? "#175bc9" : "#7f9bc6";
        return (
          <Fragment key={`subgrid:${grid.id}`}>
            <rect
              className={getSpriteOverlaySubgridClassNames(presentation)}
              data-canvas-sprite-subgrid-id={grid.id}
              fill={fill}
              height={rect.height}
              stroke={stroke}
              strokeDasharray={presentation.emphasis === "context" ? "10 6" : "6 8"}
              width={rect.width}
              x={rect.x}
              y={rect.y}
            />
            {presentation.showLabel ? (
              <text
                className={`canvas-sprite-subgrid-label${presentation.emphasis === "context" ? " sprite-subgrid--context" : presentation.emphasis === "dimmed" ? " sprite-subgrid--dimmed" : ""}`}
                data-canvas-sprite-subgrid-id={grid.id}
                x={rect.x + 6}
                y={rect.y + 16}
              >
                {grid.id}
              </text>
            ) : null}
          </Fragment>
        );
      })}
      {sidecar.spec.frames.map((frame) => {
        const presentation = plan.framePresentations.get(frame.id);
        if (!presentation) return null;
        const frameGuideRegionContext =
          frame.id === sidecar.spec.selectedFrameId ? selectedGuideRegionContext : undefined;
        const rect =
          draftRect && frame.id === selectedFrameId
            ? mapSpriteFrameToCanvasRect(image, draftRect)
            : mapSpriteFrameToCanvasRect(image, frame);
        const chip = presentation.showLabel
          ? buildSpriteOverlayLabelChip(frame, presentation.sourceKind, presentation.emphasis)
          : undefined;
        const chipLayout =
          chip !== undefined ? layoutSpriteOverlayLabelChip(rect, imageRect, chip) : undefined;
        const fill =
          presentation.emphasis === "selected"
            ? "rgba(255, 196, 0, 0.18)"
            : presentation.emphasis === "hovered"
              ? "rgba(255, 196, 0, 0.1)"
              : presentation.sourceKind === "grid"
                ? presentation.emphasis === "dimmed"
                  ? "rgba(0, 160, 140, 0.03)"
                  : "rgba(0, 160, 140, 0.08)"
                : presentation.emphasis === "dimmed"
                  ? "rgba(201, 95, 23, 0.03)"
                  : "rgba(201, 95, 23, 0.08)";
        const stroke =
          presentation.emphasis === "selected"
            ? "#ffb000"
            : presentation.emphasis === "hovered"
              ? "#ffcf5d"
              : presentation.emphasis === "audit"
                ? "#d64242"
                : presentation.emphasis === "dimmed"
                  ? presentation.sourceKind === "grid"
                    ? "#8abaae"
                    : "#d9a27f"
                  : presentation.sourceKind === "grid"
                    ? "#00a08c"
                    : presentation.sourceKind === "manual"
                      ? "#8f3fd1"
                      : "#c95f17";
        return (
          <Fragment key={frame.id}>
            <rect
              className="canvas-sprite-frame-hit"
              data-canvas-sprite-frame-id={frame.id}
              fill="transparent"
              height={rect.height}
              onPointerDown={(event) => onFramePointerDown(event, frame)}
              onPointerEnter={() => onFramePointerEnter(frame.id)}
              onPointerLeave={() => onFramePointerLeave(frame.id)}
              stroke="transparent"
              strokeWidth={12}
              width={rect.width}
              x={rect.x}
              y={rect.y}
            />
            {presentation.showRect ? (
              <rect
                className={`${getSpriteOverlayFrameClassNames(presentation)}${
                  frameGuideRegionContext &&
                  frame.id === sidecar.spec.selectedFrameId &&
                  frameGuideRegionContext.relation !== "contains"
                    ? " sprite-frame--outside-guide"
                    : ""
                }`}
                data-canvas-sprite-frame-id={frame.id}
                data-canvas-sprite-source-kind={presentation.sourceKind}
                fill={fill}
                height={rect.height}
                stroke={stroke}
                width={rect.width}
                x={rect.x}
                y={rect.y}
              />
            ) : null}
            {presentation.showLabel && chip && chipLayout ? (
              <Fragment>
                <rect
                  className={`canvas-sprite-label-chip${presentation.labelTone === "selected" ? " sprite-frame-label--selected" : presentation.labelTone === "hovered" ? " sprite-frame-label--hovered" : presentation.labelTone === "audit" ? " sprite-frame-label--audit" : ""}`}
                  data-canvas-sprite-frame-id={frame.id}
                  fill={
                    presentation.labelTone === "selected"
                      ? "#111111"
                      : presentation.labelTone === "hovered"
                        ? "#1f463f"
                        : presentation.labelTone === "audit"
                          ? "#5a1f1f"
                          : "#1b1b1b"
                  }
                  height={chipLayout.height}
                  rx={6}
                  ry={6}
                  width={chipLayout.width}
                  x={chipLayout.x}
                  y={chipLayout.y}
                />
                <text
                  className={`canvas-sprite-label${presentation.labelTone === "selected" ? " sprite-frame-label--selected" : presentation.labelTone === "hovered" ? " sprite-frame-label--hovered" : presentation.labelTone === "audit" ? " sprite-frame-label--audit" : ""}`}
                  data-canvas-sprite-frame-id={frame.id}
                  x={chipLayout.x + 8}
                  y={chipLayout.titleY}
                >
                  {chip.title}
                </text>
                {chip.detail && chipLayout.detailY !== undefined ? (
                  <text
                    className="canvas-sprite-label-meta"
                    data-canvas-sprite-frame-id={frame.id}
                    x={chipLayout.x + 8}
                    y={chipLayout.detailY}
                  >
                    {chip.detail}
                  </text>
                ) : null}
              </Fragment>
            ) : null}
            {presentation.showHandle ? (
              <rect
                className="canvas-sprite-resize-handle"
                fill="#ffb000"
                height={10}
                onPointerDown={(event) => onResizeHandlePointerDown(event, frame)}
                width={10}
                x={rect.x + rect.width - 5}
                y={rect.y + rect.height - 5}
              />
            ) : null}
          </Fragment>
        );
      })}
      {selected ? (
        <rect
          className="selection-box"
          height={sidecar.height + 10}
          rx={4}
          width={sidecar.width + 10}
          x={sidecar.x - 5}
          y={sidecar.y - 5}
        />
      ) : null}
    </g>
  );
}

function GuideSidecarSvg({
  image,
  guideObject,
  selected,
  selectedDatumTargets,
  selectedGuideRegionContext,
}: {
  image: ImageObject;
  guideObject: GuideSidecarObject;
  selected: boolean;
  selectedDatumTargets: readonly SpriteFrameDatumSnapTarget[];
  selectedGuideRegionContext?: SpriteFrameGuideRegionContext;
}) {
  if (!guideObject.visible) return null;

  const scaleX = image.width / (image.intrinsicWidth ?? image.width);
  const scaleY = image.height / (image.intrinsicHeight ?? image.height);
  const mapPoint = (x: number, y: number) => ({
    x: image.x + x * scaleX,
    y: image.y + y * scaleY,
  });
  const diagnostics = validateGuideSidecar(guideObject.guide, {
    imageWidth: image.intrinsicWidth ?? image.width,
    imageHeight: image.intrinsicHeight ?? image.height,
  });
  const selectedDatumIds = new Set(selectedDatumTargets.map((target) => target.datumId));
  const nearestDatumId = selectedDatumTargets[0]?.datumId;
  const opacity = guideObject.opacity ?? 0.9;
  const showLabels = guideObject.showLabels ?? true;

  return (
    <g
      className={`canvas-guide-overlay ${selected ? "is-selected" : ""}`}
      data-canvas-object-id={guideObject.id}
      data-canvas-kind={guideObject.kind}
      data-canvas-name={guideObject.name}
      opacity={opacity}
      pointerEvents="none"
    >
      {guideObject.guide.regions.map((region) => {
        const origin = mapPoint(region.x, region.y);
        const width = region.width * scaleX;
        const height = region.height * scaleY;
        const grid = region.grid;
        const isSelectedContextRegion =
          selectedGuideRegionContext?.guideSidecarId === guideObject.id &&
          selectedGuideRegionContext.regionId === region.id;
        const isWarningRegion =
          isSelectedContextRegion && selectedGuideRegionContext.relation !== "contains";
        return (
          <Fragment key={`guide-region:${region.id}`}>
            <rect
              className={`canvas-guide-region${
                isSelectedContextRegion ? " guide-region--selected-context" : ""
              }${isWarningRegion ? " guide-region--warning" : ""}`}
              data-canvas-guide-region-id={region.id}
              x={origin.x}
              y={origin.y}
              width={width}
              height={height}
              fill={isSelectedContextRegion ? "rgba(255, 122, 0, 0.1)" : "rgba(233, 77, 26, 0.06)"}
              stroke={isWarningRegion ? "#d64242" : isSelectedContextRegion ? "#ff7a00" : "#e94d1a"}
              strokeDasharray={isWarningRegion ? "10 4" : isSelectedContextRegion ? "10 5" : "8 6"}
            />
            {showLabels ? (
              <text className="canvas-guide-label" x={origin.x + 6} y={origin.y + 16}>
                {region.id}
              </text>
            ) : null}
            {grid
              ? Array.from({ length: grid.columns - 1 }, (_, index) => {
                  const lineX = origin.x + (index + 1) * grid.cellWidth * scaleX;
                  return (
                    <line
                      className="canvas-guide-grid"
                      key={`guide-grid-col:${region.id}:${index}`}
                      x1={lineX}
                      y1={origin.y}
                      x2={lineX}
                      y2={origin.y + height}
                      stroke="#f58d61"
                    />
                  );
                })
              : null}
            {grid
              ? Array.from({ length: grid.rows - 1 }, (_, index) => {
                  const lineY = origin.y + (index + 1) * grid.cellHeight * scaleY;
                  return (
                    <line
                      className="canvas-guide-grid"
                      key={`guide-grid-row:${region.id}:${index}`}
                      x1={origin.x}
                      y1={lineY}
                      x2={origin.x + width}
                      y2={lineY}
                      stroke="#f58d61"
                    />
                  );
                })
              : null}
          </Fragment>
        );
      })}
      {guideObject.guide.datums.map((datum) => {
        const datumClassName = `canvas-guide-datum${
          selectedDatumIds.has(datum.id) ? " guide-datum--snap-target" : ""
        }${nearestDatumId === datum.id ? " guide-datum--nearest" : ""}`;
        if (datum.kind === "vertical") {
          const x = image.x + datum.x * scaleX;
          return (
            <g key={`guide-datum:${datum.id}`}>
              <line
                className={datumClassName}
                x1={x}
                y1={image.y}
                x2={x}
                y2={image.y + image.height}
                stroke="#d9480f"
              />
              {showLabels ? (
                <text className="canvas-guide-label" x={x + 4} y={image.y + 14}>
                  {datum.label ?? datum.id}
                </text>
              ) : null}
            </g>
          );
        }
        if (datum.kind === "horizontal") {
          const y = image.y + datum.y * scaleY;
          return (
            <g key={`guide-datum:${datum.id}`}>
              <line
                className={datumClassName}
                x1={image.x}
                y1={y}
                x2={image.x + image.width}
                y2={y}
                stroke="#d9480f"
              />
              {showLabels ? (
                <text className="canvas-guide-label" x={image.x + 6} y={y - 4}>
                  {datum.label ?? datum.id}
                </text>
              ) : null}
            </g>
          );
        }
        const point = mapPoint(datum.x, datum.y);
        return (
          <g key={`guide-datum:${datum.id}`}>
            <line
              className={datumClassName}
              x1={point.x - 6}
              y1={point.y}
              x2={point.x + 6}
              y2={point.y}
              stroke="#d9480f"
            />
            <line
              className={datumClassName}
              x1={point.x}
              y1={point.y - 6}
              x2={point.x}
              y2={point.y + 6}
              stroke="#d9480f"
            />
            {showLabels ? (
              <text className="canvas-guide-label" x={point.x + 8} y={point.y - 8}>
                {datum.label ?? datum.id}
              </text>
            ) : null}
          </g>
        );
      })}
      {guideObject.guide.dimensions.map((dimension) => {
        if (dimension.kind !== "linear" || !dimension.from || !dimension.to) return null;
        const from = mapPoint(dimension.from[0], dimension.from[1]);
        const to = mapPoint(dimension.to[0], dimension.to[1]);
        const labelX = (from.x + to.x) / 2;
        const labelY = (from.y + to.y) / 2 - 6;
        return (
          <g key={`guide-dimension:${dimension.id}`}>
            <line
              className="canvas-guide-dimension"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#ff7a00"
            />
            {showLabels ? (
              <text className="canvas-guide-label" x={labelX} y={labelY} textAnchor="middle">
                {dimension.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {guideObject.guide.alignmentMarks.map((mark) => {
        const point = mapPoint(mark.x, mark.y);
        return (
          <g key={`guide-mark:${mark.id}`}>
            <circle className="canvas-guide-mark" cx={point.x} cy={point.y} r={4} fill="#c92a2a" />
            <line x1={point.x - 8} y1={point.y} x2={point.x + 8} y2={point.y} stroke="#c92a2a" />
            <line x1={point.x} y1={point.y - 8} x2={point.x} y2={point.y + 8} stroke="#c92a2a" />
            {showLabels ? (
              <text className="canvas-guide-label" x={point.x + 8} y={point.y + 14}>
                {mark.label ?? mark.id}
              </text>
            ) : null}
          </g>
        );
      })}
      {showLabels && diagnostics.length > 0 ? (
        <text className="canvas-guide-label" x={image.x + 8} y={image.y + image.height - 8}>
          {`${diagnostics.length} guide finding${diagnostics.length === 1 ? "" : "s"}`}
        </text>
      ) : null}
      {selected ? (
        <rect
          className="selection-box"
          height={guideObject.height + 10}
          rx={4}
          width={guideObject.width + 10}
          x={guideObject.x - 5}
          y={guideObject.y - 5}
        />
      ) : null}
    </g>
  );
}

function BlockoutSidecarSvg({
  owner,
  sidecar,
  selected,
}: {
  owner: CanvasObject;
  sidecar: BlockoutSidecarObject;
  selected: boolean;
}) {
  if (!sidecar.visible) return null;

  const sourceWidth =
    owner.kind === "image" ? (owner.intrinsicWidth ?? owner.width) : sidecar.width || owner.width;
  const sourceHeight =
    owner.kind === "image"
      ? (owner.intrinsicHeight ?? owner.height)
      : sidecar.height || owner.height;
  const scaleX = owner.width / (sourceWidth || owner.width || 1);
  const scaleY = owner.height / (sourceHeight || owner.height || 1);
  const opacity = sidecar.opacity ?? 0.72;
  const showLabels = sidecar.showLabels ?? true;
  const mapPoint = (x: number, y: number) => ({
    x: owner.x + x * scaleX,
    y: owner.y + y * scaleY,
  });
  const diagnostics = validateBlockoutSidecar(sidecar.blockout);

  return (
    <g
      className={`canvas-blockout-overlay ${selected ? "is-selected" : ""}`}
      data-canvas-object-id={sidecar.id}
      data-canvas-kind={sidecar.kind}
      data-canvas-name={sidecar.name}
      opacity={opacity}
      pointerEvents="none"
    >
      {sidecar.blockout.boxes.map((box) => {
        const origin = mapPoint(box.x, box.y);
        const width = box.width * scaleX;
        const height = box.height * scaleY;
        const stroke =
          box.role === "construction" ? "#ff8c00" : box.role === "void" ? "#169c46" : "#13a538";
        const fill =
          box.role === "void"
            ? "rgba(19, 165, 56, 0.06)"
            : box.role === "construction"
              ? "rgba(255, 140, 0, 0.05)"
              : "rgba(19, 165, 56, 0.14)";
        return (
          <Fragment key={`blockout-box:${box.id}`}>
            <rect
              className={`canvas-blockout-box${
                box.role === "construction"
                  ? " blockout-role--construction"
                  : box.role === "void"
                    ? " blockout-role--void"
                    : ""
              }`}
              x={origin.x}
              y={origin.y}
              width={width}
              height={height}
              fill={fill}
              stroke={stroke}
              strokeDasharray={
                box.role === "construction" ? "7 4" : box.role === "void" ? "10 4" : "8 5"
              }
            />
            {showLabels ? (
              <text className="canvas-blockout-label" x={origin.x + 6} y={origin.y + 16}>
                {box.label ?? box.id}
              </text>
            ) : null}
          </Fragment>
        );
      })}
      {sidecar.blockout.points.map((point) => {
        const mapped = mapPoint(point.x, point.y);
        return (
          <g key={`blockout-point:${point.id}`}>
            <line
              className="canvas-blockout-point"
              x1={mapped.x - 6}
              y1={mapped.y}
              x2={mapped.x + 6}
              y2={mapped.y}
              stroke="#0f8f37"
            />
            <line
              className="canvas-blockout-point"
              x1={mapped.x}
              y1={mapped.y - 6}
              x2={mapped.x}
              y2={mapped.y + 6}
              stroke="#0f8f37"
            />
            {showLabels ? (
              <text className="canvas-blockout-label" x={mapped.x + 8} y={mapped.y - 8}>
                {point.label ?? point.id}
              </text>
            ) : null}
          </g>
        );
      })}
      {sidecar.blockout.curves.map((curve) => {
        if (curve.points.length < 2) return null;
        const mappedPoints = curve.points.map((point) => mapPoint(point[0], point[1]));
        const d = mappedPoints
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
          .join(" ");
        const stroke =
          curve.role === "construction" || curve.kind === "centerline" ? "#ff8c00" : "#13a538";
        return (
          <g key={`blockout-curve:${curve.id}`}>
            <path
              className={`canvas-blockout-curve${
                curve.role === "construction" || curve.kind === "centerline"
                  ? " blockout-role--construction"
                  : ""
              }`}
              d={d}
              fill="none"
              stroke={stroke}
              strokeDasharray={
                curve.role === "construction" || curve.kind === "centerline" ? "6 4" : "5 3"
              }
            />
            {showLabels ? (
              <text
                className="canvas-blockout-label"
                x={mappedPoints[0].x + 6}
                y={mappedPoints[0].y - 8}
              >
                {curve.label ?? curve.id}
              </text>
            ) : null}
          </g>
        );
      })}
      {showLabels && diagnostics.length > 0 ? (
        <text className="canvas-blockout-label" x={owner.x + 8} y={owner.y + owner.height - 8}>
          {`${diagnostics.length} blockout finding${diagnostics.length === 1 ? "" : "s"}`}
        </text>
      ) : null}
      {selected ? (
        <rect
          className="selection-box"
          height={sidecar.height + 10}
          rx={4}
          width={sidecar.width + 10}
          x={sidecar.x - 5}
          y={sidecar.y - 5}
        />
      ) : null}
    </g>
  );
}

function MechanicalAnnotationSidecarSvg({
  sidecar,
  selected,
}: {
  sidecar: MechanicalAnnotationSidecarObject;
  selected: boolean;
}) {
  if (!sidecar.visible) return null;

  const lineStroke = 0.35;
  const lightStroke = 0.25;
  const labelFontSize = 4.2;
  const noteFontSize = 4.4;
  const blockTitleFontSize = 4;
  const tableHeaderFontSize = 3.1;
  const tableCellFontSize = 3.6;
  const sheetLayout = getMechanicalSheetLayout(sidecar.annotations.sheet);

  const renderLinearDimension = (
    dimension: Extract<
      MechanicalAnnotationSidecarObject["annotations"]["dimensions"][number],
      { kind: "linear" | "aligned" }
    >,
  ) => {
    const dx = dimension.to[0] - dimension.from[0];
    const dy = dimension.to[1] - dimension.from[1];
    const length = Math.hypot(dx, dy) || 1;
    const normalX =
      dimension.kind === "linear" ? (dimension.axis === "horizontal" ? 0 : 1) : -dy / length;
    const normalY =
      dimension.kind === "linear" ? (dimension.axis === "horizontal" ? -1 : 0) : dx / length;
    const offset = dimension.offset ?? 18;
    const start = [
      dimension.from[0] + normalX * offset,
      dimension.from[1] + normalY * offset,
    ] as const;
    const end = [dimension.to[0] + normalX * offset, dimension.to[1] + normalY * offset] as const;
    return (
      <Fragment key={dimension.id}>
        <line
          className="canvas-mechanical-extension"
          stroke="#253043"
          strokeWidth={lightStroke}
          x1={dimension.from[0]}
          x2={start[0]}
          y1={dimension.from[1]}
          y2={start[1]}
        />
        <line
          className="canvas-mechanical-extension"
          stroke="#253043"
          strokeWidth={lightStroke}
          x1={dimension.to[0]}
          x2={end[0]}
          y1={dimension.to[1]}
          y2={end[1]}
        />
        <line
          className="canvas-mechanical-dimension"
          stroke="#253043"
          strokeWidth={lineStroke}
          x1={start[0]}
          x2={end[0]}
          y1={start[1]}
          y2={end[1]}
        />
        <text
          className="canvas-mechanical-label"
          fill="#253043"
          fontSize={labelFontSize}
          stroke="none"
          textAnchor="middle"
          x={(start[0] + end[0]) / 2}
          y={(start[1] + end[1]) / 2 - 4}
        >
          {formatMechanicalDimensionText(dimension, sidecar.annotations.units)}
        </text>
      </Fragment>
    );
  };

  const renderAngleDimension = (
    dimension: Extract<
      MechanicalAnnotationSidecarObject["annotations"]["dimensions"][number],
      { kind: "angle" }
    >,
  ) => {
    const radius = 22;
    const startAngle = Math.atan2(
      dimension.from[1] - dimension.center[1],
      dimension.from[0] - dimension.center[0],
    );
    const endAngle = Math.atan2(
      dimension.to[1] - dimension.center[1],
      dimension.to[0] - dimension.center[0],
    );
    const start = [
      dimension.center[0] + Math.cos(startAngle) * radius,
      dimension.center[1] + Math.sin(startAngle) * radius,
    ] as const;
    const end = [
      dimension.center[0] + Math.cos(endAngle) * radius,
      dimension.center[1] + Math.sin(endAngle) * radius,
    ] as const;
    const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
    const midAngle = startAngle + (endAngle - startAngle) / 2;
    const label = [
      dimension.center[0] + Math.cos(midAngle) * (radius + 14),
      dimension.center[1] + Math.sin(midAngle) * (radius + 14),
    ] as const;
    return (
      <Fragment key={dimension.id}>
        <line
          className="canvas-mechanical-extension"
          stroke="#253043"
          strokeWidth={lightStroke}
          x1={dimension.center[0]}
          x2={dimension.from[0]}
          y1={dimension.center[1]}
          y2={dimension.from[1]}
        />
        <line
          className="canvas-mechanical-extension"
          stroke="#253043"
          strokeWidth={lightStroke}
          x1={dimension.center[0]}
          x2={dimension.to[0]}
          y1={dimension.center[1]}
          y2={dimension.to[1]}
        />
        <path
          className="canvas-mechanical-dimension"
          d={`M ${start[0]} ${start[1]} A ${radius} ${radius} 0 ${largeArc} 1 ${end[0]} ${end[1]}`}
          fill="none"
          stroke="#253043"
          strokeWidth={lineStroke}
        />
        <text
          className="canvas-mechanical-label"
          fill="#253043"
          fontSize={labelFontSize}
          stroke="none"
          textAnchor="middle"
          x={label[0]}
          y={label[1]}
        >
          {formatMechanicalDimensionText(dimension, sidecar.annotations.units)}
        </text>
      </Fragment>
    );
  };

  const renderCircularDimension = (
    dimension: Extract<
      MechanicalAnnotationSidecarObject["annotations"]["dimensions"][number],
      { kind: "radius" | "diameter" }
    >,
  ) => {
    const radius = dimension.kind === "radius" ? dimension.radius : dimension.diameter / 2;
    const anchor = [dimension.center[0] + radius, dimension.center[1]] as const;
    return (
      <Fragment key={dimension.id}>
        <line
          className="canvas-mechanical-dimension"
          stroke="#253043"
          strokeWidth={lineStroke}
          x1={dimension.center[0]}
          x2={anchor[0]}
          y1={dimension.center[1]}
          y2={anchor[1]}
        />
        <circle
          className="canvas-mechanical-center-mark"
          cx={dimension.center[0]}
          cy={dimension.center[1]}
          fill="#253043"
          r={1.4}
          stroke="none"
        />
        <text
          className="canvas-mechanical-label"
          fill="#253043"
          fontSize={labelFontSize}
          stroke="none"
          x={anchor[0] + 18}
          y={anchor[1] - 8}
        >
          {formatMechanicalDimensionText(dimension, sidecar.annotations.units)}
        </text>
      </Fragment>
    );
  };

  const renderBlock = (
    block: MechanicalAnnotationSidecarObject["annotations"]["blocks"][number],
  ) => {
    if (block.kind === "titleBlock") {
      const entries = getMechanicalTitleBlockEntries(sidecar.annotations, block);
      const rowHeight = Math.max(5.2, (block.height - 7) / Math.max(entries.length, 1));
      return (
        <g className="canvas-mechanical-block" data-canvas-mechanical-id={block.id} key={block.id}>
          <rect
            fill="#ffffff"
            height={block.height}
            stroke="#253043"
            strokeWidth={lineStroke}
            width={block.width}
            x={block.x}
            y={block.y}
          />
          <text
            className="canvas-mechanical-block-title"
            fill="#253043"
            fontSize={blockTitleFontSize}
            fontWeight={700}
            stroke="none"
            x={block.x + 3}
            y={block.y + 5.5}
          >
            TITLE BLOCK
          </text>
          {entries.map(([key, value], index) => {
            const rowY = block.y + 7 + index * rowHeight;
            return (
              <Fragment key={`${block.id}:${key}`}>
                {index > 0 ? (
                  <line
                    stroke="#253043"
                    strokeWidth={lightStroke}
                    x1={block.x}
                    x2={block.x + block.width}
                    y1={rowY}
                    y2={rowY}
                  />
                ) : null}
                <text
                  className="canvas-mechanical-table-header"
                  fill="#253043"
                  fontSize={tableHeaderFontSize}
                  fontWeight={700}
                  stroke="none"
                  x={block.x + 3}
                  y={rowY + 4.2}
                >
                  {key}
                </text>
                <text
                  className="canvas-mechanical-table-cell"
                  fill="#253043"
                  fontSize={tableCellFontSize}
                  stroke="none"
                  x={block.x + Math.max(24, block.width * 0.34)}
                  y={rowY + 4.4}
                >
                  {value}
                </text>
              </Fragment>
            );
          })}
        </g>
      );
    }

    const { width, height, columnWidth, rowHeight } = getMechanicalTableRenderMetrics(
      sidecar.annotations,
      block,
    );
    const title = block.kind === "revisionTable" ? "REVISIONS" : "BOM";
    return (
      <g className="canvas-mechanical-block" data-canvas-mechanical-id={block.id} key={block.id}>
        <text
          className="canvas-mechanical-block-title"
          fill="#253043"
          fontSize={blockTitleFontSize}
          fontWeight={700}
          stroke="none"
          x={block.x}
          y={block.y - 2}
        >
          {title}
        </text>
        <rect
          className="canvas-mechanical-table"
          fill="#ffffff"
          height={height}
          stroke="#253043"
          strokeWidth={lineStroke}
          width={width}
          x={block.x}
          y={block.y}
        />
        {block.columns.map((column, columnIndex) => (
          <text
            className="canvas-mechanical-table-header"
            fill="#253043"
            fontSize={tableHeaderFontSize}
            fontWeight={700}
            key={`${block.id}:header:${column}`}
            stroke="none"
            x={block.x + columnIndex * columnWidth + 2.5}
            y={block.y + 5.7}
          >
            {column}
          </text>
        ))}
        {Array.from({ length: block.columns.length - 1 }, (_, index) => {
          const x = block.x + (index + 1) * columnWidth;
          return (
            <line
              className="canvas-mechanical-table-line"
              key={`${block.id}:col:${index}`}
              stroke="#253043"
              strokeWidth={lightStroke}
              x1={x}
              x2={x}
              y1={block.y}
              y2={block.y + height}
            />
          );
        })}
        {Array.from({ length: block.rows.length }, (_, index) => {
          const y = block.y + (index + 1) * rowHeight;
          return (
            <line
              className="canvas-mechanical-table-line"
              key={`${block.id}:row:${index}`}
              stroke="#253043"
              strokeWidth={lightStroke}
              x1={block.x}
              x2={block.x + width}
              y1={y}
              y2={y}
            />
          );
        })}
        {block.rows.map((row, rowIndex) =>
          block.columns.map((column, columnIndex) => (
            <text
              className="canvas-mechanical-table-cell"
              fill="#253043"
              fontSize={tableCellFontSize}
              key={`${block.id}:${rowIndex}:${column}`}
              stroke="none"
              x={block.x + columnIndex * columnWidth + 2.5}
              y={block.y + (rowIndex + 2) * rowHeight - 2.6}
            >
              {String(row[column] ?? "")}
            </text>
          )),
        )}
      </g>
    );
  };

  return (
    <g
      className={`canvas-mechanical-overlay ${selected ? "is-selected" : ""}`}
      data-canvas-object-id={sidecar.id}
      data-canvas-kind={sidecar.kind}
      data-canvas-name={sidecar.name}
      fill="none"
      fontFamily="Arial, Helvetica, sans-serif"
      pointerEvents="none"
      stroke="#253043"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <g className="canvas-mechanical-sheet-frame" data-canvas-mechanical-sheet="A4-landscape">
        <rect
          className="canvas-mechanical-sheet-boundary"
          fill="#ffffff"
          height={sheetLayout.heightMm}
          stroke="#253043"
          strokeWidth={lineStroke}
          width={sheetLayout.widthMm}
          x={0}
          y={0}
        />
        <rect
          className="canvas-mechanical-sheet-margin"
          fill="none"
          height={sheetLayout.contentBoxMm.height}
          stroke="#7f8896"
          strokeDasharray="2 1.4"
          strokeWidth={lightStroke}
          width={sheetLayout.contentBoxMm.width}
          x={sheetLayout.contentBoxMm.x}
          y={sheetLayout.contentBoxMm.y}
        />
        <rect
          className="canvas-mechanical-sheet-content"
          fill="none"
          height={sheetLayout.contentBoxMm.height}
          stroke="#c7ccd4"
          strokeWidth={lightStroke}
          width={sheetLayout.contentBoxMm.width}
          x={sheetLayout.contentBoxMm.x}
          y={sheetLayout.contentBoxMm.y}
        />
      </g>
      {sidecar.annotations.dimensions.map((dimension) =>
        dimension.kind === "linear" || dimension.kind === "aligned"
          ? renderLinearDimension(dimension)
          : dimension.kind === "angle"
            ? renderAngleDimension(dimension)
            : renderCircularDimension(dimension),
      )}
      {sidecar.annotations.notes.map((note) => (
        <Fragment key={note.id}>
          {note.leaderTo ? (
            <line
              className="canvas-mechanical-note-leader"
              stroke="#253043"
              strokeWidth={lineStroke}
              x1={note.at[0]}
              x2={note.leaderTo[0]}
              y1={note.at[1]}
              y2={note.leaderTo[1]}
            />
          ) : null}
          <text
            className="canvas-mechanical-note"
            fill="#253043"
            fontSize={noteFontSize}
            fontWeight={700}
            stroke="none"
            x={note.at[0]}
            y={note.at[1]}
          >
            {note.text}
          </text>
        </Fragment>
      ))}
      {sidecar.annotations.datums.map((datum) => (
        <Fragment key={datum.id}>
          {datum.target ? (
            <line
              className="canvas-mechanical-datum-leader"
              stroke="#253043"
              strokeWidth={lineStroke}
              x1={datum.at[0]}
              x2={datum.target[0]}
              y1={datum.at[1]}
              y2={datum.target[1]}
            />
          ) : null}
          <rect
            className="canvas-mechanical-datum-box"
            fill="#ffffff"
            height={8}
            stroke="#253043"
            strokeWidth={lineStroke}
            width={10}
            x={datum.at[0] - 4.5}
            y={datum.at[1] - 5.5}
          />
          <text
            className="canvas-mechanical-datum-label"
            fill="#253043"
            fontSize={labelFontSize}
            fontWeight={700}
            stroke="none"
            x={datum.at[0] + 0.4}
            y={datum.at[1] + 1.6}
          >
            {datum.label}
          </text>
        </Fragment>
      ))}
      {sidecar.annotations.blocks.map((block) => renderBlock(block))}
      {selected ? (
        <rect
          className="selection-box"
          height={Math.max(sidecar.height, sheetLayout.heightMm) + 10}
          rx={4}
          width={Math.max(sidecar.width, sheetLayout.widthMm) + 10}
          x={sidecar.x - 5}
          y={sidecar.y - 5}
        />
      ) : null}
    </g>
  );
}

function ReferenceGridOverlay({
  document,
  showLines,
}: {
  document: CanvasDocument;
  showLines: boolean;
}) {
  const config = createReferenceGridConfig(document.referenceGrid);
  const cellWidth = document.width / config.columns;
  const cellHeight = document.height / config.rows;
  const columnLabels = Array.from({ length: config.columns }, (_, index) =>
    getColumnLabel(index, config.columnStart),
  );
  const rowLabels = Array.from({ length: config.rows }, (_, index) =>
    String((config.rowStart ?? 1) + index),
  );

  return (
    <g className="reference-grid-overlay">
      {config.showBorder ? (
        <rect
          className="reference-grid-border"
          x={0}
          y={0}
          width={document.width}
          height={document.height}
        />
      ) : null}
      {showLines
        ? Array.from({ length: config.columns - 1 }, (_, index) => (
            <line
              className="reference-grid-line"
              key={`col-${index}`}
              x1={(index + 1) * cellWidth}
              y1={0}
              x2={(index + 1) * cellWidth}
              y2={document.height}
            />
          ))
        : null}
      {showLines
        ? Array.from({ length: config.rows - 1 }, (_, index) => (
            <line
              className="reference-grid-line"
              key={`row-${index}`}
              x1={0}
              y1={(index + 1) * cellHeight}
              x2={document.width}
              y2={(index + 1) * cellHeight}
            />
          ))
        : null}
      {config.showLabels
        ? columnLabels.map((label, index) => (
            <text
              className="reference-grid-label"
              key={label}
              x={index * cellWidth + cellWidth / 2}
              y={18}
              textAnchor="middle"
            >
              {label}
            </text>
          ))
        : null}
      {config.showLabels
        ? rowLabels.map((label, index) => (
            <text
              className="reference-grid-label"
              key={label}
              x={14}
              y={index * cellHeight + cellHeight / 2}
              dominantBaseline="middle"
              textAnchor="middle"
            >
              {label}
            </text>
          ))
        : null}
    </g>
  );
}

function MeasurementLabelsOverlay({ document }: { document: CanvasDocument }) {
  const selected = getSelectedObject(document);
  if (!selected) return null;

  const unitSystem = getCanvasUnitSystem(document);
  const width = formatCanvasMeasurement(selected.width, unitSystem);
  const height = formatCanvasMeasurement(selected.height, unitSystem);
  const centerX = formatCanvasMeasurement(selected.x + selected.width / 2, unitSystem);
  const centerY = formatCanvasMeasurement(selected.y + selected.height / 2, unitSystem);
  const labelY = Math.max(18, selected.y - 12);

  return (
    <g className="measurement-label-overlay" pointerEvents="none">
      <text x={selected.x} y={labelY}>
        w {width} x h {height}
      </text>
      <text x={selected.x} y={selected.y + selected.height + 18}>
        center {centerX}, {centerY}
      </text>
    </g>
  );
}

function CanvasPanel(props: MachinaSlotProps) {
  const {
    activeMode,
    document,
    viewport,
    setViewport,
    aidToggles,
    runCommand,
    runCommands,
    spriteFrameEditSettings,
  } = readViewData(props);
  const viewBox = getCanvasViewportViewBox(document, viewport);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragState, setDragState] = useState<SpriteDragState>();
  const [panState, setPanState] = useState<CanvasPanState>();
  const [hoveredFrame, setHoveredFrame] = useState<
    { sidecarId: string; frameId: string } | undefined
  >();
  const selected = getSelectedObject(document);
  const coordinateProfile = getCoordinateProfile(document.coordinateProfileId);
  const selectedSpriteFrame = getSelectedSpriteFrameState(document, selected);
  const selectedGuideRegionContext = getSelectedSpriteFrameGuideRegionContext(document, selected);
  const selectedDatumTargets = getSelectedSpriteFrameDatumTargets(document, selected, {
    maxDistance: spriteFrameEditSettings.datumSnapDistance,
    restrictToRegion: spriteFrameEditSettings.restrictDatumSnapsToGuideRegion,
  });
  const alphaMappedImages = document.layers
    .filter((layer) => layer.visible)
    .flatMap((layer) => layer.objectIds.map((id) => document.objects[id]))
    .filter(
      (object): object is ImageObject =>
        object?.kind === "image" &&
        object.alphaMapId !== undefined &&
        document.objects[object.alphaMapId]?.kind === "image",
    );

  const getSvgPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return undefined;
      const bounds = svg.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return undefined;
      return {
        x: viewBox.x + ((clientX - bounds.left) / bounds.width) * viewBox.width,
        y: viewBox.y + ((clientY - bounds.top) / bounds.height) * viewBox.height,
      };
    },
    [viewBox],
  );

  const getDraftRect = useCallback(
    (state: SpriteDragState) => {
      const image = document.objects[state.imageId];
      if (image?.kind !== "image") return state.startRect;
      const sourceWidth = image.intrinsicWidth ?? image.width;
      const sourceHeight = image.intrinsicHeight ?? image.height;
      const scaleX = image.width / sourceWidth;
      const scaleY = image.height / sourceHeight;
      const dx = (state.currentPoint.x - state.startPoint.x) / scaleX;
      const dy = (state.currentPoint.y - state.startPoint.y) / scaleY;
      const unsnapped =
        state.mode === "move"
          ? {
              x: state.startRect.x + dx,
              y: state.startRect.y + dy,
              width: state.startRect.width,
              height: state.startRect.height,
            }
          : {
              x: state.startRect.x,
              y: state.startRect.y,
              width: state.startRect.width + dx,
              height: state.startRect.height + dy,
            };
      return snapSpriteFrameRect(
        spriteFrameEditSettings.constrainFrameEditsToGuideRegion
          ? (() => {
              const guideContext = findGuideRegionForSpriteFrame(document, {
                spriteSidecarId: state.sidecarId,
                frameId: state.frameId,
              });
              return guideContext
                ? clampSpriteFrameRectToGuideRegion(
                    {
                      x: Math.max(0, unsnapped.x),
                      y: Math.max(0, unsnapped.y),
                      width: Math.max(1, unsnapped.width),
                      height: Math.max(1, unsnapped.height),
                    },
                    guideContext.region,
                  )
                : {
                    x: Math.max(0, unsnapped.x),
                    y: Math.max(0, unsnapped.y),
                    width: Math.max(1, unsnapped.width),
                    height: Math.max(1, unsnapped.height),
                  };
            })()
          : {
              x: Math.max(0, unsnapped.x),
              y: Math.max(0, unsnapped.y),
              width: Math.max(1, unsnapped.width),
              height: Math.max(1, unsnapped.height),
            },
        {
          enabled: spriteFrameEditSettings.snapToGrid,
          gridSize: spriteFrameEditSettings.gridSize,
        },
      );
    },
    [
      document,
      spriteFrameEditSettings.constrainFrameEditsToGuideRegion,
      spriteFrameEditSettings.gridSize,
      spriteFrameEditSettings.snapToGrid,
    ],
  );

  useEffect(() => {
    setHoveredFrame((current) => {
      if (!current) return undefined;
      const sidecar = document.objects[current.sidecarId];
      if (sidecar?.kind !== "spriteSidecar") return undefined;
      return sidecar.spec.frames.some((frame) => frame.id === current.frameId)
        ? current
        : undefined;
    });
  }, [document.objects]);

  useEffect(() => {
    if (!panState) return;

    const handlePointerMove = (event: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const bounds = svg.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const startViewBox = getCanvasViewportViewBox(document, panState.startViewport);
      const dx = ((event.clientX - panState.startClientX) / bounds.width) * startViewBox.width;
      const dy = ((event.clientY - panState.startClientY) / bounds.height) * startViewBox.height;
      setViewport(panCanvasViewport(panState.startViewport, { dx, dy }));
    };

    const handlePointerUp = () => {
      setPanState(undefined);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [document, panState, setViewport]);

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (event: PointerEvent) => {
      const point = getSvgPoint(event.clientX, event.clientY);
      if (!point) return;
      setDragState((current) => (current ? { ...current, currentPoint: point } : current));
    };

    const handlePointerUp = (event: PointerEvent) => {
      const point = getSvgPoint(event.clientX, event.clientY);
      const current = dragState;
      setDragState(undefined);
      if (!current || !point) return;
      const finalRect = getDraftRect({ ...current, currentPoint: point });
      if (
        finalRect.x !== current.startRect.x ||
        finalRect.y !== current.startRect.y ||
        finalRect.width !== current.startRect.width ||
        finalRect.height !== current.startRect.height
      ) {
        runCommand({
          kind: "updateSpriteFrameRect",
          sidecarId: current.sidecarId,
          frameId: current.frameId,
          rect: finalRect,
        });
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, getDraftRect, getSvgPoint, runCommand]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }
      const selected = document.selectedObjectId
        ? document.objects[document.selectedObjectId]
        : undefined;
      if (selected?.kind !== "spriteSidecar" || !selected.spec.selectedFrameId) return;
      const step = event.shiftKey ? 10 : 1;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const [dx, dy] =
        event.key === "ArrowLeft"
          ? visualDirectionDelta({ direction: "left", amount: step, profile: coordinateProfile })
          : event.key === "ArrowRight"
            ? visualDirectionDelta({ direction: "right", amount: step, profile: coordinateProfile })
            : event.key === "ArrowUp"
              ? visualDirectionDelta({ direction: "up", amount: step, profile: coordinateProfile })
              : visualDirectionDelta({
                  direction: "down",
                  amount: step,
                  profile: coordinateProfile,
                });
      runCommand({
        kind: "nudgeSpriteFrame",
        sidecarId: selected.id,
        frameId: selected.spec.selectedFrameId,
        dx,
        dy,
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [coordinateProfile, document, runCommand]);

  const beginFrameDrag = useCallback(
    (
      event: ReactPointerEvent<SVGRectElement>,
      image: ImageObject,
      sidecar: SpriteSidecarObject,
      frame: CanvasSpriteFrame,
      mode: "move" | "resize",
    ) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const point = getSvgPoint(event.clientX, event.clientY);
      if (!point) return;
      const hit = hitTestSpriteFrameAtPoint(sidecar, image, point);
      const resolvedFrame = hit?.frame ?? frame;
      if (
        document.selectedObjectId !== sidecar.id ||
        sidecar.spec.selectedFrameId !== resolvedFrame.id
      ) {
        runCommands([
          { kind: "select", id: sidecar.id },
          { kind: "selectSpriteFrame", sidecarId: sidecar.id, frameId: resolvedFrame.id },
        ]);
      }
      setDragState({
        sidecarId: sidecar.id,
        frameId: resolvedFrame.id,
        imageId: image.id,
        mode,
        startPoint: point,
        currentPoint: point,
        startRect: {
          x: resolvedFrame.x,
          y: resolvedFrame.y,
          width: resolvedFrame.width,
          height: resolvedFrame.height,
        },
      });
    },
    [document.selectedObjectId, getSvgPoint, runCommands],
  );

  return (
    <main className="canvas-panel panel">
      <div className="canvas-heading">
        <div>
          <small>Canvas / Artboard</small>
          <h1>{document.name}</h1>
          <small>{activeMode.subtitle}</small>
        </div>
        <span>
          {formatDocumentSize(document)} · Coordinates:{" "}
          {formatCoordinateProfileSummary(coordinateProfile)}
        </span>
      </div>
      <div className="artboard-wrap">
        <svg
          className={panState ? "artboard is-panning" : "artboard"}
          ref={svgRef}
          onPointerDownCapture={(event) => {
            if (event.button !== 1) return;
            event.preventDefault();
            setPanState({
              startClientX: event.clientX,
              startClientY: event.clientY,
              startViewport: viewport,
            });
          }}
          onPointerLeave={() => setHoveredFrame(undefined)}
          onWheel={(event) => {
            event.preventDefault();
            setViewport((current) =>
              setCanvasViewportZoom(current, nextZoomStep(current.zoom, event.deltaY < 0 ? 1 : -1)),
            );
          }}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          role="img"
          aria-label={`${document.name} scene graph`}
        >
          {alphaMappedImages.length > 0 ? (
            <defs>
              {alphaMappedImages.map((object) => {
                const alphaMap = document.objects[object.alphaMapId as string];
                if (alphaMap?.kind !== "image") return null;
                return (
                  <mask
                    id={getCanvasImageMaskId(object.id)}
                    key={object.id}
                    maskUnits="userSpaceOnUse"
                  >
                    <image
                      href={alphaMap.src}
                      x={object.x}
                      y={object.y}
                      width={object.width}
                      height={object.height}
                      preserveAspectRatio={getImagePreserveAspectRatio(object.fit)}
                    />
                  </mask>
                );
              })}
            </defs>
          ) : null}
          {document.layers
            .filter((layer) => layer.visible)
            .flatMap((layer) => layer.objectIds.map((id) => document.objects[id]))
            .filter((object): object is CanvasObject => object !== undefined)
            .map((object) => {
              const alphaMap =
                object.kind === "image" && object.alphaMapId
                  ? document.objects[object.alphaMapId]
                  : undefined;
              const sketchOverlay =
                object.kind === "image" ? getSketchOverlayForImage(document, object) : undefined;
              const guideSidecars =
                object.kind === "image" ? getGuideSidecarsForImage(document, object) : [];
              const blockoutSidecars = getBlockoutSidecarsForObject(document, object);
              const mechanicalSidecars = getMechanicalAnnotationSidecarsForObject(document, object);
              const standaloneMechanicalSidecar =
                object.kind === "mechanicalAnnotationSidecar" &&
                (!object.targetObjectId || document.objects[object.targetObjectId] === undefined)
                  ? object
                  : undefined;
              const spriteSidecar =
                object.kind === "image" ? getSpriteSidecarForImage(document, object) : undefined;
              return (
                <Fragment key={object.id}>
                  <SceneObjectSvg
                    object={object}
                    alphaMap={alphaMap?.kind === "image" ? alphaMap : undefined}
                    selected={document.selectedObjectId === object.id}
                    onSelect={(id) => runCommand({ kind: "select", id })}
                  />
                  {sketchOverlay ? (
                    <SketchOverlaySvg
                      document={document}
                      overlay={sketchOverlay}
                      selected={document.selectedObjectId === sketchOverlay.id}
                    />
                  ) : null}
                  {object.kind === "image"
                    ? guideSidecars.map((guideObject) => (
                        <GuideSidecarSvg
                          guideObject={guideObject}
                          image={object}
                          key={guideObject.id}
                          selected={document.selectedObjectId === guideObject.id}
                          selectedDatumTargets={selectedDatumTargets.filter(
                            (target) => target.guideSidecarId === guideObject.id,
                          )}
                          selectedGuideRegionContext={
                            selectedGuideRegionContext?.guideSidecarId === guideObject.id
                              ? selectedGuideRegionContext
                              : undefined
                          }
                        />
                      ))
                    : null}
                  {blockoutSidecars.map((sidecar) => (
                    <BlockoutSidecarSvg
                      key={sidecar.id}
                      owner={object}
                      selected={document.selectedObjectId === sidecar.id}
                      sidecar={sidecar}
                    />
                  ))}
                  {mechanicalSidecars.map((sidecar) => (
                    <MechanicalAnnotationSidecarSvg
                      key={sidecar.id}
                      selected={document.selectedObjectId === sidecar.id}
                      sidecar={sidecar}
                    />
                  ))}
                  {standaloneMechanicalSidecar ? (
                    <MechanicalAnnotationSidecarSvg
                      selected={document.selectedObjectId === standaloneMechanicalSidecar.id}
                      sidecar={standaloneMechanicalSidecar}
                    />
                  ) : null}
                  {object.kind === "image" && spriteSidecar ? (
                    <SpriteSidecarSvg
                      draftRect={
                        dragState &&
                        dragState.sidecarId === spriteSidecar.id &&
                        dragState.frameId === spriteSidecar.spec.selectedFrameId
                          ? getDraftRect(dragState)
                          : undefined
                      }
                      hoveredFrameId={
                        hoveredFrame?.sidecarId === spriteSidecar.id
                          ? hoveredFrame.frameId
                          : undefined
                      }
                      image={object}
                      onFramePointerDown={(event, frame) =>
                        beginFrameDrag(event, object, spriteSidecar, frame, "move")
                      }
                      onFramePointerEnter={(frameId) =>
                        setHoveredFrame((current) =>
                          current?.sidecarId === spriteSidecar.id && current.frameId === frameId
                            ? current
                            : { sidecarId: spriteSidecar.id, frameId },
                        )
                      }
                      onFramePointerLeave={(frameId) =>
                        setHoveredFrame((current) =>
                          current?.sidecarId === spriteSidecar.id && current.frameId === frameId
                            ? undefined
                            : current,
                        )
                      }
                      onResizeHandlePointerDown={(event, frame) =>
                        beginFrameDrag(event, object, spriteSidecar, frame, "resize")
                      }
                      sidecar={spriteSidecar}
                      selected={document.selectedObjectId === spriteSidecar.id}
                      selectedGuideRegionContext={
                        selectedGuideRegionContext &&
                        spriteSidecar.id === selectedSpriteFrame?.sidecar.id
                          ? selectedGuideRegionContext
                          : undefined
                      }
                    />
                  ) : null}
                </Fragment>
              );
            })}
          {aidToggles.showMeasurementLabels ? (
            <MeasurementLabelsOverlay document={document} />
          ) : null}
          {aidToggles.showReferenceGrid ? (
            <ReferenceGridOverlay
              document={document}
              showLines={aidToggles.showReferenceGridLines}
            />
          ) : null}
        </svg>
      </div>
    </main>
  );
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="inspector-section">
      <h3>{title}</h3>
      <div className="inspector-rows">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="field-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getGuideAlignmentSourceMarks(
  document: CanvasDocument,
  sourceObjectId: string,
  sourceGuideSidecarId?: string,
): readonly ResolvedGuideAlignmentMark[] {
  return resolveGuideAlignmentMarks(document).filter(
    (mark) =>
      mark.targetObjectId === sourceObjectId &&
      (sourceGuideSidecarId === undefined || mark.guideSidecarId === sourceGuideSidecarId),
  );
}

export function GuideAlignmentSection({
  document,
  sourceObjectId,
  sourceGuideSidecarId,
  runCommand,
}: {
  document: CanvasDocument;
  sourceObjectId: string;
  sourceGuideSidecarId?: string;
  runCommand: (command: CanvasCommand) => void;
}) {
  const resolvedMarks = resolveGuideAlignmentMarks(document);
  const sourceMarks = getGuideAlignmentSourceMarks(document, sourceObjectId, sourceGuideSidecarId);
  const diagnostics = validateGuideAlignmentMarks(document);
  const [sourceMarkId, setSourceMarkId] = useState("");
  const [targetObjectId, setTargetObjectId] = useState("");
  const [targetMarkId, setTargetMarkId] = useState("");

  const targetObjects = Array.from(
    new Set(
      resolvedMarks
        .map((mark) => mark.targetObjectId)
        .filter((objectId) => objectId !== sourceObjectId || resolvedMarks.length === 1),
    ),
  );
  const targetMarks = resolvedMarks.filter((mark) => mark.targetObjectId === targetObjectId);

  useEffect(() => {
    const nextSourceMarkId = sourceMarks[0]?.markId ?? "";
    setSourceMarkId(nextSourceMarkId);

    const preferredTargetObjectId =
      targetObjects.find((objectId) => objectId !== sourceObjectId) ?? targetObjects[0] ?? "";
    setTargetObjectId(preferredTargetObjectId);

    const nextTargetMarkId =
      resolvedMarks.find((mark) => mark.targetObjectId === preferredTargetObjectId)?.markId ?? "";
    setTargetMarkId(nextTargetMarkId);
  }, [resolvedMarks, sourceMarks, sourceObjectId, targetObjects]);

  useEffect(() => {
    const nextTargetMarkId =
      resolvedMarks.find((mark) => mark.targetObjectId === targetObjectId)?.markId ?? "";
    setTargetMarkId((current) =>
      current && targetMarks.some((mark) => mark.markId === current) ? current : nextTargetMarkId,
    );
  }, [resolvedMarks, targetMarks, targetObjectId]);

  return (
    <InspectorSection title="Alignment marks">
      <Field label="Mark count" value={sourceMarks.length} />
      {sourceMarks.length > 0 ? (
        <div className="datum-target-list">
          {sourceMarks.map((mark) => (
            <div className="datum-target-card" key={`${mark.guideSidecarId}:${mark.markId}`}>
              <strong>{mark.label ?? mark.markId}</strong>
              <p>
                {`${mark.targetObjectId} @ ${mark.scene.x.toFixed(1)}, ${mark.scene.y.toFixed(1)}`}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-note">No resolved source marks for this image.</p>
      )}
      <label className="sprite-frame-select">
        <span>Source mark</span>
        <select
          aria-label="Source alignment mark"
          value={sourceMarkId}
          onChange={(event) => setSourceMarkId(event.currentTarget.value)}
        >
          {sourceMarks.length === 0 ? <option value="">No marks</option> : null}
          {sourceMarks.map((mark) => (
            <option key={`${mark.guideSidecarId}:${mark.markId}`} value={mark.markId}>
              {`${mark.label ?? mark.markId} (${mark.scene.x.toFixed(1)}, ${mark.scene.y.toFixed(1)})`}
            </option>
          ))}
        </select>
      </label>
      <label className="sprite-frame-select">
        <span>Target object</span>
        <select
          aria-label="Target alignment object"
          value={targetObjectId}
          onChange={(event) => setTargetObjectId(event.currentTarget.value)}
        >
          {targetObjects.length === 0 ? <option value="">No targets</option> : null}
          {targetObjects.map((objectId) => (
            <option key={objectId} value={objectId}>
              {objectId}
            </option>
          ))}
        </select>
      </label>
      <label className="sprite-frame-select">
        <span>Target mark</span>
        <select
          aria-label="Target alignment mark"
          value={targetMarkId}
          onChange={(event) => setTargetMarkId(event.currentTarget.value)}
        >
          {targetMarks.length === 0 ? <option value="">No marks</option> : null}
          {targetMarks.map((mark) => (
            <option key={`${mark.guideSidecarId}:${mark.markId}`} value={mark.markId}>
              {`${mark.label ?? mark.markId} (${mark.scene.x.toFixed(1)}, ${mark.scene.y.toFixed(1)})`}
            </option>
          ))}
        </select>
      </label>
      <div className="command-row">
        <button
          type="button"
          disabled={!sourceMarkId || !targetObjectId || !targetMarkId}
          onClick={() =>
            runCommand({
              kind: "alignObjectByGuideMarks",
              sourceObjectId,
              sourceMarkId,
              targetObjectId,
              targetMarkId,
              sourceGuideSidecarId,
            })
          }
        >
          Align to mark
        </button>
      </div>
      {diagnostics.length > 0 ? (
        <div className="validation-result is-warning">
          <strong>Alignment diagnostics</strong>
          <ul>
            {diagnostics.slice(0, 6).map((diagnostic, index) => (
              <li key={`${diagnostic.code}-${diagnostic.alignmentMarkId ?? index}`}>
                <span>{diagnostic.code}</span>
                {`: ${diagnostic.message}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </InspectorSection>
  );
}

function UiPropEditor({
  objectId,
  prop,
  value,
  runCommand,
}: {
  objectId: string;
  prop: CanvasUiPropDefinition;
  value: unknown;
  runCommand: (command: CanvasCommand) => void;
}) {
  const label = <span>{prop.label}</span>;
  if (prop.kind === "boolean") {
    return (
      <label className="ui-prop-row ui-prop-checkbox-row">
        {label}
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) =>
            runCommand({
              kind: "setUiProp",
              id: objectId,
              prop: prop.name,
              value: event.target.checked,
            })
          }
        />
      </label>
    );
  }

  if (prop.kind === "enum") {
    return (
      <label className="ui-prop-row">
        {label}
        <select
          value={typeof value === "string" ? value : (prop.options?.[0] ?? "")}
          onChange={(event) =>
            runCommand({
              kind: "setUiProp",
              id: objectId,
              prop: prop.name,
              value: event.target.value,
            })
          }
        >
          {(prop.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="ui-prop-row">
      {label}
      <input
        type={prop.kind === "number" ? "number" : "text"}
        value={typeof value === "number" || typeof value === "string" ? value : ""}
        onChange={(event) =>
          runCommand({
            kind: "setUiProp",
            id: objectId,
            prop: prop.name,
            value: prop.kind === "number" ? Number(event.target.value) : event.target.value,
          })
        }
      />
    </label>
  );
}

function formatImageSrcLabel(src: string): string {
  if (src.startsWith("data:")) {
    const mimeType = /^data:([^;,]+)/.exec(src)?.[1] ?? "data URL";
    return `${mimeType} data URL (${src.length.toLocaleString()} chars)`;
  }
  return src;
}

function createClosedInspectorGroups(): Record<InspectorGroupId, boolean> {
  return {
    "selected-object": false,
    "selected-sprite-frame": false,
    geometry: false,
    viewport: false,
    alignment: false,
    "sprite-sidecar": false,
    "sprite-audit": false,
    "ui-component": false,
    "view-aids": false,
    "image-assets": false,
    export: false,
    "command-diagnostics": false,
    metadata: false,
  };
}

export function getDefaultInspectorAccordionState(options: {
  modeId: CanvasEditorModeId;
  selected?: CanvasObject;
  showViewAids: boolean;
  showImageTools: boolean;
  showExport: boolean;
  hasSelectedSpriteFrame: boolean;
  hasSpriteAuditResults: boolean;
}): Record<InspectorGroupId, boolean> {
  const state = createClosedInspectorGroups();
  state["selected-object"] = true;
  state.geometry = true;
  state.metadata = true;
  state.alignment = Boolean(
    options.selected?.kind === "image" || options.selected?.kind === "guideSidecar",
  );
  state["ui-component"] = options.selected?.kind === "uiComponent";
  if (options.showViewAids) state.viewport = options.modeId !== "sprites";
  if (options.showImageTools) state["image-assets"] = options.modeId !== "sprites";
  if (options.showExport) state.export = options.modeId !== "sprites";
  if (
    options.selected?.kind === "guideSidecar" ||
    options.selected?.kind === "mechanicalAnnotationSidecar"
  ) {
    state["sprite-sidecar"] = true;
  }
  if (options.modeId === "sprites") {
    state.viewport = true;
    state["sprite-sidecar"] = options.selected?.kind === "spriteSidecar";
    state["selected-sprite-frame"] = options.hasSelectedSpriteFrame;
    state["sprite-audit"] = options.hasSpriteAuditResults;
    state["view-aids"] = false;
    state["image-assets"] = false;
    state.export = false;
    state["command-diagnostics"] = false;
  }
  return state;
}

export function getSelectedSpriteFrameState(
  document: CanvasDocument,
  selected?: CanvasObject,
): { sidecar: SpriteSidecarObject; frame: CanvasSpriteFrame; image?: ImageObject } | undefined {
  if (selected?.kind !== "spriteSidecar" || !selected.spec.selectedFrameId) return undefined;
  const frame = selected.spec.frames.find((entry) => entry.id === selected.spec.selectedFrameId);
  if (!frame) return undefined;
  const image = getSpriteSidecarTarget(document, selected);
  return { sidecar: selected, frame, image };
}

function getSelectedSpriteFrameGuideRegionContext(
  document: CanvasDocument,
  selected?: CanvasObject,
): SpriteFrameGuideRegionContext | undefined {
  const selectedFrame = getSelectedSpriteFrameState(document, selected);
  if (!selectedFrame) return undefined;
  return findGuideRegionForSpriteFrame(document, {
    spriteSidecarId: selectedFrame.sidecar.id,
    frameId: selectedFrame.frame.id,
  });
}

export function getSelectedSpriteFrameDatumTargets(
  document: CanvasDocument,
  selected: CanvasObject | undefined,
  options?: {
    readonly maxDistance?: number;
    readonly restrictToRegion?: boolean;
  },
): readonly SpriteFrameDatumSnapTarget[] {
  const selectedFrame = getSelectedSpriteFrameState(document, selected);
  if (!selectedFrame) return [];
  return findDatumSnapTargetsForSpriteFrame(document, {
    spriteSidecarId: selectedFrame.sidecar.id,
    frameId: selectedFrame.frame.id,
    options,
  });
}

function getSpriteCommandApplyContext(
  spriteFrameEditSettings: SpriteFrameEditSettings,
): CanvasCommandApplyContext {
  return {
    spriteFrameEditSettings: {
      constrainFrameEditsToGuideRegion: spriteFrameEditSettings.constrainFrameEditsToGuideRegion,
    },
  };
}

export function getSelectedSpriteFramePreviewModel(options: {
  image?: ImageObject;
  frame: Pick<CanvasSpriteFrame, "x" | "y" | "width" | "height">;
}): { width: number; height: number; style: Record<string, string> } | { reason: string } {
  const { image, frame } = options;
  if (!image?.src) {
    return { reason: "Preview unavailable: missing linked image" };
  }
  const atlasWidth = image.intrinsicWidth ?? image.width;
  const atlasHeight = image.intrinsicHeight ?? image.height;
  if (atlasWidth <= 0 || atlasHeight <= 0) {
    return { reason: "Preview unavailable: missing linked image" };
  }
  const margin = 1;
  const cropWidth = Math.max(1, frame.width + margin * 2);
  const cropHeight = Math.max(1, frame.height + margin * 2);
  const scale = Math.min(6, 192 / Math.max(cropWidth, cropHeight));
  const width = Math.max(72, Math.round(cropWidth * scale));
  const height = Math.max(72, Math.round(cropHeight * scale));
  const offsetX = Math.max(0, frame.x - margin);
  const offsetY = Math.max(0, frame.y - margin);
  return {
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      backgroundImage: `url("${image.src}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${Math.round(atlasWidth * scale)}px ${Math.round(atlasHeight * scale)}px`,
      backgroundPosition: `-${Math.round(offsetX * scale)}px -${Math.round(offsetY * scale)}px`,
    },
  };
}

type SpriteAlphaMaskState =
  | { status: "idle" | "loading" }
  | { status: "ready"; mask: SpriteAlphaMask }
  | { status: "unavailable"; reason: string };

async function loadSpriteAlphaMask(image: ImageObject): Promise<SpriteAlphaMaskState> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      status: "unavailable",
      reason: "Alpha-aware cut validation unavailable outside the browser runtime.",
    };
  }

  return new Promise((resolve) => {
    const element = new window.Image();
    element.decoding = "async";
    element.crossOrigin = "anonymous";
    element.onload = () => {
      try {
        const width = element.naturalWidth;
        const height = element.naturalHeight;
        if (width <= 0 || height <= 0) {
          resolve({
            status: "unavailable",
            reason:
              "Alpha-aware cut validation unavailable because the image has no readable size.",
          });
          return;
        }
        const canvas = window.document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          resolve({
            status: "unavailable",
            reason:
              "Alpha-aware cut validation unavailable because the browser could not create a readable canvas context.",
          });
          return;
        }
        context.clearRect(0, 0, width, height);
        context.drawImage(element, 0, 0, width, height);
        const alpha = context.getImageData(0, 0, width, height).data;
        resolve({
          status: "ready",
          mask: {
            width,
            height,
            isOpaque: (x, y) => {
              const ix = Math.trunc(x);
              const iy = Math.trunc(y);
              if (ix < 0 || iy < 0 || ix >= width || iy >= height) return false;
              return alpha[(iy * width + ix) * 4 + 3] > 0;
            },
          },
        });
      } catch (error) {
        resolve({
          status: "unavailable",
          reason:
            error instanceof Error
              ? `Alpha-aware cut validation unavailable for this image. ${error.message}`
              : "Alpha-aware cut validation unavailable for this image.",
        });
      }
    };
    element.onerror = () =>
      resolve({
        status: "unavailable",
        reason: "Alpha-aware cut validation unavailable because the image could not be decoded.",
      });
    element.src = image.src;
  });
}

function SpriteAuditSectionContent({
  document,
  sidecar,
  image,
}: {
  document: CanvasDocument;
  sidecar: SpriteSidecarObject;
  image: ImageObject;
}) {
  const [scope, setScope] = useState<SpriteAuditScope>("allFrames");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [status, setStatus] = useState("");
  const [artifact, setArtifact] = useState<SpriteAuditArtifact>();
  const [screenshotArtifact, setScreenshotArtifact] = useState<SpriteAuditScreenshotArtifact>();
  const [alphaAuditEnabled, setAlphaAuditEnabled] = useState(true);
  const [alphaThreshold, setAlphaThreshold] = useState(1);
  const [alphaMaskState, setAlphaMaskState] = useState<SpriteAlphaMaskState>({ status: "idle" });

  useEffect(() => {
    if (!alphaAuditEnabled) {
      setAlphaMaskState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setAlphaMaskState({ status: "loading" });
    void loadSpriteAlphaMask(image).then((nextState) => {
      if (!cancelled) setAlphaMaskState(nextState);
    });
    return () => {
      cancelled = true;
    };
  }, [alphaAuditEnabled, image]);

  useEffect(
    () => () => {
      if (screenshotArtifact?.url) {
        URL.revokeObjectURL(screenshotArtifact.url);
      }
    },
    [screenshotArtifact],
  );

  const createArtifact = useCallback(() => {
    const report = buildSpriteAuditReport(sidecar, image, {
      document,
      scope,
      includeAlphaAnalysis: alphaAuditEnabled,
      alphaMask: alphaMaskState.status === "ready" ? alphaMaskState.mask : undefined,
      alphaUnavailableReason:
        alphaMaskState.status === "unavailable"
          ? alphaMaskState.reason
          : alphaMaskState.status === "loading"
            ? "Alpha-aware cut validation still loading image pixels."
            : undefined,
      alphaOptions: { alphaThreshold },
    });
    const nextArtifact = {
      scope,
      report,
      text: formatSpriteAuditReport(report),
    } satisfies SpriteAuditArtifact;
    setArtifact(nextArtifact);
    return nextArtifact;
  }, [alphaAuditEnabled, alphaMaskState, alphaThreshold, document, image, scope, sidecar]);

  const ensureArtifact = useCallback(() => {
    if (artifact && artifact.scope === scope) {
      return artifact;
    }
    return createArtifact();
  }, [artifact, createArtifact, scope]);

  const runAudit = () => {
    const nextArtifact = createArtifact();
    setPreviewVisible(true);
    setStatus(
      `Audit ran for ${formatSpriteAuditScope(scope)}. Found ${nextArtifact.report.summary.totalFindings} suspicious item${nextArtifact.report.summary.totalFindings === 1 ? "" : "s"}.`,
    );
  };

  const previewAudit = () => {
    ensureArtifact();
    setPreviewVisible(true);
    setStatus(`Previewing audit for ${formatSpriteAuditScope(scope)}.`);
  };

  const copyAudit = () => {
    const nextArtifact = ensureArtifact();
    if (!navigator.clipboard?.writeText) {
      setStatus("Clipboard API is unavailable in this browser.");
      return;
    }

    navigator.clipboard
      .writeText(nextArtifact.text)
      .then(() => setStatus("Copied sprite audit report."))
      .catch(() => setStatus("Could not copy sprite audit report."));
  };

  const downloadAudit = () => {
    const nextArtifact = ensureArtifact();
    downloadBlobFile(
      new Blob([nextArtifact.text], { type: "text/markdown" }),
      `${sidecar.id}-sprite-audit.md`,
    );
    setStatus(`Downloaded ${sidecar.id}-sprite-audit.md.`);
  };

  const captureAuditScreenshot = async () => {
    try {
      const nextArtifact = ensureArtifact();
      setStatus("Capturing overlay screenshot...");
      const blob = await lowerCanvasDocumentToRasterBlob(
        createSpriteAuditScreenshotDocument(document, sidecar.id, scope),
        {
          mimeType: "image/png",
          scale: 2,
          background: "#ffffff",
        },
      );
      const url = URL.createObjectURL(blob);
      setScreenshotArtifact((current) => {
        if (current?.url) {
          URL.revokeObjectURL(current.url);
        }
        return {
          path: `${sidecar.id}-sprite-audit-overlay.png`,
          mimeType: "image/png",
          blob,
          size: blob.size,
          url,
        };
      });
      setPreviewVisible(true);
      setStatus(
        `Captured overlay screenshot for ${formatSpriteAuditScope(scope)} with ${nextArtifact.report.summary.totalFindings} suspicious item${nextArtifact.report.summary.totalFindings === 1 ? "" : "s"}.`,
      );
    } catch (caught) {
      setStatus(
        caught instanceof Error ? caught.message : "Overlay screenshot could not be captured.",
      );
    }
  };

  const downloadScreenshot = () => {
    if (!screenshotArtifact) return;
    downloadBlobFile(screenshotArtifact.blob, screenshotArtifact.path);
    setStatus(`Downloaded ${screenshotArtifact.path}.`);
  };

  return (
    <>
      <Field label="Sidecar" value={sidecar.id} />
      <Field label="Image" value={image.id} />
      <label className="sprite-frame-select">
        <span>Audit scope</span>
        <select
          aria-label="Sprite audit scope"
          value={scope}
          onChange={(event) => setScope(event.currentTarget.value as SpriteAuditScope)}
        >
          <option value="allFrames">All frames</option>
          <option value="selectedFrame">Selected frame only</option>
        </select>
      </label>
      <ToggleField
        label="Alpha-aware cut check"
        checked={alphaAuditEnabled}
        onChange={setAlphaAuditEnabled}
      />
      <NumberField
        label="Alpha threshold"
        min={1}
        value={alphaThreshold}
        onChange={(value) => setAlphaThreshold(Math.max(1, Math.round(value)))}
      />
      {alphaAuditEnabled && alphaMaskState.status === "loading" ? (
        <p className="empty-note">Reading image alpha for cut-line checks...</p>
      ) : null}
      {alphaAuditEnabled && alphaMaskState.status === "unavailable" ? (
        <p className="empty-note">{alphaMaskState.reason}</p>
      ) : null}
      <div className="sprite-audit-actions">
        <button type="button" onClick={runAudit}>
          Run audit
        </button>
        <button type="button" onClick={copyAudit}>
          Copy audit report
        </button>
        <button type="button" onClick={previewAudit}>
          Preview audit report
        </button>
        <button type="button" onClick={downloadAudit}>
          Download audit report
        </button>
        <button type="button" onClick={() => void captureAuditScreenshot()}>
          Capture overlay screenshot
        </button>
      </div>
      {status ? <p className="export-status">{status}</p> : null}
      {artifact ? (
        <>
          <div className="validation-result">
            <strong>Audit summary</strong>
            <p>
              {artifact.report.summary.totalFindings} suspicious finding
              {artifact.report.summary.totalFindings === 1 ? "" : "s"} across{" "}
              {artifact.report.summary.totalFrames} frame
              {artifact.report.summary.totalFrames === 1 ? "" : "s"}.
            </p>
            <p>
              {artifact.report.summary.errors} error, {artifact.report.summary.warnings} warning,{" "}
              {artifact.report.summary.notes} note.
            </p>
          </div>
          <div className="validation-result">
            <strong>Likely issues found</strong>
            <ul>
              {artifact.report.likelyIssues.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
      {previewVisible && artifact ? (
        <textarea
          className="export-preview"
          aria-label="Sprite audit report preview"
          readOnly
          value={artifact.text}
        />
      ) : null}
      {screenshotArtifact ? (
        <div className="sprite-audit-preview">
          <img alt="Sprite audit overlay screenshot" src={screenshotArtifact.url} />
          <div className="sprite-audit-preview__meta">
            <p>
              {screenshotArtifact.path} · {formatBlobSize(screenshotArtifact.size)}
            </p>
            {artifact ? <p>{artifact.report.whatToAdjustNext[0]}</p> : null}
            <button type="button" onClick={downloadScreenshot}>
              Download screenshot
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ImageAssetSection(props: MachinaSlotProps) {
  const {
    document,
    loadBlockoutSidecarFile,
    loadGuideSidecarFile,
    loadImageFile,
    loadSketchOverlayFile,
    loadSpriteSidecarFile,
    runCommand,
  } = readViewData(props);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const alphaInputRef = useRef<HTMLInputElement>(null);
  const spriteInputRef = useRef<HTMLInputElement>(null);
  const guideInputRef = useRef<HTMLInputElement>(null);
  const blockoutInputRef = useRef<HTMLInputElement>(null);
  const sketchInputRef = useRef<HTMLInputElement>(null);
  const selected = getSelectedObject(document);
  const imageObjects = Object.values(document.objects).filter(
    (object): object is ImageObject =>
      object.kind === "image" && (object.role === undefined || object.role === "image"),
  );
  const alphaObjects = Object.values(document.objects).filter(
    (object): object is ImageObject =>
      object.kind === "image" && (object.role === "alphaMap" || object.role === "mask"),
  );
  const spriteSidecars = Object.values(document.objects).filter(
    (object): object is SpriteSidecarObject => object.kind === "spriteSidecar",
  );
  const defaultAlphaId = alphaObjects[0]?.id ?? "";
  const defaultSourceId = imageObjects[0]?.id ?? "";
  const defaultSpriteId = spriteSidecars[0]?.id ?? "";
  const [alphaId, setAlphaId] = useState(defaultAlphaId);
  const [sourceId, setSourceId] = useState(defaultSourceId);
  const [spriteId, setSpriteId] = useState(defaultSpriteId);

  useEffect(() => {
    setAlphaId((current) =>
      current && alphaObjects.some((object) => object.id === current) ? current : defaultAlphaId,
    );
  }, [alphaObjects, defaultAlphaId]);

  useEffect(() => {
    setSourceId((current) =>
      current && imageObjects.some((object) => object.id === current) ? current : defaultSourceId,
    );
  }, [imageObjects, defaultSourceId]);

  useEffect(() => {
    setSpriteId((current) =>
      current && spriteSidecars.some((object) => object.id === current) ? current : defaultSpriteId,
    );
  }, [spriteSidecars, defaultSpriteId]);

  const loadFromInput = (role: CanvasImageRole) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void loadImageFile(file, { role });
  };

  const loadSpriteFromInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    const targetId = getOwnerImageForSelection(document, selected)?.id;
    if (file) void loadSpriteSidecarFile(file, { targetId });
  };

  const loadSketchFromInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    const targetId = getOwnerImageForSelection(document, selected)?.id;
    if (file) void loadSketchOverlayFile(file, { targetId });
  };

  const loadGuideFromInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    const targetId = getOwnerImageForSelection(document, selected)?.id;
    if (file) void loadGuideSidecarFile(file, { targetId });
  };

  const loadBlockoutFromInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    const targetObjectId = selected?.id;
    if (file) void loadBlockoutSidecarFile(file, { targetObjectId });
  };

  return (
    <InspectorSection title="Image assets">
      <input
        ref={imageInputRef}
        className="asset-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={loadFromInput("image")}
      />
      <input
        ref={alphaInputRef}
        className="asset-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={loadFromInput("alphaMap")}
      />
      <input
        ref={spriteInputRef}
        className="asset-file-input"
        type="file"
        accept=".toml,.sprite.toml,.spriteforge.toml,text/plain"
        onChange={loadSpriteFromInput}
      />
      <input
        ref={guideInputRef}
        className="asset-file-input"
        type="file"
        accept=".toml,.guide.toml,text/plain"
        onChange={loadGuideFromInput}
      />
      <input
        ref={blockoutInputRef}
        className="asset-file-input"
        type="file"
        accept=".toml,.blockout.toml,text/plain"
        onChange={loadBlockoutFromInput}
      />
      <input
        ref={sketchInputRef}
        className="asset-file-input"
        type="file"
        accept=".toml,.sketch.toml,text/plain"
        onChange={loadSketchFromInput}
      />
      <div className="asset-actions">
        <button type="button" onClick={() => imageInputRef.current?.click()}>
          Load image
        </button>
        <button type="button" onClick={() => alphaInputRef.current?.click()}>
          Load alpha map
        </button>
        <button type="button" onClick={() => guideInputRef.current?.click()}>
          Load guide sidecar
        </button>
        <button type="button" onClick={() => blockoutInputRef.current?.click()}>
          Load blockout sidecar
        </button>
        <button type="button" onClick={() => sketchInputRef.current?.click()}>
          Load sketch overlay
        </button>
        <button type="button" onClick={() => spriteInputRef.current?.click()}>
          Load sprite sidecar
        </button>
      </div>
      {selected?.kind === "image" &&
      (selected.role === undefined || selected.role === "image") &&
      alphaObjects.length > 0 ? (
        <div className="asset-select-row">
          <select
            aria-label="Alpha map object"
            value={alphaId}
            onChange={(event) => setAlphaId(event.currentTarget.value)}
          >
            {alphaObjects.map((object) => (
              <option key={object.id} value={object.id}>
                {object.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!alphaId}
            onClick={() => runCommand({ kind: "attachAlphaMap", sourceId: selected.id, alphaId })}
          >
            Attach alpha
          </button>
        </div>
      ) : null}
      {selected?.kind === "image" &&
      (selected.role === "alphaMap" || selected.role === "mask") &&
      imageObjects.length > 0 ? (
        <div className="asset-select-row">
          <select
            aria-label="Source image object"
            value={sourceId}
            onChange={(event) => setSourceId(event.currentTarget.value)}
          >
            {imageObjects.map((object) => (
              <option key={object.id} value={object.id}>
                {object.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!sourceId}
            onClick={() => runCommand({ kind: "attachAlphaMap", sourceId, alphaId: selected.id })}
          >
            Use as alpha
          </button>
        </div>
      ) : null}
      {selected?.kind === "image" && selected.alphaMapId ? (
        <button
          className="asset-wide-button"
          type="button"
          onClick={() => runCommand({ kind: "detachAlphaMap", sourceId: selected.id })}
        >
          Detach alpha map
        </button>
      ) : null}
      {selected?.kind === "image" &&
      (selected.role === undefined || selected.role === "image") &&
      spriteSidecars.length > 0 ? (
        <div className="asset-select-row">
          <select
            aria-label="Sprite sidecar object"
            value={spriteId}
            onChange={(event) => setSpriteId(event.currentTarget.value)}
          >
            {spriteSidecars.map((object) => (
              <option key={object.id} value={object.id}>
                {object.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!spriteId}
            onClick={() =>
              runCommand({
                kind: "attachSpriteSidecar",
                sourceId: selected.id,
                sidecarId: spriteId,
              })
            }
          >
            Attach sprite
          </button>
        </div>
      ) : null}
      {selected?.kind === "image" && selected.spriteSidecarId ? (
        <button
          className="asset-wide-button"
          type="button"
          onClick={() => runCommand({ kind: "detachSpriteSidecar", sourceId: selected.id })}
        >
          Detach sprite sidecar
        </button>
      ) : null}
      {selected ? (
        <button
          className="asset-wide-button"
          type="button"
          onClick={() => runCommand({ kind: "removeObject", id: selected.id })}
        >
          Remove selected
        </button>
      ) : null}
      {selected?.kind === "image" && selected.role === "alphaMap" ? (
        <p className="empty-note">Attach it to an image with Attach Alpha.</p>
      ) : null}
    </InspectorSection>
  );
}

function CanvasToolsSection(props: MachinaSlotProps) {
  const { document, lastToolResult, runCanvasTool } = readViewData(props);
  const selected = getSelectedObject(document);
  const [autoAttach, setAutoAttach] = useState(true);

  if (selected?.kind !== "image") return null;

  const availableTools = listCanvasTools(canvasTools).filter(
    (tool) =>
      tool.targetKind === "image-object" &&
      (selected.role === undefined || selected.role === "image"),
  );
  if (availableTools.length === 0) return null;

  return (
    <InspectorSection title="Tools">
      <ToggleField label="Auto-attach alpha map" checked={autoAttach} onChange={setAutoAttach} />
      <div className="tool-actions">
        {availableTools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() =>
              runCanvasTool(tool.id, {
                targetObjectId: selected.id,
                options:
                  tool.id === GENERATE_ALPHA_MAP_TOOL_ID
                    ? {
                        autoAttach,
                      }
                    : undefined,
              })
            }
          >
            {tool.label}
          </button>
        ))}
      </div>
      {lastToolResult ? (
        <div className="last-tool-result">
          <strong>{lastToolResult.toolId}</strong>
          {lastToolResult.createdObjectIds?.length ? (
            <p>Created: {lastToolResult.createdObjectIds.join(", ")}</p>
          ) : null}
          {lastToolResult.updatedObjectIds?.length ? (
            <p>Updated: {lastToolResult.updatedObjectIds.join(", ")}</p>
          ) : null}
          {lastToolResult.notes?.map((note, index) => (
            <p key={`${lastToolResult.toolId}-${index}`}>{note}</p>
          ))}
        </div>
      ) : null}
    </InspectorSection>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="ui-prop-row">
      <span>{label}</span>
      <input
        min={min}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
        type="number"
        value={value}
      />
    </label>
  );
}

function formatDatumTargetAnchor(target: SpriteFrameDatumSnapTarget) {
  if (target.datumKind === "point") return "center";
  return target.anchor;
}

function SelectedSpriteFrameSection({
  sidecar,
  frame,
  image,
  coordinateProfile,
  guideRegionContext,
  datumTargets,
  hasGuideSidecars,
  spriteFrameEditSettings,
  setSpriteFrameEditSettings,
  runCommand,
  zoomToSelected,
}: {
  sidecar: SpriteSidecarObject;
  frame: CanvasSpriteFrame;
  image?: ImageObject;
  coordinateProfile: ReturnType<typeof getCoordinateProfile>;
  guideRegionContext?: SpriteFrameGuideRegionContext;
  datumTargets: readonly SpriteFrameDatumSnapTarget[];
  hasGuideSidecars: boolean;
  spriteFrameEditSettings: SpriteFrameEditSettings;
  setSpriteFrameEditSettings: (settings: SpriteFrameEditSettings) => void;
  runCommand: (command: CanvasCommand) => void;
  zoomToSelected: () => void;
}) {
  const atlasWidth = sidecar.spec.atlasWidth ?? image?.intrinsicWidth;
  const atlasHeight = sidecar.spec.atlasHeight ?? image?.intrinsicHeight;
  const spriteEditStep =
    spriteFrameEditSettings.gridSize > 0 ? spriteFrameEditSettings.gridSize : 1;
  const expectedRect = getSpriteExpectedSourceRect(
    frame,
    sidecar.spec.grids,
    sidecar.spec.stackframes,
  );
  const sourceStackframe =
    frame.sourceStackframeId !== undefined
      ? sidecar.spec.stackframes.find((stackframe) => stackframe.id === frame.sourceStackframeId)
      : undefined;
  const updateRect = (rect: SpriteFrameRect) =>
    runCommand({
      kind: "updateSpriteFrameRect",
      sidecarId: sidecar.id,
      frameId: frame.id,
      rect: snapSpriteFrameRect(rect, {
        enabled: spriteFrameEditSettings.snapToGrid,
        gridSize: spriteFrameEditSettings.gridSize,
      }),
    });
  const auditCount = sidecar.spec.diagnostics.filter((diagnostic) =>
    diagnostic.frameIds?.includes(frame.id),
  ).length;
  const preview = getSelectedSpriteFramePreviewModel({ image, frame });
  const deltaSummary = expectedRect
    ? `${frame.x - expectedRect.x >= 0 ? "+" : ""}${frame.x - expectedRect.x},${
        frame.y - expectedRect.y >= 0 ? "+" : ""
      }${frame.y - expectedRect.y},${frame.width - expectedRect.width >= 0 ? "+" : ""}${
        frame.width - expectedRect.width
      },${frame.height - expectedRect.height >= 0 ? "+" : ""}${frame.height - expectedRect.height}`
    : "No source grid delta";
  const guideDeltaSummary = guideRegionContext?.deltaToRegion
    ? `left ${guideRegionContext.deltaToRegion.left}, top ${guideRegionContext.deltaToRegion.top}, right ${guideRegionContext.deltaToRegion.right}, bottom ${guideRegionContext.deltaToRegion.bottom}`
    : undefined;
  const showGuideConstraintControls = hasGuideSidecars || guideRegionContext !== undefined;
  const guideWarning =
    guideRegionContext?.relation === "intersects"
      ? `${frame.id} partially leaves guide region ${guideRegionContext.regionId}.`
      : guideRegionContext?.relation === "nearest"
        ? `${frame.id} is not inside any guide region.`
        : undefined;
  const hasDatumTargets = datumTargets.length > 0;
  const nearestDatumTarget = datumTargets[0];
  const snapFrameToNearestDatum = (anchor?: SpriteFrameDatumAnchor) =>
    runCommand({
      kind: "snapSpriteFrameToNearestDatum",
      sidecarId: sidecar.id,
      frameId: frame.id,
      anchor,
      maxDistance: spriteFrameEditSettings.datumSnapDistance,
      restrictToRegion: spriteFrameEditSettings.restrictDatumSnapsToGuideRegion,
    });

  return (
    <>
      <div className="sprite-frame-preview-panel">
        <div className="sprite-frame-preview-panel__header">
          <strong>{frame.label}</strong>
          <button onClick={zoomToSelected} type="button">
            Zoom to selected frame
          </button>
        </div>
        {"reason" in preview ? (
          <p className="empty-note">{preview.reason}</p>
        ) : (
          <div className="sprite-frame-preview">
            <div
              aria-label="Selected frame preview"
              className="sprite-frame-preview__crop"
              role="img"
              style={preview.style}
            />
          </div>
        )}
      </div>
      <Field label="Frame ID" value={frame.id} />
      <Field label="Coordinates" value={formatCoordinateProfileSummary(coordinateProfile)} />
      <Field label="Label" value={frame.label} />
      <Field label="Source" value={getSpriteFrameSourceKind(frame)} />
      <Field label="Parent grid" value={frame.sourceGridId ?? "none"} />
      <Field label="Stackframe" value={frame.sourceStackframeId ?? "none"} />
      <Field label="Stack index" value={frame.sourceStackIndex ?? "none"} />
      {sourceStackframe ? (
        <>
          <Field label="Direction" value={sourceStackframe.direction} />
          <Field label="Step" value={sourceStackframe.step} />
        </>
      ) : null}
      <Field
        label="Grid cell"
        value={
          frame.sourceRow !== undefined || frame.sourceColumn !== undefined
            ? `row ${frame.sourceRow ?? "?"}, col ${frame.sourceColumn ?? "?"}`
            : "none"
        }
      />
      <Field label="Sprite" value={frame.spriteId ?? "none"} />
      <Field label="Animation" value={frame.animationId ?? "none"} />
      <Field label="Audit findings" value={auditCount} />
      <Field
        label="Snap"
        value={spriteFrameEditSettings.snapToGrid ? `${spriteFrameEditSettings.gridSize}px` : "off"}
      />
      <Field label="Delta" value={deltaSummary} />
      {guideRegionContext ? (
        <>
          <Field label="Guide region" value={guideRegionContext.regionId} />
          <Field label="Relation" value={guideRegionContext.relation} />
          <Field
            label="Region rect"
            value={`x=${guideRegionContext.regionRect.x} y=${guideRegionContext.regionRect.y} w=${guideRegionContext.regionRect.width} h=${guideRegionContext.regionRect.height}`}
          />
          {guideDeltaSummary ? <Field label="Guide delta" value={guideDeltaSummary} /> : null}
        </>
      ) : null}
      {expectedRect ? (
        <Field
          label="Source rect"
          value={`x=${expectedRect.x} y=${expectedRect.y} w=${expectedRect.width} h=${expectedRect.height}`}
        />
      ) : null}
      <NumberField
        label="Image X"
        min={0}
        onChange={(x) => updateRect({ x, y: frame.y, width: frame.width, height: frame.height })}
        value={frame.x}
      />
      <NumberField
        label="Image Y from top"
        min={0}
        onChange={(y) => updateRect({ x: frame.x, y, width: frame.width, height: frame.height })}
        value={frame.y}
      />
      <NumberField
        label="Width"
        min={1}
        onChange={(width) =>
          updateRect({ x: frame.x, y: frame.y, width: Math.max(1, width), height: frame.height })
        }
        value={frame.width}
      />
      <NumberField
        label="Height"
        min={1}
        onChange={(height) =>
          updateRect({ x: frame.x, y: frame.y, width: frame.width, height: Math.max(1, height) })
        }
        value={frame.height}
      />
      {showGuideConstraintControls ? (
        <>
          <ToggleField
            checked={spriteFrameEditSettings.constrainFrameEditsToGuideRegion}
            label="Constrain to guide region"
            onChange={(constrainFrameEditsToGuideRegion) =>
              setSpriteFrameEditSettings({
                ...spriteFrameEditSettings,
                constrainFrameEditsToGuideRegion,
              })
            }
          />
          <p className="empty-note">Keeps frame edits inside the selected guide region.</p>
          <button
            className="viewport-wide-button"
            onClick={() =>
              runCommand({
                kind: "clampSpriteFrameToGuideRegion",
                sidecarId: sidecar.id,
                frameId: frame.id,
              })
            }
            type="button"
          >
            Clamp to guide region
          </button>
        </>
      ) : null}
      <div className="inspector-section datum-snapping-section">
        <h3>Datum snapping</h3>
        <Field
          label="Nearest"
          value={
            nearestDatumTarget
              ? `${nearestDatumTarget.datumId} / ${formatDatumTargetAnchor(nearestDatumTarget)} / ${nearestDatumTarget.distance.toFixed(1)}px`
              : "none"
          }
        />
        <NumberField
          label="Snap distance"
          min={0}
          onChange={(datumSnapDistance) =>
            setSpriteFrameEditSettings({
              ...spriteFrameEditSettings,
              datumSnapDistance: Math.max(0, Math.round(datumSnapDistance)),
            })
          }
          value={spriteFrameEditSettings.datumSnapDistance}
        />
        <ToggleField
          checked={spriteFrameEditSettings.restrictDatumSnapsToGuideRegion}
          label="Restrict to frame region"
          onChange={(restrictDatumSnapsToGuideRegion) =>
            setSpriteFrameEditSettings({
              ...spriteFrameEditSettings,
              restrictDatumSnapsToGuideRegion,
            })
          }
        />
        <button
          className="viewport-wide-button"
          onClick={() => snapFrameToNearestDatum()}
          type="button"
        >
          Snap nearest
        </button>
        <div className="command-row sprite-edit-buttons">
          <button onClick={() => snapFrameToNearestDatum("left")} type="button">
            Snap left
          </button>
          <button onClick={() => snapFrameToNearestDatum("right")} type="button">
            Snap right
          </button>
          <button onClick={() => snapFrameToNearestDatum("centerX")} type="button">
            Snap center X
          </button>
          <button onClick={() => snapFrameToNearestDatum("top")} type="button">
            Snap top
          </button>
          <button onClick={() => snapFrameToNearestDatum("bottom")} type="button">
            Snap bottom
          </button>
          <button onClick={() => snapFrameToNearestDatum("centerY")} type="button">
            Snap center Y
          </button>
        </div>
        {hasDatumTargets ? (
          <div className="datum-target-list">
            {datumTargets.slice(0, 5).map((target, index) => (
              <div
                className={`datum-target-card${index === 0 ? " is-nearest" : ""}`}
                key={`${target.guideSidecarId}:${target.datumId}:${target.anchor}`}
              >
                <strong>
                  {target.datumId} / {formatDatumTargetAnchor(target)}
                </strong>
                <p>
                  {target.datumKind} datum · {target.distance.toFixed(1)}px
                  {target.regionId ? ` · region ${target.regionId}` : " · global"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-note">
            No nearby datums. Add datums in a .guide.toml or increase snap distance.
          </p>
        )}
      </div>
      <ToggleField
        checked={spriteFrameEditSettings.snapToGrid}
        label="Snap frame edits"
        onChange={(snapToGrid) =>
          setSpriteFrameEditSettings({
            ...spriteFrameEditSettings,
            snapToGrid,
          })
        }
      />
      <NumberField
        label="Grid size"
        min={1}
        onChange={(gridSize) =>
          setSpriteFrameEditSettings({
            ...spriteFrameEditSettings,
            gridSize: Math.max(1, Math.round(gridSize)),
          })
        }
        value={spriteFrameEditSettings.gridSize}
      />
      <p className="empty-note">
        x/y must stay at or above 0. width/height must stay above 0.
        {atlasWidth && atlasHeight ? ` Atlas bounds: ${atlasWidth} x ${atlasHeight}.` : ""}
      </p>
      {guideWarning ? <p className="empty-note">{guideWarning}</p> : null}
      {!guideRegionContext && hasGuideSidecars ? (
        <p className="empty-note">No guide region found for this frame.</p>
      ) : null}
      {!guideRegionContext && !hasGuideSidecars ? (
        <p className="empty-note">Attach a .guide.toml to constrain frame edits.</p>
      ) : null}
      <div className="command-row sprite-edit-buttons">
        <button
          onClick={(event) => {
            const [dx, dy] = visualDirectionDelta({
              direction: "left",
              amount: event.shiftKey ? 10 : 1,
              profile: coordinateProfile,
            });
            runCommand({
              kind: "nudgeSpriteFrame",
              sidecarId: sidecar.id,
              frameId: frame.id,
              dx,
              dy,
            });
          }}
          type="button"
        >
          Nudge Left
        </button>
        <button
          onClick={(event) => {
            const [dx, dy] = visualDirectionDelta({
              direction: "right",
              amount: event.shiftKey ? 10 : 1,
              profile: coordinateProfile,
            });
            runCommand({
              kind: "nudgeSpriteFrame",
              sidecarId: sidecar.id,
              frameId: frame.id,
              dx,
              dy,
            });
          }}
          type="button"
        >
          Nudge Right
        </button>
        <button
          onClick={(event) => {
            const [dx, dy] = visualDirectionDelta({
              direction: "up",
              amount: event.shiftKey ? 10 : 1,
              profile: coordinateProfile,
            });
            runCommand({
              kind: "nudgeSpriteFrame",
              sidecarId: sidecar.id,
              frameId: frame.id,
              dx,
              dy,
            });
          }}
          type="button"
        >
          Nudge Up
        </button>
        <button
          onClick={(event) => {
            const [dx, dy] = visualDirectionDelta({
              direction: "down",
              amount: event.shiftKey ? 10 : 1,
              profile: coordinateProfile,
            });
            runCommand({
              kind: "nudgeSpriteFrame",
              sidecarId: sidecar.id,
              frameId: frame.id,
              dx,
              dy,
            });
          }}
          type="button"
        >
          Nudge Down
        </button>
        <button
          onClick={() =>
            runCommand({
              kind: "resizeSpriteFrame",
              sidecarId: sidecar.id,
              frameId: frame.id,
              dw: spriteEditStep,
              dh: 0,
            })
          }
          type="button"
        >
          Grow W
        </button>
        <button
          onClick={() =>
            runCommand({
              kind: "resizeSpriteFrame",
              sidecarId: sidecar.id,
              frameId: frame.id,
              dw: -spriteEditStep,
              dh: 0,
            })
          }
          type="button"
        >
          Shrink W
        </button>
        <button
          onClick={() =>
            runCommand({
              kind: "resizeSpriteFrame",
              sidecarId: sidecar.id,
              frameId: frame.id,
              dw: 0,
              dh: spriteEditStep,
            })
          }
          type="button"
        >
          Grow H
        </button>
        <button
          onClick={() =>
            runCommand({
              kind: "resizeSpriteFrame",
              sidecarId: sidecar.id,
              frameId: frame.id,
              dw: 0,
              dh: -spriteEditStep,
            })
          }
          type="button"
        >
          Shrink H
        </button>
      </div>
    </>
  );
}

function ViewportSection(props: MachinaSlotProps) {
  const {
    document,
    viewport,
    fitViewport,
    setZoom,
    zoomToSelected,
    zoomToGridRef,
    zoomToGridSpan,
  } = readViewData(props);
  const [gridRef, setGridRef] = useState("D3");
  const [gridSpan, setGridSpan] = useState("A2-C3");
  const [error, setError] = useState("");
  const selected = getSelectedObject(document);
  const selectedSpriteFrame = getSelectedSpriteFrameState(document, selected);
  const zoomButtonLabel = selectedSpriteFrame ? "Zoom to selected frame" : "Zoom to selected";

  const runViewportAction = (action: () => void) => {
    try {
      action();
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update viewport.");
    }
  };

  return (
    <InspectorSection title="Viewport">
      <Field label="Zoom" value={`${Math.round(viewport.zoom * 100)}%`} />
      <div className="viewport-actions">
        <button type="button" onClick={fitViewport}>
          Fit
        </button>
        {CANVAS_ZOOM_STEPS.map((zoom) => (
          <button
            className={viewport.zoom === zoom ? "is-active" : ""}
            key={zoom}
            type="button"
            onClick={() => setZoom(zoom)}
          >
            {Math.round(zoom * 100)}%
          </button>
        ))}
      </div>
      <button
        className="viewport-wide-button"
        type="button"
        disabled={!selected}
        onClick={() => runViewportAction(zoomToSelected)}
      >
        {zoomButtonLabel}
      </button>
      <label className="viewport-input-row">
        <span>Grid ref</span>
        <input value={gridRef} onChange={(event) => setGridRef(event.currentTarget.value)} />
        <button type="button" onClick={() => runViewportAction(() => zoomToGridRef(gridRef))}>
          Zoom
        </button>
      </label>
      <label className="viewport-input-row">
        <span>Grid span</span>
        <input value={gridSpan} onChange={(event) => setGridSpan(event.currentTarget.value)} />
        <button type="button" onClick={() => runViewportAction(() => zoomToGridSpan(gridSpan))}>
          Zoom
        </button>
      </label>
      {error ? <p className="viewport-error">{error}</p> : null}
      <p className="viewport-summary">{summarizeViewport(document, viewport)}</p>
    </InspectorSection>
  );
}

function ViewAidsSection(props: MachinaSlotProps) {
  const { aidToggles, setAidToggle } = readViewData(props);

  return (
    <InspectorSection title="View aids">
      <ToggleField
        label="Reference grid"
        checked={aidToggles.showReferenceGrid}
        onChange={(checked) => setAidToggle("showReferenceGrid", checked)}
      />
      <ToggleField
        label="Grid lines"
        checked={aidToggles.showReferenceGridLines}
        onChange={(checked) => setAidToggle("showReferenceGridLines", checked)}
      />
      <ToggleField
        label="Measurement labels"
        checked={aidToggles.showMeasurementLabels}
        onChange={(checked) => setAidToggle("showMeasurementLabels", checked)}
      />
      <ToggleField
        label="Geometry diagnostics"
        checked={aidToggles.showGeometryDiagnostics}
        onChange={(checked) => setAidToggle("showGeometryDiagnostics", checked)}
      />
    </InspectorSection>
  );
}

function CommandJsonPanel(props: MachinaSlotProps) {
  const {
    commandJson,
    commandValidation,
    lastApplyResults,
    setCommandJson,
    loadExampleCommands,
    validateCommandJson,
    applyCommandJson,
  } = readViewData(props);

  return (
    <InspectorSection title="Command JSON">
      <textarea
        className="command-json-input"
        value={commandJson}
        spellCheck={false}
        onChange={(event) => setCommandJson(event.target.value)}
        aria-label="Command JSON"
      />
      <div className="command-json-actions">
        <button type="button" onClick={validateCommandJson}>
          Validate
        </button>
        <button type="button" onClick={applyCommandJson}>
          Apply
        </button>
        <button type="button" onClick={loadExampleCommands}>
          Load example
        </button>
      </div>
      <p className="empty-note">
        Commands accept grid refs like A1, D3.ne, B4@0.5,0.25 and spans like A2-C3.
      </p>
      <div className={`validation-result ${commandValidation?.ok ? "is-ok" : "is-error"}`}>
        <strong>
          {commandValidation === undefined
            ? "Not validated"
            : commandValidation.ok
              ? "Valid command JSON"
              : "Command JSON has errors"}
        </strong>
        {commandValidation?.diagnostics.length ? (
          <ul>
            {commandValidation.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}-${index}`}>
                <span>{diagnostic.code}</span>
                {diagnostic.commandIndex !== undefined
                  ? ` #${diagnostic.commandIndex + 1}: `
                  : ": "}
                {diagnostic.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {lastApplyResults.length > 0 ? (
        <div className="last-apply-result">
          <strong>Last applied</strong>
          {lastApplyResults.map((result, index) => (
            <p key={`${result.command.kind}-${index}`}>
              {commandKindLabels[result.command.kind]}: {result.message}
            </p>
          ))}
        </div>
      ) : null}
    </InspectorSection>
  );
}

function GeometryDiagnosticsSection(props: MachinaSlotProps) {
  const { geometryDiagnostics } = readViewData(props);

  return (
    <InspectorSection title="Geometry diagnostics">
      {geometryDiagnostics.length === 0 ? (
        <p className="empty-note">No geometry diagnostics.</p>
      ) : (
        <div className="diagnostic-list">
          {geometryDiagnostics.map((diagnostic, index) => (
            <article
              className={`diagnostic ${getDiagnosticClass(diagnostic)}`}
              key={`${diagnostic.code}-${index}`}
            >
              <strong>{diagnostic.code}</strong>
              <p>{diagnostic.message}</p>
              <small>{diagnostic.objectIds.join(", ")}</small>
            </article>
          ))}
        </div>
      )}
    </InspectorSection>
  );
}

function ExportPanel(props: MachinaSlotProps) {
  const {
    exportArtifacts,
    exportCart,
    exportPresets,
    checkpointNote,
    lastCheckout,
    exportStatus,
    applyExportPreset,
    toggleExportArtifact,
    checkoutExportCart,
    setCheckpointNote,
    saveCheckpoint,
  } = readViewData(props);

  return (
    <InspectorSection title="Export">
      <ExportCartPanel
        artifacts={exportArtifacts}
        cart={exportCart}
        checkpointNote={checkpointNote}
        lastCheckout={lastCheckout}
        onApplyPreset={applyExportPreset}
        onCheckpointNoteChange={setCheckpointNote}
        onCheckout={() => void checkoutExportCart()}
        onSaveCheckpoint={() => void saveCheckpoint()}
        onToggleArtifact={toggleExportArtifact}
        presets={exportPresets}
        status={exportStatus}
      />
    </InspectorSection>
  );
}

function Inspector(props: MachinaSlotProps) {
  const view = readViewData(props);
  const {
    activeMode,
    document,
    aidToggles,
    isToolGroupVisible,
    runCommand,
    spriteFrameEditSettings,
    setSpriteFrameEditSettings,
    zoomToSelected,
  } = view;
  const selected = getSelectedObject(document);
  const layer = getObjectLayer(document, selected);
  const unitSystem = getCanvasUnitSystem(document);
  const coordinateProfile = getCoordinateProfile(document.coordinateProfileId);
  const measurements = getSelectedObjectMeasurements(document);
  const showGeometryTools = isToolGroupVisible("geometry");
  const showImageTools = isToolGroupVisible("image") || isToolGroupVisible("sprite");
  const showViewAids = isToolGroupVisible("viewAids");
  const showExport = isToolGroupVisible("export");
  const selectedSpriteFrame = getSelectedSpriteFrameState(document, selected);
  const selectedGuideRegionContext = getSelectedSpriteFrameGuideRegionContext(document, selected);
  const selectedDatumTargets = getSelectedSpriteFrameDatumTargets(document, selected, {
    maxDistance: spriteFrameEditSettings.datumSnapDistance,
    restrictToRegion: spriteFrameEditSettings.restrictDatumSnapsToGuideRegion,
  });
  const selectedFrameGuideSidecarCount = selectedSpriteFrame
    ? getGuideSidecarsForSpriteSidecar(document, selectedSpriteFrame.sidecar.id).length
    : 0;
  const hasSpriteAuditResults = Boolean(
    (selected?.kind === "spriteSidecar" && selected.spec.diagnostics.length > 0) ||
      (selected?.kind === "image" &&
        getSpriteSidecarForImage(document, selected)?.spec.diagnostics.length),
  );
  const accordionDefaults = getDefaultInspectorAccordionState({
    modeId: activeMode.id,
    selected,
    showViewAids,
    showImageTools,
    showExport,
    hasSelectedSpriteFrame: selectedSpriteFrame !== undefined,
    hasSpriteAuditResults,
  });
  const inspectorContextKey = `${activeMode.id}:${selected?.id ?? "document"}`;
  const [accordionStateByContext, setAccordionStateByContext] = useState<
    Partial<Record<string, Record<InspectorGroupId, boolean>>>
  >({});
  const accordionState = accordionStateByContext[inspectorContextKey] ?? accordionDefaults;
  const setAccordionOpen = (groupId: InspectorGroupId, open: boolean) =>
    setAccordionStateByContext((current) => ({
      ...current,
      [inspectorContextKey]: {
        ...(current[inspectorContextKey] ?? accordionDefaults),
        [groupId]: open,
      },
    }));

  if (!selected) {
    return (
      <aside className="inspector panel">
        <header className="panel-title">
          <small>Inspector</small>
          <h2>{document.name}</h2>
        </header>
        {showGeometryTools ? (
          <InspectorAccordionGroup
            id="selected-object"
            key={`${inspectorContextKey}:selected-object`}
            onOpenChange={(open) => setAccordionOpen("selected-object", open)}
            open={accordionState["selected-object"]}
            subtitle="Document"
            title="Selected object"
          >
            <Field label="ID" value={document.id} />
            <Field label="Size" value={formatDocumentSize(document)} />
            <Field label="Coordinates" value={formatCoordinateProfileSummary(coordinateProfile)} />
            <Field label="Unit" value={unitSystem.label} />
            <Field label="Pixels/unit" value={unitSystem.pixelsPerUnit} />
            <Field label="Layers" value={document.layers.length} />
            <Field label="Objects" value={Object.keys(document.objects).length} />
          </InspectorAccordionGroup>
        ) : null}
        {showViewAids ? (
          <InspectorAccordionGroup
            id="viewport"
            key={`${inspectorContextKey}:viewport`}
            onOpenChange={(open) => setAccordionOpen("viewport", open)}
            open={accordionState.viewport}
            subtitle={`${Math.round(view.viewport.zoom * 100)}%`}
            title="Viewport"
          >
            <ViewportSection {...props} />
          </InspectorAccordionGroup>
        ) : null}
        {showViewAids ? (
          <InspectorAccordionGroup
            id="view-aids"
            key={`${inspectorContextKey}:view-aids`}
            onOpenChange={(open) => setAccordionOpen("view-aids", open)}
            open={accordionState["view-aids"]}
            title="View aids"
          >
            <ViewAidsSection {...props} />
          </InspectorAccordionGroup>
        ) : null}
        {showImageTools ? (
          <InspectorAccordionGroup
            id="image-assets"
            key={`${inspectorContextKey}:image-assets`}
            onOpenChange={(open) => setAccordionOpen("image-assets", open)}
            open={accordionState["image-assets"]}
            title="Image assets"
          >
            <ImageAssetSection {...props} />
          </InspectorAccordionGroup>
        ) : null}
        {showExport ? (
          <InspectorAccordionGroup
            id="export"
            key={`${inspectorContextKey}:export`}
            onOpenChange={(open) => setAccordionOpen("export", open)}
            open={accordionState.export}
            title="Export / Handoff"
          >
            <ExportPanel {...props} />
          </InspectorAccordionGroup>
        ) : null}
        <InspectorAccordionGroup
          id="command-diagnostics"
          key={`${inspectorContextKey}:command-diagnostics`}
          onOpenChange={(open) => setAccordionOpen("command-diagnostics", open)}
          open={accordionState["command-diagnostics"]}
          title="Command / Diagnostics"
        >
          {showGeometryTools
            ? measurements.map((measurement) => (
                <Field key={measurement.label} label={measurement.label} value={measurement.text} />
              ))
            : null}
          {aidToggles.showGeometryDiagnostics ? <GeometryDiagnosticsSection {...props} /> : null}
          <CommandJsonPanel {...props} />
        </InspectorAccordionGroup>
      </aside>
    );
  }

  const nextFill = selected.fill === "#e34747" ? "#111111" : "#e34747";
  const selectedGrid = objectToGridRef(selected, document);
  const topLeftGrid = objectToGridRef({ ...selected, width: 0, height: 0 }, document).center.ref;

  return (
    <aside className="inspector panel">
      <header className="panel-title">
        <small>Selected object</small>
        <h2>{selected.name}</h2>
      </header>
      {showGeometryTools ? (
        <InspectorAccordionGroup
          id="selected-object"
          key={`${inspectorContextKey}:selected-object`}
          onOpenChange={(open) => setAccordionOpen("selected-object", open)}
          open={accordionState["selected-object"]}
          subtitle={objectKindLabels[selected.kind]}
          title="Selected object"
        >
          <div className="command-row">
            <button
              type="button"
              onClick={() => runCommand({ kind: "move", id: selected.id, dx: 10, dy: 0 })}
            >
              Move X +10
            </button>
            <button
              type="button"
              onClick={() => runCommand({ kind: "move", id: selected.id, dx: 0, dy: 10 })}
            >
              Move Y +10
            </button>
            <button
              type="button"
              onClick={() => runCommand({ kind: "setFill", id: selected.id, fill: nextFill })}
            >
              Toggle fill
            </button>
          </div>
          <Field label="Kind" value={objectKindLabels[selected.kind]} />
          <Field label="Coordinates" value={formatCoordinateProfileSummary(coordinateProfile)} />
          <Field label="Layer" value={layer?.name ?? selected.layerId} />
          <Field label="Intent" value={formatFrameIntent(selected.frame)} />
          {selected.kind === "image" ? (
            <Field label="Src" value={formatImageSrcLabel(selected.src)} />
          ) : null}
          {selected.kind === "image" ? (
            <Field label="Role" value={selected.role ?? "image"} />
          ) : null}
          {selected.kind === "sketchOverlay" ? (
            <>
              <Field label="Target" value={selected.targetId} />
              <Field label="Dialect" value={selected.spec.dialect} />
              <Field label="Primitives" value={selected.spec.primitives.length} />
              <label className="toggle-row">
                <span>Visible</span>
                <input
                  checked={selected.visible}
                  onChange={(event) =>
                    runCommand({
                      kind: "setSketchOverlayVisible",
                      overlayId: selected.id,
                      visible: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
              </label>
              <div className="sketch-primitive-list">
                {selected.spec.primitives.map((primitive) => (
                  <div className="sketch-primitive-card" key={primitive.id}>
                    <strong>
                      {primitive.kind} / {primitive.id}
                    </strong>
                    <p>
                      {"label" in primitive && primitive.label
                        ? primitive.label
                        : primitive.kind === "label"
                          ? primitive.text
                          : "no label"}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {selected.kind === "mechanicalAnnotationSidecar"
            ? (() => {
                const summary = getMechanicalInspectorSummary(document, selected);
                return (
                  <>
                    <Field label="Target" value={selected.targetObjectId ?? "canvas"} />
                    <Field
                      label="Coordinates"
                      value={formatCoordinateProfileSummary(coordinateProfile)}
                    />
                    <Field label="Sheet" value={summary.sheetTarget} />
                    <Field label="Size" value={summary.sheetSizeLabel} />
                    <Field label="Print margin" value={summary.printMarginLabel} />
                    <Field label="Units" value={summary.units} />
                    <Field label="Scale" value={summary.scale} />
                    <Field label="Drawing no." value={summary.drawingNumber} />
                    <Field label="Title" value={summary.title} />
                    <Field label="Revision" value={summary.revision} />
                    <Field label="Dimensions" value={summary.dimensionCount} />
                    <Field label="Notes" value={summary.noteCount} />
                    <Field label="Datums" value={summary.datumCount} />
                    <Field label="Blocks" value={summary.blockCount} />
                    <Field label="Diagnostics" value={summary.diagnosticsCount} />
                    <Field label="Ref diagnostics" value={summary.referenceDiagnosticCount} />
                    {summary.sheetNotice ? <p>{summary.sheetNotice}</p> : null}
                  </>
                );
              })()
            : null}
        </InspectorAccordionGroup>
      ) : null}
      {selectedSpriteFrame ? (
        <InspectorAccordionGroup
          id="selected-sprite-frame"
          key={`${inspectorContextKey}:selected-sprite-frame`}
          onOpenChange={(open) => setAccordionOpen("selected-sprite-frame", open)}
          open={accordionState["selected-sprite-frame"]}
          subtitle={selectedSpriteFrame.frame.id}
          title="Selected sprite frame"
        >
          <SelectedSpriteFrameSection
            coordinateProfile={coordinateProfile}
            datumTargets={selectedDatumTargets}
            frame={selectedSpriteFrame.frame}
            guideRegionContext={selectedGuideRegionContext}
            hasGuideSidecars={selectedFrameGuideSidecarCount > 0}
            image={selectedSpriteFrame.image}
            runCommand={runCommand}
            setSpriteFrameEditSettings={setSpriteFrameEditSettings}
            sidecar={selectedSpriteFrame.sidecar}
            spriteFrameEditSettings={spriteFrameEditSettings}
            zoomToSelected={zoomToSelected}
          />
        </InspectorAccordionGroup>
      ) : null}
      {showGeometryTools ? (
        <InspectorAccordionGroup
          id="geometry"
          key={`${inspectorContextKey}:geometry`}
          onOpenChange={(open) => setAccordionOpen("geometry", open)}
          open={accordionState.geometry}
          subtitle={selectedGrid.span}
          title="Geometry"
        >
          <Field
            label="X / Y"
            value={`${formatCanvasMeasurement(selected.x, unitSystem)} / ${formatCanvasMeasurement(selected.y, unitSystem)}`}
          />
          <Field
            label="W / H"
            value={`${formatCanvasMeasurement(selected.width, unitSystem)} / ${formatCanvasMeasurement(selected.height, unitSystem)}`}
          />
          <Field label="Unit" value={unitSystem.label} />
          <Field label="Pixels/unit" value={unitSystem.pixelsPerUnit} />
          {measurements.map((measurement) => (
            <Field key={measurement.label} label={measurement.label} value={measurement.text} />
          ))}
          <Field label="Span" value={selectedGrid.span} />
          <Field label="Center" value={selectedGrid.center.ref} />
          <Field label="Top-left" value={topLeftGrid} />
          <Field label="Fill" value={selected.fill ?? "none"} />
          <Field label="Stroke" value={selected.stroke ?? "none"} />
          {selected.kind === "text" ? <Field label="Font size" value={selected.fontSize} /> : null}
        </InspectorAccordionGroup>
      ) : null}
      {showViewAids ? (
        <InspectorAccordionGroup
          id="viewport"
          key={`${inspectorContextKey}:viewport`}
          onOpenChange={(open) => setAccordionOpen("viewport", open)}
          open={accordionState.viewport}
          subtitle={`${Math.round(view.viewport.zoom * 100)}%`}
          title="Viewport"
        >
          <ViewportSection {...props} />
        </InspectorAccordionGroup>
      ) : null}
      {selected.kind === "spriteSidecar" ? (
        <InspectorAccordionGroup
          id="sprite-sidecar"
          key={`${inspectorContextKey}:sprite-sidecar`}
          onOpenChange={(open) => setAccordionOpen("sprite-sidecar", open)}
          open={accordionState["sprite-sidecar"]}
          subtitle={`${selected.spec.frames.length} frames`}
          title="Sprite sidecar"
        >
          <Field label="Target" value={selected.targetId} />
          <Field label="Dialect" value={selected.spec.dialect} />
          <Field label="Source" value={selected.spec.sourceName ?? "unknown"} />
          <Field
            label="Atlas"
            value={
              selected.spec.atlasWidth && selected.spec.atlasHeight
                ? `${selected.spec.atlasWidth} x ${selected.spec.atlasHeight}`
                : "unknown"
            }
          />
          <Field label="Subgrids" value={selected.spec.grids.length} />
          <Field label="Stackframes" value={selected.spec.stackframes.length} />
          <Field label="Frames" value={selected.spec.frames.length} />
          <Field label="Animations" value={selected.spec.animations.length} />
          <label className="sprite-frame-select">
            <span>Overlay mode</span>
            <select
              value={selected.spec.overlay.displayMode}
              onChange={(event) =>
                runCommand({
                  kind: "setSpriteOverlayDisplayMode",
                  sidecarId: selected.id,
                  mode: event.currentTarget.value as
                    | "focus"
                    | "cutEdit"
                    | "gridEdit"
                    | "audit"
                    | "debug",
                })
              }
            >
              {SPRITE_OVERLAY_DISPLAY_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {getSpriteOverlayDisplayModeLabel(mode)}
                </option>
              ))}
            </select>
          </label>
          <ToggleField
            checked={selected.spec.overlay.showBounds}
            label="Bounds / cut lines"
            onChange={(value) =>
              runCommand({
                kind: "setSpriteOverlayOption",
                sidecarId: selected.id,
                option: "showBounds",
                value,
              })
            }
          />
          <ToggleField
            checked={selected.spec.overlay.showSubgrids}
            label="Subgrid regions"
            onChange={(value) =>
              runCommand({
                kind: "setSpriteOverlayOption",
                sidecarId: selected.id,
                option: "showSubgrids",
                value,
              })
            }
          />
          <ToggleField
            checked={selected.spec.overlay.showExactFrames}
            label="Exact/custom frames"
            onChange={(value) =>
              runCommand({
                kind: "setSpriteOverlayOption",
                sidecarId: selected.id,
                option: "showExactFrames",
                value,
              })
            }
          />
          <ToggleField
            checked={selected.spec.overlay.showLabels}
            label="All frame labels"
            onChange={(value) =>
              runCommand({
                kind: "setSpriteOverlayOption",
                sidecarId: selected.id,
                option: "showLabels",
                value,
              })
            }
          />
          <ToggleField
            checked={selected.spec.overlay.selectedOnly}
            label="Legacy selected-only filter"
            onChange={(value) =>
              runCommand({
                kind: "setSpriteOverlayOption",
                sidecarId: selected.id,
                option: "selectedOnly",
                value,
              })
            }
          />
          <label className="sprite-frame-select">
            <span>Selected frame</span>
            <select
              value={selected.spec.selectedFrameId ?? ""}
              onChange={(event) =>
                runCommand({
                  kind: "selectSpriteFrame",
                  sidecarId: selected.id,
                  frameId: event.currentTarget.value || undefined,
                })
              }
            >
              {selected.spec.frames.map((frame) => (
                <option key={frame.id} value={frame.id}>
                  {frame.label}
                </option>
              ))}
            </select>
          </label>
          <div className="sprite-frame-list">
            {selected.spec.frames.slice(0, 36).map((frame) => (
              <button
                className={
                  selected.spec.selectedFrameId === frame.id
                    ? "sprite-frame-card is-selected"
                    : "sprite-frame-card"
                }
                key={frame.id}
                type="button"
                onClick={() =>
                  runCommand({
                    kind: "selectSpriteFrame",
                    sidecarId: selected.id,
                    frameId: frame.id,
                  })
                }
              >
                <strong>{frame.label}</strong>
                <small>{getSpriteFrameSummary(frame)}</small>
              </button>
            ))}
          </div>
        </InspectorAccordionGroup>
      ) : null}
      {selected.kind === "image" ? (
        <InspectorAccordionGroup
          id="alignment"
          key={`${inspectorContextKey}:alignment`}
          onOpenChange={(open) => setAccordionOpen("alignment", open)}
          open={accordionState.alignment}
          subtitle={`${getGuideAlignmentSourceMarks(document, selected.id).length} marks`}
          title="Alignment"
        >
          <GuideAlignmentSection
            document={document}
            runCommand={runCommand}
            sourceObjectId={selected.id}
          />
        </InspectorAccordionGroup>
      ) : null}
      {selected.kind === "image" ? (
        <InspectorAccordionGroup
          id="sprite-sidecar"
          key={`${inspectorContextKey}:sprite-sidecar`}
          onOpenChange={(open) => setAccordionOpen("sprite-sidecar", open)}
          open={accordionState["sprite-sidecar"]}
          title="Sprite sidecar"
        >
          {(() => {
            const sidecar = getSpriteSidecarForImage(document, selected);
            if (!sidecar) return <Field label="Sidecar" value="none" />;
            const currentFrame = sidecar.spec.frames.find(
              (frame) => frame.id === sidecar.spec.selectedFrameId,
            );
            return (
              <>
                <Field label="Sidecar" value={sidecar.id} />
                <Field label="Dialect" value={sidecar.spec.dialect} />
                <Field label="Subgrids" value={sidecar.spec.grids.length} />
                <Field label="Stackframes" value={sidecar.spec.stackframes.length} />
                <Field label="Frames" value={sidecar.spec.frames.length} />
                <Field
                  label="Overlay mode"
                  value={getSpriteOverlayDisplayModeLabel(sidecar.spec.overlay.displayMode)}
                />
                <Field
                  label="Selected"
                  value={currentFrame ? getSpriteFrameSummary(currentFrame) : "none"}
                />
                <div className="command-row">
                  <button
                    type="button"
                    onClick={() =>
                      runCommand({
                        kind: "setSpriteSidecarVisible",
                        sidecarId: sidecar.id,
                        visible: !sidecar.visible,
                      })
                    }
                  >
                    {sidecar.visible ? "Hide Sprite Overlay" : "Show Sprite Overlay"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runCommand({ kind: "detachSpriteSidecar", sourceId: selected.id })
                    }
                  >
                    Detach Sprite Sidecar
                  </button>
                </div>
              </>
            );
          })()}
        </InspectorAccordionGroup>
      ) : null}
      {selected.kind === "guideSidecar" ? (
        <InspectorAccordionGroup
          id="sprite-sidecar"
          key={`${inspectorContextKey}:guide-sidecar`}
          onOpenChange={(open) => setAccordionOpen("sprite-sidecar", open)}
          open={accordionState["sprite-sidecar"]}
          subtitle={`${selected.guide.regions.length} regions · ${selected.guide.datums.length} datums · ${selected.guide.dimensions.length} dimensions · ${selected.guide.alignmentMarks.length} marks`}
          title="Guide sidecar"
        >
          {(() => {
            const targetImage =
              selected.targetId && document.objects[selected.targetId]?.kind === "image"
                ? (document.objects[selected.targetId] as ImageObject)
                : undefined;
            const diagnostics = [
              ...validateGuideSidecar(selected.guide, {
                imageWidth: targetImage?.intrinsicWidth ?? targetImage?.width,
                imageHeight: targetImage?.intrinsicHeight ?? targetImage?.height,
              }),
              ...validateGuideAlignmentMarks(document).filter((diagnostic) =>
                selected.guide.alignmentMarks.some(
                  (mark) => mark.id === diagnostic.alignmentMarkId,
                ),
              ),
            ];
            return (
              <>
                <Field label="Attached owner" value={selected.targetId ?? "unattached"} />
                <Field label="Visible" value={selected.visible ? "yes" : "no"} />
                <Field label="Opacity" value={String(selected.opacity ?? 0.9)} />
                <Field label="Units" value={selected.guide.units} />
                <Field label="Regions" value={selected.guide.regions.length} />
                <Field label="Datums" value={selected.guide.datums.length} />
                <Field label="Dimensions" value={selected.guide.dimensions.length} />
                <Field label="Alignment marks" value={selected.guide.alignmentMarks.length} />
                <Field label="Validation findings" value={diagnostics.length} />
                {selected.guide.description ? (
                  <Field label="Description" value={selected.guide.description} />
                ) : null}
                {targetImage ? (
                  <GuideAlignmentSection
                    document={document}
                    runCommand={runCommand}
                    sourceGuideSidecarId={selected.id}
                    sourceObjectId={targetImage.id}
                  />
                ) : null}
                <div className="command-row">
                  <button
                    type="button"
                    onClick={() =>
                      runCommand({
                        kind: "setGuideSidecarVisible",
                        guideId: selected.id,
                        visible: !selected.visible,
                      })
                    }
                  >
                    {selected.visible ? "Hide Guide Overlay" : "Show Guide Overlay"}
                  </button>
                  <button
                    disabled={!selected.targetId}
                    type="button"
                    onClick={() => runCommand({ kind: "detachGuideSidecar", guideId: selected.id })}
                  >
                    Detach Guide Sidecar
                  </button>
                </div>
                <div className="command-row">
                  <button
                    type="button"
                    onClick={() =>
                      runCommand({
                        kind: "setGuideSidecarOpacity",
                        guideId: selected.id,
                        opacity: Math.max(0.15, Math.min(1, (selected.opacity ?? 0.9) - 0.15)),
                      })
                    }
                  >
                    Lower opacity
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runCommand({
                        kind: "setGuideSidecarOpacity",
                        guideId: selected.id,
                        opacity: Math.max(0.15, Math.min(1, (selected.opacity ?? 0.9) + 0.15)),
                      })
                    }
                  >
                    Raise opacity
                  </button>
                </div>
                {diagnostics.length ? (
                  <div className="validation-result is-error">
                    <strong>Guide validation</strong>
                    <ul>
                      {diagnostics.map((diagnostic, index) => (
                        <li key={`${diagnostic.code}-${index}`}>
                          <span>{diagnostic.code}</span>
                          {`: ${diagnostic.message}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="validation-result is-ok">
                    <strong>Guide validation</strong>
                    <p>No guide findings.</p>
                  </div>
                )}
              </>
            );
          })()}
        </InspectorAccordionGroup>
      ) : null}
      {selected.kind === "blockoutSidecar" ? (
        <InspectorAccordionGroup
          id="sprite-sidecar"
          key={`${inspectorContextKey}:blockout-sidecar`}
          onOpenChange={(open) => setAccordionOpen("sprite-sidecar", open)}
          open={accordionState["sprite-sidecar"]}
          subtitle={`${selected.blockout.boxes.length} boxes`}
          title="Blockout sidecar"
        >
          {(() => {
            const targetObject = selected.targetObjectId
              ? document.objects[selected.targetObjectId]
              : undefined;
            const diagnostics = validateBlockoutSidecar(selected.blockout);
            return (
              <>
                <Field label="Target object" value={selected.targetObjectId ?? "unattached"} />
                <Field label="Visible" value={selected.visible ? "yes" : "no"} />
                <Field label="Opacity" value={String(selected.opacity ?? 0.72)} />
                <Field label="Boxes" value={selected.blockout.boxes.length} />
                <Field label="Points" value={selected.blockout.points.length} />
                <Field label="Curves" value={selected.blockout.curves.length} />
                <Field label="Diagnostics" value={diagnostics.length} />
                {selected.blockout.description ? (
                  <Field label="Description" value={selected.blockout.description} />
                ) : null}
                {targetObject ? <Field label="Owner" value={targetObject.name} /> : null}
                <div className="command-row">
                  <button
                    type="button"
                    onClick={() =>
                      runCommand({
                        kind: "setBlockoutSidecarVisible",
                        blockoutId: selected.id,
                        visible: !selected.visible,
                      })
                    }
                  >
                    {selected.visible ? "Hide Blockout Overlay" : "Show Blockout Overlay"}
                  </button>
                  <button
                    disabled={!selected.targetObjectId}
                    type="button"
                    onClick={() =>
                      runCommand({ kind: "detachBlockoutSidecar", blockoutId: selected.id })
                    }
                  >
                    Detach Blockout Sidecar
                  </button>
                </div>
                <div className="command-row">
                  <button
                    type="button"
                    onClick={() =>
                      runCommand({
                        kind: "setBlockoutSidecarOpacity",
                        blockoutId: selected.id,
                        opacity: Math.max(0.15, Math.min(1, (selected.opacity ?? 0.72) - 0.15)),
                      })
                    }
                  >
                    Lower opacity
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runCommand({
                        kind: "setBlockoutSidecarOpacity",
                        blockoutId: selected.id,
                        opacity: Math.max(0.15, Math.min(1, (selected.opacity ?? 0.72) + 0.15)),
                      })
                    }
                  >
                    Raise opacity
                  </button>
                </div>
                {diagnostics.length ? (
                  <div className="validation-result is-error">
                    <strong>Blockout validation</strong>
                    <ul>
                      {diagnostics.map((diagnostic, index) => (
                        <li key={`${diagnostic.code}-${index}`}>
                          <span>{diagnostic.code}</span>
                          {`: ${diagnostic.message}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="validation-result is-ok">
                    <strong>Blockout validation</strong>
                    <p>No blockout findings.</p>
                  </div>
                )}
              </>
            );
          })()}
        </InspectorAccordionGroup>
      ) : null}
      {selected.kind === "mechanicalAnnotationSidecar" ? (
        <InspectorAccordionGroup
          id="sprite-sidecar"
          key={`${inspectorContextKey}:mechanical-sidecar`}
          onOpenChange={(open) => setAccordionOpen("sprite-sidecar", open)}
          open={accordionState["sprite-sidecar"]}
          subtitle={`${selected.annotations.dimensions.length} dimensions`}
          title="Mechanical annotations"
        >
          {(() => {
            const diagnostics = validateMechanicalAnnotationsForScene(document, selected);
            const summary = getMechanicalInspectorSummary(document, selected);
            return (
              <>
                <Field label="Target object" value={selected.targetObjectId ?? "canvas"} />
                <Field label="Sheet" value={summary.sheetTarget} />
                <Field label="Size" value={summary.sheetSizeLabel} />
                <Field label="Print margin" value={summary.printMarginLabel} />
                <Field label="Units" value={summary.units} />
                <Field label="Scale" value={summary.scale} />
                <Field label="Drawing no." value={summary.drawingNumber} />
                <Field label="Title" value={summary.title} />
                <Field label="Revision" value={summary.revision} />
                <Field label="Dimensions" value={summary.dimensionCount} />
                <Field label="Notes" value={summary.noteCount} />
                <Field label="Datums" value={summary.datumCount} />
                <Field label="Blocks" value={summary.blockCount} />
                <Field label="Reference diagnostics" value={summary.referenceDiagnosticCount} />
                <Field label="Diagnostics" value={diagnostics.length} />
                {summary.sheetNotice ? <p>{summary.sheetNotice}</p> : null}
                {summary.dimensionReferenceSummaries.length ? (
                  <div className="validation-result">
                    <strong>Reference-backed dimensions</strong>
                    <ul>
                      {summary.dimensionReferenceSummaries.map((entry) =>
                        entry.references.map((reference, index) => (
                          <li
                            key={`${entry.dimensionId}-${reference.objectId}-${reference.anchor}-${index}`}
                          >
                            <span>{entry.label}</span>
                            {`: ${reference.objectId} · ${reference.anchor} · ${
                              reference.resolved ? "resolved" : "unresolved"
                            }`}
                          </li>
                        )),
                      )}
                    </ul>
                  </div>
                ) : null}
                {diagnostics.length ? (
                  <div className="validation-result is-error">
                    <strong>Mechanical annotation diagnostics</strong>
                    <ul>
                      {diagnostics.map((diagnostic, index) => (
                        <li key={`${diagnostic.code}-${index}`}>
                          <span>{diagnostic.code}</span>
                          {`: ${diagnostic.message}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="validation-result is-ok">
                    <strong>Mechanical annotation diagnostics</strong>
                    <p>No findings.</p>
                  </div>
                )}
              </>
            );
          })()}
        </InspectorAccordionGroup>
      ) : null}
      {selected.kind === "image" || selected.kind === "spriteSidecar" ? (
        <InspectorAccordionGroup
          id="sprite-audit"
          key={`${inspectorContextKey}:sprite-audit`}
          onOpenChange={(open) => setAccordionOpen("sprite-audit", open)}
          open={accordionState["sprite-audit"]}
          title="Sprite audit"
        >
          {selected.kind === "image"
            ? (() => {
                const sidecar = getSpriteSidecarForImage(document, selected);
                if (!sidecar)
                  return <Field label="Sprite audit" value="linked sprite sidecar missing" />;
                return (
                  <SpriteAuditSectionContent
                    key={`${sidecar.id}:${selected.id}`}
                    document={document}
                    image={selected}
                    sidecar={sidecar}
                  />
                );
              })()
            : (() => {
                const imageTarget = getSpriteSidecarTarget(document, selected);
                if (!imageTarget)
                  return <Field label="Sprite audit" value="linked image missing" />;
                return (
                  <SpriteAuditSectionContent
                    key={`${selected.id}:${imageTarget.id}`}
                    document={document}
                    image={imageTarget}
                    sidecar={selected}
                  />
                );
              })()}
        </InspectorAccordionGroup>
      ) : null}
      {showViewAids ? (
        <InspectorAccordionGroup
          id="view-aids"
          key={`${inspectorContextKey}:view-aids`}
          onOpenChange={(open) => setAccordionOpen("view-aids", open)}
          open={accordionState["view-aids"]}
          title="View aids"
        >
          <ViewAidsSection {...props} />
        </InspectorAccordionGroup>
      ) : null}
      {showImageTools ? (
        <InspectorAccordionGroup
          id="image-assets"
          key={`${inspectorContextKey}:image-assets`}
          onOpenChange={(open) => setAccordionOpen("image-assets", open)}
          open={accordionState["image-assets"]}
          title="Image assets"
        >
          <ImageAssetSection {...props} />
          <CanvasToolsSection {...props} />
          {selected.kind === "image" ? (
            <>
              {(() => {
                const overlay = getSketchOverlayForImage(document, selected);
                if (!overlay) {
                  const demoOverlay = document.objects["generated-product-sketch"];
                  const attachable =
                    demoOverlay?.kind === "sketchOverlay" && demoOverlay.targetId === selected.id;
                  return (
                    <>
                      <Field label="Sketch overlay" value="none" />
                      {attachable ? (
                        <div className="command-row">
                          <button
                            type="button"
                            onClick={() =>
                              runCommand({
                                kind: "attachSketchOverlay",
                                sourceId: selected.id,
                                overlayId: demoOverlay.id,
                              })
                            }
                          >
                            Attach Demo Sketch Overlay
                          </button>
                        </div>
                      ) : null}
                    </>
                  );
                }
                return (
                  <>
                    <Field label="Sketch overlay" value={overlay.id} />
                    <Field label="Overlay dialect" value={overlay.spec.dialect} />
                    <div className="command-row">
                      <button
                        type="button"
                        onClick={() =>
                          runCommand({
                            kind: "setSketchOverlayVisible",
                            overlayId: overlay.id,
                            visible: !overlay.visible,
                          })
                        }
                      >
                        {overlay.visible ? "Hide Sketch Overlay" : "Show Sketch Overlay"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runCommand({
                            kind: "detachSketchOverlay",
                            sourceId: selected.id,
                          })
                        }
                      >
                        Detach Sketch Overlay
                      </button>
                    </div>
                  </>
                );
              })()}
              {(() => {
                const guides = getGuideSidecarsForImage(document, selected);
                if (guides.length === 0) {
                  return <Field label="Guide sidecars" value="none" />;
                }
                return (
                  <>
                    <Field
                      label="Guide sidecars"
                      value={guides.map((guide) => guide.id).join(", ")}
                    />
                    <div className="command-row">
                      {guides.map((guide) => (
                        <button
                          key={guide.id}
                          type="button"
                          onClick={() =>
                            runCommand({
                              kind: "setGuideSidecarVisible",
                              guideId: guide.id,
                              visible: !guide.visible,
                            })
                          }
                        >
                          {guide.visible ? `Hide ${guide.id}` : `Show ${guide.id}`}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
              {(() => {
                const blockouts = getBlockoutSidecarsForObject(document, selected);
                if (blockouts.length === 0) {
                  return <Field label="Blockout sidecars" value="none" />;
                }
                return (
                  <>
                    <Field
                      label="Blockout sidecars"
                      value={blockouts.map((blockout) => blockout.id).join(", ")}
                    />
                    <div className="command-row">
                      {blockouts.map((blockout) => (
                        <button
                          key={blockout.id}
                          type="button"
                          onClick={() =>
                            runCommand({
                              kind: "setBlockoutSidecarVisible",
                              blockoutId: blockout.id,
                              visible: !blockout.visible,
                            })
                          }
                        >
                          {blockout.visible ? `Hide ${blockout.id}` : `Show ${blockout.id}`}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
              {selected.alphaMapId ? (
                <Field label="Uses alpha map" value={selected.alphaMapId} />
              ) : null}
              {selected.role === "alphaMap" ? (
                <>
                  <Field label="Role" value="alpha map" />
                  <Field label="Attachable" value="Can be attached to an image object" />
                </>
              ) : null}
            </>
          ) : null}
        </InspectorAccordionGroup>
      ) : null}
      {selected.kind === "uiComponent" ? (
        <InspectorAccordionGroup
          id="ui-component"
          key={`${inspectorContextKey}:ui-component`}
          onOpenChange={(open) => setAccordionOpen("ui-component", open)}
          open={accordionState["ui-component"]}
          subtitle={selected.componentId}
          title="UI Component"
        >
          {(() => {
            try {
              const definition = getCanvasUiComponentDefinition(selected.componentId);
              return (
                <>
                  <Field label="Component" value={selected.componentId} />
                  <Field label="Label" value={definition.label} />
                  <Field label="Variant" value={selected.variant ?? "none"} />
                  <Field label="Export name" value={selected.exportName ?? "auto"} />
                  <div className="ui-prop-list">
                    {definition.propSchema.map((prop) => (
                      <UiPropEditor
                        key={prop.name}
                        objectId={selected.id}
                        prop={prop}
                        value={selected.props[prop.name] ?? definition.defaultProps[prop.name]}
                        runCommand={runCommand}
                      />
                    ))}
                  </div>
                </>
              );
            } catch (error) {
              return (
                <Field
                  label="Component"
                  value={error instanceof Error ? error.message : selected.componentId}
                />
              );
            }
          })()}
        </InspectorAccordionGroup>
      ) : null}
      <InspectorAccordionGroup
        id="metadata"
        key={`${inspectorContextKey}:metadata`}
        onOpenChange={(open) => setAccordionOpen("metadata", open)}
        open={accordionState.metadata}
        title="Metadata"
      >
        <Field label="ID" value={selected.id} />
        <Field label="Tags" value={selected.tags?.join(", ") ?? "none"} />
        <Field label="Notes" value={selected.notes ?? "none"} />
      </InspectorAccordionGroup>
      {showExport ? (
        <InspectorAccordionGroup
          id="export"
          key={`${inspectorContextKey}:export`}
          onOpenChange={(open) => setAccordionOpen("export", open)}
          open={accordionState.export}
          title="Export / Handoff"
        >
          <ExportPanel {...props} />
        </InspectorAccordionGroup>
      ) : null}
      <InspectorAccordionGroup
        id="command-diagnostics"
        key={`${inspectorContextKey}:command-diagnostics`}
        onOpenChange={(open) => setAccordionOpen("command-diagnostics", open)}
        open={accordionState["command-diagnostics"]}
        title="Command / Diagnostics"
      >
        {aidToggles.showGeometryDiagnostics ? <GeometryDiagnosticsSection {...props} /> : null}
        <CommandJsonPanel {...props} />
      </InspectorAccordionGroup>
    </aside>
  );
}

function SceneSummaryShelf(props: MachinaSlotProps) {
  const {
    document,
    viewport,
    runCommand,
    commandLog,
    commandLogCollapsed,
    terminalLog,
    terminalCollapsed,
    terminalInput,
    runTerminalCommand,
    setCommandLogCollapsed,
    setTerminalCollapsed,
    setTerminalInput,
  } = readViewData(props);
  const objects = Object.values(document.objects).filter((object) =>
    ["logo", "headline", "generated-product-image", "cta-bg", "feature-chip-1"].includes(object.id),
  );
  const summaryObjects = objects.length > 0 ? objects : Object.values(document.objects).slice(0, 5);
  const recentLog = commandLog.slice(0, 3);
  const coordinateProfile = getCoordinateProfile(document.coordinateProfileId);

  return (
    <section className="scene-summary panel">
      <div className="summary-main">
        <p className="summary-text">{summarizeScene(document)}</p>
        <p className="summary-text viewport-summary-text">
          {summarizeViewport(document, viewport)}
        </p>
        <p className="summary-text viewport-summary-text">
          Coordinates: {formatCoordinateProfileSummary(coordinateProfile)}
        </p>
        <div className="object-card-row">
          {summaryObjects.map((object) => (
            <button
              className={`object-card ${document.selectedObjectId === object.id ? "is-selected" : ""}`}
              key={object.id}
              type="button"
              onClick={() => runCommand({ kind: "select", id: object.id })}
            >
              <span className={`kind-pill ${getKindClass(object)}`}>
                {getKindShortLabel(object)}
              </span>
              <strong>{object.name}</strong>
              <small>{getObjectBoundsSummary(object, document)}</small>
            </button>
          ))}
        </div>
        <CanvasCommandTerminal
          collapsed={terminalCollapsed}
          inputValue={terminalInput}
          log={terminalLog}
          onChangeInput={setTerminalInput}
          onSubmitCommand={runTerminalCommand}
          onToggleCollapsed={() => setTerminalCollapsed(!terminalCollapsed)}
        />
      </div>
      <aside
        className={commandLogCollapsed ? "command-log is-collapsed" : "command-log"}
        aria-label="Command log"
      >
        <header>
          <small>Command log</small>
          <strong>{commandLog.length}</strong>
          <button onClick={() => setCommandLogCollapsed(!commandLogCollapsed)} type="button">
            {commandLogCollapsed ? "Expand" : "Collapse"}
          </button>
        </header>
        {commandLogCollapsed ? (
          <p className="empty-note">Recent command history is hidden while editing.</p>
        ) : recentLog.length === 0 ? (
          <p className="empty-note">No commands applied yet.</p>
        ) : (
          recentLog.map((entry) => (
            <article className="command-log-entry" key={entry.id}>
              <div>
                <strong>
                  {entry.commands.length} command{entry.commands.length === 1 ? "" : "s"}
                </strong>
                <small>{entry.timestamp}</small>
              </div>
              <p>{formatCommandKinds(entry.commands)}</p>
              <ul>
                {entry.results
                  .flatMap((result) =>
                    result.changes.length === 0
                      ? [`${commandKindLabels[result.command.kind]}: no changes`]
                      : result.changes.slice(0, 3).map(formatChange),
                  )
                  .slice(0, 5)
                  .map((line, index) => (
                    <li key={`${entry.id}-${index}`}>{line}</li>
                  ))}
              </ul>
            </article>
          ))
        )}
      </aside>
    </section>
  );
}

function Breadcrumb(props: MachinaSlotProps) {
  const { document, lastCommand } = readViewData(props);
  const selected = getSelectedObject(document);
  const layer = getObjectLayer(document, selected);

  return (
    <footer className="breadcrumb">
      <span>
        MachinaCanvas / {document.name}
        {selected ? ` / ${layer?.name ?? selected.layerId} / ${selected.id}` : ""}
      </span>
      <strong>{lastCommand}</strong>
    </footer>
  );
}

const VIEWS = {
  SceneTree,
  CanvasPanel,
  Inspector,
  SceneSummaryShelf,
  Breadcrumb,
} satisfies Record<string, ComponentType<MachinaSlotProps>>;

export function App() {
  const rootRect = useRootRect();
  const layout = useMemo(() => resolveAppLayout(rootRect), [rootRect]);
  const [activeModeId, setActiveModeId] = useState<CanvasEditorModeId | undefined>();
  const [document, setDocument] = useState(INITIAL_EDITOR_DOCUMENT);
  const [viewport, setViewport] = useState(() => createCanvasViewport(INITIAL_EDITOR_DOCUMENT));
  const [lastCommand, setLastCommand] = useState("ready");
  const [commandJson, setCommandJson] = useState(exampleCommandJson);
  const [commandValidation, setCommandValidation] = useState<
    CanvasCommandValidationResult | undefined
  >();
  const [commandLog, setCommandLog] = useState<CommandLogEntry[]>([]);
  const [commandLogCollapsed, setCommandLogCollapsed] = useState(false);
  const [terminalLog, setTerminalLog] = useState<CanvasTerminalLogEntry[]>([]);
  const [terminalCollapsed, setTerminalCollapsed] = useState(true);
  const [terminalInput, setTerminalInput] = useState("");
  const [aidToggles, setAidToggles] = useState<CanvasAidToggles>(getDefaultCanvasAidToggles());
  const [lastApplyResults, setLastApplyResults] = useState<CanvasCommandApplyResult[]>([]);
  const [lastToolResult, setLastToolResult] = useState<CanvasToolResult>();
  const [exportCart, setExportCart] = useState<CanvasExportCart>({
    selectedArtifactIds: [],
    checkoutMode: "downloadFiles",
  });
  const [checkpointNote, setCheckpointNote] = useState("");
  const [lastCheckout, setLastCheckout] = useState<CanvasExportCheckoutResult>();
  const [exportBundle, setExportBundle] = useState<CanvasExportBundle>();
  const [exportValidation, setExportValidation] = useState<CanvasExportValidationResult>();
  const [selectedExportPath, setSelectedExportPath] = useState<string>();
  const [exportStatus, setExportStatus] = useState("");
  const [rasterScale, setRasterScaleState] = useState(1);
  const [rasterBackground, setRasterBackgroundState] =
    useState<RasterExportBackground>("transparent");
  const [spriteFrameEditSettings, setSpriteFrameEditSettingsState] =
    useState<SpriteFrameEditSettings>({
      snapToGrid: false,
      gridSize: 1,
      constrainFrameEditsToGuideRegion: true,
      datumSnapDistance: DEFAULT_SPRITE_FRAME_DATUM_SNAP_DISTANCE,
      restrictDatumSnapsToGuideRegion: true,
    });
  const [rasterArtifact, setRasterArtifact] = useState<RasterExportArtifact>();
  const [rasterStatus, setRasterStatus] = useState("");
  const commandLogCounter = useRef(0);
  const geometryDiagnostics = useMemo(() => getSceneGeometryDiagnostics(document), [document]);
  const activeMode = activeModeId
    ? getCanvasEditorModeTemplate(activeModeId)
    : INITIAL_MODE_TEMPLATE;
  const selectedObject = getSelectedObject(document);
  const selectedSpriteFrame = getSelectedSpriteFrameState(document, selectedObject);
  const exportArtifacts = useMemo(
    () =>
      collectCanvasExportArtifacts({
        scene: document,
        activeModeId,
        selectedObjectId: document.selectedObjectId,
        selectedSpriteFrameId: selectedSpriteFrame?.frame.id,
      }),
    [activeModeId, document, selectedSpriteFrame?.frame.id],
  );

  useEffect(() => {
    setExportCart((current) => reconcileExportCart(exportArtifacts, current));
  }, [exportArtifacts]);

  const loadMode = (modeId: CanvasEditorModeId) => {
    const template = getCanvasEditorModeTemplate(modeId);
    const nextDocument = template.createScene();
    const selectedObjectId =
      template.defaultSelectedObjectId &&
      nextDocument.objects[template.defaultSelectedObjectId] !== undefined
        ? template.defaultSelectedObjectId
        : nextDocument.selectedObjectId;
    const resolvedDocument =
      selectedObjectId === nextDocument.selectedObjectId
        ? nextDocument
        : { ...nextDocument, selectedObjectId };

    setActiveModeId(modeId);
    setDocument(resolvedDocument);
    setViewport(createCanvasViewport(resolvedDocument));
    setLastCommand(`mode ready: ${template.title}`);
    setCommandJson(exampleCommandJson);
    setCommandValidation(undefined);
    setCommandLog([]);
    setCommandLogCollapsed(modeId === "sprites");
    setTerminalLog([]);
    setTerminalCollapsed(true);
    setTerminalInput("");
    setAidToggles(getDefaultCanvasAidToggles(modeId));
    setLastApplyResults([]);
    setLastToolResult(undefined);
    setExportCart(
      createExportCart(
        collectCanvasExportArtifacts({
          scene: resolvedDocument,
          activeModeId: modeId,
          selectedObjectId: resolvedDocument.selectedObjectId,
        }),
      ),
    );
    setCheckpointNote("");
    setLastCheckout(undefined);
    setExportBundle(undefined);
    setExportValidation(undefined);
    setSelectedExportPath(undefined);
    setExportStatus("");
    setRasterScaleState(1);
    setRasterBackgroundState("transparent");
    setSpriteFrameEditSettingsState({
      snapToGrid: false,
      gridSize: 1,
      constrainFrameEditsToGuideRegion: true,
      datumSnapDistance: DEFAULT_SPRITE_FRAME_DATUM_SNAP_DISTANCE,
      restrictDatumSnapsToGuideRegion: true,
    });
    setRasterArtifact(undefined);
    setRasterStatus("");
    commandLogCounter.current = 0;
  };

  const returnToModeSelection = useCallback(() => {
    const hasSessionState =
      commandLog.length > 0 ||
      exportBundle !== undefined ||
      exportValidation !== undefined ||
      rasterArtifact !== undefined;
    if (
      activeModeId !== undefined &&
      hasSessionState &&
      !window.confirm("Change mode and discard the current working scene?")
    ) {
      return;
    }
    setActiveModeId(undefined);
    setLastCommand("choose a canvas mode");
  }, [activeModeId, commandLog.length, exportBundle, exportValidation, rasterArtifact]);

  const viewData = useMemo<AppViewData>(() => {
    const isToolGroupVisible = (group: CanvasToolGroupId) =>
      isToolGroupVisibleForMode(activeMode, group);
    const recordAppliedCommands = (
      commands: CanvasCommand[],
      results: CanvasCommandApplyResult[],
    ) => {
      commandLogCounter.current += 1;
      const logId = `command-${commandLogCounter.current}`;
      setLastApplyResults(results);
      setCommandLog((entries) => [
        {
          id: logId,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          commands,
          results,
        },
        ...entries,
      ]);
      setLastCommand(`${commands.length} command${commands.length === 1 ? "" : "s"} applied`);
    };

    const runCommands = (commands: CanvasCommand[]) => {
      const applyResult = applyCanvasCommands(
        document,
        commands,
        getSpriteCommandApplyContext(spriteFrameEditSettings),
      );
      setDocument(applyResult.document);
      recordAppliedCommands(commands, applyResult.results);
    };

    const runCommand = (command: CanvasCommand) => {
      runCommands([command]);
    };

    const setCheckpointNoteValue = (value: string) => {
      setCheckpointNote(value);
    };

    const applyCartPreset = (presetId: string) => {
      const preset = CANVAS_EXPORT_PRESETS.find((candidate) => candidate.id === presetId);
      if (!preset) {
        setExportStatus(`Unknown export preset "${presetId}".`);
        return;
      }
      setExportCart(applyExportPreset(exportArtifacts, preset));
      setExportStatus(`Preset ${preset.title} selected.`);
    };

    const toggleCartArtifact = (artifactId: string) => {
      setExportCart((current) => toggleExportArtifact(current, artifactId, exportArtifacts));
    };

    const saveCheckpoint = async (message?: string) => {
      const artifact = createCanvasCheckpointArtifact({
        scene: document,
        activeModeId,
        selectedObjectId: document.selectedObjectId,
        selectedSpriteFrameId: selectedSpriteFrame?.frame.id,
        message: message ?? (checkpointNote.trim() || undefined),
      });
      const result = await checkoutExportCart({
        artifacts: [artifact],
        cart: {
          selectedArtifactIds: [artifact.id],
          checkoutMode: "downloadFiles",
        },
        activeModeId,
      });
      setLastCheckout(result);
      if (result.kind === "ok") {
        setExportStatus(`Checkpoint saved as ${artifact.filename}.`);
        setCheckpointNote("");
        setLastCommand("checkpoint saved");
      } else {
        setExportStatus(`Checkpoint failed: ${result.message}`);
        setLastCommand("checkpoint failed");
      }
    };

    const runCartCheckout = async () => {
      const result = await checkoutExportCart({
        artifacts: exportArtifacts,
        cart: exportCart,
        activeModeId,
      });
      setLastCheckout(result);
      if (result.kind === "ok") {
        setExportStatus(
          `Checked out ${result.artifactCount} file${result.artifactCount === 1 ? "" : "s"}: ${result.filenames.join(", ")}`,
        );
        setLastCommand("export checkout completed");
      } else {
        setExportStatus(
          `Checkout failed${result.failedArtifactId ? ` on ${result.failedArtifactId}` : ""}: ${result.message}`,
        );
        setLastCommand("export checkout failed");
      }
    };

    const applyTerminalSideEffect = (sideEffect: CanvasTerminalSideEffect) => {
      switch (sideEffect.kind) {
        case "applyExportPreset":
          applyCartPreset(sideEffect.presetId);
          break;
        case "setExportArtifactSelected":
          setExportCart((current) => {
            const isSelected = current.selectedArtifactIds.includes(sideEffect.artifactId);
            if (isSelected === sideEffect.selected) return current;
            return toggleExportArtifact(current, sideEffect.artifactId, exportArtifacts);
          });
          break;
        case "checkoutExportCart":
          void runCartCheckout();
          break;
        case "saveCheckpoint":
          void saveCheckpoint(sideEffect.message);
          break;
      }
    };

    const runTerminalCommand = (input: string) => {
      const result = executeCanvasTerminalCommand(input, {
        document,
        exportArtifacts,
        exportCart,
        exportPresets: CANVAS_EXPORT_PRESETS,
      });
      if (result.clearLog) {
        setTerminalLog([]);
        setTerminalInput("");
        setLastCommand("terminal log cleared");
        return;
      }
      if (result.commands?.length) {
        runCommands(result.commands);
      }
      if (result.sideEffects?.length) {
        for (const sideEffect of result.sideEffects) {
          applyTerminalSideEffect(sideEffect);
        }
      }
      const logEntry = result.logEntry;
      if (logEntry) {
        setTerminalLog((entries) => [logEntry, ...entries].slice(0, 50));
        setLastCommand(logEntry.message);
      }
      setTerminalInput("");
    };

    const runCanvasTool: AppViewData["runCanvasTool"] = async (toolId, input) => {
      try {
        const result = await runRegisteredCanvasTool(canvasTools, toolId, input, { document });
        setLastToolResult(result);
        if (result.document) {
          setDocument(result.document);
        }
        if (result.commands?.length && result.commandResults?.length) {
          recordAppliedCommands([...result.commands], [...result.commandResults]);
        }
        setLastCommand(`tool ${toolId} completed`);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : `Tool ${toolId} failed.`;
        setLastCommand(message);
        setLastToolResult({
          toolId,
          notes: [message],
        });
      }
    };

    const createLayerGroupFromPanel = (title: string) => {
      const nextTitle = title.trim() || "New group";
      setDocument((current) => createLayerGroup(current, nextTitle));
      setLastCommand(`created layer group ${nextTitle}`);
    };

    const createMechanicalAnnotationsSidecar: AppViewData["createMechanicalAnnotationsSidecar"] =
      async (options) => {
        try {
          const selected = getSelectedObject(document);
          const targetObjectId = options?.targetObjectId ?? selected?.id;
          const target = targetObjectId ? document.objects[targetObjectId] : undefined;
          const layerId = target?.layerId ?? getDefaultImageLayerId(document);
          const sidecarId = makeUniqueObjectId("mechanical-annotations", document);
          const geometryBounds = target
            ? { x: target.x, y: target.y, width: target.width, height: target.height }
            : { x: 0, y: 0, width: document.width, height: document.height };
          const annotationUnits =
            document.unit === "mm" ||
            document.unit === "cm" ||
            document.unit === "in" ||
            document.unit === "px"
              ? document.unit
              : "px";
          const sidecar = createMechanicalAnnotationSidecarObject({
            id: sidecarId,
            name: "Mechanical annotations",
            layerId,
            x: geometryBounds.x,
            y: geometryBounds.y,
            width: geometryBounds.width,
            height: geometryBounds.height,
            targetObjectId,
            annotations: createMechanicalAnnotationSet({
              id: `${sidecarId}-set`,
              units: annotationUnits,
              sheet:
                activeModeId === "mechanical" ? createDefaultMechanicalSheetMetadata() : undefined,
            }),
          });
          let nextDocument: CanvasDocument = {
            ...document,
            selectedObjectId: sidecar.id,
            objects: {
              ...document.objects,
              [sidecar.id]: sidecar,
            },
            layers: document.layers.map((layer) =>
              layer.id === sidecar.layerId
                ? { ...layer, objectIds: [...layer.objectIds, sidecar.id] }
                : layer,
            ),
          };
          if (options?.groupId) {
            nextDocument = addObjectToLayerGroup(nextDocument, options.groupId, sidecar.id);
          }
          setDocument(nextDocument);
          setLastCommand(`created ${sidecar.name.toLowerCase()}`);
        } catch (caught) {
          setLastCommand(
            caught instanceof Error
              ? caught.message
              : "Mechanical annotations could not be created.",
          );
        }
      };

    const loadImageFile: AppViewData["loadImageFile"] = async (file, options) => {
      try {
        const role = options?.role ?? "image";
        const asset = await loadImageAssetFromFile(file, {
          idPrefix: role === "image" ? "image-" : "alpha-",
        });
        const objectId = makeUniqueObjectId(asset.id, document);
        const object = createImageObjectFromAsset(asset, {
          id: objectId,
          layerId: getDefaultImageLayerId(document),
          role,
          document,
        });
        const command: CanvasCommand = { kind: "addImageObject", object };
        const validation = validateCanvasCommands(document, command);
        setCommandValidation(validation);
        if (!validation.ok) {
          setLastCommand("image asset command invalid");
          return;
        }

        let nextDocument = applyCanvasCommands(
          document,
          [command],
          getSpriteCommandApplyContext(spriteFrameEditSettings),
        ).document;
        if (options?.groupId) {
          nextDocument = addObjectToLayerGroup(nextDocument, options.groupId, object.id);
        }
        if (role === "alphaMap" && options?.attachToImageId) {
          nextDocument = attachAlphaMapToImage(nextDocument, options.attachToImageId, object.id);
        }
        setDocument(nextDocument);
        const applyResult = applyCanvasCommands(
          document,
          [command],
          getSpriteCommandApplyContext(spriteFrameEditSettings),
        );
        recordAppliedCommands([command], applyResult.results);
      } catch (caught) {
        setLastCommand(
          caught instanceof Error ? caught.message : "Image file could not be loaded.",
        );
      }
    };

    const loadSpriteSidecarFile: AppViewData["loadSpriteSidecarFile"] = async (file, options) => {
      try {
        const selected = getOwnerImageForSelection(document, getSelectedObject(document));
        const target =
          (options?.targetId ? document.objects[options.targetId] : selected) ?? undefined;
        const targetImage =
          target?.kind === "image" && (target.role === undefined || target.role === "image")
            ? target
            : undefined;

        const text = await file.text();
        const baseName = file.name.replace(/\.(spriteforge|sprite)?\.?toml$/i, "");
        const sidecarId = makeUniqueObjectId(
          `${(targetImage?.id ?? baseName) || "sprite-sidecar"}-sprite-sidecar`,
          document,
        );
        const spec = parseSpriteSidecarToml(text, {
          id: sidecarId,
          name: `${baseName || targetImage?.name || file.name} sprite sidecar`,
          targetId: targetImage?.id,
          sourceName: file.name,
        });
        const object = targetImage
          ? createSpriteSidecarObject(targetImage, spec)
          : createUnattachedSpriteSidecarObject(spec, {
              layerId: getDefaultImageLayerId(document),
            });
        const command: CanvasCommand = {
          kind: "addSpriteSidecarObject",
          object,
          attach: Boolean(targetImage),
        };
        const validation = validateCanvasCommands(document, command);
        setCommandValidation(validation);
        if (!validation.ok) {
          setLastCommand("sprite sidecar command invalid");
          return;
        }

        const applyResult = applyCanvasCommands(
          document,
          [command],
          getSpriteCommandApplyContext(spriteFrameEditSettings),
        );
        let nextDocument = applyResult.document;
        if (options?.groupId) {
          nextDocument = addObjectToLayerGroup(nextDocument, options.groupId, object.id);
        }
        if (targetImage) {
          nextDocument = attachSpriteSidecarToImage(nextDocument, targetImage.id, object.id);
        }
        setDocument(nextDocument);
        recordAppliedCommands([command], applyResult.results);
      } catch (caught) {
        setLastCommand(
          caught instanceof Error ? caught.message : "Sprite sidecar could not be loaded.",
        );
      }
    };

    const loadGuideSidecarFile: AppViewData["loadGuideSidecarFile"] = async (file, options) => {
      try {
        const selected = getOwnerImageForSelection(document, getSelectedObject(document));
        const target =
          (options?.targetId ? document.objects[options.targetId] : selected) ?? undefined;
        const targetImage =
          target?.kind === "image" && (target.role === undefined || target.role === "image")
            ? target
            : undefined;

        const text = await file.text();
        const baseName = file.name.replace(/\.guide\.toml$/i, "").replace(/\.toml$/i, "");
        const guideId = makeUniqueObjectId(
          `${(targetImage?.id ?? baseName) || "guide-sidecar"}-guide-sidecar`,
          document,
        );
        const guide = parseGuideSidecarToml(text);
        const name = `${baseName || targetImage?.name || file.name}.guide.toml`;
        const object = targetImage
          ? createGuideSidecarObject(
              targetImage,
              { ...guide, id: guideId, rawToml: text },
              { name },
            )
          : createUnattachedGuideSidecarObject(
              { ...guide, id: guideId, rawToml: text },
              {
                layerId: getDefaultImageLayerId(document),
                name,
              },
            );
        const command: CanvasCommand = {
          kind: "addGuideSidecarObject",
          object,
          attach: Boolean(targetImage),
        };
        const validation = validateCanvasCommands(document, command);
        setCommandValidation(validation);
        if (!validation.ok) {
          setLastCommand("guide sidecar command invalid");
          return;
        }

        const applyResult = applyCanvasCommands(
          document,
          [command],
          getSpriteCommandApplyContext(spriteFrameEditSettings),
        );
        let nextDocument = applyResult.document;
        if (options?.groupId) {
          nextDocument = addObjectToLayerGroup(nextDocument, options.groupId, object.id);
        }
        if (targetImage) {
          nextDocument = attachGuideSidecarToImage(nextDocument, targetImage.id, object.id);
        }
        setDocument(nextDocument);
        recordAppliedCommands([command], applyResult.results);
      } catch (caught) {
        setLastCommand(
          caught instanceof Error ? caught.message : "Guide sidecar could not be loaded.",
        );
      }
    };

    const loadBlockoutSidecarFile: AppViewData["loadBlockoutSidecarFile"] = async (
      file,
      options,
    ) => {
      try {
        const selectedObject = getSelectedObject(document);
        const targetObject =
          (options?.targetObjectId ? document.objects[options.targetObjectId] : selectedObject) ??
          undefined;
        const text = await file.text();
        const baseName = file.name.replace(/\.blockout\.toml$/i, "").replace(/\.toml$/i, "");
        const blockoutId = makeUniqueObjectId(
          `${(targetObject?.id ?? baseName) || "blockout-sidecar"}-blockout-sidecar`,
          document,
        );
        const blockout = parseBlockoutSidecarToml(text);
        const name = `${baseName || targetObject?.name || file.name}.blockout.toml`;
        const object = targetObject
          ? createBlockoutSidecarObject(
              targetObject,
              { ...blockout, id: blockoutId, rawToml: text },
              { name },
            )
          : createUnattachedBlockoutSidecarObject(
              { ...blockout, id: blockoutId, rawToml: text },
              {
                layerId: getDefaultImageLayerId(document),
                name,
              },
            );
        const command: CanvasCommand = {
          kind: "addBlockoutSidecarObject",
          object,
          attach: Boolean(targetObject),
        };
        const validation = validateCanvasCommands(document, command);
        setCommandValidation(validation);
        if (!validation.ok) {
          setLastCommand("blockout sidecar command invalid");
          return;
        }

        const applyResult = applyCanvasCommands(
          document,
          [command],
          getSpriteCommandApplyContext(spriteFrameEditSettings),
        );
        let nextDocument = applyResult.document;
        if (options?.groupId) {
          nextDocument = addObjectToLayerGroup(nextDocument, options.groupId, object.id);
        }
        if (targetObject) {
          nextDocument = applyCanvasCommands(
            nextDocument,
            [
              {
                kind: "attachBlockoutSidecar",
                targetObjectId: targetObject.id,
                blockoutId: object.id,
              },
            ],
            getSpriteCommandApplyContext(spriteFrameEditSettings),
          ).document;
        }
        setDocument(nextDocument);
        recordAppliedCommands([command], applyResult.results);
      } catch (caught) {
        setLastCommand(
          caught instanceof Error ? caught.message : "Blockout sidecar could not be loaded.",
        );
      }
    };

    const loadSketchOverlayFile: AppViewData["loadSketchOverlayFile"] = async (file, options) => {
      try {
        const selected = getOwnerImageForSelection(document, getSelectedObject(document));
        const target =
          (options?.targetId ? document.objects[options.targetId] : selected) ?? undefined;
        const targetImage =
          target?.kind === "image" && (target.role === undefined || target.role === "image")
            ? target
            : undefined;
        const text = await file.text();
        const baseName = file.name.replace(/\.sketch\.toml$/i, "").replace(/\.toml$/i, "");
        const overlayId = makeUniqueObjectId(
          `${(targetImage?.id ?? baseName) || "sketch-overlay"}-sketch`,
          document,
        );
        const spec = parseSketchOverlayToml(text, {
          id: overlayId,
          name: baseName || "Sketch overlay",
          targetId: targetImage?.id,
        });
        const object = createSketchOverlayObject(spec, {
          id: overlayId,
          name: spec.name,
          target: targetImage,
          layerId: getDefaultImageLayerId(document),
        });
        const nextObjects = {
          ...document.objects,
          [object.id]: object,
        };
        const nextLayers = document.layers.map((layer) =>
          layer.id === object.layerId && !layer.objectIds.includes(object.id)
            ? { ...layer, objectIds: [...layer.objectIds, object.id] }
            : layer,
        );
        let nextDocument: CanvasDocument = {
          ...document,
          objects: nextObjects,
          layers: nextLayers,
          selectedObjectId: object.id,
        };
        if (options?.groupId) {
          nextDocument = addObjectToLayerGroup(nextDocument, options.groupId, object.id);
        }
        if (targetImage) {
          nextDocument = attachSketchOverlayToImage(nextDocument, targetImage.id, object.id);
        }
        setDocument(nextDocument);
        setLastCommand(`loaded sketch overlay ${file.name}`);
      } catch (caught) {
        setLastCommand(
          caught instanceof Error ? caught.message : "Sketch overlay could not be loaded.",
        );
      }
    };

    const setAidToggle = (key: keyof CanvasAidToggles, value: boolean) => {
      setAidToggles((current) => ({ ...current, [key]: value }));
    };

    const setSpriteFrameEditSettings = (settings: SpriteFrameEditSettings) => {
      setSpriteFrameEditSettingsState(settings);
    };

    const fitViewport = () => {
      setViewport(fitCanvasViewport(document));
      setLastCommand("viewport fit to canvas");
    };

    const setZoom = (zoom: number) => {
      setViewport((current) => setCanvasViewportZoom(current, zoom));
      setLastCommand(
        `viewport zoom ${Math.round(setCanvasViewportZoom(viewport, zoom).zoom * 100)}%`,
      );
    };

    const zoomToSelected = () => {
      if (!document.selectedObjectId) return;
      const selected = getSelectedObject(document);
      const selectedFrame = getSelectedSpriteFrameState(document, selected);
      if (selectedFrame?.image) {
        setViewport(
          viewportForSpriteFrame(document, selectedFrame.image, {
            sidecarId: selectedFrame.sidecar.id,
            frame: selectedFrame.frame,
          }),
        );
        setLastCommand(`viewport zoomed to sprite frame ${selectedFrame.frame.id}`);
        return;
      }
      setViewport(viewportForObject(document, document.selectedObjectId));
      setLastCommand(`viewport zoomed to ${document.selectedObjectId}`);
    };

    const zoomToGridRef = (ref: string) => {
      setViewport(viewportForGridRef(document, ref));
      setLastCommand(`viewport zoomed to ${ref.trim()}`);
    };

    const zoomToGridSpan = (span: string) => {
      setViewport(viewportForGridSpan(document, span));
      setLastCommand(`viewport zoomed to ${span.trim()}`);
    };

    const loadExampleCommands = () => {
      setCommandJson(exampleCommandJson);
      setCommandValidation(undefined);
      setLastCommand("example command JSON loaded");
    };

    const validateCommandJson = () => {
      const parsed = parseCommandJson(commandJson);
      if (!parsed.ok) {
        setCommandValidation(parsed.validation);
        setLastCommand("command JSON invalid");
        return;
      }

      const validation = validateCanvasCommands(document, parsed.value);
      setCommandValidation(validation);
      setLastCommand(validation.ok ? "command JSON valid" : "command JSON invalid");
    };

    const applyCommandJson = () => {
      const parsed = parseCommandJson(commandJson);
      if (!parsed.ok) {
        setCommandValidation(parsed.validation);
        setLastCommand("command JSON invalid");
        return;
      }

      const validation = validateCanvasCommands(document, parsed.value);
      setCommandValidation(validation);
      if (!validation.ok) {
        setLastCommand("command JSON invalid");
        return;
      }

      const commands = normalizeCommands(parsed.value);
      const applyResult = applyCanvasCommands(
        document,
        commands,
        getSpriteCommandApplyContext(spriteFrameEditSettings),
      );
      setDocument(applyResult.document);
      recordAppliedCommands(commands, applyResult.results);
    };

    const generateExport = () => {
      const latestCommands = commandLog[0]?.commands;
      const bundle = createCanvasExportBundle(document, {
        selectedObjectId: document.selectedObjectId,
        commands: latestCommands,
        summary: summarizeScene(document),
        diagnostics: geometryDiagnostics,
        viewport,
      });
      const validation = validateCanvasExportBundle(bundle, {
        expectedCommands: latestCommands !== undefined,
      });
      setExportBundle(bundle);
      setExportValidation(validation);
      setRasterArtifact(undefined);
      setRasterStatus("");
      setSelectedExportPath("handoff.toml");
      setExportStatus(
        `${bundle.files.length} files generated in ${bundle.rootName}. Validation ${
          validation.ok ? "passed" : "failed"
        }.`,
      );
      setLastCommand("export generated");
    };

    const generateTsxExport = () => {
      const latestCommands = commandLog[0]?.commands;
      const bundle = createCanvasExportBundle(document, {
        selectedObjectId: document.selectedObjectId,
        commands: latestCommands,
        summary: summarizeScene(document),
        diagnostics: geometryDiagnostics,
        viewport,
        tsxOptions: { componentName: "GeneratedPage" },
      });
      const validation = validateCanvasExportBundle(bundle, {
        expectedCommands: latestCommands !== undefined,
      });
      setExportBundle(bundle);
      setExportValidation(validation);
      setRasterArtifact(undefined);
      setRasterStatus("");
      setSelectedExportPath("generated-page.tsx");
      setExportStatus(
        `generated-page.tsx added to ${bundle.rootName}. Validation ${
          validation.ok ? "passed" : "failed"
        }.`,
      );
      setLastCommand("TSX page generated");
    };

    const setRasterScale = (scale: number) => {
      setRasterScaleState(scale);
      setRasterArtifact(undefined);
      setRasterStatus("");
    };

    const setRasterBackground = (background: RasterExportBackground) => {
      setRasterBackgroundState(background);
      setRasterArtifact(undefined);
      setRasterStatus("");
    };

    const generatePngExport = async () => {
      try {
        setRasterStatus("Generating PNG from render.svg...");
        const rasterOptions: NormalizedRasterExportOptions = normalizeRasterExportOptions({
          mimeType: "image/png",
          scale: rasterScale,
          background: rasterBackground,
        });
        const path = getRasterExportFileName("render", rasterOptions);
        const blob = await lowerCanvasDocumentToRasterBlob(document, rasterOptions);
        const artifact = {
          path,
          mimeType: rasterOptions.mimeType,
          blob,
          size: blob.size,
        };
        const latestCommands = commandLog[0]?.commands;
        const bundle = createCanvasExportBundle(document, {
          selectedObjectId: document.selectedObjectId,
          commands: latestCommands,
          summary: summarizeScene(document),
          diagnostics: geometryDiagnostics,
          viewport,
          rasterArtifactPath: path,
          rasterOptions,
        });
        const validation = validateCanvasExportBundle(bundle, {
          expectedCommands: latestCommands !== undefined,
        });

        setRasterArtifact(artifact);
        setExportBundle(bundle);
        setExportValidation(validation);
        setSelectedExportPath("handoff.toml");
        setRasterStatus(`Generated ${path}.`);
        setExportStatus(
          `${bundle.files.length} text files generated with PNG lowering metadata. Validation ${
            validation.ok ? "passed" : "failed"
          }.`,
        );
        setLastCommand("PNG lowered from render.svg");
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "PNG export failed.";
        setRasterStatus(message);
        setLastCommand("PNG export failed");
      }
    };

    const selectExportFile = (path: string) => {
      setSelectedExportPath(path);
      setExportStatus("");
    };

    const copySelectedExportFile = () => {
      const selectedFile = getSelectedExportFile(exportBundle, selectedExportPath);
      if (!selectedFile) return;

      if (!navigator.clipboard?.writeText) {
        setExportStatus("Clipboard API is unavailable in this browser.");
        return;
      }

      navigator.clipboard
        .writeText(selectedFile.text)
        .then(() => setExportStatus(`Copied ${selectedFile.path}.`))
        .catch(() => setExportStatus(`Could not copy ${selectedFile.path}.`));
    };

    const copyValidationReport = () => {
      if (!exportValidation) return;

      if (!navigator.clipboard?.writeText) {
        setExportStatus("Clipboard API is unavailable in this browser.");
        return;
      }

      navigator.clipboard
        .writeText(formatCanvasExportValidationReport(exportValidation))
        .then(() => setExportStatus("Copied validation report."))
        .catch(() => setExportStatus("Could not copy validation report."));
    };

    const downloadSelectedExportFile = () => {
      const selectedFile = getSelectedExportFile(exportBundle, selectedExportPath);
      if (!selectedFile) return;

      const blob = new Blob([selectedFile.text], { type: selectedFile.mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${exportBundle?.rootName ?? document.id}-${selectedFile.path.replace(/\//g, "__")}`;
      window.document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportStatus(`Downloaded ${selectedFile.path}.`);
    };

    const downloadRasterArtifact = () => {
      if (!rasterArtifact) return;

      const url = URL.createObjectURL(rasterArtifact.blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = rasterArtifact.path;
      window.document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setRasterStatus(`Downloaded ${rasterArtifact.path}.`);
    };

    return {
      activeMode,
      document,
      viewport,
      aidToggles,
      lastCommand,
      commandJson,
      commandValidation,
      commandLog,
      commandLogCollapsed,
      lastApplyResults,
      terminalLog,
      terminalCollapsed,
      terminalInput,
      spriteFrameEditSettings,
      lastToolResult,
      geometryDiagnostics,
      exportArtifacts,
      exportCart,
      exportPresets: CANVAS_EXPORT_PRESETS,
      checkpointNote,
      lastCheckout,
      exportBundle,
      exportValidation,
      selectedExportPath,
      exportStatus,
      rasterScale,
      rasterBackground,
      rasterArtifact,
      rasterStatus,
      isToolGroupVisible,
      returnToModeSelection,
      setViewport,
      setAidToggle,
      fitViewport,
      setZoom,
      zoomToSelected,
      zoomToGridRef,
      zoomToGridSpan,
      runCommand,
      runCommands,
      runTerminalCommand,
      setCommandLogCollapsed,
      setTerminalCollapsed,
      setSpriteFrameEditSettings,
      setTerminalInput,
      runCanvasTool,
      createLayerGroup: createLayerGroupFromPanel,
      loadImageFile,
      loadGuideSidecarFile,
      loadBlockoutSidecarFile,
      createMechanicalAnnotationsSidecar,
      loadSketchOverlayFile,
      loadSpriteSidecarFile,
      setCommandJson,
      loadExampleCommands,
      validateCommandJson,
      applyCommandJson,
      generateExport,
      generateTsxExport,
      applyExportPreset: applyCartPreset,
      toggleExportArtifact: toggleCartArtifact,
      checkoutExportCart: runCartCheckout,
      saveCheckpoint,
      setCheckpointNote: setCheckpointNoteValue,
      setRasterScale,
      setRasterBackground,
      generatePngExport,
      selectExportFile,
      copySelectedExportFile,
      copyValidationReport,
      downloadSelectedExportFile,
      downloadRasterArtifact,
    };
  }, [
    activeMode,
    document,
    viewport,
    aidToggles,
    lastCommand,
    commandJson,
    commandValidation,
    commandLog,
    lastApplyResults,
    terminalLog,
    terminalCollapsed,
    terminalInput,
    spriteFrameEditSettings,
    lastToolResult,
    geometryDiagnostics,
    exportArtifacts,
    exportCart,
    checkpointNote,
    lastCheckout,
    exportBundle,
    exportValidation,
    selectedExportPath,
    exportStatus,
    rasterScale,
    rasterBackground,
    rasterArtifact,
    rasterStatus,
    commandLogCollapsed,
    returnToModeSelection,
    activeModeId,
    selectedSpriteFrame?.frame.id,
  ]);

  if (activeModeId === undefined) {
    return <CanvasModeStart onSelectMode={loadMode} />;
  }

  return (
    <MachinaReactView
      layout={layout}
      views={VIEWS}
      viewData={{
        SceneTree: viewData,
        CanvasPanel: viewData,
        Inspector: viewData,
        SceneSummaryShelf: viewData,
        Breadcrumb: viewData,
      }}
      className="machina-canvas"
      nodeClassName="machina-node"
      nodeContainment="layout-paint"
      nodeContentVisibility="none"
    />
  );
}
