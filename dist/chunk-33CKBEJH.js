import {
  MachinaLayoutError
} from "./chunk-VREK57S3.js";

// src/screenCatalog.ts
var STANDARD_VIEWPORTS = [
  { key: "desktop", width: 1440, height: 900, label: "Desktop", tags: ["desktop"] },
  { key: "tablet", width: 1024, height: 768, label: "Tablet", tags: ["tablet"] },
  { key: "phone", width: 390, height: 844, label: "Phone", tags: ["phone", "mobile"] }
];
function isPositiveFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function validateStringArray(value, code, field) {
  if (value === void 0) return;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new MachinaLayoutError(code, `${field} must be an array of strings`);
  }
}
function copyViewport(viewport) {
  return {
    ...viewport,
    tags: viewport.tags === void 0 ? void 0 : [...viewport.tags]
  };
}
function copyScreen(screen) {
  return {
    ...screen,
    viewports: screen.viewports === void 0 ? void 0 : [...screen.viewports],
    tags: screen.tags === void 0 ? void 0 : [...screen.tags]
  };
}
function defineMachinaViewports(viewports) {
  const seen = /* @__PURE__ */ new Set();
  return viewports.map((viewport) => {
    if (typeof viewport.key !== "string" || viewport.key.trim() === "") {
      throw new MachinaLayoutError("InvalidViewport", "viewport key must be a non-empty string");
    }
    if (seen.has(viewport.key)) {
      throw new MachinaLayoutError(
        "DuplicateViewportKey",
        `duplicate viewport key: ${viewport.key}`
      );
    }
    seen.add(viewport.key);
    if (!isPositiveFiniteNumber(viewport.width) || !isPositiveFiniteNumber(viewport.height)) {
      throw new MachinaLayoutError(
        "InvalidViewport",
        `viewport ${viewport.key} width and height must be finite positive numbers`
      );
    }
    if (viewport.deviceScaleFactor !== void 0 && !isPositiveFiniteNumber(viewport.deviceScaleFactor)) {
      throw new MachinaLayoutError(
        "InvalidViewport",
        `viewport ${viewport.key} deviceScaleFactor must be a finite positive number`
      );
    }
    if (viewport.label !== void 0 && typeof viewport.label !== "string") {
      throw new MachinaLayoutError(
        "InvalidViewport",
        `viewport ${viewport.key} label must be a string`
      );
    }
    validateStringArray(viewport.tags, "InvalidViewport", `viewport ${viewport.key} tags`);
    return copyViewport(viewport);
  });
}
function createViewportMatrix(preset = "standard-responsive") {
  if (preset === "desktop-only") return defineMachinaViewports([STANDARD_VIEWPORTS[0]]);
  if (preset === "mobile-first")
    return defineMachinaViewports([
      STANDARD_VIEWPORTS[2],
      STANDARD_VIEWPORTS[1],
      STANDARD_VIEWPORTS[0]
    ]);
  return defineMachinaViewports(STANDARD_VIEWPORTS);
}
function defineMachinaScreens(screens) {
  const catalog = { screens: {}, order: [] };
  for (const screen of screens) {
    if (typeof screen.key !== "string" || screen.key.trim() === "") {
      throw new MachinaLayoutError("InvalidScreen", "screen key must be a non-empty string");
    }
    if (catalog.screens[screen.key] !== void 0) {
      throw new MachinaLayoutError("DuplicateScreenKey", `duplicate screen key: ${screen.key}`);
    }
    if (typeof screen.route !== "string" || screen.route.trim() === "") {
      throw new MachinaLayoutError(
        "InvalidScreen",
        `screen ${screen.key} route must be a non-empty string`
      );
    }
    if (screen.fixture !== void 0 && typeof screen.fixture !== "string") {
      throw new MachinaLayoutError(
        "InvalidScreen",
        `screen ${screen.key} fixture must be a string`
      );
    }
    validateStringArray(screen.viewports, "InvalidScreen", `screen ${screen.key} viewports`);
    validateStringArray(screen.tags, "InvalidScreen", `screen ${screen.key} tags`);
    if (screen.metadata !== void 0 && (typeof screen.metadata !== "object" || screen.metadata === null || Array.isArray(screen.metadata))) {
      throw new MachinaLayoutError(
        "InvalidScreen",
        `screen ${screen.key} metadata must be an object`
      );
    }
    catalog.screens[screen.key] = copyScreen(screen);
    catalog.order.push(screen.key);
  }
  return catalog;
}
function slugMachinaArtifactName(input) {
  const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug === "" ? "artifact" : slug;
}
function getMachinaViewport(viewports, key) {
  const viewport = viewports.find((candidate) => candidate.key === key);
  if (!viewport) throw new MachinaLayoutError("UnknownViewportKey", `unknown viewport key: ${key}`);
  return viewport;
}
function orderedUnique(values) {
  const result = [];
  for (const value of values ?? []) {
    if (!result.includes(value)) result.push(value);
  }
  return result;
}
function expandScreenViewportTasks(catalog, viewports, options = {}) {
  const viewportKeys = viewports.map((viewport) => viewport.key);
  const viewportKeySet = new Set(viewportKeys);
  for (const key of options.screenKeys ?? []) {
    if (catalog.screens[key] === void 0)
      throw new MachinaLayoutError("UnknownScreenKey", `unknown screen key: ${key}`);
  }
  for (const key of options.viewportKeys ?? []) {
    if (!viewportKeySet.has(key))
      throw new MachinaLayoutError("UnknownViewportKey", `unknown viewport key: ${key}`);
  }
  const requestedScreens = options.screenKeys === void 0 ? void 0 : new Set(options.screenKeys);
  const requestedViewports = options.viewportKeys === void 0 ? void 0 : new Set(options.viewportKeys);
  const tasks = [];
  for (const screenKey of catalog.order) {
    if (requestedScreens && !requestedScreens.has(screenKey)) continue;
    const screen = catalog.screens[screenKey];
    if (!screen)
      throw new MachinaLayoutError(
        "UnknownScreenKey",
        `unknown screen key in catalog order: ${screenKey}`
      );
    const screenViewportSet = screen.viewports === void 0 ? void 0 : new Set(screen.viewports);
    for (const key of screen.viewports ?? []) {
      if (!viewportKeySet.has(key))
        throw new MachinaLayoutError(
          "UnknownViewportKey",
          `screen ${screen.key} references unknown viewport key: ${key}`
        );
    }
    for (const viewport of viewports) {
      if (screenViewportSet && !screenViewportSet.has(viewport.key)) continue;
      if (requestedViewports && !requestedViewports.has(viewport.key)) continue;
      const tags = orderedUnique([...screen.tags ?? [], ...viewport.tags ?? []]);
      if ((options.tags ?? []).some((tag) => !tags.includes(tag))) continue;
      tasks.push({
        key: `${screen.key}__${viewport.key}`,
        screenKey: screen.key,
        viewportKey: viewport.key,
        route: screen.route,
        fixture: screen.fixture,
        viewport,
        screen,
        tags,
        artifactBaseName: `${slugMachinaArtifactName(screen.key)}__${slugMachinaArtifactName(viewport.key)}`
      });
    }
  }
  return tasks;
}

export {
  defineMachinaViewports,
  createViewportMatrix,
  defineMachinaScreens,
  slugMachinaArtifactName,
  getMachinaViewport,
  expandScreenViewportTasks
};
