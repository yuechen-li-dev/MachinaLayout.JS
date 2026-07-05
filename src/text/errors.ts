export type TextFormatErrorCode = "InvalidTextLength" | "InvalidTextFill" | "InvalidTruncateLength";

export class TextFormatError extends Error {
  readonly code: TextFormatErrorCode;

  constructor(code: TextFormatErrorCode, message: string) {
    super(message);
    this.name = "TextFormatError";
    this.code = code;
  }
}
