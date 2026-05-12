type MachinaTextSource = {
    kind: "plain";
    text: string;
} | {
    kind: "machina-text";
    text: string;
};
type MachinaTextVariant = "body" | "label" | "caption" | "title" | "mono";
type MachinaTextWrap = "word" | "none";
type MachinaTextOverflow = "clip" | "ellipsis" | "scroll";
type MachinaTextAlign = "start" | "center" | "end";
type MachinaTextLeading = "tight" | "normal" | "loose" | number;
type MachinaTextVerticalAlign = "top" | "center" | "bottom";
type MachinaTextSpec = {
    kind: "text";
    source: MachinaTextSource;
    variant?: MachinaTextVariant;
    wrap?: MachinaTextWrap;
    overflow?: MachinaTextOverflow;
    align?: MachinaTextAlign;
    leading?: MachinaTextLeading;
    blockGap?: number;
    listGap?: number;
    valign?: MachinaTextVerticalAlign;
};
type MachinaTextDocument = {
    blocks: MachinaTextBlock[];
};
type MachinaTextBlock = {
    kind: "paragraph";
    inline: MachinaInline[];
} | {
    kind: "bulletList";
    items: MachinaBulletItem[];
};
type MachinaBulletItem = {
    inline: MachinaInline[];
    children?: MachinaBulletItem[];
};
type MachinaInline = {
    kind: "text";
    text: string;
} | {
    kind: "strong";
    children: MachinaInline[];
} | {
    kind: "emphasis";
    children: MachinaInline[];
} | {
    kind: "code";
    text: string;
} | {
    kind: "link";
    href: string;
    children: MachinaInline[];
};
type MachinaTextDiagnosticLevel = "error" | "warning";
type MachinaTextDiagnosticCode = "unsupported_syntax" | "heading_forbidden" | "max_list_depth_exceeded" | "malformed_link" | "unclosed_inline" | "invalid_escape";
type MachinaTextDiagnostic = {
    code: MachinaTextDiagnosticCode;
    message: string;
    index: number;
    length: number;
    line: number;
    column: number;
    level: MachinaTextDiagnosticLevel;
};
type ParseMachinaTextResult = {
    ok: boolean;
    document: MachinaTextDocument;
    diagnostics: MachinaTextDiagnostic[];
};

export type { MachinaTextSpec as M, ParseMachinaTextResult as P, MachinaTextSource as a, MachinaTextDocument as b, MachinaBulletItem as c, MachinaInline as d, MachinaTextAlign as e, MachinaTextBlock as f, MachinaTextDiagnostic as g, MachinaTextDiagnosticCode as h, MachinaTextDiagnosticLevel as i, MachinaTextLeading as j, MachinaTextOverflow as k, MachinaTextVariant as l, MachinaTextVerticalAlign as m, MachinaTextWrap as n };
