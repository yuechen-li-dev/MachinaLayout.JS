import type { ArrangeSpec, FrameSpec, LayoutRowVariant } from "../types";
import { MachinaAuthoringError } from "./errors";
import { validateFinite, validateNodeId, validateNonNegativeFinite } from "./lower";
import { makeNode, node } from "./node";
import type { MachinaNode, MachinaNodeId, MachinaStackAxis } from "./types";

export type StackOptions = {
  gap?: number;
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
  justify?: "start" | "center" | "end" | "space-between";
  align?: "start" | "center" | "end";
};
export type StackContainerOptions = StackOptions & {
  parent?: MachinaNodeId;
  frame?: FrameSpec;
  view?: string;
  slot?: string;
  debugLabel?: string;
  layer?: string;
  z?: number;
  variants?: readonly LayoutRowVariant[];
};
export type FixedNodeOptions = {
  view?: string;
  slot?: string;
  debugLabel?: string;
  layer?: string;
  z?: number;
  arrange?: ArrangeSpec;
  variants?: readonly LayoutRowVariant[];
};
export type FillNodeOptions = FixedNodeOptions & { cross?: number | "fill" };

export function stackArrange(axis: MachinaStackAxis, options: StackOptions = {}): ArrangeSpec {
  if (options.gap !== undefined) validateFinite(options.gap, "InvalidStackChild", "gap");
  return { kind: "stack", axis, ...options } as ArrangeSpec;
}

function stack(
  id: MachinaNodeId,
  axis: MachinaStackAxis,
  options: StackContainerOptions = {},
  children: readonly MachinaNode[] = [],
) {
  const {
    gap,
    padding,
    justify,
    align,
    parent,
    frame = { kind: "fill", weight: 1 },
    ...rest
  } = options;
  return node(
    id,
    { ...rest, parent, frame, arrange: stackArrange(axis, { gap, padding, justify, align }) },
    children,
  );
}
export const vstack = (
  id: MachinaNodeId,
  options?: StackContainerOptions,
  children?: readonly MachinaNode[],
) => stack(id, "vertical", options, children);
export const hstack = (
  id: MachinaNodeId,
  options?: StackContainerOptions,
  children?: readonly MachinaNode[],
) => stack(id, "horizontal", options, children);

function mergeView<T extends object>(
  viewOrOptions?: string | T,
  options?: T,
): T & { view?: string } {
  return typeof viewOrOptions === "string"
    ? ({ ...options, view: viewOrOptions } as T & { view?: string })
    : ({ ...viewOrOptions, ...options } as T & { view?: string });
}

export function fixed(
  id: MachinaNodeId,
  mainSize: number,
  viewOrOptions?: string | FixedNodeOptions,
  options?: FixedNodeOptions,
  children: readonly MachinaNode[] = [],
): MachinaNode {
  validateNodeId(id);
  validateNonNegativeFinite(mainSize, "InvalidLength", "mainSize");
  const opts = mergeView(viewOrOptions, options);
  return makeNode(
    id,
    (context = {}) => {
      if (!context.parentStackAxis)
        throw new MachinaAuthoringError(
          "InvalidFixedFrameContext",
          "fixed() must be lowered under a stack parent axis.",
        );
      const frame =
        context.parentStackAxis === "vertical"
          ? ({ kind: "fixed", height: mainSize } as FrameSpec)
          : ({ kind: "fixed", width: mainSize } as FrameSpec);
      return {
        ...opts,
        variants: opts.variants ? [...opts.variants] : undefined,
        id,
        parent: context.parentId,
        frame,
      };
    },
    children,
  );
}

export function fill(
  id: MachinaNodeId,
  weight = 1,
  viewOrOptions?: string | FillNodeOptions,
  options?: FillNodeOptions,
  children: readonly MachinaNode[] = [],
): MachinaNode {
  validateNodeId(id);
  validateNonNegativeFinite(weight, "InvalidLength", "weight");
  const opts = mergeView(viewOrOptions, options);
  const { cross, ...rest } = opts;
  return node(id, { ...rest, frame: { kind: "fill", weight, cross } }, children);
}

export function space(id: MachinaNodeId, weight = 1): MachinaNode {
  validateNodeId(id);
  validateNonNegativeFinite(weight, "InvalidSpaceNode", "weight");
  return node(id, { frame: { kind: "fill", weight } });
}
