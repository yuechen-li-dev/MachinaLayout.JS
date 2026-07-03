import { defineMachinaAtlas } from "../atlas/defineMachinaAtlas";
import type { MachinaAtlas, MachinaAtlasSection } from "../atlas/types";
import { MachinaAtlasError } from "../atlas/types";

export type MachinaSectionOptions = Omit<MachinaAtlasSection, "key">;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function copyArray(value: readonly string[] | undefined): readonly string[] | undefined {
  return value === undefined ? undefined : [...value];
}

export function section(key: string, options: MachinaSectionOptions): MachinaAtlasSection {
  if (!isNonEmptyString(key)) {
    throw new MachinaAtlasError("InvalidAtlasSection", "Machina section key must be non-empty.");
  }
  if (!options || !isNonEmptyString(options.name)) {
    throw new MachinaAtlasError("InvalidAtlasSection", "Machina section name must be non-empty.");
  }
  return {
    key,
    name: options.name,
    kind: options.kind,
    marker: options.marker,
    file: options.file,
    symbol: options.symbol,
    route: options.route,
    fixture: options.fixture,
    screen: options.screen,
    owns: copyArray(options.owns),
    uses: copyArray(options.uses),
    usedBy: copyArray(options.usedBy),
    dependsOn: copyArray(options.dependsOn),
    tags: copyArray(options.tags),
    notes: options.notes,
    metadata: options.metadata,
  };
}

export type MachinaAtlasOptions = {
  app: string;
  sections?: readonly MachinaAtlasSection[];
  tags?: readonly string[];
  notes?: string;
  metadata?: Record<string, unknown>;
};

export function atlas(options: MachinaAtlasOptions): MachinaAtlas {
  return defineMachinaAtlas({
    app: options.app,
    sections: options.sections === undefined ? undefined : [...options.sections],
    tags: options.tags === undefined ? undefined : [...options.tags],
    notes: options.notes,
    metadata: options.metadata,
  });
}
