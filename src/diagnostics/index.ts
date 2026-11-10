export * from "./authoring";
export * from "./collect";
export * from "./format";
export * from "./types";

import { err, error, from, info, ok, warning, within } from "./authoring";
import { collect, groupBySource, hasErrors, hasWarnings, sort } from "./collect";
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
  within,
} as const;
