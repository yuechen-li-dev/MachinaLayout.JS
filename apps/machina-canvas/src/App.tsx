import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { Rect } from "machinalayout";
import { enumTable, matchEnum } from "machinalayout/match";
import { MachinaReactView, type MachinaSlotProps } from "machinalayout/react";
import { resolveAppLayout } from "./appLayout";
import { applyCanvasCommand, type CanvasCommand } from "./sceneCommands";
import { initialSceneDocument } from "./sceneDocument";
import type { CanvasDocument, CanvasObject, CanvasObjectKind, TextObject } from "./sceneModel";
import { getObjectBoundsSummary, summarizeScene } from "./sceneSummary";

const MIN_WIDTH = 760;
const MIN_HEIGHT = 640;

const objectKindLabels = enumTable<CanvasObjectKind, string>({
  rect: "Rectangle",
  ellipse: "Ellipse",
  text: "Text",
});

type AppViewData = {
  document: CanvasDocument;
  lastCommand: string;
  runCommand: (command: CanvasCommand) => void;
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
      </aside>
    );
  }

  const nextFill = selected.fill === "#e34747" ? "#111111" : "#e34747";

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
    </aside>
  );
}

function SceneSummaryShelf(props: MachinaSlotProps) {
  const { document, runCommand } = readViewData(props);
  const objects = Object.values(document.objects).filter((object) =>
    ["logo", "headline", "product-body", "cta-bg", "feature-chip-1"].includes(object.id),
  );

  return (
    <section className="scene-summary panel">
      <p className="summary-text">{summarizeScene(document)}</p>
      <div className="object-card-row">
        {objects.map((object) => (
          <button
            className={`object-card ${document.selectedObjectId === object.id ? "is-selected" : ""}`}
            key={object.id}
            type="button"
            onClick={() => runCommand({ kind: "select", id: object.id })}
          >
            <span className={`kind-pill ${getKindClass(object)}`}>{getKindShortLabel(object)}</span>
            <strong>{object.name}</strong>
            <small>{getObjectBoundsSummary(object)}</small>
          </button>
        ))}
      </div>
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

  const viewData = useMemo<AppViewData>(() => {
    const runCommand = (command: CanvasCommand) => {
      setDocument((current) => applyCanvasCommand(current, command));
      setLastCommand(
        command.kind === "select"
          ? `select ${command.id ?? "document"}`
          : command.kind === "move"
            ? `move ${command.id} by ${command.dx},${command.dy}`
            : `setFill ${command.id}`,
      );
    };

    return { document, lastCommand, runCommand };
  }, [document, lastCommand]);

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
