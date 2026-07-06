export type MachinaAtlasSectionKind =
  | "app"
  | "page"
  | "screen"
  | "view"
  | "component"
  | "layout"
  | "behavior"
  | "fixture"
  | "data"
  | "shared"
  | "test"
  | "other";

export type MachinaAtlasSection = {
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

export type MachinaAtlas = {
  schemaVersion: 1;
  app: string;
  sections: readonly MachinaAtlasSection[];
  tags?: readonly string[];
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type MachinaSectionMarker = {
  name: string;
  line: number;
  column: number;
  raw: string;
};

export type MachinaExtractedSection = {
  name: string;
  startLine: number;
  endLine: number;
  text: string;
  marker: MachinaSectionMarker;
};

export type MachinaAtlasSummaryOptions = {
  includeNotes?: boolean;
  includeSymbols?: boolean;
  includeRelations?: boolean;
  includeRoutes?: boolean;
  includeFixtures?: boolean;
  includeTags?: boolean;
};

export type MachinaAtlasSectionTableDescription = {
  readonly kind: "atlasSectionTableDescription";
  readonly tableId: string;
  readonly sectionCount: number;
  readonly kinds: readonly MachinaAtlasSectionKind[];
  readonly tagCount: number;
};

export type MachinaAtlasErrorCode =
  | "InvalidAtlas"
  | "InvalidAtlasSection"
  | "DuplicateAtlasSectionKey"
  | "UnknownAtlasSection"
  | "AmbiguousAtlasSection"
  | "UnknownSectionMarker"
  | "AmbiguousSectionMarker";

export class MachinaAtlasError extends Error {
  code: MachinaAtlasErrorCode;

  constructor(code: MachinaAtlasErrorCode, message: string) {
    super(message);
    this.name = "MachinaAtlasError";
    this.code = code;
  }
}
