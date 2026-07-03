import type { LayoutRow, LayoutRowVariant } from "../types";
import { MachinaAuthoringError } from "./errors";
import { copyRow, stackAxisFromArrange, validateDuplicateRows, validateNodeId } from "./lower";
import type { MachinaLowerContext, MachinaNode, MachinaNodeId } from "./types";

export type NodeOptions = Omit<LayoutRow, "id" | "parent" | "variants"> & {
  parent?: MachinaNodeId;
  variants?: readonly LayoutRowVariant[];
};
export type RootOptions = Omit<NodeOptions, "frame" | "parent">;

type LowerRow = (context?: MachinaLowerContext) => LayoutRow;

export function makeNode(
  id: MachinaNodeId,
  lowerRow: LowerRow,
  children: readonly MachinaNode[] = [],
): MachinaNode {
  validateNodeId(id);
  return {
    id,
    rows() {
      const lowered = this.lower();
      validateDuplicateRows(lowered);
      return lowered;
    },
    lower(context = {}) {
      const row = copyRow(lowerRow(context));
      const childAxis = stackAxisFromArrange(row.arrange);
      const childRows = children.flatMap((child) =>
        child.lower({ parentId: id, parentStackAxis: childAxis }),
      );
      return [row, ...childRows];
    },
  };
}

export function node(
  id: MachinaNodeId,
  options: NodeOptions,
  children: readonly MachinaNode[] = [],
): MachinaNode {
  validateNodeId(id);
  return makeNode(
    id,
    (context = {}) => {
      const row: LayoutRow = {
        ...options,
        variants: options.variants ? [...options.variants] : undefined,
        id,
      };
      if (options.parent !== undefined) row.parent = options.parent;
      else if (context.parentId !== undefined) row.parent = context.parentId;
      return row;
    },
    children,
  );
}

export function root(
  id: MachinaNodeId,
  options: RootOptions = {},
  children: readonly MachinaNode[] = [],
): MachinaNode {
  validateNodeId(id);
  return makeNode(
    id,
    (context = {}) => {
      if (context.parentId !== undefined) {
        throw new MachinaAuthoringError(
          "InvalidAuthoringTree",
          "A Machina root cannot be lowered with a parent.",
        );
      }
      return {
        ...options,
        variants: options.variants ? [...options.variants] : undefined,
        id,
        frame: { kind: "root" },
      };
    },
    children,
  );
}

export function rows(node: MachinaNode): LayoutRow[] {
  return node.rows();
}
