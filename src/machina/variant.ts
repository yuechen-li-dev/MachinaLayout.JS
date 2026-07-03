import type { ArrangeSpec, FrameSpec, LayoutRowVariant } from "../types";
import { validateFinite } from "./lower";
export type VariantCondition = {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
};
export type VariantOverrides = {
  frame?: FrameSpec;
  arrange?: ArrangeSpec;
  view?: string;
  slot?: string;
  debugLabel?: string;
  layer?: string;
  z?: number;
};
export function when(condition: VariantCondition, overrides: VariantOverrides): LayoutRowVariant {
  for (const [key, value] of Object.entries(condition))
    if (value !== undefined) validateFinite(value, "InvalidVariant", key);
  return { when: { ...condition }, ...overrides };
}
