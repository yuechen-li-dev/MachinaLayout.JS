import type { UiLength } from "../types";
import { validateFinite } from "./lower";
export function px(value: number): UiLength {
  validateFinite(value, "InvalidLength", "px value");
  return { unit: "px", value };
}
export function ui(value: number): UiLength {
  validateFinite(value, "InvalidLength", "ui value");
  return { unit: "ui", value };
}
