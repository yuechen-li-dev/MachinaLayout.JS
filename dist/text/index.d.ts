import { j as MachinaTextSource, P as ParseMachinaTextResult, a as MachinaInline, d as MachinaTextDiagnostic } from '../index-DpsIn6PZ.js';
export { M as MachinaBulletItem, b as MachinaTextAlign, c as MachinaTextBlock, e as MachinaTextDiagnosticCode, f as MachinaTextDiagnosticLevel, g as MachinaTextDocument, h as MachinaTextLeading, i as MachinaTextOverflow, k as MachinaTextSpec, l as MachinaTextVariant, m as MachinaTextVerticalAlign, n as MachinaTextView, o as MachinaTextViewProps, p as MachinaTextWrap } from '../index-DpsIn6PZ.js';
import 'react';

declare function parseMachinaTextInline(text: string): {
    inline: MachinaInline[];
    diagnostics: MachinaTextDiagnostic[];
};
declare function parseMachinaText(source: MachinaTextSource | string): ParseMachinaTextResult;

export { MachinaInline, MachinaTextDiagnostic, MachinaTextSource, ParseMachinaTextResult, parseMachinaText, parseMachinaTextInline };
