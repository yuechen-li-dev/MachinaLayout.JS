export * from "./types";
export * from "./authoring";
export * from "./collect";
export * from "./format";

import { collect, groupBySource, hasErrors, hasWarnings, sort } from "./collect";
import { err, error, from, info, ok, warning } from "./authoring";
import { format } from "./format";

export const D = {
  error,
  warning,
  info,
  ok,
  err,
  collect,
  hasErrors,
  hasWarnings,
  sort,
  groupBySource,
  format,
  from,
} as const;
