// src/inspect/summarizeMachinaDom.ts
var DEFAULT_SELECTOR = "[data-machina-node-id]";
var DEFAULT_MAX_TEXT_LENGTH = 120;
function getGlobalDocument() {
  return typeof document === "undefined" ? void 0 : document;
}
function isOptions(value) {
  if (value === void 0 || value === null || typeof value !== "object") return false;
  return "root" in value || "selector" in value || "includeTextExcerpt" in value || "includeA11y" in value || "generatedAt" in value || "maxTextLength" in value || "includeEmptyNodes" in value;
}
function readOptionalAttribute(element, name) {
  const value = element.getAttribute(name);
  return value === null || value === "" ? void 0 : value;
}
function rectFromElement(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}
function textExcerpt(element, maxLength) {
  const normalized = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  if (normalized === "") return void 0;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}
function canMatchRoot(root) {
  return typeof root.matches === "function";
}
function queryMatchingElements(root, selector) {
  const matches = Array.from(root.querySelectorAll(selector));
  if (canMatchRoot(root) && root.matches(selector)) return [root, ...matches];
  return matches;
}
function nearestMatchingAncestor(element, selected, root) {
  let parent = element.parentElement;
  while (parent) {
    if (selected.has(parent)) return parent;
    if (parent === root) return void 0;
    parent = parent.parentElement;
  }
  return void 0;
}
function makeSummaryNode(element, options) {
  const node = {
    tagName: element.tagName.toLowerCase(),
    rect: rectFromElement(element),
    children: []
  };
  const nodeId = readOptionalAttribute(element, "data-machina-node-id");
  const view = readOptionalAttribute(element, "data-machina-view");
  const slot = readOptionalAttribute(element, "data-machina-slot");
  const debugLabel = readOptionalAttribute(element, "data-machina-debug-label");
  const layer = readOptionalAttribute(element, "data-machina-layer");
  if (nodeId !== void 0) node.nodeId = nodeId;
  if (view !== void 0) node.view = view;
  if (slot !== void 0) node.slot = slot;
  if (debugLabel !== void 0) node.debugLabel = debugLabel;
  if (layer !== void 0) node.layer = layer;
  if (options.includeA11y) {
    const role = readOptionalAttribute(element, "role");
    const ariaLabel = readOptionalAttribute(element, "aria-label");
    if (role !== void 0) node.role = role;
    if (ariaLabel !== void 0) node.ariaLabel = ariaLabel;
  }
  if (options.includeTextExcerpt) {
    const excerpt = textExcerpt(element, options.maxTextLength);
    if (excerpt !== void 0) node.textExcerpt = excerpt;
  }
  return node;
}
function summarizeMachinaDom(rootOrOptions) {
  const options = isOptions(rootOrOptions) ? rootOrOptions : { root: rootOrOptions };
  const selector = options.selector ?? DEFAULT_SELECTOR;
  const root = options.root ?? getGlobalDocument();
  const summary = { schemaVersion: 1, rootSelector: selector, nodes: [] };
  if (options.generatedAt !== void 0) summary.generatedAt = options.generatedAt;
  if (root === void 0 || typeof root.querySelectorAll !== "function") return summary;
  const elements = queryMatchingElements(root, selector);
  const selected = new Set(elements);
  const nodeByElement = /* @__PURE__ */ new Map();
  const nodeOptions = {
    includeTextExcerpt: options.includeTextExcerpt ?? false,
    includeA11y: options.includeA11y ?? false,
    maxTextLength: options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH
  };
  for (const element of elements) nodeByElement.set(element, makeSummaryNode(element, nodeOptions));
  for (const element of elements) {
    const node = nodeByElement.get(element);
    if (!node) continue;
    const parent = nearestMatchingAncestor(element, selected, root);
    const parentNode = parent === void 0 ? void 0 : nodeByElement.get(parent);
    if (parentNode) parentNode.children.push(node);
    else summary.nodes.push(node);
  }
  return summary;
}
export {
  summarizeMachinaDom
};
