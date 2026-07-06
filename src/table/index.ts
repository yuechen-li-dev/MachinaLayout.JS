export * from "./types";
export * from "./authoring";
export * from "./access";
export * from "./convert";
export * from "./validate";
export * from "./format";

import { columnNames, getCell, getColumn, getRow, rowCount } from "./access";
import {
  boolean,
  define,
  defineWithSchema,
  enumColumn,
  literal,
  number,
  optional,
  schema,
  string,
  unknown,
  withSchema,
} from "./authoring";
import { fromObjects, fromRows, toObjects, toRows } from "./convert";
import { formatTableDiagnostics } from "./format";
import { validateTable } from "./validate";

export const Table = {
  define,
  defineWithSchema,
  withSchema,
  fromRows,
  fromObjects,
  toRows,
  toObjects,
  getColumn,
  getRow,
  getCell,
  rowCount,
  columnNames,
  string,
  number,
  boolean,
  literal,
  enum: enumColumn,
  unknown,
  optional,
  schema,
  validate: validateTable,
  formatDiagnostics: formatTableDiagnostics,
} as const;
