import type { ArrangeSpec, LayoutRowVariant, UiLength } from "../types";
import { validateUiLength } from "./lower";
import { node } from "./node";
import type { MachinaNode, MachinaNodeId } from "./types";

export type AnchorOptions = {
  left?: UiLength;
  right?: UiLength;
  top?: UiLength;
  bottom?: UiLength;
  width?: UiLength;
  height?: UiLength;
  parent?: MachinaNodeId;
  view?: string;
  slot?: string;
  debugLabel?: string;
  layer?: string;
  z?: number;
  arrange?: ArrangeSpec;
  variants?: readonly LayoutRowVariant[];
};

export function anchor(
  id: MachinaNodeId,
  options: AnchorOptions,
  children: readonly MachinaNode[] = [],
): MachinaNode {
  validateUiLength(options.left, "InvalidAnchorFrame");
  validateUiLength(options.right, "InvalidAnchorFrame");
  validateUiLength(options.top, "InvalidAnchorFrame");
  validateUiLength(options.bottom, "InvalidAnchorFrame");
  validateUiLength(options.width, "InvalidAnchorFrame");
  validateUiLength(options.height, "InvalidAnchorFrame");
  const { left, right, top, bottom, width, height, ...rest } = options;
  return node(
    id,
    { ...rest, frame: { kind: "anchor", left, right, top, bottom, width, height } },
    children,
  );
}
