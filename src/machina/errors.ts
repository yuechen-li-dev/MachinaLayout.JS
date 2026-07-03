export type MachinaAuthoringErrorCode =
  | "InvalidNodeId"
  | "DuplicateNodeId"
  | "InvalidAuthoringTree"
  | "InvalidStackChild"
  | "InvalidFixedFrameContext"
  | "InvalidSpaceNode"
  | "InvalidAnchorFrame"
  | "InvalidLength"
  | "InvalidVariant"
  | "InvalidGridTrack"
  | "InvalidGridMatrix"
  | "GridMatrixOverlap"
  | "GridMatrixOutOfBounds"
  | "InvalidGridArea";

export class MachinaAuthoringError extends Error {
  readonly code: MachinaAuthoringErrorCode;

  constructor(code: MachinaAuthoringErrorCode, message: string) {
    super(message);
    this.name = "MachinaAuthoringError";
    this.code = code;
  }
}
