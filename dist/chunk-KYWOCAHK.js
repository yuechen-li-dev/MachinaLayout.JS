import {
  parseMachinaText
} from "./chunk-BJOQRPPX.js";

// src/text/react/MachinaTextView.tsx
import React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var DEFAULT_POLICY = {
  variant: "body",
  wrap: "word",
  overflow: "clip",
  align: "start",
  leading: "normal",
  blockGap: 8,
  listGap: 2,
  valign: "top"
};
var INLINE_CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
var VARIANT_STYLE = {
  body: { fontSize: "14px", fontWeight: 400, lineHeight: 1.4 },
  label: { fontSize: "12px", fontWeight: 500, lineHeight: 1.3 },
  caption: { fontSize: "11px", fontWeight: 400, lineHeight: 1.25, opacity: 0.8 },
  title: { fontSize: "18px", fontWeight: 700, lineHeight: 1.25 },
  mono: { fontSize: "12px", lineHeight: 1.35, fontFamily: INLINE_CODE_FONT }
};
function isMachinaTextDocument(value) {
  return typeof value === "object" && value !== null && "blocks" in value;
}
function isMachinaTextSpec(value) {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "text";
}
function normalizePositive(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
function normalizeNonNegative(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
function normalizeLeading(value) {
  if (value === void 0) return DEFAULT_POLICY.leading;
  if (value === "tight" || value === "normal" || value === "loose") return value;
  return normalizePositive(value, resolveLineHeight(DEFAULT_POLICY));
}
function normalizeSpecPolicy(spec) {
  return {
    variant: spec.variant ?? DEFAULT_POLICY.variant,
    wrap: spec.wrap ?? DEFAULT_POLICY.wrap,
    overflow: spec.overflow ?? DEFAULT_POLICY.overflow,
    align: spec.align ?? DEFAULT_POLICY.align,
    leading: normalizeLeading(spec.leading),
    blockGap: normalizeNonNegative(spec.blockGap, DEFAULT_POLICY.blockGap),
    listGap: normalizeNonNegative(spec.listGap, DEFAULT_POLICY.listGap),
    valign: spec.valign ?? DEFAULT_POLICY.valign
  };
}
function normalizeText(text) {
  if (isMachinaTextDocument(text))
    return { document: text, diagnostics: [], policy: DEFAULT_POLICY };
  if (isMachinaTextSpec(text)) {
    const result2 = parseMachinaText(text.source);
    return {
      document: result2.document,
      diagnostics: result2.diagnostics,
      policy: normalizeSpecPolicy(text)
    };
  }
  const result = parseMachinaText(typeof text === "string" ? { kind: "machina-text", text } : text);
  return { document: result.document, diagnostics: result.diagnostics, policy: DEFAULT_POLICY };
}
function resolveLineHeight(policy) {
  if (policy.leading === "tight") return 1.15;
  if (policy.leading === "loose") return 1.6;
  if (typeof policy.leading === "number") return policy.leading;
  return VARIANT_STYLE[policy.variant].lineHeight;
}
function policyStyle(policy) {
  const wrapStyle = {
    word: { whiteSpace: "normal", overflowWrap: "anywhere" },
    none: { whiteSpace: "nowrap" }
  };
  const overflowStyle = {
    clip: { overflow: "hidden" },
    ellipsis: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    scroll: { overflow: "auto" }
  };
  const alignStyle = {
    start: { textAlign: "left" },
    center: { textAlign: "center" },
    end: { textAlign: "right" }
  };
  const justifyContent = {
    top: "flex-start",
    center: "center",
    bottom: "flex-end"
  };
  return {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: justifyContent[policy.valign],
    minWidth: 0,
    ...VARIANT_STYLE[policy.variant],
    lineHeight: resolveLineHeight(policy),
    ...wrapStyle[policy.wrap],
    ...overflowStyle[policy.overflow],
    ...alignStyle[policy.align]
  };
}
function renderInline(inline, key, props) {
  switch (inline.kind) {
    case "text":
      return /* @__PURE__ */ jsx(React.Fragment, { children: inline.text }, key);
    case "strong":
      return /* @__PURE__ */ jsx("strong", { children: inline.children.map((c, i) => renderInline(c, `${key}-s-${i}`, props)) }, key);
    case "emphasis":
      return /* @__PURE__ */ jsx("em", { children: inline.children.map((c, i) => renderInline(c, `${key}-e-${i}`, props)) }, key);
    case "code":
      return /* @__PURE__ */ jsx(
        "code",
        {
          style: {
            fontFamily: INLINE_CODE_FONT,
            backgroundColor: "rgba(127, 127, 127, 0.15)",
            borderRadius: 3,
            padding: "0 0.25em"
          },
          children: inline.text
        },
        key
      );
    case "link": {
      const rel = props.linkTarget === "_blank" ? "noreferrer noopener" : void 0;
      return /* @__PURE__ */ jsx(
        "a",
        {
          href: inline.href,
          target: props.linkTarget,
          rel,
          onClick: (event) => props.onLinkClick?.(inline.href, event),
          children: inline.children.map((c, i) => renderInline(c, `${key}-l-${i}`, props))
        },
        key
      );
    }
  }
}
function renderBulletItem(item, path, props, listGap) {
  return /* @__PURE__ */ jsxs("li", { style: { marginBottom: listGap }, children: [
    item.inline.map((i, idx) => renderInline(i, `${path}-i-${idx}`, props)),
    item.children?.length ? /* @__PURE__ */ jsx("ul", { style: { margin: "0.25em 0 0 0", paddingLeft: "1.25em" }, children: item.children.map((c, idx) => renderBulletItem(c, `${path}-c-${idx}`, props, listGap)) }) : null
  ] }, path);
}
function MachinaTextView(props) {
  const normalized = normalizeText(props.text);
  return /* @__PURE__ */ jsx("div", { className: props.className, style: { ...policyStyle(normalized.policy), ...props.style }, children: /* @__PURE__ */ jsxs("div", { style: { minWidth: 0 }, children: [
    normalized.document.blocks.map(
      (block, index) => block.kind === "paragraph" ? /* @__PURE__ */ jsx(
        "p",
        {
          style: {
            margin: index === normalized.document.blocks.length - 1 ? "0" : `0 0 ${normalized.policy.blockGap}px 0`
          },
          children: block.inline.map((i, idx) => renderInline(i, `b-${index}-${idx}`, props))
        },
        `b-${index}`
      ) : /* @__PURE__ */ jsx(
        "ul",
        {
          style: {
            margin: index === normalized.document.blocks.length - 1 ? "0" : `0 0 ${normalized.policy.blockGap}px 0`,
            paddingLeft: "1.25em"
          },
          children: block.items.map(
            (item, itemIndex) => renderBulletItem(
              item,
              `b-${index}-item-${itemIndex}`,
              props,
              normalized.policy.listGap
            )
          )
        },
        `b-${index}`
      )
    ),
    props.showDiagnostics && normalized.diagnostics.length > 0 ? /* @__PURE__ */ jsx(
      "pre",
      {
        style: {
          margin: `${normalized.policy.blockGap}px 0 0 0`,
          padding: "0.5em",
          fontSize: "11px",
          fontFamily: INLINE_CODE_FONT,
          whiteSpace: "pre-wrap",
          background: "rgba(127, 127, 127, 0.12)"
        },
        children: normalized.diagnostics.map((d) => `${d.code} (${d.line}:${d.column}) ${d.message}`).join("\n")
      }
    ) : null
  ] }) });
}

export {
  MachinaTextView
};
