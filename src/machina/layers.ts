import { MachinaAuthoringError } from "./errors";

export type MachinaLayerMap = Record<string, { z: number }>;

function validateLayerName(name: string): void {
  if (typeof name !== "string" || name.trim() === "") {
    throw new MachinaAuthoringError("InvalidLayer", "Layer name must be a non-empty string.");
  }
}

export function onLayer(name: string): string {
  validateLayerName(name);
  return name;
}

export function defineLayers<T extends MachinaLayerMap>(layers: T): T {
  if (typeof layers !== "object" || layers === null || Array.isArray(layers)) {
    throw new MachinaAuthoringError("InvalidLayer", "Layers must be an object.");
  }
  const result: MachinaLayerMap = {};
  for (const [name, layer] of Object.entries(layers)) {
    validateLayerName(name);
    if (typeof layer !== "object" || layer === null || !Number.isFinite(layer.z)) {
      throw new MachinaAuthoringError("InvalidLayer", `Layer ${name} z must be a finite number.`);
    }
    result[name] = { z: layer.z };
  }
  return result as T;
}
