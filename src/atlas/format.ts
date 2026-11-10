import { withDefaults } from "../kit";
import type { LinePart } from "../text/lines";
import { Text } from "../text/utilities";
import type { MachinaAtlas, MachinaAtlasSection, MachinaAtlasSummaryOptions } from "./types";

const DEFAULT_OPTIONS = {
  includeNotes: false,
  includeSymbols: true,
  includeRelations: true,
  includeRoutes: true,
  includeFixtures: true,
  includeTags: true,
};

function listLine(label: string, values: readonly string[] | undefined): string | false {
  return values !== undefined && values.length > 0 && `${label}: ${values.join(", ")}`;
}

function formatSection(
  section: MachinaAtlasSection,
  index: number,
  options: Required<MachinaAtlasSummaryOptions>,
): LinePart {
  const kind = section.kind ? ` [${section.kind}]` : "";
  return [
    `${index + 1}. ${section.key} — ${section.name}${kind}`,
    Text.indent(
      [
        options.includeSymbols && section.symbol && `symbol: ${section.symbol}`,
        options.includeRoutes && section.route && `route: ${section.route}`,
        options.includeFixtures && section.fixture && `fixture: ${section.fixture}`,
        options.includeRelations && [
          listLine("owns", section.owns),
          listLine("uses", section.uses),
          listLine("usedBy", section.usedBy),
          listLine("dependsOn", section.dependsOn),
        ],
        options.includeTags && listLine("tags", section.tags),
        options.includeNotes && section.notes && `notes: ${section.notes}`,
      ],
      "   ",
    ),
  ];
}

export function formatMachinaAtlasSummary(
  atlas: MachinaAtlas,
  options?: MachinaAtlasSummaryOptions,
): string {
  const resolved = withDefaults(options, DEFAULT_OPTIONS);
  return Text.lines(
    `MachinaAtlas: ${atlas.app}`,
    `Sections: ${atlas.sections.length}`,
    resolved.includeTags && listLine("Tags", atlas.tags),
    resolved.includeNotes && atlas.notes && `Notes: ${atlas.notes}`,
    atlas.sections.map((section, index) => [Text.blank, formatSection(section, index, resolved)]),
  );
}
