export type {
  MachinaBulletItem,
  MachinaInline,
  MachinaTextAlign,
  MachinaTextBlock,
  MachinaTextDiagnostic,
  MachinaTextDiagnosticCode,
  MachinaTextDiagnosticLevel,
  MachinaTextDocument,
  MachinaTextOverflow,
  MachinaTextLeading,
  MachinaTextSource,
  MachinaTextSpec,
  MachinaTextVariant,
  MachinaTextVerticalAlign,
  MachinaTextWrap,
  ParseMachinaTextResult,
} from "./types";

export { parseMachinaText, parseMachinaTextInline } from "./parseMachinaText";
export { TextFormatError } from "./errors";
export type { TextFormatErrorCode } from "./errors";
export { leftPad, rightPad, centerPad } from "./pad";
export type { TruncateOptions } from "./truncate";
export { truncate } from "./truncate";
export { kebab, camel, pascal } from "./case";
export { slug } from "./slug";
export { Text } from "./utilities";
