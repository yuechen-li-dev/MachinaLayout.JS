import { Text } from "../text/utilities";
import type { DiagnosticFix, MachinaDiagnostic } from "./types";

export type FormatDiagnosticsOptions = {
  /**
   * `block` (default): header line, then indented source/message/details/fix.
   * `line`: `[severity] Code at path: message [fix: …]`, details indented below.
   */
  style?: "block" | "line";
  includeSeverity?: boolean;
  /** Default: true for `block`, false for `line`. */
  includeSource?: boolean;
  includePath?: boolean;
  /** Text for an empty list. Default `"No diagnostics."`. */
  empty?: string;
};

export function formatFix(fix: DiagnosticFix): string {
  switch (fix.op) {
    case "add":
      return `add ${fix.path}: ${fix.expected}`;
    case "remove":
      return `remove ${fix.path}`;
    case "rename":
      return `rename ${fix.path} → ${fix.to}`;
    case "replace":
      return `set ${fix.path} to ${fix.expected}`;
  }
}

/**
 * The one diagnostics formatter. Accepts diagnostics from any module (they
 * all share `MachinaDiagnostic`); module-specific formatters delegate here.
 */
export function format(
  diagnostics: readonly MachinaDiagnostic[],
  options: FormatDiagnosticsOptions = {},
): string {
  if (diagnostics.length === 0) {
    return options.empty ?? "No diagnostics.";
  }
  const style = options.style ?? "block";
  const includeSeverity = options.includeSeverity ?? true;
  const includeSource = options.includeSource ?? style === "block";
  const includePath = options.includePath ?? true;

  if (style === "line") {
    return diagnostics
      .map((diagnostic) => {
        const severity = includeSeverity ? `[${diagnostic.severity}] ` : "";
        const path = includePath && diagnostic.path ? ` at ${diagnostic.path}` : "";
        const source = includeSource && diagnostic.source ? ` (${diagnostic.source})` : "";
        const fix = diagnostic.fix ? ` [fix: ${formatFix(diagnostic.fix)}]` : "";
        return Text.lines(
          `${severity}${diagnostic.code}${path}${source}: ${diagnostic.message}${fix}`,
          Text.indent(diagnostic.details ?? []),
        );
      })
      .join("\n");
  }

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
          diagnostic.fix && `fix: ${formatFix(diagnostic.fix)}`,
        ]),
      );
    })
    .join("\n\n");
}
