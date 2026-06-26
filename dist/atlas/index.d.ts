type MachinaAtlasSectionKind = "app" | "page" | "screen" | "view" | "component" | "layout" | "behavior" | "fixture" | "data" | "shared" | "test" | "other";
type MachinaAtlasSection = {
    key: string;
    name: string;
    kind?: MachinaAtlasSectionKind;
    marker?: string;
    file?: string;
    symbol?: string;
    route?: string;
    fixture?: string;
    screen?: string;
    owns?: readonly string[];
    uses?: readonly string[];
    usedBy?: readonly string[];
    dependsOn?: readonly string[];
    tags?: readonly string[];
    notes?: string;
    metadata?: Record<string, unknown>;
};
type MachinaAtlas = {
    schemaVersion: 1;
    app: string;
    sections: readonly MachinaAtlasSection[];
    tags?: readonly string[];
    notes?: string;
    metadata?: Record<string, unknown>;
};
type MachinaSectionMarker = {
    name: string;
    line: number;
    column: number;
    raw: string;
};
type MachinaExtractedSection = {
    name: string;
    startLine: number;
    endLine: number;
    text: string;
    marker: MachinaSectionMarker;
};
type MachinaAtlasSummaryOptions = {
    includeNotes?: boolean;
    includeSymbols?: boolean;
    includeRelations?: boolean;
    includeRoutes?: boolean;
    includeFixtures?: boolean;
    includeTags?: boolean;
};
type MachinaAtlasErrorCode = "InvalidAtlas" | "InvalidAtlasSection" | "DuplicateAtlasSectionKey" | "UnknownAtlasSection" | "AmbiguousAtlasSection" | "UnknownSectionMarker" | "AmbiguousSectionMarker";
declare class MachinaAtlasError extends Error {
    code: MachinaAtlasErrorCode;
    constructor(code: MachinaAtlasErrorCode, message: string);
}

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

export { type MachinaAtlas, MachinaAtlasError, type MachinaAtlasErrorCode, type MachinaAtlasSection, type MachinaAtlasSectionKind, type MachinaAtlasSummaryOptions, type MachinaExtractedSection, type MachinaSectionMarker, defineMachinaAtlas, extractMachinaAtlasSection, extractMachinaSection, extractMachinaSections, formatMachinaAtlasSummary, getMachinaAtlasSection, listMachinaAtlasSections, parseMachinaSectionMarkers };
