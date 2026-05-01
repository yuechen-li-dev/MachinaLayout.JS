import React from "react";
import { parseMachinaText } from "../parseMachinaText";
import type {
  MachinaBulletItem,
  MachinaInline,
  MachinaTextAlign,
  MachinaTextDiagnostic,
  MachinaTextDocument,
  MachinaTextOverflow,
  MachinaTextSource,
  MachinaTextSpec,
  MachinaTextVariant,
  MachinaTextWrap,
} from "../types";

export type MachinaTextViewProps = {
  text: MachinaTextSpec | MachinaTextSource | MachinaTextDocument | string;
  className?: string;
  style?: React.CSSProperties;
  linkTarget?: React.HTMLAttributeAnchorTarget;
  onLinkClick?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
  showDiagnostics?: boolean;
};

type TextPolicy = { variant: MachinaTextVariant; wrap: MachinaTextWrap; overflow: MachinaTextOverflow; align: MachinaTextAlign };
type NormalizedText = { document: MachinaTextDocument; diagnostics: MachinaTextDiagnostic[]; policy: TextPolicy };

const DEFAULT_POLICY: TextPolicy = { variant: "body", wrap: "word", overflow: "clip", align: "start" };
const INLINE_CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

function isMachinaTextDocument(value: MachinaTextViewProps["text"]): value is MachinaTextDocument {
  return typeof value === "object" && value !== null && "blocks" in value;
}
function isMachinaTextSpec(value: MachinaTextViewProps["text"]): value is MachinaTextSpec {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "text";
}

function normalizeText(text: MachinaTextViewProps["text"]): NormalizedText {
  if (isMachinaTextDocument(text)) return { document: text, diagnostics: [], policy: DEFAULT_POLICY };
  if (isMachinaTextSpec(text)) {
    const result = parseMachinaText(text.source);
    return {
      document: result.document,
      diagnostics: result.diagnostics,
      policy: { variant: text.variant ?? "body", wrap: text.wrap ?? "word", overflow: text.overflow ?? "clip", align: text.align ?? "start" },
    };
  }
  const result = parseMachinaText(typeof text === "string" ? { kind: "machina-text", text } : text);
  return { document: result.document, diagnostics: result.diagnostics, policy: DEFAULT_POLICY };
}

function policyStyle(policy: TextPolicy): React.CSSProperties {
  const variantStyle: Record<MachinaTextVariant, React.CSSProperties> = {
    body: { fontSize: "14px", fontWeight: 400, lineHeight: 1.4 },
    label: { fontSize: "12px", fontWeight: 500, lineHeight: 1.3 },
    caption: { fontSize: "11px", fontWeight: 400, lineHeight: 1.25, opacity: 0.8 },
    title: { fontSize: "18px", fontWeight: 700, lineHeight: 1.25 },
    mono: { fontSize: "12px", lineHeight: 1.35, fontFamily: INLINE_CODE_FONT },
  };
  const wrapStyle: Record<MachinaTextWrap, React.CSSProperties> = { word: { whiteSpace: "normal", overflowWrap: "anywhere" }, none: { whiteSpace: "nowrap" } };
  const overflowStyle: Record<MachinaTextOverflow, React.CSSProperties> = {
    clip: { overflow: "hidden" },
    ellipsis: { overflow: "hidden", textOverflow: "ellipsis" },
    scroll: { overflow: "auto" },
  };
  const alignStyle: Record<MachinaTextAlign, React.CSSProperties> = { start: { textAlign: "left" }, center: { textAlign: "center" }, end: { textAlign: "right" } };
  return { width: "100%", height: "100%", boxSizing: "border-box", ...variantStyle[policy.variant], ...wrapStyle[policy.wrap], ...overflowStyle[policy.overflow], ...alignStyle[policy.align] };
}

function renderInline(inline: MachinaInline, key: string, props: MachinaTextViewProps): React.ReactNode {
  switch (inline.kind) {
    case "text": return <React.Fragment key={key}>{inline.text}</React.Fragment>;
    case "strong": return <strong key={key}>{inline.children.map((c, i) => renderInline(c, `${key}-s-${i}`, props))}</strong>;
    case "emphasis": return <em key={key}>{inline.children.map((c, i) => renderInline(c, `${key}-e-${i}`, props))}</em>;
    case "code": return <code key={key} style={{ fontFamily: INLINE_CODE_FONT, backgroundColor: "rgba(127, 127, 127, 0.15)", borderRadius: 3, padding: "0 0.25em" }}>{inline.text}</code>;
    case "link": {
      const rel = props.linkTarget === "_blank" ? "noreferrer noopener" : undefined;
      return <a key={key} href={inline.href} target={props.linkTarget} rel={rel} onClick={(event) => props.onLinkClick?.(inline.href, event)}>{inline.children.map((c, i) => renderInline(c, `${key}-l-${i}`, props))}</a>;
    }
  }
}

function renderBulletItem(item: MachinaBulletItem, path: string, props: MachinaTextViewProps): React.ReactNode {
  return <li key={path}>{item.inline.map((i, idx) => renderInline(i, `${path}-i-${idx}`, props))}{item.children?.length ? <ul style={{ margin: "0.25em 0 0 0", paddingLeft: "1.25em" }}>{item.children.map((c, idx) => renderBulletItem(c, `${path}-c-${idx}`, props))}</ul> : null}</li>;
}

export function MachinaTextView(props: MachinaTextViewProps): React.JSX.Element {
  const normalized = normalizeText(props.text);
  return <div className={props.className} style={{ ...policyStyle(normalized.policy), ...props.style }}>
    {normalized.document.blocks.map((block, index) => block.kind === "paragraph"
      ? <p key={`b-${index}`} style={{ margin: index === normalized.document.blocks.length - 1 ? "0" : "0 0 0.5em 0" }}>{block.inline.map((i, idx) => renderInline(i, `b-${index}-${idx}`, props))}</p>
      : <ul key={`b-${index}`} style={{ margin: index === normalized.document.blocks.length - 1 ? "0" : "0 0 0.5em 0", paddingLeft: "1.25em" }}>{block.items.map((item, itemIndex) => renderBulletItem(item, `b-${index}-item-${itemIndex}`, props))}</ul>)}
    {props.showDiagnostics && normalized.diagnostics.length > 0 ? <pre style={{ margin: "0.5em 0 0 0", padding: "0.5em", fontSize: "11px", fontFamily: INLINE_CODE_FONT, whiteSpace: "pre-wrap", background: "rgba(127, 127, 127, 0.12)" }}>{normalized.diagnostics.map((d) => `${d.code} (${d.line}:${d.column}) ${d.message}`).join("\n")}</pre> : null}
  </div>;
}
