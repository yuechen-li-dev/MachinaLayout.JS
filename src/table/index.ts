export * from "./types";
export * from "./authoring";
export * from "./access";
export * from "./convert";
export * from "./validate";
export * from "./format";

import { columnNames, getCell, getColumn, getRow, rowCount } from "./access";
import { define } from "./authoring";
import { fromObjects, fromRows, toObjects, toRows } from "./convert";
import { formatTableDiagnostics } from "./format";
import { validateTable } from "./validate";

export const Table = {
  define,
  fromRows,
  fromObjects,
  toRows,
  toObjects,
  getColumn,
  getRow,
  getCell,
  rowCount,
  columnNames,
  validate: validateTable,
  formatDiagnostics: formatTableDiagnostics,
} as const;
