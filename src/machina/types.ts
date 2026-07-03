import type { LayoutRow } from "../types";

export type MachinaNodeId = string;
export type MachinaStackAxis = "vertical" | "horizontal";

export type MachinaLowerContext = {
  parentId?: MachinaNodeId;
  parentStackAxis?: MachinaStackAxis;
};

export interface MachinaNode {
  readonly id: MachinaNodeId;
  rows(): LayoutRow[];
  lower(context?: MachinaLowerContext): LayoutRow[];
}
