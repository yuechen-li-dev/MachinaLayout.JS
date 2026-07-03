import type {
  ArrangeSpec,
  EdgeRef,
  GuideLength,
  LayoutRowVariant,
  RectEdge,
  UiLength,
} from "../types";
import { validateNodeId, validateUiLength } from "./lower";
import { node } from "./node";
import { MachinaAuthoringError } from "./errors";
import type { MachinaNode, MachinaNodeId } from "./types";

export type MachinaGuideEdgeName = RectEdge;

export type MachinaGuideEdgeRef = {
  ref: MachinaNodeId;
  edge: MachinaGuideEdgeName;
  offset?: UiLength;
};

const EDGE_NAMES = new Set<MachinaGuideEdgeName>([
  "left",
  "right",
  "top",
  "bottom",
  "centerX",
  "centerY",
]);

function validateGuideEdgeName(edgeName: MachinaGuideEdgeName): void {
  if (typeof edgeName !== "string" || !EDGE_NAMES.has(edgeName)) {
    throw new MachinaAuthoringError("InvalidGuideEdge", "Guide edge must be a valid edge name.");
  }
}

export function edge(
  ref: MachinaNodeId,
  edge: MachinaGuideEdgeName,
  offset?: UiLength,
): MachinaGuideEdgeRef {
  try {
    validateNodeId(ref);
    validateGuideEdgeName(edge);
    validateUiLength(offset, "InvalidGuideEdge");
  } catch (error) {
    if (error instanceof MachinaAuthoringError && error.code === "InvalidNodeId") {
      throw new MachinaAuthoringError(
        "InvalidGuideEdge",
        "Guide edge ref must be a non-empty string.",
      );
    }
    throw error;
  }
  return offset === undefined ? { ref, edge } : { ref, edge, offset };
}

export type GuideOptions = {
  left?: UiLength | MachinaGuideEdgeRef;
  right?: UiLength | MachinaGuideEdgeRef;
  top?: UiLength | MachinaGuideEdgeRef;
  bottom?: UiLength | MachinaGuideEdgeRef;
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

function isEdgeRef(value: GuideLength | undefined): value is MachinaGuideEdgeRef {
  return typeof value === "object" && value !== null && "ref" in value && "edge" in value;
}

function validateGuideLength(value: GuideLength | undefined): void {
  if (isEdgeRef(value)) {
    edge(value.ref, value.edge, value.offset);
  } else {
    validateUiLength(value, "InvalidGuideFrame");
  }
}

function copyGuideLength(value: GuideLength | undefined): GuideLength | undefined {
  if (value === undefined) return undefined;
  if (!isEdgeRef(value)) return value;
  const copied: EdgeRef = { ref: value.ref, edge: value.edge };
  if (value.offset !== undefined) copied.offset = value.offset;
  return copied;
}

export function guide(
  id: MachinaNodeId,
  options: GuideOptions,
  children: readonly MachinaNode[] = [],
): MachinaNode {
  validateNodeId(id);
  validateGuideLength(options.left);
  validateGuideLength(options.right);
  validateGuideLength(options.top);
  validateGuideLength(options.bottom);
  validateUiLength(options.width, "InvalidGuideFrame");
  validateUiLength(options.height, "InvalidGuideFrame");
  const { left, right, top, bottom, width, height, ...rest } = options;
  return node(
    id,
    {
      ...rest,
      frame: {
        kind: "guide",
        left: copyGuideLength(left),
        right: copyGuideLength(right),
        top: copyGuideLength(top),
        bottom: copyGuideLength(bottom),
        width,
        height,
      },
    },
    children,
  );
}
