import {
  parseMachinaText
} from "../../chunk-BJOQRPPX.js";

// src/text/react-native/MachinaNativeTextView.tsx
import React from "react";
import { Text, View } from "react-native";
import { jsx, jsxs } from "react/jsx-runtime";
var DEFAULT_POLICY = { variant: "body", wrap: "word", overflow: "clip", align: "start", leading: "normal", blockGap: 8, listGap: 2, valign: "top" };
var VARIANT_STYLE = {
  body: { fontSize: 14, fontWeight: "400" },
  label: { fontSize: 12, fontWeight: "500" },
  caption: { fontSize: 11, fontWeight: "400", opacity: 0.8 },
  title: { fontSize: 18, fontWeight: "700" },
  mono: { fontSize: 12, fontFamily: "monospace" }
};
var isDoc = (v) => typeof v === "object" && v !== null && "blocks" in v;
var isSpec = (v) => typeof v === "object" && v !== null && "kind" in v && v.kind === "text";
var normalizePositive = (v, f) => typeof v === "number" && Number.isFinite(v) && v > 0 ? v : f;
var normalizeNonNegative = (v, f) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : f;
function resolveLeadingMultiplier(policy) {
  if (policy.leading === "tight") return 1.15;
  if (policy.leading === "loose") return 1.6;
  if (typeof policy.leading === "number") return policy.leading;
  if (policy.variant === "body") return 1.4;
  if (policy.variant === "label") return 1.3;
  if (policy.variant === "caption") return 1.25;
  if (policy.variant === "title") return 1.25;
  return 1.35;
}
function normalizeLeading(value) {
  if (value === void 0) return DEFAULT_POLICY.leading;
  if (value === "tight" || value === "normal" || value === "loose") return value;
  return normalizePositive(value, resolveLeadingMultiplier(DEFAULT_POLICY));
}
function normalizeText(text) {
  if (isDoc(text)) return { document: text, diagnostics: [], policy: DEFAULT_POLICY };
  if (isSpec(text)) {
    const result2 = parseMachinaText(text.source);
    return {
      document: result2.document,
      diagnostics: result2.diagnostics,
      policy: { variant: text.variant ?? DEFAULT_POLICY.variant, wrap: text.wrap ?? DEFAULT_POLICY.wrap, overflow: text.overflow ?? DEFAULT_POLICY.overflow, align: text.align ?? DEFAULT_POLICY.align, leading: normalizeLeading(text.leading), blockGap: normalizeNonNegative(text.blockGap, DEFAULT_POLICY.blockGap), listGap: normalizeNonNegative(text.listGap, DEFAULT_POLICY.listGap), valign: text.valign ?? DEFAULT_POLICY.valign }
    };
  }
  const result = parseMachinaText(typeof text === "string" ? { kind: "machina-text", text } : text);
  return { document: result.document, diagnostics: result.diagnostics, policy: DEFAULT_POLICY };
}
function textStyle(policy) {
  const base = VARIANT_STYLE[policy.variant];
  const fontSize = base.fontSize ?? 14;
  return { ...base, lineHeight: fontSize * resolveLeadingMultiplier(policy), textAlign: policy.align === "center" ? "center" : policy.align === "end" ? "right" : "left" };
}
var pProps = (policy) => policy.overflow === "ellipsis" ? { numberOfLines: 1, ellipsizeMode: "tail" } : policy.wrap === "none" ? { numberOfLines: 1 } : {};
function renderInline(inline, key, props) {
  switch (inline.kind) {
    case "text":
      return /* @__PURE__ */ jsx(React.Fragment, { children: inline.text }, key);
    case "strong":
      return /* @__PURE__ */ jsx(Text, { style: { fontWeight: "700" }, children: inline.children.map((c, i) => renderInline(c, `${key}-s-${i}`, props)) }, key);
    case "emphasis":
      return /* @__PURE__ */ jsx(Text, { style: { fontStyle: "italic" }, children: inline.children.map((c, i) => renderInline(c, `${key}-e-${i}`, props)) }, key);
    case "code":
      return /* @__PURE__ */ jsx(Text, { style: [{ fontFamily: "monospace" }, props.codeStyle], children: inline.text }, key);
    case "link":
      return /* @__PURE__ */ jsx(Text, { style: [{ textDecorationLine: "underline", color: "#2563eb" }, props.linkStyle], onPress: () => props.onLinkPress?.(inline.href), children: inline.children.map((c, i) => renderInline(c, `${key}-l-${i}`, props)) }, key);
  }
}
function renderBullet(item, path, props, policy, depth) {
  return /* @__PURE__ */ jsxs(View, { style: { marginBottom: policy.listGap, marginLeft: depth * 12 }, children: [
    /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "flex-start" }, children: [
      /* @__PURE__ */ jsx(Text, { style: textStyle(policy), children: "\u2022 " }),
      /* @__PURE__ */ jsx(Text, { style: [{ flexShrink: 1 }, textStyle(policy)], ...pProps(policy), children: item.inline.map((i, idx) => renderInline(i, `${path}-i-${idx}`, props)) })
    ] }),
    item.children?.map((child, idx) => renderBullet(child, `${path}-c-${idx}`, props, policy, depth + 1))
  ] }, path);
}
function MachinaNativeTextView(props) {
  const normalized = normalizeText(props.text);
  const justifyContent = normalized.policy.valign === "center" ? "center" : normalized.policy.valign === "bottom" ? "flex-end" : "flex-start";
  return /* @__PURE__ */ jsx(View, { style: [{ width: "100%", height: "100%", justifyContent }, props.contentStyle], children: /* @__PURE__ */ jsxs(View, { style: { minWidth: 0 }, children: [
    normalized.document.blocks.map((block, idx) => block.kind === "paragraph" ? /* @__PURE__ */ jsx(Text, { style: [textStyle(normalized.policy), idx === normalized.document.blocks.length - 1 ? void 0 : { marginBottom: normalized.policy.blockGap }, props.style], ...pProps(normalized.policy), children: block.inline.map((i, iIdx) => renderInline(i, `b-${idx}-${iIdx}`, props)) }, `b-${idx}`) : /* @__PURE__ */ jsx(View, { style: idx === normalized.document.blocks.length - 1 ? void 0 : { marginBottom: normalized.policy.blockGap }, children: block.items.map((item, itemIdx) => renderBullet(item, `b-${idx}-item-${itemIdx}`, props, normalized.policy, 0)) }, `b-${idx}`)),
    props.showDiagnostics && normalized.diagnostics.length > 0 ? /* @__PURE__ */ jsx(Text, { style: { marginTop: normalized.policy.blockGap, padding: 8, fontSize: 11, fontFamily: "monospace", backgroundColor: "rgba(127, 127, 127, 0.12)" }, children: normalized.diagnostics.map((d) => `${d.code} (${d.line}:${d.column}) ${d.message}`).join("\n") }) : null
  ] }) });
}
export {
  MachinaNativeTextView
};
