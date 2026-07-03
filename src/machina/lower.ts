import type { ArrangeSpec, LayoutRow, UiLength } from "../types";
import { MachinaAuthoringError } from "./errors";
import type { MachinaNodeId, MachinaStackAxis } from "./types";

export function validateNodeId(id: MachinaNodeId): void {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new MachinaAuthoringError("InvalidNodeId", "Machina node ids must be non-empty strings.");
  }
}

export function validateFinite(
  value: number,
  code: "InvalidLength" | "InvalidVariant" | "InvalidStackChild" | "InvalidSpaceNode",
  name: string,
): void {
  if (!Number.isFinite(value)) {
    throw new MachinaAuthoringError(code, `${name} must be a finite number.`);
  }
}

export function validateNonNegativeFinite(
  value: number,
  code: "InvalidLength" | "InvalidStackChild" | "InvalidSpaceNode",
  name: string,
): void {
  validateFinite(value, code, name);
  if (value < 0)
    throw new MachinaAuthoringError(code, `${name} must be greater than or equal to 0.`);
}

export function stackAxisFromArrange(arrange?: ArrangeSpec): MachinaStackAxis | undefined {
  return arrange?.kind === "stack" ? arrange.axis : undefined;
}

export function copyRow(row: LayoutRow): LayoutRow {
  return {
    ...row,
    variants: row.variants ? row.variants.map((variant) => ({ ...variant })) : undefined,
  };
}

export function validateDuplicateRows(rows: readonly LayoutRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id))
      throw new MachinaAuthoringError("DuplicateNodeId", `Duplicate Machina node id: ${row.id}`);
    seen.add(row.id);
  }
}

export function validateUiLength(
  length: UiLength | undefined,
  code:
    | "InvalidLength"
    | "InvalidAnchorFrame"
    | "InvalidGuideFrame"
    | "InvalidGuideEdge" = "InvalidLength",
): void {
  if (length === undefined) return;
  if (typeof length === "number") {
    if (!Number.isFinite(length)) throw new MachinaAuthoringError(code, "Length must be finite.");
    return;
  }
  if (!Number.isFinite(length.value))
    throw new MachinaAuthoringError(code, "Length value must be finite.");
}
