export type MachinaLayoutErrorCode =
  | "EmptyRows"
  | "MissingRoot"
  | "MultipleRoots"
  | "DuplicateId"
  | "InvalidId"
  | "MissingParent"
  | "UnknownParent"
  | "SelfParent"
  | "Cycle"
  | "UnreachableNode"
  | "NonFiniteNumber"
  | "InvalidZ"
  | "NegativeSize"
  | "NegativeGap"
  | "NegativePadding"
  | "InvalidAnchorHorizontal"
  | "InvalidAnchorVertical"
  | "NegativeResolvedSize"
  | "FixedFrameWithoutArranger"
  | "StackChildMustBeFixed"
  | "StackContentNegative"
  | "StackOverflow"
  | "RootFrameNotRoot"
  | "RootFrameWithoutRoot";

export class MachinaLayoutError extends Error {
  readonly code: MachinaLayoutErrorCode;

  constructor(code: MachinaLayoutErrorCode, message: string) {
    super(message);
    this.name = "MachinaLayoutError";
    this.code = code;
  }
}
