import type { MachinaAtlas, MachinaAtlasSection, MachinaAtlasSummaryOptions } from "./types";

const DEFAULT_OPTIONS = {
  includeNotes: false,
  includeSymbols: true,
  includeRelations: true,
  includeRoutes: true,
  includeFixtures: true,
  includeTags: true,
};

function pushList(lines: string[], label: string, values: readonly string[] | undefined): void {
  if (values && values.length > 0) lines.push(`   ${label}: ${values.join(", ")}`);
}

function formatSection(
  section: MachinaAtlasSection,
  index: number,
  options: Required<MachinaAtlasSummaryOptions>,
): string[] {
  const kind = section.kind ? ` [${section.kind}]` : "";
  const lines = [`${index + 1}. ${section.key} — ${section.name}${kind}`];
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

export function formatMachinaAtlasSummary(
  atlas: MachinaAtlas,
  options?: MachinaAtlasSummaryOptions,
): string {
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
