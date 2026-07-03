import type { LayoutRow } from "../types";
import type { MachinaScreen, MachinaViewport } from "../screenCatalog";
import { MachinaAuthoringError } from "./errors";

export type MachinaScreenLayoutBuilder = (viewport: MachinaViewport) => LayoutRow[];

export type MachinaScreenDefinition = MachinaScreen & {
  layout?: MachinaScreenLayoutBuilder;
};

export type ScreenOptions = Omit<MachinaScreenDefinition, "key">;

function validateStringArray(value: readonly string[] | undefined, field: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new MachinaAuthoringError("InvalidScreen", `${field} must be an array of strings.`);
  }
}

export function screen(key: string, definition: ScreenOptions): MachinaScreenDefinition {
  if (typeof key !== "string" || key.trim() === "") {
    throw new MachinaAuthoringError("InvalidScreen", "Screen key must be a non-empty string.");
  }
  if (typeof definition !== "object" || definition === null || Array.isArray(definition)) {
    throw new MachinaAuthoringError("InvalidScreen", "Screen definition must be an object.");
  }
  if (typeof definition.route !== "string" || definition.route.trim() === "") {
    throw new MachinaAuthoringError("InvalidScreen", "Screen route must be a non-empty string.");
  }
  if (definition.fixture !== undefined && typeof definition.fixture !== "string") {
    throw new MachinaAuthoringError("InvalidScreen", "Screen fixture must be a string.");
  }
  validateStringArray(definition.viewports, "Screen viewports");
  validateStringArray(definition.tags, "Screen tags");
  if (definition.layout !== undefined && typeof definition.layout !== "function") {
    throw new MachinaAuthoringError("InvalidScreen", "Screen layout must be a function.");
  }
  return {
    ...definition,
    key,
    viewports: definition.viewports === undefined ? undefined : [...definition.viewports],
    tags: definition.tags === undefined ? undefined : [...definition.tags],
  };
}
