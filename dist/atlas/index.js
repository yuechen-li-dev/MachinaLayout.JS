import {
  MachinaAtlasError,
  defineMachinaAtlas,
  getMachinaAtlasSection,
  listMachinaAtlasSections
} from "../chunk-PKZM3ZTE.js";

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

// src/atlas/validate.ts
var DEFAULT_OPTIONS2 = {
  requireSectionMarkers: true,
  requireAtlasForEveryMarker: false,
  checkOwns: true,
  checkUses: false,
  checkRelations: true,
  checkDuplicateOwnership: true,
  symbolMatch: "identifier"
};
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function containsSymbol(source, symbol, mode) {
  if (symbol.length === 0) return false;
  if (mode === "substring") return source.includes(symbol);
  return new RegExp(`(^|[^A-Za-z0-9_$])${escapeRegExp(symbol)}($|[^A-Za-z0-9_$])`).test(source);
}
function sectionLabel(sectionKey, sectionName) {
  return sectionName === void 0 ? sectionKey : `${sectionKey} \u2014 ${sectionName}`;
}
function validateMachinaAtlas(input) {
  if (!input?.atlas || typeof input.sourceText !== "string") {
    throw new TypeError("validateMachinaAtlas requires an atlas and sourceText string.");
  }
  const options = { ...DEFAULT_OPTIONS2, ...input.options };
  const diagnostics = [];
  const markers = parseMachinaSectionMarkers(input.sourceText);
  const markerNames = new Set(markers.map((marker) => marker.name));
  const extractedSections = extractMachinaSections(input.sourceText);
  const extractedByMarker = new Map(
    extractedSections.map((section) => [section.name, section.text])
  );
  const sectionKeys = new Set(input.atlas.sections.map((section) => section.key));
  const expectedMarkers = /* @__PURE__ */ new Set();
  for (const section of input.atlas.sections) {
    const marker = section.marker ?? section.name;
    expectedMarkers.add(marker);
    if (options.requireSectionMarkers && !markerNames.has(marker)) {
      diagnostics.push({
        code: "AtlasMarkerMissing",
        severity: "error",
        sectionKey: section.key,
        sectionName: section.name,
        marker,
        message: `Atlas section ${section.key} expects marker "${marker}", but it was not found.`
      });
    }
  }
  if (options.requireAtlasForEveryMarker) {
    for (const marker of markers) {
      if (!expectedMarkers.has(marker.name)) {
        diagnostics.push({
          code: "AtlasMarkerUnmapped",
          severity: "error",
          marker: marker.name,
          line: marker.line,
          message: `Source marker "${marker.name}" at line ${marker.line} is not mapped by any Atlas section.`
        });
      }
    }
  }
  const sourceBySectionKey = /* @__PURE__ */ new Map();
  for (const section of input.atlas.sections) {
    const marker = section.marker ?? section.name;
    if (!markerNames.has(marker)) continue;
    try {
      sourceBySectionKey.set(section.key, extractMachinaSection(input.sourceText, marker).text);
    } catch (error) {
      if (options.requireSectionMarkers) {
        diagnostics.push({
          code: "AtlasSectionExtractFailed",
          severity: "error",
          sectionKey: section.key,
          sectionName: section.name,
          marker,
          message: `Atlas section ${section.key} marker "${marker}" could not be extracted: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
    if (!sourceBySectionKey.has(section.key) && extractedByMarker.has(marker)) {
      sourceBySectionKey.set(section.key, extractedByMarker.get(marker) ?? "");
    }
  }
  if (options.checkOwns) {
    for (const section of input.atlas.sections) {
      const source = sourceBySectionKey.get(section.key);
      if (source === void 0) continue;
      for (const symbol of section.owns ?? []) {
        if (!containsSymbol(source, symbol, options.symbolMatch)) {
          diagnostics.push({
            code: "AtlasOwnedSymbolMissing",
            severity: "error",
            sectionKey: section.key,
            sectionName: section.name,
            symbol,
            message: `Section ${section.key} declares owned symbol ${symbol}, but it was not found in the extracted source section.`
          });
        }
      }
    }
  }
  if (options.checkUses) {
    for (const section of input.atlas.sections) {
      const source = sourceBySectionKey.get(section.key);
      if (source === void 0) continue;
      for (const symbol of section.uses ?? []) {
        if (sectionKeys.has(symbol)) continue;
        if (!containsSymbol(source, symbol, options.symbolMatch)) {
          diagnostics.push({
            code: "AtlasUsedSymbolMissing",
            severity: "error",
            sectionKey: section.key,
            sectionName: section.name,
            symbol,
            message: `Section ${section.key} declares used symbol ${symbol}, but it was not found in the extracted source section.`
          });
        }
      }
    }
  }
  if (options.checkRelations) {
    for (const section of input.atlas.sections) {
      for (const relation of ["usedBy", "dependsOn"]) {
        for (const targetKey of section[relation] ?? []) {
          if (!sectionKeys.has(targetKey)) {
            diagnostics.push({
              code: "AtlasUnknownRelation",
              severity: "error",
              sectionKey: section.key,
              sectionName: section.name,
              relation,
              targetKey,
              message: `Section ${section.key} ${relation} references unknown section key ${targetKey}.`
            });
          }
        }
      }
    }
  }
  if (options.checkDuplicateOwnership) {
    const owners = /* @__PURE__ */ new Map();
    for (const section of input.atlas.sections) {
      for (const symbol of section.owns ?? []) {
        const existing = owners.get(symbol);
        if (existing !== void 0) {
          diagnostics.push({
            code: "AtlasDuplicateOwnership",
            severity: "warning",
            sectionKey: section.key,
            sectionName: section.name,
            symbol,
            message: `Symbol ${symbol} is owned by both ${existing} and ${section.key}.`
          });
        } else {
          owners.set(symbol, section.key);
        }
      }
    }
  }
  return { ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"), diagnostics };
}
function formatMachinaAtlasValidationReport(result) {
  const status = result.ok ? "ok" : "failed";
  const lines = [`MachinaAtlas validation: ${status}`, `Diagnostics: ${result.diagnostics.length}`];
  if (result.diagnostics.length === 0) return lines.join("\n");
  lines.push("");
  result.diagnostics.forEach((diagnostic, index) => {
    lines.push(`${index + 1}. ${diagnostic.severity} ${diagnostic.code}`);
    if (diagnostic.sectionKey !== void 0) {
      lines.push(`   section: ${sectionLabel(diagnostic.sectionKey, diagnostic.sectionName)}`);
    }
    if (diagnostic.marker !== void 0) lines.push(`   marker: ${diagnostic.marker}`);
    if (diagnostic.symbol !== void 0) lines.push(`   symbol: ${diagnostic.symbol}`);
    if (diagnostic.relation !== void 0) lines.push(`   relation: ${diagnostic.relation}`);
    if (diagnostic.targetKey !== void 0) lines.push(`   target: ${diagnostic.targetKey}`);
    if (diagnostic.line !== void 0) lines.push(`   line: ${diagnostic.line}`);
    lines.push(`   message: ${diagnostic.message}`);
    if (index + 1 < result.diagnostics.length) lines.push("");
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
  formatMachinaAtlasValidationReport,
  getMachinaAtlasSection,
  listMachinaAtlasSections,
  parseMachinaSectionMarkers,
  validateMachinaAtlas
};
