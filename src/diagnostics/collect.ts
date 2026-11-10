import type { MachinaDiagnostic } from "./types";

const severityRank: Record<MachinaDiagnostic["severity"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

function compareStrings(left: string | undefined, right: string | undefined): number {
  return (left ?? "").localeCompare(right ?? "");
}

/**
 * Concatenate diagnostics from any modules. Element types are preserved
 * (`ConceptDiagnostic | TableDiagnostic`), so module-specific fields survive.
 */
export function collect<
  const TGroups extends readonly (readonly MachinaDiagnostic[] | undefined)[],
>(...groups: TGroups): Exclude<TGroups[number], undefined>[number][] {
  const diagnostics: Exclude<TGroups[number], undefined>[number][] = [];

  for (const group of groups) {
    if (group === undefined) {
      continue;
    }

    diagnostics.push(...(group as Exclude<TGroups[number], undefined>));
  }

  return diagnostics;
}

export function hasErrors(diagnostics: readonly MachinaDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

export function hasWarnings(diagnostics: readonly MachinaDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "warning");
}

export function sort(diagnostics: readonly MachinaDiagnostic[]): MachinaDiagnostic[] {
  return [...diagnostics].sort((left, right) => {
    const severityDifference = severityRank[left.severity] - severityRank[right.severity];
    if (severityDifference !== 0) {
      return severityDifference;
    }

    return (
      compareStrings(left.source, right.source) ||
      compareStrings(left.path, right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message)
    );
  });
}

export function groupBySource(
  diagnostics: readonly MachinaDiagnostic[],
): Record<string, MachinaDiagnostic[]> {
  const groups: Record<string, MachinaDiagnostic[]> = {};

  for (const diagnostic of diagnostics) {
    const source = diagnostic.source ?? "(unknown)";
    groups[source] ??= [];
    groups[source].push(diagnostic);
  }

  return groups;
}
