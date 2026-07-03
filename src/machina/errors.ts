export type MachinaAuthoringErrorCode =
  | "InvalidNodeId"
  | "DuplicateNodeId"
  | "InvalidAuthoringTree"
  | "InvalidStackChild"
  | "InvalidFixedFrameContext"
  | "InvalidSpaceNode"
  | "InvalidAnchorFrame"
  | "InvalidLength"
  | "InvalidVariant";

export class MachinaAuthoringError extends Error {
  readonly code: MachinaAuthoringErrorCode;

  constructor(code: MachinaAuthoringErrorCode, message: string) {
    super(message);
    this.name = "MachinaAuthoringError";
    this.code = code;
  }
}
