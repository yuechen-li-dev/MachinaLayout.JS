export * from "./types.js";
export * from "./authoring.js";
export * from "./collect.js";
export * from "./format.js";
import { collect, groupBySource, hasErrors, hasWarnings, sort } from "./collect.js";
import { err, error, from, info, ok, warning } from "./authoring.js";
import { format } from "./format.js";
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
};
