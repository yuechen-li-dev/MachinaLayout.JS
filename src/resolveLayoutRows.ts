import { compileLayoutRows } from "./compileLayoutRows";
import { resolveLayoutDocument } from "./resolveLayoutDocument";
import type { LayoutRow, Rect, ResolvedLayoutDocument } from "./types";

export function resolveLayoutRows(rows: LayoutRow[], rootRect: Rect): ResolvedLayoutDocument {
  const document = compileLayoutRows(rows);
  return resolveLayoutDocument(document, rootRect);
}
