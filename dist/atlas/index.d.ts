import { M as MachinaAtlasSection, a as MachinaAtlas, b as MachinaAtlasSectionKind, c as MachinaExtractedSection, d as MachinaAtlasSummaryOptions, e as MachinaSectionMarker } from '../types-CqWMheJe.js';
export { f as MachinaAtlasError, g as MachinaAtlasErrorCode } from '../types-CqWMheJe.js';

declare function defineMachinaAtlas(atlas: {
    app: string;
    sections?: readonly MachinaAtlasSection[];
    tags?: readonly string[];
    notes?: string;
    metadata?: Record<string, unknown>;
}): MachinaAtlas;
declare function getMachinaAtlasSection(atlas: MachinaAtlas, keyOrName: string): MachinaAtlasSection;
declare function listMachinaAtlasSections(atlas: MachinaAtlas, options?: {
    kind?: MachinaAtlasSectionKind;
    tags?: readonly string[];
}): MachinaAtlasSection[];

declare function extractMachinaSections(sourceText: string): MachinaExtractedSection[];
declare function extractMachinaSection(sourceText: string, name: string): MachinaExtractedSection;
declare function extractMachinaAtlasSection(sourceText: string, atlas: MachinaAtlas, keyOrName: string): MachinaExtractedSection;

declare function formatMachinaAtlasSummary(atlas: MachinaAtlas, options?: MachinaAtlasSummaryOptions): string;

declare function parseMachinaSectionMarkers(sourceText: string): MachinaSectionMarker[];

type MachinaAtlasValidationSeverity = "error" | "warning";
type MachinaAtlasValidationDiagnosticCode = "AtlasMarkerMissing" | "AtlasMarkerUnmapped" | "AtlasSectionExtractFailed" | "AtlasOwnedSymbolMissing" | "AtlasUsedSymbolMissing" | "AtlasUnknownRelation" | "AtlasDuplicateOwnership";
type MachinaAtlasValidationDiagnostic = {
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
type MachinaAtlasValidationOptions = {
    requireSectionMarkers?: boolean;
    requireAtlasForEveryMarker?: boolean;
    checkOwns?: boolean;
    checkUses?: boolean;
    checkRelations?: boolean;
    checkDuplicateOwnership?: boolean;
    symbolMatch?: "identifier" | "substring";
};
type MachinaAtlasValidationInput = {
    atlas: MachinaAtlas;
    sourceText: string;
    options?: MachinaAtlasValidationOptions;
};
type MachinaAtlasValidationResult = {
    ok: boolean;
    diagnostics: MachinaAtlasValidationDiagnostic[];
};
declare function validateMachinaAtlas(input: MachinaAtlasValidationInput): MachinaAtlasValidationResult;
declare function formatMachinaAtlasValidationReport(result: MachinaAtlasValidationResult): string;

export { MachinaAtlas, MachinaAtlasSection, MachinaAtlasSectionKind, MachinaAtlasSummaryOptions, type MachinaAtlasValidationDiagnostic, type MachinaAtlasValidationDiagnosticCode, type MachinaAtlasValidationInput, type MachinaAtlasValidationOptions, type MachinaAtlasValidationResult, type MachinaAtlasValidationSeverity, MachinaExtractedSection, MachinaSectionMarker, defineMachinaAtlas, extractMachinaAtlasSection, extractMachinaSection, extractMachinaSections, formatMachinaAtlasSummary, formatMachinaAtlasValidationReport, getMachinaAtlasSection, listMachinaAtlasSections, parseMachinaSectionMarkers, validateMachinaAtlas };
