import type { TableDiagnostic } from "./types";

function formatLocation(diagnostic: TableDiagnostic): string | undefined {
  if (diagnostic.path) return diagnostic.path;
  if (diagnostic.tableId === undefined) return undefined;
  if (diagnostic.row !== undefined && diagnostic.column !== undefined) {
    return `${diagnostic.tableId}[${diagnostic.row}].${diagnostic.column}`;
  }
  if (diagnostic.row !== undefined) {
    return `${diagnostic.tableId}[${diagnostic.row}]`;
  }
  if (diagnostic.column !== undefined) {
    return `${diagnostic.tableId}.${diagnostic.column}`;
  }
  return diagnostic.tableId;
}

export function formatTableDiagnostics(diagnostics: readonly TableDiagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const location = formatLocation(diagnostic);
      const header =
        location === undefined
          ? `${diagnostic.severity} ${diagnostic.code}`
          : `${diagnostic.severity} ${diagnostic.code} at ${location}`;
      return `${header}\n  ${diagnostic.message}`;
    })
    .join("\n\n");
}
