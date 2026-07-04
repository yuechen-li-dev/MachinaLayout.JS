import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { Rect } from "machinalayout";
import { enumTable, matchEnum } from "machinalayout/match";
import { MachinaReactView, type MachinaSlotProps } from "machinalayout/react";
import { resolveAppLayout } from "./appLayout";
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
  createCanvasViewport,
  fitCanvasViewport,
  getCanvasViewportViewBox,
  setCanvasViewportZoom,
  viewportForGridRef,
  viewportForGridSpan,
  viewportForObject,
  type CanvasViewport,
} from "./canvasViewport";
import { formatCanvasMeasurement, getCanvasUnitSystem } from "./canvasUnits";
import {
  formatCanvasExportValidationReport,
  validateCanvasExportBundle,
  type CanvasExportValidationDiagnostic,
  type CanvasExportValidationResult,
} from "./canvasExportValidation";
import {
  applyCanvasCommands,
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
import { initialSceneDocument } from "./sceneDocument";
import { getSceneGeometryDiagnostics, type GeometryDiagnostic } from "./sceneGeometry";
import { getSelectedObjectMeasurements } from "./sceneMeasurement";
import { resolveSketchSpec } from "./sketchOverlay";
import type {
  CanvasDocument,
  CanvasFrame,
  CanvasImageRole,
  CanvasObject,
  CanvasObjectKind,
  ImageObject,
  TextObject,
} from "./sceneModel";
import { getObjectBoundsSummary, summarizeScene } from "./sceneSummary";
import { summarizeViewport } from "./viewportSummary";
import { createReferenceGridConfig, getColumnLabel, objectToGridRef } from "./referenceGrid";
import { getCanvasImageMaskId, getImagePreserveAspectRatio } from "./canvasImageSvg";
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

const MIN_WIDTH = 760;
const MIN_HEIGHT = 640;

const objectKindLabels = enumTable<CanvasObjectKind, string>({
  rect: "Rectangle",
  ellipse: "Ellipse",
  text: "Text",
  image: "Image",
  uiComponent: "UI Component",
  sketchOverlay: "Sketch Overlay",
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
  addImageObject: "Add image object",
  removeObject: "Remove object",
  attachAlphaMap: "Attach alpha map",
  detachAlphaMap: "Detach alpha map",
  attachSketchOverlay: "Attach sketch overlay",
  detachSketchOverlay: "Detach sketch overlay",
  setSketchOverlayVisible: "Set sketch overlay visible",
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

type CanvasAidToggles = {
  showReferenceGrid: boolean;
  showReferenceGridLines: boolean;
  showMeasurementLabels: boolean;
  showGeometryDiagnostics: boolean;
};

type AppViewData = {
  document: CanvasDocument;
  viewport: CanvasViewport;
  aidToggles: CanvasAidToggles;
  lastCommand: string;
  commandJson: string;
  commandValidation: CanvasCommandValidationResult | undefined;
  commandLog: CommandLogEntry[];
  lastApplyResults: CanvasCommandApplyResult[];
  lastToolResult: CanvasToolResult | undefined;
  geometryDiagnostics: GeometryDiagnostic[];
  exportBundle: CanvasExportBundle | undefined;
  exportValidation: CanvasExportValidationResult | undefined;
  selectedExportPath: string | undefined;
  exportStatus: string;
  rasterScale: number;
  rasterBackground: RasterExportBackground;
  rasterArtifact: RasterExportArtifact | undefined;
  rasterStatus: string;
  setViewport: (viewport: CanvasViewport) => void;
  setAidToggle: (key: keyof CanvasAidToggles, value: boolean) => void;
  fitViewport: () => void;
  setZoom: (zoom: number) => void;
  zoomToSelected: () => void;
  zoomToGridRef: (ref: string) => void;
  zoomToGridSpan: (span: string) => void;
  runCommand: (command: CanvasCommand) => void;
  runCanvasTool: (
    toolId: string,
    input: { targetObjectId?: string; options?: Record<string, unknown> },
  ) => Promise<void>;
  loadImageFile: (file: File, role: CanvasImageRole) => Promise<void>;
  setCommandJson: (commandJson: string) => void;
  loadExampleCommands: () => void;
  validateCommandJson: () => void;
  applyCommandJson: () => void;
  generateExport: () => void;
  generateTsxExport: () => void;
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
    text: () => "kind-text",
    image: () => "kind-image",
    uiComponent: () => "kind-ui",
    sketchOverlay: () => "kind-sketch",
  });
}

function getKindShortLabel(object: CanvasObject): string {
  return matchEnum(object.kind, {
    rect: () => "RECT",
    ellipse: () => "OVAL",
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
  });
}

function getSketchOverlayForImage(document: CanvasDocument, object: ImageObject) {
  if (!object.sketchOverlayId) return undefined;
  const overlay = document.objects[object.sketchOverlayId];
  if (overlay?.kind !== "sketchOverlay" || overlay.targetId !== object.id) return undefined;
  return overlay;
}

function getSketchOverlayTarget(
  document: CanvasDocument,
  object: Extract<CanvasObject, { kind: "sketchOverlay" }>,
) {
  const target = document.objects[object.targetId];
  if (target?.kind !== "image") return undefined;
  return target;
}

function getObjectGridSpan(document: CanvasDocument, object: CanvasObject): string {
  return objectToGridRef(object, document).span;
}

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

function formatFileSize(text: string): string {
  return `${text.length.toLocaleString()} chars`;
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

function getExportValidationClass(validation: CanvasExportValidationResult | undefined): string {
  if (!validation) return "is-pending";
  if (!validation.ok) return "is-error";
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "warning")) {
    return "is-warning";
  }
  return "is-ok";
}

function getExportValidationLabel(validation: CanvasExportValidationResult | undefined): string {
  if (!validation) return "Not validated";
  if (!validation.ok) return "Validation failed";
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "warning")) {
    return "Validation passed with warnings";
  }
  return "Validation passed";
}

function formatExportDiagnosticDetail(diagnostic: CanvasExportValidationDiagnostic): string {
  const refs = [
    diagnostic.path ? `path ${diagnostic.path}` : undefined,
    diagnostic.objectId ? `object ${diagnostic.objectId}` : undefined,
    diagnostic.layerId ? `layer ${diagnostic.layerId}` : undefined,
  ].filter(Boolean);

  return refs.length ? `${refs.join(" / ")}: ${diagnostic.message}` : diagnostic.message;
}

function SceneTree(props: MachinaSlotProps) {
  const { document, runCommand } = readViewData(props);

  return (
    <aside className="scene-tree panel">
      <header className="app-wordmark">
        <span>MachinaCanvas</span>
        <small>LLM geometry editor</small>
      </header>
      <nav aria-label="Scene layers">
        {document.layers.map((layer) => (
          <section className="tree-layer" key={layer.id}>
            <button
              className="layer-row"
              type="button"
              onClick={() => runCommand({ kind: "select" })}
            >
              <span>{layer.name}</span>
              <small>{layer.objectIds.length}</small>
            </button>
            <div className="tree-objects">
              {layer.objectIds.map((objectId) => {
                const object = document.objects[objectId];
                const selected = document.selectedObjectId === object.id;
                const alphaFor =
                  object.kind === "image" && (object.role === "alphaMap" || object.role === "mask")
                    ? Object.values(document.objects).find(
                        (candidate) =>
                          candidate.kind === "image" && candidate.alphaMapId === object.id,
                      )?.id
                    : undefined;
                const sketchFor =
                  object.kind === "sketchOverlay"
                    ? getSketchOverlayTarget(document, object)?.id
                    : undefined;
                const sketchOverlayId =
                  object.kind === "image" ? object.sketchOverlayId : undefined;
                return (
                  <button
                    className={`tree-object ${selected ? "is-selected" : ""}`}
                    key={object.id}
                    type="button"
                    onClick={() => runCommand({ kind: "select", id: object.id })}
                  >
                    <span className={`kind-pill ${getKindClass(object)}`}>
                      {getKindShortLabel(object)}
                    </span>
                    <span>{object.name}</span>
                    <small>
                      {alphaFor
                        ? `alpha for ${alphaFor}`
                        : sketchFor
                          ? `overlay for ${sketchFor}`
                          : sketchOverlayId
                            ? `overlay ${sketchOverlayId}`
                            : getObjectGridSpan(document, object)}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
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
  if (object.kind === "sketchOverlay") return null;

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
  const { document, viewport, aidToggles, runCommand } = readViewData(props);
  const viewBox = getCanvasViewportViewBox(document, viewport);
  const alphaMappedImages = document.layers
    .filter((layer) => layer.visible)
    .flatMap((layer) => layer.objectIds.map((id) => document.objects[id]))
    .filter(
      (object): object is ImageObject =>
        object?.kind === "image" &&
        object.alphaMapId !== undefined &&
        document.objects[object.alphaMapId]?.kind === "image",
    );

  return (
    <main className="canvas-panel panel">
      <div className="canvas-heading">
        <div>
          <small>Canvas / Artboard</small>
          <h1>{document.name}</h1>
        </div>
        <span>{formatDocumentSize(document)}</span>
      </div>
      <div className="artboard-wrap">
        <svg
          className="artboard"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          role="img"
          aria-label="MachinaCanvas demo poster scene graph"
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

function ImageAssetSection(props: MachinaSlotProps) {
  const { document, loadImageFile, runCommand } = readViewData(props);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const alphaInputRef = useRef<HTMLInputElement>(null);
  const selected = getSelectedObject(document);
  const imageObjects = Object.values(document.objects).filter(
    (object): object is ImageObject =>
      object.kind === "image" && (object.role === undefined || object.role === "image"),
  );
  const alphaObjects = Object.values(document.objects).filter(
    (object): object is ImageObject =>
      object.kind === "image" && (object.role === "alphaMap" || object.role === "mask"),
  );
  const defaultAlphaId = alphaObjects[0]?.id ?? "";
  const defaultSourceId = imageObjects[0]?.id ?? "";
  const [alphaId, setAlphaId] = useState(defaultAlphaId);
  const [sourceId, setSourceId] = useState(defaultSourceId);

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

  const loadFromInput = (role: CanvasImageRole) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void loadImageFile(file, role);
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
      <div className="asset-actions">
        <button type="button" onClick={() => imageInputRef.current?.click()}>
          Load image
        </button>
        <button type="button" onClick={() => alphaInputRef.current?.click()}>
          Load alpha map
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
  const zoomValues = [0.5, 1, 2, 4, 8];

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
        {zoomValues.map((zoom) => (
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
        Zoom to selected
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
    exportBundle,
    exportValidation,
    exportStatus,
    rasterScale,
    rasterBackground,
    rasterArtifact,
    rasterStatus,
    selectedExportPath,
    generateExport,
    generateTsxExport,
    setRasterScale,
    setRasterBackground,
    generatePngExport,
    selectExportFile,
    copySelectedExportFile,
    copyValidationReport,
    downloadSelectedExportFile,
    downloadRasterArtifact,
  } = readViewData(props);
  const selectedFile = getSelectedExportFile(exportBundle, selectedExportPath);
  const validationReport = exportValidation
    ? formatCanvasExportValidationReport(exportValidation)
    : undefined;

  return (
    <InspectorSection title="Export">
      <div className="export-actions">
        <button type="button" onClick={generateExport}>
          Generate Export
        </button>
        <button type="button" onClick={copySelectedExportFile} disabled={!selectedFile}>
          Copy
        </button>
        <button type="button" onClick={copyValidationReport} disabled={!validationReport}>
          Copy Report
        </button>
        <button type="button" onClick={downloadSelectedExportFile} disabled={!selectedFile}>
          Download
        </button>
      </div>
      {exportStatus ? <p className="export-status">{exportStatus}</p> : null}
      <div className="tsx-lowering">
        <strong>TSX LOWERING</strong>
        <p>generated-page.tsx - text/typescript</p>
        <div className="tsx-actions">
          <button type="button" onClick={generateTsxExport}>
            Generate TSX Page
          </button>
          <button
            type="button"
            onClick={() => selectExportFile("generated-page.tsx")}
            disabled={!exportBundle?.files.some((file) => file.path === "generated-page.tsx")}
          >
            Show TSX
          </button>
        </div>
      </div>
      <div className="raster-lowering">
        <div className="raster-control">
          <span>Scale</span>
          <div className="raster-button-group">
            {[1, 2, 4].map((scale) => (
              <button
                className={rasterScale === scale ? "is-active" : ""}
                key={scale}
                type="button"
                onClick={() => setRasterScale(scale)}
              >
                {scale}x
              </button>
            ))}
          </div>
        </div>
        <label className="raster-control">
          <span>Background</span>
          <select
            value={rasterBackground}
            onChange={(event) => setRasterBackground(event.target.value)}
          >
            <option value="transparent">transparent</option>
            <option value="#ffffff">white</option>
            <option value="#000000">black</option>
          </select>
        </label>
        <div className="raster-actions">
          <button type="button" onClick={generatePngExport}>
            Generate PNG
          </button>
          <button type="button" onClick={downloadRasterArtifact} disabled={!rasterArtifact}>
            Download PNG
          </button>
        </div>
        {rasterArtifact ? (
          <p className="export-status">
            {rasterArtifact.path} - {rasterArtifact.mimeType} -{" "}
            {formatBlobSize(rasterArtifact.size)}
          </p>
        ) : null}
        {rasterStatus ? <p className="export-status">{rasterStatus}</p> : null}
      </div>
      <div className={`validation-result ${getExportValidationClass(exportValidation)}`}>
        <strong>{getExportValidationLabel(exportValidation)}</strong>
        {exportValidation ? (
          <p>
            {exportValidation.diagnostics.length} diagnostic
            {exportValidation.diagnostics.length === 1 ? "" : "s"}
          </p>
        ) : null}
        {exportValidation?.diagnostics.length ? (
          <ul>
            {exportValidation.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}-${index}`}>
                <span>
                  {diagnostic.severity} {diagnostic.code}
                </span>
                : {formatExportDiagnosticDetail(diagnostic)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {validationReport ? (
        <textarea
          className="export-validation-report"
          value={validationReport}
          readOnly
          spellCheck={false}
          aria-label="Canvas export validation report"
        />
      ) : null}
      {exportBundle ? (
        <>
          <div className="export-file-list">
            {exportBundle.files.map((file) => (
              <button
                className={`export-file-row ${selectedFile?.path === file.path ? "is-selected" : ""}`}
                key={file.path}
                type="button"
                onClick={() => selectExportFile(file.path)}
              >
                <span>{file.path}</span>
                <small>
                  {file.mimeType} / {formatFileSize(file.text)}
                </small>
              </button>
            ))}
          </div>
          <textarea
            className="export-preview"
            value={selectedFile?.text ?? ""}
            readOnly
            spellCheck={false}
            aria-label="Selected export file preview"
          />
        </>
      ) : (
        <p className="empty-note">No export generated yet.</p>
      )}
    </InspectorSection>
  );
}

function Inspector(props: MachinaSlotProps) {
  const { document, aidToggles, runCommand } = readViewData(props);
  const selected = getSelectedObject(document);
  const layer = getObjectLayer(document, selected);
  const unitSystem = getCanvasUnitSystem(document);
  const measurements = getSelectedObjectMeasurements(document);

  if (!selected) {
    return (
      <aside className="inspector panel">
        <header className="panel-title">
          <small>Inspector</small>
          <h2>{document.name}</h2>
        </header>
        <InspectorSection title="Document">
          <Field label="ID" value={document.id} />
          <Field label="Size" value={formatDocumentSize(document)} />
          <Field label="Unit" value={unitSystem.label} />
          <Field label="Pixels/unit" value={unitSystem.pixelsPerUnit} />
          <Field label="Layers" value={document.layers.length} />
          <Field label="Objects" value={Object.keys(document.objects).length} />
        </InspectorSection>
        <ViewportSection {...props} />
        <ViewAidsSection {...props} />
        <ImageAssetSection {...props} />
        <InspectorSection title="Measurements">
          {measurements.map((measurement) => (
            <Field key={measurement.label} label={measurement.label} value={measurement.text} />
          ))}
        </InspectorSection>
        {aidToggles.showGeometryDiagnostics ? <GeometryDiagnosticsSection {...props} /> : null}
        <ExportPanel {...props} />
        <CommandJsonPanel {...props} />
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
      <InspectorSection title="Geometry">
        <Field label="Kind" value={objectKindLabels[selected.kind]} />
        <Field label="Layer" value={layer?.name ?? selected.layerId} />
      </InspectorSection>
      <InspectorSection title="Frame">
        <Field label="Intent" value={formatFrameIntent(selected.frame)} />
      </InspectorSection>
      <InspectorSection title="Resolved">
        <Field
          label="X / Y"
          value={`${formatCanvasMeasurement(selected.x, unitSystem)} / ${formatCanvasMeasurement(
            selected.y,
            unitSystem,
          )}`}
        />
        <Field
          label="W / H"
          value={`${formatCanvasMeasurement(
            selected.width,
            unitSystem,
          )} / ${formatCanvasMeasurement(selected.height, unitSystem)}`}
        />
      </InspectorSection>
      <ViewportSection {...props} />
      <ViewAidsSection {...props} />
      <ImageAssetSection {...props} />
      <CanvasToolsSection {...props} />
      <InspectorSection title="Measurements">
        <Field label="Unit" value={unitSystem.label} />
        <Field label="Pixels/unit" value={unitSystem.pixelsPerUnit} />
        {measurements.map((measurement) => (
          <Field key={measurement.label} label={measurement.label} value={measurement.text} />
        ))}
      </InspectorSection>
      <InspectorSection title="Reference">
        <Field label="Span" value={selectedGrid.span} />
        <Field label="Center" value={selectedGrid.center.ref} />
        <Field label="Top-left" value={topLeftGrid} />
      </InspectorSection>
      <InspectorSection title="Style">
        <Field label="Fill" value={selected.fill ?? "none"} />
        <Field label="Stroke" value={selected.stroke ?? "none"} />
        {selected.kind === "text" ? <Field label="Font size" value={selected.fontSize} /> : null}
      </InspectorSection>
      {selected.kind === "image" ? (
        <>
          <InspectorSection title="Image">
            <Field label="Src" value={formatImageSrcLabel(selected.src)} />
            <Field label="Role" value={selected.role ?? "image"} />
            <Field label="Alpha map" value={selected.alphaMapId ?? "none"} />
            <Field label="Opacity" value={selected.opacity ?? 1} />
            <Field label="Blend" value={selected.blendMode ?? "normal"} />
            <Field label="Fit" value={selected.fit ?? "fill"} />
            <Field
              label="Intrinsic"
              value={
                selected.intrinsicWidth && selected.intrinsicHeight
                  ? `${selected.intrinsicWidth} x ${selected.intrinsicHeight}`
                  : "unknown"
              }
            />
          </InspectorSection>
          <InspectorSection title="Sketch Overlay">
            {(() => {
              const overlay = getSketchOverlayForImage(document, selected);
              if (!overlay) {
                const demoOverlay = document.objects["generated-product-sketch"];
                const attachable =
                  demoOverlay?.kind === "sketchOverlay" && demoOverlay.targetId === selected.id;
                return (
                  <>
                    <Field label="Overlay" value="none" />
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
                  <Field label="Overlay" value={overlay.id} />
                  <Field label="Dialect" value={overlay.spec.dialect} />
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
          </InspectorSection>
          <InspectorSection title="Composite">
            {selected.alphaMapId ? (
              <Field label="Uses alpha map" value={selected.alphaMapId} />
            ) : null}
            {selected.role === "alphaMap" ? (
              <>
                <Field label="Role" value="alpha map" />
                <Field label="Attachable" value="Can be attached to an image object" />
              </>
            ) : null}
          </InspectorSection>
        </>
      ) : null}
      {selected.kind === "sketchOverlay" ? (
        <InspectorSection title="Sketch Overlay">
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
        </InspectorSection>
      ) : null}
      {selected.kind === "uiComponent" ? (
        <InspectorSection title="UI Component">
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
        </InspectorSection>
      ) : null}
      <InspectorSection title="Metadata">
        <Field label="ID" value={selected.id} />
        <Field label="Tags" value={selected.tags?.join(", ") ?? "none"} />
        <Field label="Notes" value={selected.notes ?? "none"} />
      </InspectorSection>
      {aidToggles.showGeometryDiagnostics ? <GeometryDiagnosticsSection {...props} /> : null}
      <ExportPanel {...props} />
      <CommandJsonPanel {...props} />
    </aside>
  );
}

function SceneSummaryShelf(props: MachinaSlotProps) {
  const { document, viewport, runCommand, commandLog } = readViewData(props);
  const objects = Object.values(document.objects).filter((object) =>
    ["logo", "headline", "generated-product-image", "cta-bg", "feature-chip-1"].includes(object.id),
  );
  const recentLog = commandLog.slice(0, 3);

  return (
    <section className="scene-summary panel">
      <div className="summary-main">
        <p className="summary-text">{summarizeScene(document)}</p>
        <p className="summary-text viewport-summary-text">
          {summarizeViewport(document, viewport)}
        </p>
        <div className="object-card-row">
          {objects.map((object) => (
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
      </div>
      <aside className="command-log" aria-label="Command log">
        <header>
          <small>Command log</small>
          <strong>{commandLog.length}</strong>
        </header>
        {recentLog.length === 0 ? (
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
  const [document, setDocument] = useState(initialSceneDocument);
  const [viewport, setViewport] = useState(() => createCanvasViewport(initialSceneDocument));
  const [lastCommand, setLastCommand] = useState("ready");
  const [commandJson, setCommandJson] = useState(exampleCommandJson);
  const [commandValidation, setCommandValidation] = useState<
    CanvasCommandValidationResult | undefined
  >();
  const [commandLog, setCommandLog] = useState<CommandLogEntry[]>([]);
  const [aidToggles, setAidToggles] = useState<CanvasAidToggles>({
    showReferenceGrid: true,
    showReferenceGridLines: false,
    showMeasurementLabels: false,
    showGeometryDiagnostics: true,
  });
  const [lastApplyResults, setLastApplyResults] = useState<CanvasCommandApplyResult[]>([]);
  const [lastToolResult, setLastToolResult] = useState<CanvasToolResult>();
  const [exportBundle, setExportBundle] = useState<CanvasExportBundle>();
  const [exportValidation, setExportValidation] = useState<CanvasExportValidationResult>();
  const [selectedExportPath, setSelectedExportPath] = useState<string>();
  const [exportStatus, setExportStatus] = useState("");
  const [rasterScale, setRasterScaleState] = useState(1);
  const [rasterBackground, setRasterBackgroundState] =
    useState<RasterExportBackground>("transparent");
  const [rasterArtifact, setRasterArtifact] = useState<RasterExportArtifact>();
  const [rasterStatus, setRasterStatus] = useState("");
  const commandLogCounter = useRef(0);
  const geometryDiagnostics = useMemo(() => getSceneGeometryDiagnostics(document), [document]);

  const viewData = useMemo<AppViewData>(() => {
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

    const runCommand = (command: CanvasCommand) => {
      const applyResult = applyCanvasCommands(document, [command]);
      setDocument(applyResult.document);
      recordAppliedCommands([command], applyResult.results);
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

    const loadImageFile = async (file: File, role: CanvasImageRole) => {
      try {
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

        const applyResult = applyCanvasCommands(document, [command]);
        setDocument(applyResult.document);
        recordAppliedCommands([command], applyResult.results);
      } catch (caught) {
        setLastCommand(
          caught instanceof Error ? caught.message : "Image file could not be loaded.",
        );
      }
    };

    const setAidToggle = (key: keyof CanvasAidToggles, value: boolean) => {
      setAidToggles((current) => ({ ...current, [key]: value }));
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
      const applyResult = applyCanvasCommands(document, commands);
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
      document,
      viewport,
      aidToggles,
      lastCommand,
      commandJson,
      commandValidation,
      commandLog,
      lastApplyResults,
      lastToolResult,
      geometryDiagnostics,
      exportBundle,
      exportValidation,
      selectedExportPath,
      exportStatus,
      rasterScale,
      rasterBackground,
      rasterArtifact,
      rasterStatus,
      setViewport,
      setAidToggle,
      fitViewport,
      setZoom,
      zoomToSelected,
      zoomToGridRef,
      zoomToGridSpan,
      runCommand,
      runCanvasTool,
      loadImageFile,
      setCommandJson,
      loadExampleCommands,
      validateCommandJson,
      applyCommandJson,
      generateExport,
      generateTsxExport,
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
    document,
    viewport,
    aidToggles,
    lastCommand,
    commandJson,
    commandValidation,
    commandLog,
    lastApplyResults,
    lastToolResult,
    geometryDiagnostics,
    exportBundle,
    exportValidation,
    selectedExportPath,
    exportStatus,
    rasterScale,
    rasterBackground,
    rasterArtifact,
    rasterStatus,
  ]);

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
