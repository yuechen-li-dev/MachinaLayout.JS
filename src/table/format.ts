import { format as formatDiagnostics } from "../diagnostics/format";
import type { TableDiagnostic } from "./types";

function formatLocation(diagnostic: TableDiagnostic): string | undefined {
  if (diagnostic.path) return diagnostic.path;
  if (diagnostic.tableId === undefined) return undefined;
  if (diagnostic.row !== undefined && diagnostic.column !== undefined) {
    return `${diagnostic.tableId}.${diagnostic.column}[${diagnostic.row}]`;
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
  return formatDiagnostics(
    diagnostics.map((diagnostic) => ({ ...diagnostic, path: formatLocation(diagnostic) })),
    { includeSource: false, empty: "" },
  );
}
