import { Text } from "../text/utilities";
import type { MachinaDiagnostic } from "./types";

export type FormatDiagnosticsOptions = {
  includeSeverity?: boolean;
  includeSource?: boolean;
  includePath?: boolean;
};

export function format(
  diagnostics: readonly MachinaDiagnostic[],
  options: FormatDiagnosticsOptions = {},
): string {
  if (diagnostics.length === 0) {
    return "No diagnostics.";
  }

  const includeSeverity = options.includeSeverity ?? true;
  const includeSource = options.includeSource ?? true;
  const includePath = options.includePath ?? true;

  return diagnostics
    .map((diagnostic) => {
      const headerParts = [
        includeSeverity ? diagnostic.severity : undefined,
        diagnostic.code,
        includePath && diagnostic.path ? `at ${diagnostic.path}` : undefined,
      ].filter((part): part is string => part !== undefined);

      return Text.lines(
        headerParts.join(" "),
        Text.indent([
          includeSource && diagnostic.source && `source: ${diagnostic.source}`,
          diagnostic.message,
          (diagnostic.details ?? []).map((detail) => `- ${detail}`),
        ]),
      );
    })
    .join("\n\n");
}
