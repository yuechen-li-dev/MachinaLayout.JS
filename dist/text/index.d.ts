import { a as MachinaTextSource, P as ParseMachinaTextResult, d as MachinaInline, g as MachinaTextDiagnostic } from '../types-C4poVJpR.js';
export { c as MachinaBulletItem, e as MachinaTextAlign, f as MachinaTextBlock, h as MachinaTextDiagnosticCode, i as MachinaTextDiagnosticLevel, b as MachinaTextDocument, j as MachinaTextLeading, k as MachinaTextOverflow, M as MachinaTextSpec, l as MachinaTextVariant, m as MachinaTextVerticalAlign, n as MachinaTextWrap } from '../types-C4poVJpR.js';
export { MachinaTextView, MachinaTextViewProps } from './react/index.js';
export { MachinaVueTextView, MachinaVueTextViewProps } from './vue/index.js';
import 'react';
import 'vue';

declare function parseMachinaTextInline(text: string): {
    inline: MachinaInline[];
    diagnostics: MachinaTextDiagnostic[];
};
declare function parseMachinaText(source: MachinaTextSource | string): ParseMachinaTextResult;

export { MachinaInline, MachinaTextDiagnostic, MachinaTextSource, ParseMachinaTextResult, parseMachinaText, parseMachinaTextInline };
