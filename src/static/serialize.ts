import type {
  StaticAccordion,
  StaticContent,
  StaticDispatch,
  StaticHtmlArtifact,
  StaticHttpAction,
  StaticHttpField,
  StaticHttpFieldOption,
  StaticHttpLink,
  StaticNode,
  StaticPage,
  StaticTabs,
  StaticTimeline,
  StaticTimelineStep,
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

function accordionInputId(accordion: StaticAccordion, itemId: string): string {
  return `${accordion.id}-${itemId}`;
}

function dispatchInputId(dispatch: StaticDispatch, stateId: string): string {
  return `${dispatch.id}-state-${stateId}`;
}

function httpFieldId(action: StaticHttpAction, field: StaticHttpField): string {
  return `${action.id}-${field.id}`;
}

function httpOptionId(
  action: StaticHttpAction,
  field: StaticHttpField,
  option: StaticHttpFieldOption,
): string {
  return `${httpFieldId(action, field)}-${option.value}`;
}

function isSafeCssCustomPropertyValue(value: string): boolean {
  return value.trim().length > 0 && !/[;{}<>]/.test(value);
}

function timelineAccent(step: StaticTimelineStep): string {
  if (step.accent && isSafeCssCustomPropertyValue(step.accent)) {
    return step.accent;
  }
  return "var(--machina-static-accent)";
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

function isAccordionItemChecked(
  accordion: StaticAccordion,
  index: number,
  explicitDefaultIndex: number,
): boolean {
  if (accordion.allowMultiple) {
    return accordion.items[index]?.defaultOpen === true;
  }
  if (explicitDefaultIndex >= 0) {
    return index === explicitDefaultIndex;
  }
  return index === 0;
}

function renderAccordionHtml(accordion: StaticAccordion): string {
  const inputType = accordion.allowMultiple ? "checkbox" : "radio";
  const name = `${accordion.id}-state`;
  const explicitDefaultIndex = accordion.items.findIndex((item) => item.defaultOpen === true);
  const items = accordion.items
    .map((item, index) => {
      const id = accordionInputId(accordion, item.id);
      const checked = isAccordionItemChecked(accordion, index, explicitDefaultIndex)
        ? " checked"
        : "";
      const radioName = accordion.allowMultiple ? "" : ` name="${escapeAttribute(name)}"`;
      return `    <div class="machina-accordion__item">
      <input class="machina-accordion__input" type="${inputType}" id="${escapeAttribute(id)}"${radioName}${checked} />
      <label class="machina-accordion__label" for="${escapeAttribute(id)}">${escapeHtml(item.label)}</label>
      <div class="machina-accordion__panel">${renderStaticContent(item.content)}</div>
    </div>`;
    })
    .join("\n");

  return `<section class="machina-accordion" id="${escapeAttribute(accordion.id)}">
${items}
  </section>`;
}

function renderTimelineHtml(timeline: StaticTimeline): string {
  const title = timeline.title
    ? `  <h2 class="machina-timeline__title">${escapeHtml(timeline.title)}</h2>\n`
    : "";
  const steps = timeline.steps
    .map(
      (step, index) => `    <li
      class="machina-timeline__step"
      style="--step-index: ${index}; --step-accent: ${escapeAttribute(timelineAccent(step))};"
    >
      <h3 class="machina-timeline__step-label">${escapeHtml(step.label)}</h3>
      <div class="machina-timeline__step-body">${renderStaticContent(step.body)}</div>
    </li>`,
    )
    .join("\n");

  return `<section
    class="machina-timeline"
    id="${escapeAttribute(timeline.id)}"
    style="--timeline-duration: ${timeline.durationMs}ms; --timeline-step-count: ${timeline.steps.length}; --timeline-iteration-count: ${timeline.loop ? "infinite" : "1"};"
  >
${title}  <ol class="machina-timeline__steps">
${steps}
  </ol>
  <div class="machina-timeline__progress" aria-hidden="true">
    <div class="machina-timeline__progress-bar"></div>
  </div>
  </section>`;
}

function renderDispatchHtml(dispatch: StaticDispatch): string {
  const name = `${dispatch.id}-state`;
  const stateEntries = Object.entries(dispatch.states);
  const inputs = stateEntries
    .map(([stateId]) => {
      const checked = stateId === dispatch.initial ? " checked" : "";
      return `  <input class="machina-dispatch__input" type="radio" name="${escapeAttribute(name)}" id="${escapeAttribute(dispatchInputId(dispatch, stateId))}"${checked} />`;
    })
    .join("\n");
  const screens = stateEntries
    .map(([stateId, state]) => {
      const body =
        state.body === undefined
          ? ""
          : `      <div class="machina-dispatch__body">${renderStaticContent(state.body)}</div>\n`;
      const actions =
        state.actions && state.actions.length > 0
          ? `      <div class="machina-dispatch__actions">
${state.actions
  .map(
    (action) =>
      `        <label class="machina-dispatch__action" for="${escapeAttribute(dispatchInputId(dispatch, action.to))}">${escapeHtml(action.label)}</label>`,
  )
  .join("\n")}
      </div>\n`
          : "";
      return `    <section class="machina-dispatch__screen machina-dispatch__screen--${escapeAttribute(stateId)}">
      <h2 class="machina-dispatch__title">${escapeHtml(state.title)}</h2>
${body}${actions}    </section>`;
    })
    .join("\n");

  return `<section class="machina-dispatch" id="${escapeAttribute(dispatch.id)}">
${inputs}
  <div class="machina-dispatch__screens">
${screens}
  </div>
  </section>`;
}

function renderBooleanAttribute(name: string, value: boolean | undefined): string {
  return value ? ` ${name}` : "";
}

function renderAttribute(name: string, value: string | number | undefined): string {
  if (value === undefined) {
    return "";
  }
  return ` ${name}="${escapeAttribute(String(value))}"`;
}

function renderTargetAttributes(target: "self" | "blank" | undefined): string {
  if (target === "blank") {
    return ' target="_blank" rel="noopener noreferrer"';
  }
  return "";
}

function renderCommonFieldAttributes(field: StaticHttpField): string {
  return [
    renderAttribute("placeholder", field.placeholder),
    renderBooleanAttribute("required", field.required),
    renderBooleanAttribute("disabled", field.disabled),
    renderBooleanAttribute("readonly", field.readonly),
    renderAttribute("min", field.min),
    renderAttribute("max", field.max),
    renderAttribute("step", field.step),
    renderAttribute("pattern", field.pattern),
    renderAttribute("autocomplete", field.autocomplete),
  ].join("");
}

function renderHiddenHttpField(action: StaticHttpAction, field: StaticHttpField): string {
  const id = httpFieldId(action, field);
  const name = field.name ?? field.id;
  return `      <input type="hidden" id="${escapeAttribute(id)}" name="${escapeAttribute(name)}"${renderAttribute("value", field.value)}${renderBooleanAttribute("disabled", field.disabled)} />`;
}

function renderTextareaHttpField(action: StaticHttpAction, field: StaticHttpField): string {
  const id = httpFieldId(action, field);
  const name = field.name ?? field.id;
  return `      <div class="machina-http-action__field">
        <label for="${escapeAttribute(id)}">${escapeHtml(field.label ?? "")}</label>
        <textarea id="${escapeAttribute(id)}" name="${escapeAttribute(name)}"${renderCommonFieldAttributes(field)}>${escapeHtml(field.value ?? "")}</textarea>
      </div>`;
}

function renderSelectHttpField(action: StaticHttpAction, field: StaticHttpField): string {
  const id = httpFieldId(action, field);
  const name = field.name ?? field.id;
  const options = (field.options ?? [])
    .map(
      (option) =>
        `          <option value="${escapeAttribute(option.value)}"${option.value === field.value ? " selected" : ""}>${escapeHtml(option.label)}</option>`,
    )
    .join("\n");
  return `      <div class="machina-http-action__field">
        <label for="${escapeAttribute(id)}">${escapeHtml(field.label ?? "")}</label>
        <select id="${escapeAttribute(id)}" name="${escapeAttribute(name)}"${renderCommonFieldAttributes(field)}>
${options}
        </select>
      </div>`;
}

function renderRadioHttpField(action: StaticHttpAction, field: StaticHttpField): string {
  const name = field.name ?? field.id;
  const options = (field.options ?? [])
    .map((option) => {
      const id = httpOptionId(action, field, option);
      return `        <label class="machina-http-action__choice" for="${escapeAttribute(id)}">
          <input id="${escapeAttribute(id)}" name="${escapeAttribute(name)}" type="radio" value="${escapeAttribute(option.value)}"${option.value === field.value ? " checked" : ""}${renderBooleanAttribute("required", field.required)}${renderBooleanAttribute("disabled", field.disabled)} />
          <span>${escapeHtml(option.label)}</span>
        </label>`;
    })
    .join("\n");
  return `      <fieldset class="machina-http-action__field machina-http-action__field--choices">
        <legend>${escapeHtml(field.label ?? "")}</legend>
${options}
      </fieldset>`;
}

function renderInputHttpField(action: StaticHttpAction, field: StaticHttpField): string {
  const id = httpFieldId(action, field);
  const name = field.name ?? field.id;
  const value = field.kind === "checkbox" ? (field.value ?? "on") : field.value;
  return `      <div class="machina-http-action__field">
        <label for="${escapeAttribute(id)}">${escapeHtml(field.label ?? "")}</label>
        <input id="${escapeAttribute(id)}" name="${escapeAttribute(name)}" type="${escapeAttribute(field.kind)}"${renderAttribute("value", value)}${renderCommonFieldAttributes(field)} />
      </div>`;
}

function renderHttpField(action: StaticHttpAction, field: StaticHttpField): string {
  if (field.kind === "hidden") {
    return renderHiddenHttpField(action, field);
  }
  if (field.kind === "textarea") {
    return renderTextareaHttpField(action, field);
  }
  if (field.kind === "select") {
    return renderSelectHttpField(action, field);
  }
  if (field.kind === "radio") {
    return renderRadioHttpField(action, field);
  }
  return renderInputHttpField(action, field);
}

function renderHttpActionHtml(action: StaticHttpAction): string {
  const title =
    action.title === undefined
      ? ""
      : `  <h2 class="machina-http-action__title">${escapeHtml(action.title)}</h2>\n`;
  const description =
    action.description === undefined
      ? ""
      : `  <div class="machina-http-action__description">${renderStaticContent(action.description)}</div>\n`;
  const fields = action.fields.map((field) => renderHttpField(action, field)).join("\n");

  return `<section class="machina-http-action" id="${escapeAttribute(action.id)}">
${title}${description}  <form class="machina-http-action__form" method="${action.method.toLowerCase()}" action="${escapeAttribute(action.action)}"${renderTargetAttributes(action.target)}>
${fields}
    <button class="machina-http-action__submit" type="submit">${escapeHtml(action.submitLabel ?? "Submit")}</button>
  </form>
  </section>`;
}

function renderHttpLinkHtml(link: StaticHttpLink): string {
  return `<a class="machina-http-link" id="${escapeAttribute(link.id)}" href="${escapeAttribute(link.href)}"${renderTargetAttributes(link.target)}>${escapeHtml(link.label)}</a>`;
}

function renderNodeHtml(node: StaticNode): string {
  if (node.kind === "tabs") {
    return renderTabsHtml(node);
  }
  if (node.kind === "accordion") {
    return renderAccordionHtml(node);
  }
  if (node.kind === "timeline") {
    return renderTimelineHtml(node);
  }
  if (node.kind === "dispatch") {
    return renderDispatchHtml(node);
  }
  if (node.kind === "httpAction") {
    return renderHttpActionHtml(node);
  }
  if (node.kind === "httpLink") {
    return renderHttpLinkHtml(node);
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
  return `:root {
  --machina-static-border: #b8c2cc;
  --machina-static-accent: #0b5cad;
  --machina-static-surface: #ffffff;
  --machina-static-muted: #eef3f7;
  --machina-static-text: #172026;
}

.machina-tabs {
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

.machina-accordion {
  color: #172026;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  margin: 2rem auto;
  max-width: 760px;
}

.machina-accordion__item {
  border: 1px solid #b8c2cc;
  border-radius: 6px;
  margin-block: 0.75rem;
  overflow: hidden;
}

.machina-accordion__input {
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

.machina-accordion__label {
  background: #f7fafc;
  cursor: pointer;
  display: block;
  padding: 0.85rem 1rem;
}

.machina-accordion__label:hover {
  background: #eef3f7;
}

.machina-accordion__panel {
  display: none;
  padding: 1rem;
}

.machina-accordion__input:checked ~ .machina-accordion__label {
  background: #ffffff;
  color: #0b5cad;
  font-weight: 700;
}

.machina-accordion__input:checked ~ .machina-accordion__panel {
  display: block;
}

.machina-timeline {
  color: var(--machina-static-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  margin: 2rem auto;
  max-width: 760px;
}

.machina-timeline__title {
  font-size: 1.35rem;
  line-height: 1.2;
  margin: 0 0 1rem;
}

.machina-timeline__steps {
  counter-reset: machina-timeline-step;
  display: grid;
  gap: 0.75rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.machina-timeline__step {
  animation-delay: calc(var(--step-index) * var(--timeline-duration) / var(--timeline-step-count));
  animation-duration: var(--timeline-duration);
  animation-iteration-count: var(--timeline-iteration-count);
  animation-name: machina-timeline-step-pulse;
  animation-timing-function: linear;
  border: 1px solid var(--machina-static-border);
  border-left: 0.35rem solid var(--step-accent);
  border-radius: 6px;
  counter-increment: machina-timeline-step;
  opacity: 0.72;
  padding: 0.85rem 1rem 0.85rem 3.25rem;
  position: relative;
}

.machina-timeline__step::before {
  align-items: center;
  background: var(--step-accent);
  border-radius: 999px;
  color: #ffffff;
  content: counter(machina-timeline-step);
  display: inline-flex;
  font-size: 0.8rem;
  font-weight: 750;
  height: 1.7rem;
  justify-content: center;
  left: 1rem;
  position: absolute;
  top: 0.85rem;
  width: 1.7rem;
}

.machina-timeline__step-label {
  font-size: 1rem;
  line-height: 1.3;
  margin: 0 0 0.3rem;
}

.machina-timeline__step-body {
  line-height: 1.5;
}

.machina-timeline__progress {
  background: var(--machina-static-muted);
  border-radius: 999px;
  height: 0.45rem;
  margin-top: 1rem;
  overflow: hidden;
}

.machina-timeline__progress-bar {
  animation-duration: var(--timeline-duration);
  animation-iteration-count: var(--timeline-iteration-count);
  animation-name: machina-timeline-progress;
  animation-timing-function: linear;
  background: var(--machina-static-accent);
  height: 100%;
  transform: scaleX(0);
  transform-origin: left center;
}

.machina-dispatch {
  color: var(--machina-static-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  margin: 2rem auto;
  max-width: 760px;
}

.machina-dispatch__input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  opacity: 0;
  pointer-events: none;
}

.machina-dispatch__screens {
  border: 1px solid var(--machina-static-border);
  border-radius: 6px;
  padding: 1rem;
}

.machina-dispatch__screen {
  display: none;
}

.machina-dispatch__title {
  font-size: 1.25rem;
  line-height: 1.25;
  margin: 0 0 0.5rem;
}

.machina-dispatch__body {
  line-height: 1.5;
  margin-block: 0.5rem 1rem;
}

.machina-dispatch__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.machina-dispatch__action {
  border: 1px solid var(--machina-static-border);
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  font-weight: 650;
  padding: 0.65rem 0.85rem;
}

.machina-dispatch__action:hover {
  background: var(--machina-static-muted);
  border-color: var(--machina-static-accent);
  color: var(--machina-static-accent);
}

.machina-http-action {
  color: var(--machina-static-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  margin: 2rem auto;
  max-width: 760px;
}

.machina-http-action__title {
  font-size: 1.25rem;
  line-height: 1.25;
  margin: 0 0 0.5rem;
}

.machina-http-action__description {
  line-height: 1.5;
  margin-block: 0 1rem;
}

.machina-http-action__form {
  border: 1px solid var(--machina-static-border);
  border-radius: 6px;
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
}

.machina-http-action__field {
  display: grid;
  gap: 0.35rem;
}

.machina-http-action__field label,
.machina-http-action__field legend {
  font-weight: 650;
}

.machina-http-action__field input,
.machina-http-action__field select,
.machina-http-action__field textarea {
  border: 1px solid var(--machina-static-border);
  border-radius: 6px;
  color: var(--machina-static-text);
  font: inherit;
  padding: 0.65rem 0.75rem;
}

.machina-http-action__field textarea {
  min-height: 7rem;
  resize: vertical;
}

.machina-http-action__field--choices {
  border: 0;
  margin: 0;
  padding: 0;
}

.machina-http-action__choice {
  align-items: center;
  display: flex;
  gap: 0.45rem;
  font-weight: 500;
}

.machina-http-action__choice input {
  inline-size: auto;
}

.machina-http-action__submit {
  background: var(--machina-static-accent);
  border: 1px solid var(--machina-static-accent);
  border-radius: 6px;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  justify-self: start;
  padding: 0.65rem 0.95rem;
}

.machina-http-link {
  color: var(--machina-static-accent);
  display: inline-flex;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-weight: 700;
  margin: 1rem auto;
  max-width: 760px;
}

@keyframes machina-timeline-progress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

@keyframes machina-timeline-step-pulse {
  0%, 18% {
    border-color: var(--step-accent);
    opacity: 1;
  }
  22%, 100% {
    border-color: var(--machina-static-border);
    opacity: 0.72;
  }
}

@media (prefers-reduced-motion: reduce) {
  .machina-timeline__progress-bar,
  .machina-timeline__step {
    animation: none;
  }
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

function renderDispatchCss(dispatch: StaticDispatch): string {
  return Object.keys(dispatch.states)
    .map((stateId) => {
      const id = dispatchInputId(dispatch, stateId);
      return `#${id}:checked ~ .machina-dispatch__screens .machina-dispatch__screen--${stateId} {
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
      if (node.kind === "dispatch") {
        return renderDispatchCss(node);
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
