import type {
  StaticContent,
  StaticHtmlArtifact,
  StaticNode,
  StaticPage,
  StaticTabs,
} from "./types";
import { formatStaticMachineDiagnostics, validateStaticPage } from "./validate";

export type StaticPageSerializeOptions = {
  includeHeader?: boolean;
  cssPath?: string;
};

const DEFAULT_CSS_PATH = "generated.css";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function renderStaticContent(content: StaticContent): string {
  if (typeof content === "string") {
    return escapeHtml(content);
  }
  return content.html;
}

function assertSerializablePage(page: StaticPage): void {
  const diagnostics = validateStaticPage(page).filter((entry) => entry.severity === "error");
  if (diagnostics.length > 0) {
    throw new Error(formatStaticMachineDiagnostics(diagnostics));
  }
}

function inputId(tabs: StaticTabs, tabId: string): string {
  return `${tabs.id}-${tabId}`;
}

function renderTabsHtml(tabs: StaticTabs): string {
  const name = `${tabs.id}-state`;
  const inputs = tabs.tabs
    .map((item) => {
      const checked = item.id === tabs.initial ? " checked" : "";
      return `    <input class="machina-tabs__input" type="radio" name="${escapeAttribute(name)}" id="${escapeAttribute(inputId(tabs, item.id))}"${checked} />`;
    })
    .join("\n");
  const labels = tabs.tabs
    .map(
      (item) =>
        `      <label class="machina-tabs__label" for="${escapeAttribute(inputId(tabs, item.id))}">${escapeHtml(item.label)}</label>`,
    )
    .join("\n");
  const panels = tabs.tabs
    .map(
      (item) =>
        `      <section class="machina-tabs__panel machina-tabs__panel--${escapeAttribute(item.id)}">${renderStaticContent(item.content)}</section>`,
    )
    .join("\n");

  return `<section class="machina-tabs" id="${escapeAttribute(tabs.id)}">
${inputs}
    <div class="machina-tabs__labels">
${labels}
    </div>
    <div class="machina-tabs__panels">
${panels}
    </div>
  </section>`;
}

function renderNodeHtml(node: StaticNode): string {
  if (node.kind === "tabs") {
    return renderTabsHtml(node);
  }
  return "";
}

export function serializeStaticPageHtml(
  page: StaticPage,
  options: StaticPageSerializeOptions = {},
): string {
  assertSerializablePage(page);
  const includeHeader = options.includeHeader ?? true;
  const cssPath = options.cssPath ?? DEFAULT_CSS_PATH;
  const body = page.body.map(renderNodeHtml).join("\n");

  if (!includeHeader) {
    return body;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page.title)}</title>
    <link rel="stylesheet" href="${escapeAttribute(cssPath)}" />
  </head>
  <body>
${body}
  </body>
</html>
`;
}

function baseCss(): string {
  return `.machina-tabs {
  color: #172026;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  margin: 2rem auto;
  max-width: 760px;
}

.machina-tabs__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.machina-tabs__labels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  border-bottom: 1px solid #b8c2cc;
}

.machina-tabs__label {
  border: 1px solid transparent;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  font-weight: 650;
  padding: 0.65rem 0.9rem;
}

.machina-tabs__label:hover {
  background: #eef3f7;
}

.machina-tabs__panels {
  border: 1px solid #b8c2cc;
  border-top: 0;
  padding: 1rem;
}

.machina-tabs__panel {
  display: none;
}
`;
}

function renderTabsCss(tabs: StaticTabs): string {
  return tabs.tabs
    .map((item) => {
      const id = inputId(tabs, item.id);
      return `#${id}:checked ~ .machina-tabs__labels label[for="${id}"] {
  background: #ffffff;
  border-color: #b8c2cc;
  border-bottom-color: #ffffff;
  color: #0b5cad;
}

#${id}:checked ~ .machina-tabs__panels .machina-tabs__panel--${item.id} {
  display: block;
}`;
    })
    .join("\n\n");
}

export function serializeStaticPageCss(
  page: StaticPage,
  _options: StaticPageSerializeOptions = {},
): string {
  assertSerializablePage(page);
  const nodeCss = page.body
    .map((node) => {
      if (node.kind === "tabs") {
        return renderTabsCss(node);
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
  return `${baseCss()}\n${nodeCss}\n`;
}

export function createStaticHtmlArtifact(
  page: StaticPage,
  options: StaticPageSerializeOptions = {},
): StaticHtmlArtifact {
  const cssPath = options.cssPath ?? DEFAULT_CSS_PATH;
  return {
    files: [
      {
        path: "index.html",
        text: serializeStaticPageHtml(page, { ...options, cssPath }),
        contentType: "text/html; charset=utf-8",
      },
      {
        path: cssPath,
        text: serializeStaticPageCss(page, options),
        contentType: "text/css; charset=utf-8",
      },
    ],
  };
}
