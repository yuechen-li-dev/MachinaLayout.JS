import { getMachinaAtlasSection } from "./defineMachinaAtlas";
import { parseMachinaSectionMarkers } from "./markers";
import type { MachinaAtlas, MachinaExtractedSection } from "./types";
import { MachinaAtlasError } from "./types";

function lineCount(sourceText: string): number {
  if (sourceText.length === 0) return 0;
  return sourceText.split(/\r?\n/).length;
}

export function extractMachinaSections(sourceText: string): MachinaExtractedSection[] {
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
      marker,
    };
  });
}

export function extractMachinaSection(sourceText: string, name: string): MachinaExtractedSection {
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
    `Unknown section marker: ${name}. Source has ${lineCount(sourceText)} lines.`,
  );
}

export function extractMachinaAtlasSection(
  sourceText: string,
  atlas: MachinaAtlas,
  keyOrName: string,
): MachinaExtractedSection {
  const section = getMachinaAtlasSection(atlas, keyOrName);
  return extractMachinaSection(sourceText, section.marker ?? section.name);
}
