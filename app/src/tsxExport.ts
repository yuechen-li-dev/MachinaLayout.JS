import { getCanvasUiComponentDefinition } from "./uiComponents/catalog";
import type { CanvasDocument, CanvasObject, ImageObject, TextObject } from "./sceneModel";

export type TsxExportOptions = {
  componentName?: string;
};

export type TsxExportResult = {
  path: string;
  text: string;
};

function getObjectOrder(document: CanvasDocument): CanvasObject[] {
  const ordered: CanvasObject[] = [];
  const seen = new Set<string>();

  for (const layer of document.layers) {
    if (!layer.visible) continue;
    for (const objectId of layer.objectIds) {
      const object = document.objects[objectId];
      if (object?.visible && !seen.has(objectId)) {
        ordered.push(object);
        seen.add(objectId);
      }
    }
  }

  return ordered;
}

function stringLiteral(value: string): string {
  return JSON.stringify(value);
}

function sanitizeComponentName(value: string | undefined, fallback: string): string {
  const source = value?.trim() || fallback;
  const parts = source.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const candidate = parts.map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join("");
  return /^[A-Za-z]/.test(candidate) ? candidate : "GeneratedPage";
}

function escapeJsxText(value: string): string {
  return `{${stringLiteral(value)}}`;
}

function imageJsx(object: ImageObject): string {
  const title = object.alphaMapId
    ? `{/* TODO: ${object.id} uses alpha map ${object.alphaMapId}; this shell lowers the image source only. */}`
    : "";
  return `${title}<img className="generated-image" src=${stringLiteral(object.src)} alt="" />`;
}

function textJsx(object: TextObject): string {
  return `<div className="generated-text" style={{ color: ${stringLiteral(object.fill ?? "#111111")}, fontSize: ${object.fontSize}, fontWeight: ${stringLiteral(String(object.fontWeight ?? 400))} }}>${escapeJsxText(object.text)}</div>`;
}

function decorativeJsx(object: CanvasObject): string {
  const radius = object.kind === "rect" ? (object.radius ?? 0) : object.width / 2;
  return `<div className="generated-shape" style={{ background: ${stringLiteral(object.fill ?? "transparent")}, borderColor: ${stringLiteral(object.stroke ?? "transparent")}, borderRadius: ${radius} }} />`;
}

function objectJsx(object: CanvasObject): string {
  if (object.kind === "uiComponent") {
    return getCanvasUiComponentDefinition(object.componentId).export(object).jsx;
  }
  if (object.kind === "image") return imageJsx(object);
  if (object.kind === "text") return textJsx(object);
  return decorativeJsx(object);
}

export function lowerCanvasDocumentToTsx(
  document: CanvasDocument,
  options?: TsxExportOptions,
): TsxExportResult {
  const componentName = sanitizeComponentName(options?.componentName, "GeneratedPage");
  const objects = getObjectOrder(document);
  const anchors = objects
    .map(
      (object) =>
        `      M.anchor(${stringLiteral(object.id)}, { left: ${object.x}, top: ${object.y}, width: ${object.width}, height: ${object.height}, view: ${stringLiteral(object.id)} }),`,
    )
    .join("\n");
  const views = objects
    .map((object) => `  ${stringLiteral(object.id)}: () => (\n    ${objectJsx(object)}\n  ),`)
    .join("\n");

  const text = `import React from "react";
import { type Rect, resolveLayoutRows } from "machinalayout";
import { M } from "machinalayout/machina";
import { MachinaReactView } from "machinalayout/react";

const generatedPageStyles: React.CSSProperties = {
  fontFamily: "Inter, system-ui, sans-serif",
};

const generatedCss = \`
.generated-page .machina-generated-node { overflow: hidden; }
.generated-button { width: 100%; height: 100%; border: 1px solid #111111; font: inherit; font-weight: 760; }
.generated-button-primary { background: #111111; color: #ffffff; }
.generated-button-secondary { background: #ffffff; color: #111111; }
.generated-button-ghost { background: transparent; color: #111111; }
.generated-button-sm { font-size: 12px; }
.generated-button-md { font-size: 14px; }
.generated-button-lg { font-size: 15px; }
.generated-card { width: 100%; height: 100%; padding: 14px; background: #ffffff; border: 1px solid #d7d7d2; color: #111111; }
.generated-card strong { display: block; font-size: 15px; margin-bottom: 8px; }
.generated-card p { margin: 0; color: #555550; font-size: 12px; line-height: 1.35; }
.generated-card-elevated { box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12); }
.generated-card-outline { border-color: #111111; }
.generated-field { display: grid; gap: 6px; width: 100%; height: 100%; color: #111111; font-size: 12px; font-weight: 700; }
.generated-field input { min-width: 0; height: 34px; border: 1px solid #bdbdb7; padding: 0 10px; font: inherit; font-weight: 500; }
.generated-badge { display: inline-flex; align-items: center; justify-content: center; width: 100%; height: 100%; border: 1px solid #cfcfca; border-radius: 999px; font-size: 12px; font-weight: 760; }
.generated-badge-success { background: #eaf6ee; color: #1d6b3a; border-color: #9bc7aa; }
.generated-badge-warning { background: #fff6df; color: #805b00; border-color: #d7bd6e; }
.generated-badge-danger { background: #fdecea; color: #9d3828; border-color: #d7a097; }
.generated-badge-neutral { background: #f1f1ee; color: #333333; }
.generated-image, .generated-shape { width: 100%; height: 100%; object-fit: contain; border-style: solid; border-width: 1px; }
.generated-text { width: 100%; height: 100%; overflow: hidden; line-height: 1.15; }
\`;

const views = {
${views}
};

export function ${componentName}() {
  const rootRect: Rect = { x: 0, y: 0, width: ${document.width}, height: ${document.height} };
  const rows = M.rows(
    M.root("page", { view: "Page" }, [
${anchors}
    ]),
  );
  const layout = resolveLayoutRows(rows, rootRect);

  return (
    <div className="generated-page" style={generatedPageStyles}>
      <style>{generatedCss}</style>
      <MachinaReactView
        layout={layout}
        views={views}
        nodeClassName="machina-generated-node"
      />
    </div>
  );
}
`;

  return {
    path: "generated-page.tsx",
    text,
  };
}
