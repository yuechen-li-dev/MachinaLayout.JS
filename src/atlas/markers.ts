import type { MachinaSectionMarker } from "./types";

const MARKER = "@machina-section";

export function parseMachinaSectionMarkers(sourceText: string): MachinaSectionMarker[] {
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
