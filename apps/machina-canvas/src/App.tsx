import {
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { initialSceneDocument } from "./sceneDocument";
import { getSceneGeometryDiagnostics, type GeometryDiagnostic } from "./sceneGeometry";
import type { CanvasDocument, CanvasObject, CanvasObjectKind, TextObject } from "./sceneModel";
import { getObjectBoundsSummary, summarizeScene } from "./sceneSummary";
import { createReferenceGridConfig, getColumnLabel, objectToGridRef } from "./referenceGrid";

const MIN_WIDTH = 760;
const MIN_HEIGHT = 640;

const objectKindLabels = enumTable<CanvasObjectKind, string>({
  rect: "Rectangle",
  ellipse: "Ellipse",
  text: "Text",
});

const commandKindLabels = enumTable<CanvasCommand["kind"], string>({
  select: "Select",
  move: "Move",
  resize: "Resize",
  setFill: "Set fill",
  setStroke: "Set stroke",
  align: "Align",
  distribute: "Distribute",
});

const exampleCommandJson = JSON.stringify(
  [
    { kind: "align", ids: ["logo", "headline"], axis: "left" },
    { kind: "move", id: "cta-bg", dx: 0, dy: 16 },
    { kind: "move", id: "cta-label", dx: 0, dy: 16 },
    {
      kind: "distribute",
      ids: ["feature-chip-1", "feature-chip-2", "feature-chip-3"],
      axis: "horizontal",
      gap: 16,
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

type AppViewData = {
  document: CanvasDocument;
  lastCommand: string;
  commandJson: string;
  commandValidation: CanvasCommandValidationResult | undefined;
  commandLog: CommandLogEntry[];
  lastApplyResults: CanvasCommandApplyResult[];
  geometryDiagnostics: GeometryDiagnostic[];
  exportBundle: CanvasExportBundle | undefined;
  exportValidation: CanvasExportValidationResult | undefined;
  selectedExportPath: string | undefined;
  exportStatus: string;
  runCommand: (command: CanvasCommand) => void;
  setCommandJson: (commandJson: string) => void;
  loadExampleCommands: () => void;
  validateCommandJson: () => void;
  applyCommandJson: () => void;
  generateExport: () => void;
  selectExportFile: (path: string) => void;
  copySelectedExportFile: () => void;
  copyValidationReport: () => void;
  downloadSelectedExportFile: () => void;
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

function getKindClass(object: CanvasObject): string {
  return matchEnum(object.kind, {
    rect: () => "kind-rect",
    ellipse: () => "kind-ellipse",
    text: () => "kind-text",
  });
}

function getKindShortLabel(object: CanvasObject): string {
  return matchEnum(object.kind, {
    rect: () => "RECT",
    ellipse: () => "OVAL",
    text: () => "TEXT",
  });
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
                    <small>{getObjectGridSpan(document, object)}</small>
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
  selected,
  onSelect,
}: {
  object: CanvasObject;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  if (!object.visible) return null;

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
    ) : (
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

function ReferenceGridOverlay({ document }: { document: CanvasDocument }) {
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
      {config.showLines
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
      {config.showLines
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

function CanvasPanel(props: MachinaSlotProps) {
  const { document, runCommand } = readViewData(props);

  return (
    <main className="canvas-panel panel">
      <div className="canvas-heading">
        <div>
          <small>Canvas / Artboard</small>
          <h1>{document.name}</h1>
        </div>
        <span>
          {document.width} x {document.height} {document.unit}
        </span>
      </div>
      <div className="artboard-wrap">
        <svg
          className="artboard"
          viewBox={`0 0 ${document.width} ${document.height}`}
          role="img"
          aria-label="MachinaCanvas demo poster scene graph"
        >
          {document.layers
            .filter((layer) => layer.visible)
            .flatMap((layer) => layer.objectIds.map((id) => document.objects[id]))
            .map((object) => (
              <SceneObjectSvg
                key={object.id}
                object={object}
                selected={document.selectedObjectId === object.id}
                onSelect={(id) => runCommand({ kind: "select", id })}
              />
            ))}
          <ReferenceGridOverlay document={document} />
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
    selectedExportPath,
    generateExport,
    selectExportFile,
    copySelectedExportFile,
    copyValidationReport,
    downloadSelectedExportFile,
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
  const { document, runCommand } = readViewData(props);
  const selected = getSelectedObject(document);
  const layer = getObjectLayer(document, selected);

  if (!selected) {
    return (
      <aside className="inspector panel">
        <header className="panel-title">
          <small>Inspector</small>
          <h2>{document.name}</h2>
        </header>
        <InspectorSection title="Document">
          <Field label="ID" value={document.id} />
          <Field label="Size" value={`${document.width} x ${document.height} ${document.unit}`} />
          <Field label="Layers" value={document.layers.length} />
          <Field label="Objects" value={Object.keys(document.objects).length} />
        </InspectorSection>
        <GeometryDiagnosticsSection {...props} />
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
        <Field label="X / Y" value={`${selected.x} / ${selected.y}`} />
        <Field label="W / H" value={`${selected.width} / ${selected.height}`} />
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
      <InspectorSection title="Metadata">
        <Field label="ID" value={selected.id} />
        <Field label="Tags" value={selected.tags?.join(", ") ?? "none"} />
        <Field label="Notes" value={selected.notes ?? "none"} />
      </InspectorSection>
      <GeometryDiagnosticsSection {...props} />
      <ExportPanel {...props} />
      <CommandJsonPanel {...props} />
    </aside>
  );
}

function SceneSummaryShelf(props: MachinaSlotProps) {
  const { document, runCommand, commandLog } = readViewData(props);
  const objects = Object.values(document.objects).filter((object) =>
    ["logo", "headline", "product-body", "cta-bg", "feature-chip-1"].includes(object.id),
  );
  const recentLog = commandLog.slice(0, 3);

  return (
    <section className="scene-summary panel">
      <div className="summary-main">
        <p className="summary-text">{summarizeScene(document)}</p>
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
  const [lastCommand, setLastCommand] = useState("ready");
  const [commandJson, setCommandJson] = useState(exampleCommandJson);
  const [commandValidation, setCommandValidation] = useState<
    CanvasCommandValidationResult | undefined
  >();
  const [commandLog, setCommandLog] = useState<CommandLogEntry[]>([]);
  const [lastApplyResults, setLastApplyResults] = useState<CanvasCommandApplyResult[]>([]);
  const [exportBundle, setExportBundle] = useState<CanvasExportBundle>();
  const [exportValidation, setExportValidation] = useState<CanvasExportValidationResult>();
  const [selectedExportPath, setSelectedExportPath] = useState<string>();
  const [exportStatus, setExportStatus] = useState("");
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
      });
      const validation = validateCanvasExportBundle(bundle, {
        expectedCommands: latestCommands !== undefined,
      });
      setExportBundle(bundle);
      setExportValidation(validation);
      setSelectedExportPath("handoff.toml");
      setExportStatus(
        `${bundle.files.length} files generated in ${bundle.rootName}. Validation ${
          validation.ok ? "passed" : "failed"
        }.`,
      );
      setLastCommand("export generated");
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

    return {
      document,
      lastCommand,
      commandJson,
      commandValidation,
      commandLog,
      lastApplyResults,
      geometryDiagnostics,
      exportBundle,
      exportValidation,
      selectedExportPath,
      exportStatus,
      runCommand,
      setCommandJson,
      loadExampleCommands,
      validateCommandJson,
      applyCommandJson,
      generateExport,
      selectExportFile,
      copySelectedExportFile,
      copyValidationReport,
      downloadSelectedExportFile,
    };
  }, [
    document,
    lastCommand,
    commandJson,
    commandValidation,
    commandLog,
    lastApplyResults,
    geometryDiagnostics,
    exportBundle,
    exportValidation,
    selectedExportPath,
    exportStatus,
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
