// src/atlas/types.ts
var MachinaAtlasError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "MachinaAtlasError";
    this.code = code;
  }
};

// src/atlas/defineMachinaAtlas.ts
var SECTION_KINDS = /* @__PURE__ */ new Set([
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
  "other"
]);
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function assertOptionalString(value, field, sectionKey) {
  if (value !== void 0 && typeof value !== "string") {
    throw new MachinaAtlasError(
      "InvalidAtlasSection",
      `Atlas section ${sectionKey} has invalid ${field}.`
    );
  }
}
function assertStringArray(value, field, sectionKey) {
  if (value === void 0) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new MachinaAtlasError(
      "InvalidAtlasSection",
      `Atlas section ${sectionKey} has invalid ${field}.`
    );
  }
}
function canonicalSection(section) {
  if (!isNonEmptyString(section.key) || !isNonEmptyString(section.name)) {
    throw new MachinaAtlasError(
      "InvalidAtlasSection",
      "Atlas sections require non-empty key and name."
    );
  }
  if (section.kind !== void 0 && !SECTION_KINDS.has(section.kind)) {
    throw new MachinaAtlasError(
      "InvalidAtlasSection",
      `Atlas section ${section.key} has invalid kind.`
    );
  }
  if (section.marker !== void 0 && !isNonEmptyString(section.marker)) {
    throw new MachinaAtlasError(
      "InvalidAtlasSection",
      `Atlas section ${section.key} has invalid marker.`
    );
  }
  for (const field of ["file", "symbol", "route", "fixture", "screen", "notes"]) {
    assertOptionalString(section[field], field, section.key);
  }
  for (const field of ["owns", "uses", "usedBy", "dependsOn", "tags"]) {
    assertStringArray(section[field], field, section.key);
  }
  return { ...section };
}
function defineMachinaAtlas(atlas) {
  if (!atlas || !isNonEmptyString(atlas.app)) {
    throw new MachinaAtlasError("InvalidAtlas", "MachinaAtlas app must be a non-empty string.");
  }
  assertStringArray(atlas.tags, "tags", "<atlas>");
  if (atlas.notes !== void 0 && typeof atlas.notes !== "string") {
    throw new MachinaAtlasError("InvalidAtlas", "MachinaAtlas notes must be a string.");
  }
  const seen = /* @__PURE__ */ new Set();
  const sections = (atlas.sections ?? []).map((section) => {
    const canonical = canonicalSection(section);
    if (seen.has(canonical.key)) {
      throw new MachinaAtlasError(
        "DuplicateAtlasSectionKey",
        `Duplicate atlas section key: ${canonical.key}.`
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
    metadata: atlas.metadata
  };
}
function matches(section, query, insensitive) {
  const values = [section.key, section.name, section.marker].filter(
    (value) => value !== void 0
  );
  return values.some(
    (value) => insensitive ? value.toLowerCase() === query.toLowerCase() : value === query
  );
}
function getMachinaAtlasSection(atlas, keyOrName) {
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
function listMachinaAtlasSections(atlas, options) {
  return atlas.sections.filter((section) => {
    if (options?.kind !== void 0 && section.kind !== options.kind) return false;
    if (options?.tags !== void 0) {
      const sectionTags = new Set(section.tags ?? []);
      return options.tags.every((tag) => sectionTags.has(tag));
    }
    return true;
  });
}

// src/atlas/markers.ts
var MARKER = "@machina-section";
function parseMachinaSectionMarkers(sourceText) {
  if (sourceText.length === 0) return [];
  return sourceText.split(/\r?\n/).flatMap((raw, index) => {
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith("//") && !trimmed.startsWith("/*")) return [];
    const markerIndex = raw.indexOf(MARKER);
    if (markerIndex === -1) return [];
    let name = raw.slice(markerIndex + MARKER.length).trim();
    if (name.endsWith("*/")) name = name.slice(0, -2).trim();
    if (name.length === 0) return [];
    return [{ name, line: index + 1, column: markerIndex + 1, raw }];
  });
}

// src/atlas/extract.ts
function lineCount(sourceText) {
  if (sourceText.length === 0) return 0;
  return sourceText.split(/\r?\n/).length;
}
function extractMachinaSections(sourceText) {
  const markers = parseMachinaSectionMarkers(sourceText);
  if (markers.length === 0) return [];
  const lines = sourceText.split(/\r?\n/);
  return markers.map((marker, index) => {
    const startLine = marker.line;
    const endLine = index + 1 < markers.length ? markers[index + 1].line - 1 : lines.length;
    return {
      name: marker.name,
      startLine,
      endLine,
      text: lines.slice(startLine - 1, endLine).join("\n"),
      marker
    };
  });
}
function extractMachinaSection(sourceText, name) {
  const sections = extractMachinaSections(sourceText);
  const exact = sections.filter((section) => section.name === name);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1)
    throw new MachinaAtlasError("AmbiguousSectionMarker", `Ambiguous section marker: ${name}.`);
  const normalized = name.toLowerCase();
  const fallback = sections.filter((section) => section.name.toLowerCase() === normalized);
  if (fallback.length === 1) return fallback[0];
  if (fallback.length > 1)
    throw new MachinaAtlasError("AmbiguousSectionMarker", `Ambiguous section marker: ${name}.`);
  throw new MachinaAtlasError(
    "UnknownSectionMarker",
    `Unknown section marker: ${name}. Source has ${lineCount(sourceText)} lines.`
  );
}
function extractMachinaAtlasSection(sourceText, atlas, keyOrName) {
  const section = getMachinaAtlasSection(atlas, keyOrName);
  return extractMachinaSection(sourceText, section.marker ?? section.name);
}

// src/atlas/format.ts
var DEFAULT_OPTIONS = {
  includeNotes: false,
  includeSymbols: true,
  includeRelations: true,
  includeRoutes: true,
  includeFixtures: true,
  includeTags: true
};
function pushList(lines, label, values) {
  if (values && values.length > 0) lines.push(`   ${label}: ${values.join(", ")}`);
}
function formatSection(section, index, options) {
  const kind = section.kind ? ` [${section.kind}]` : "";
  const lines = [`${index + 1}. ${section.key} \u2014 ${section.name}${kind}`];
  if (options.includeSymbols && section.symbol) lines.push(`   symbol: ${section.symbol}`);
  if (options.includeRoutes && section.route) lines.push(`   route: ${section.route}`);
  if (options.includeFixtures && section.fixture) lines.push(`   fixture: ${section.fixture}`);
  if (options.includeRelations) {
    pushList(lines, "owns", section.owns);
    pushList(lines, "uses", section.uses);
    pushList(lines, "usedBy", section.usedBy);
    pushList(lines, "dependsOn", section.dependsOn);
  }
  if (options.includeTags) pushList(lines, "tags", section.tags);
  if (options.includeNotes && section.notes) lines.push(`   notes: ${section.notes}`);
  return lines;
}
function formatMachinaAtlasSummary(atlas, options) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const lines = [`MachinaAtlas: ${atlas.app}`, `Sections: ${atlas.sections.length}`];
  if (resolved.includeTags && atlas.tags && atlas.tags.length > 0)
    lines.push(`Tags: ${atlas.tags.join(", ")}`);
  if (resolved.includeNotes && atlas.notes) lines.push(`Notes: ${atlas.notes}`);
  if (atlas.sections.length > 0) lines.push("");
  atlas.sections.forEach((section, index) => {
    if (index > 0) lines.push("");
    lines.push(...formatSection(section, index, resolved));
  });
  return lines.join("\n");
}
export {
  MachinaAtlasError,
  defineMachinaAtlas,
  extractMachinaAtlasSection,
  extractMachinaSection,
  extractMachinaSections,
  formatMachinaAtlasSummary,
  getMachinaAtlasSection,
  listMachinaAtlasSections,
  parseMachinaSectionMarkers
};
