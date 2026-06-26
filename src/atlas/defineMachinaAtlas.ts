import type { MachinaAtlas, MachinaAtlasSection, MachinaAtlasSectionKind } from "./types";
import { MachinaAtlasError } from "./types";

const SECTION_KINDS = new Set<MachinaAtlasSectionKind>([
  "app",
  "page",
  "screen",
  "view",
  "component",
  "layout",
  "behavior",
  "fixture",
  "data",
  "shared",
  "test",
  "other",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertOptionalString(
  value: unknown,
  field: string,
  sectionKey: string,
): asserts value is string | undefined {
  if (value !== undefined && typeof value !== "string") {
    throw new MachinaAtlasError(
      "InvalidAtlasSection",
      `Atlas section ${sectionKey} has invalid ${field}.`,
    );
  }
}

function assertStringArray(
  value: unknown,
  field: string,
  sectionKey: string,
): asserts value is readonly string[] | undefined {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new MachinaAtlasError(
      "InvalidAtlasSection",
      `Atlas section ${sectionKey} has invalid ${field}.`,
    );
  }
}

function canonicalSection(section: MachinaAtlasSection): MachinaAtlasSection {
  if (!isNonEmptyString(section.key) || !isNonEmptyString(section.name)) {
    throw new MachinaAtlasError(
      "InvalidAtlasSection",
      "Atlas sections require non-empty key and name.",
    );
  }
  if (section.kind !== undefined && !SECTION_KINDS.has(section.kind)) {
    throw new MachinaAtlasError(
      "InvalidAtlasSection",
      `Atlas section ${section.key} has invalid kind.`,
    );
  }
  if (section.marker !== undefined && !isNonEmptyString(section.marker)) {
    throw new MachinaAtlasError(
      "InvalidAtlasSection",
      `Atlas section ${section.key} has invalid marker.`,
    );
  }
  for (const field of ["file", "symbol", "route", "fixture", "screen", "notes"] as const) {
    assertOptionalString(section[field], field, section.key);
  }
  for (const field of ["owns", "uses", "usedBy", "dependsOn", "tags"] as const) {
    assertStringArray(section[field], field, section.key);
  }
  return { ...section };
}

export function defineMachinaAtlas(atlas: {
  app: string;
  sections?: readonly MachinaAtlasSection[];
  tags?: readonly string[];
  notes?: string;
  metadata?: Record<string, unknown>;
}): MachinaAtlas {
  if (!atlas || !isNonEmptyString(atlas.app)) {
    throw new MachinaAtlasError("InvalidAtlas", "MachinaAtlas app must be a non-empty string.");
  }
  assertStringArray(atlas.tags, "tags", "<atlas>");
  if (atlas.notes !== undefined && typeof atlas.notes !== "string") {
    throw new MachinaAtlasError("InvalidAtlas", "MachinaAtlas notes must be a string.");
  }
  const seen = new Set<string>();
  const sections = (atlas.sections ?? []).map((section) => {
    const canonical = canonicalSection(section);
    if (seen.has(canonical.key)) {
      throw new MachinaAtlasError(
        "DuplicateAtlasSectionKey",
        `Duplicate atlas section key: ${canonical.key}.`,
      );
    }
    seen.add(canonical.key);
    return canonical;
  });
  return {
    schemaVersion: 1,
    app: atlas.app,
    sections,
    tags: atlas.tags,
    notes: atlas.notes,
    metadata: atlas.metadata,
  };
}

function matches(section: MachinaAtlasSection, query: string, insensitive: boolean): boolean {
  const values = [section.key, section.name, section.marker].filter(
    (value): value is string => value !== undefined,
  );
  return values.some((value) =>
    insensitive ? value.toLowerCase() === query.toLowerCase() : value === query,
  );
}

export function getMachinaAtlasSection(
  atlas: MachinaAtlas,
  keyOrName: string,
): MachinaAtlasSection {
  const exact = atlas.sections.filter((section) => matches(section, keyOrName, false));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1)
    throw new MachinaAtlasError("AmbiguousAtlasSection", `Ambiguous atlas section: ${keyOrName}.`);
  const fallback = atlas.sections.filter((section) => matches(section, keyOrName, true));
  if (fallback.length === 1) return fallback[0];
  if (fallback.length > 1)
    throw new MachinaAtlasError("AmbiguousAtlasSection", `Ambiguous atlas section: ${keyOrName}.`);
  throw new MachinaAtlasError("UnknownAtlasSection", `Unknown atlas section: ${keyOrName}.`);
}

export function listMachinaAtlasSections(
  atlas: MachinaAtlas,
  options?: { kind?: MachinaAtlasSectionKind; tags?: readonly string[] },
): MachinaAtlasSection[] {
  return atlas.sections.filter((section) => {
    if (options?.kind !== undefined && section.kind !== options.kind) return false;
    if (options?.tags !== undefined) {
      const sectionTags = new Set(section.tags ?? []);
      return options.tags.every((tag) => sectionTags.has(tag));
    }
    return true;
  });
}
