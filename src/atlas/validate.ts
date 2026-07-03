import { extractMachinaSection, extractMachinaSections } from "./extract";
import { parseMachinaSectionMarkers } from "./markers";
import type { MachinaAtlas } from "./types";

export type MachinaAtlasValidationSeverity = "error" | "warning";

export type MachinaAtlasValidationDiagnosticCode =
  | "AtlasMarkerMissing"
  | "AtlasMarkerUnmapped"
  | "AtlasSectionExtractFailed"
  | "AtlasOwnedSymbolMissing"
  | "AtlasUsedSymbolMissing"
  | "AtlasUnknownRelation"
  | "AtlasDuplicateOwnership";

export type MachinaAtlasValidationDiagnostic = {
  code: MachinaAtlasValidationDiagnosticCode;
  severity: MachinaAtlasValidationSeverity;
  message: string;
  sectionKey?: string;
  sectionName?: string;
  marker?: string;
  symbol?: string;
  relation?: "uses" | "usedBy" | "dependsOn";
  targetKey?: string;
  line?: number;
};

export type MachinaAtlasValidationOptions = {
  requireSectionMarkers?: boolean;
  requireAtlasForEveryMarker?: boolean;
  checkOwns?: boolean;
  checkUses?: boolean;
  checkRelations?: boolean;
  checkDuplicateOwnership?: boolean;
  symbolMatch?: "identifier" | "substring";
};

export type MachinaAtlasValidationInput = {
  atlas: MachinaAtlas;
  sourceText: string;
  options?: MachinaAtlasValidationOptions;
};

export type MachinaAtlasValidationResult = {
  ok: boolean;
  diagnostics: MachinaAtlasValidationDiagnostic[];
};

type RequiredOptions = Required<MachinaAtlasValidationOptions>;

const DEFAULT_OPTIONS: RequiredOptions = {
  requireSectionMarkers: true,
  requireAtlasForEveryMarker: false,
  checkOwns: true,
  checkUses: false,
  checkRelations: true,
  checkDuplicateOwnership: true,
  symbolMatch: "identifier",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsSymbol(source: string, symbol: string, mode: "identifier" | "substring"): boolean {
  if (symbol.length === 0) return false;
  if (mode === "substring") return source.includes(symbol);
  return new RegExp(`(^|[^A-Za-z0-9_$])${escapeRegExp(symbol)}($|[^A-Za-z0-9_$])`).test(source);
}

function sectionLabel(sectionKey: string, sectionName?: string): string {
  return sectionName === undefined ? sectionKey : `${sectionKey} — ${sectionName}`;
}

export function validateMachinaAtlas(
  input: MachinaAtlasValidationInput,
): MachinaAtlasValidationResult {
  if (!input?.atlas || typeof input.sourceText !== "string") {
    throw new TypeError("validateMachinaAtlas requires an atlas and sourceText string.");
  }
  const options = { ...DEFAULT_OPTIONS, ...input.options };
  const diagnostics: MachinaAtlasValidationDiagnostic[] = [];
  const markers = parseMachinaSectionMarkers(input.sourceText);
  const markerNames = new Set(markers.map((marker) => marker.name));
  const extractedSections = extractMachinaSections(input.sourceText);
  const extractedByMarker = new Map(
    extractedSections.map((section) => [section.name, section.text]),
  );
  const sectionKeys = new Set(input.atlas.sections.map((section) => section.key));
  const expectedMarkers = new Set<string>();

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
        message: `Atlas section ${section.key} expects marker "${marker}", but it was not found.`,
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
          message: `Source marker "${marker.name}" at line ${marker.line} is not mapped by any Atlas section.`,
        });
      }
    }
  }

  const sourceBySectionKey = new Map<string, string>();
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
          message: `Atlas section ${section.key} marker "${marker}" could not be extracted: ${
            error instanceof Error ? error.message : String(error)
          }`,
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
      if (source === undefined) continue;
      for (const symbol of section.owns ?? []) {
        if (!containsSymbol(source, symbol, options.symbolMatch)) {
          diagnostics.push({
            code: "AtlasOwnedSymbolMissing",
            severity: "error",
            sectionKey: section.key,
            sectionName: section.name,
            symbol,
            message: `Section ${section.key} declares owned symbol ${symbol}, but it was not found in the extracted source section.`,
          });
        }
      }
    }
  }

  if (options.checkUses) {
    for (const section of input.atlas.sections) {
      const source = sourceBySectionKey.get(section.key);
      if (source === undefined) continue;
      for (const symbol of section.uses ?? []) {
        if (sectionKeys.has(symbol)) continue;
        if (!containsSymbol(source, symbol, options.symbolMatch)) {
          diagnostics.push({
            code: "AtlasUsedSymbolMissing",
            severity: "error",
            sectionKey: section.key,
            sectionName: section.name,
            symbol,
            message: `Section ${section.key} declares used symbol ${symbol}, but it was not found in the extracted source section.`,
          });
        }
      }
    }
  }

  if (options.checkRelations) {
    for (const section of input.atlas.sections) {
      for (const relation of ["usedBy", "dependsOn"] as const) {
        for (const targetKey of section[relation] ?? []) {
          if (!sectionKeys.has(targetKey)) {
            diagnostics.push({
              code: "AtlasUnknownRelation",
              severity: "error",
              sectionKey: section.key,
              sectionName: section.name,
              relation,
              targetKey,
              message: `Section ${section.key} ${relation} references unknown section key ${targetKey}.`,
            });
          }
        }
      }
    }
  }

  if (options.checkDuplicateOwnership) {
    const owners = new Map<string, string>();
    for (const section of input.atlas.sections) {
      for (const symbol of section.owns ?? []) {
        const existing = owners.get(symbol);
        if (existing !== undefined) {
          diagnostics.push({
            code: "AtlasDuplicateOwnership",
            severity: "warning",
            sectionKey: section.key,
            sectionName: section.name,
            symbol,
            message: `Symbol ${symbol} is owned by both ${existing} and ${section.key}.`,
          });
        } else {
          owners.set(symbol, section.key);
        }
      }
    }
  }

  return { ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"), diagnostics };
}

export function formatMachinaAtlasValidationReport(result: MachinaAtlasValidationResult): string {
  const status = result.ok ? "ok" : "failed";
  const lines = [`MachinaAtlas validation: ${status}`, `Diagnostics: ${result.diagnostics.length}`];
  if (result.diagnostics.length === 0) return lines.join("\n");
  lines.push("");
  result.diagnostics.forEach((diagnostic, index) => {
    lines.push(`${index + 1}. ${diagnostic.severity} ${diagnostic.code}`);
    if (diagnostic.sectionKey !== undefined) {
      lines.push(`   section: ${sectionLabel(diagnostic.sectionKey, diagnostic.sectionName)}`);
    }
    if (diagnostic.marker !== undefined) lines.push(`   marker: ${diagnostic.marker}`);
    if (diagnostic.symbol !== undefined) lines.push(`   symbol: ${diagnostic.symbol}`);
    if (diagnostic.relation !== undefined) lines.push(`   relation: ${diagnostic.relation}`);
    if (diagnostic.targetKey !== undefined) lines.push(`   target: ${diagnostic.targetKey}`);
    if (diagnostic.line !== undefined) lines.push(`   line: ${diagnostic.line}`);
    lines.push(`   message: ${diagnostic.message}`);
    if (index + 1 < result.diagnostics.length) lines.push("");
  });
  return lines.join("\n");
}
