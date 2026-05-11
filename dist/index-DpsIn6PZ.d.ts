import React from 'react';

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

type MachinaTextViewProps = {
    text: MachinaTextSpec | MachinaTextSource | MachinaTextDocument | string;
    className?: string;
    style?: React.CSSProperties;
    linkTarget?: React.HTMLAttributeAnchorTarget;
    onLinkClick?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
    showDiagnostics?: boolean;
};
declare function MachinaTextView(props: MachinaTextViewProps): React.JSX.Element;

export { type MachinaBulletItem as M, type ParseMachinaTextResult as P, type MachinaInline as a, type MachinaTextAlign as b, type MachinaTextBlock as c, type MachinaTextDiagnostic as d, type MachinaTextDiagnosticCode as e, type MachinaTextDiagnosticLevel as f, type MachinaTextDocument as g, type MachinaTextLeading as h, type MachinaTextOverflow as i, type MachinaTextSource as j, type MachinaTextSpec as k, type MachinaTextVariant as l, type MachinaTextVerticalAlign as m, MachinaTextView as n, type MachinaTextViewProps as o, type MachinaTextWrap as p };
