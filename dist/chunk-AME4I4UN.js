// src/text/react/MachinaTextView.tsx
import React from "react";

// src/text/parseMachinaText.ts
function makeDiagnostic(code, message, index, length, line, column) {
  return { code, message, index, length, line, column, level: "error" };
}
function toLines(source) {
  const lines = [];
  let i = 0;
  let line = 1;
  while (i <= source.length) {
    const start = i;
    while (i < source.length && source[i] !== "\n" && source[i] !== "\r") i += 1;
    const text = source.slice(start, i);
    lines.push({ text, index: start, line });
    if (i >= source.length) break;
    if (source[i] === "\r" && source[i + 1] === "\n") i += 2;
    else i += 1;
    line += 1;
  }
  return lines;
}
function parseInline(text, lineIndex, line) {
  const diagnostics = [];
  const inline = [];
  let cursor = 0;
  const pushText = (t) => {
    if (!t) return;
    const prev = inline[inline.length - 1];
    if (prev?.kind === "text") prev.text += t;
    else inline.push({ kind: "text", text: t });
  };
  const allowedEscapes = /* @__PURE__ */ new Set(["\\", "*", "`", "[", "]", "(", ")", "-"]);
  const consumeEscape = () => {
    if (text[cursor] !== "\\") return false;
    if (cursor === text.length - 1) {
      diagnostics.push(makeDiagnostic("invalid_escape", "Dangling escape sequence.", lineIndex + cursor, 1, line, cursor + 1));
      pushText("\\");
      cursor += 1;
      return true;
    }
    const escaped = text[cursor + 1];
    if (allowedEscapes.has(escaped)) {
      pushText(escaped);
      cursor += 2;
      return true;
    }
    diagnostics.push(makeDiagnostic("invalid_escape", `Unsupported escape sequence: \\${escaped}`, lineIndex + cursor, 2, line, cursor + 1));
    pushText(escaped);
    cursor += 2;
    return true;
  };
  while (cursor < text.length) {
    if (consumeEscape()) continue;
    if (text.startsWith("![", cursor)) {
      diagnostics.push(makeDiagnostic("unsupported_syntax", "Images are not supported.", lineIndex + cursor, 2, line, cursor + 1));
      pushText("![");
      cursor += 2;
      continue;
    }
    if (text[cursor] === "`") {
      const close = text.indexOf("`", cursor + 1);
      if (close < 0) {
        diagnostics.push(makeDiagnostic("unclosed_inline", "Unclosed inline code marker.", lineIndex + cursor, text.length - cursor, line, cursor + 1));
        pushText(text.slice(cursor));
        break;
      }
      inline.push({ kind: "code", text: text.slice(cursor + 1, close) });
      cursor = close + 1;
      continue;
    }
    if (text.startsWith("**", cursor)) {
      const close = text.indexOf("**", cursor + 2);
      if (close < 0) {
        diagnostics.push(makeDiagnostic("unclosed_inline", "Unclosed strong marker.", lineIndex + cursor, text.length - cursor, line, cursor + 1));
        pushText(text.slice(cursor));
        break;
      }
      const children = parseInline(text.slice(cursor + 2, close), lineIndex + cursor + 2, line);
      diagnostics.push(...children.diagnostics);
      inline.push({ kind: "strong", children: children.inline });
      cursor = close + 2;
      continue;
    }
    if (text[cursor] === "*") {
      const close = text.indexOf("*", cursor + 1);
      if (close < 0) {
        diagnostics.push(makeDiagnostic("unclosed_inline", "Unclosed emphasis marker.", lineIndex + cursor, text.length - cursor, line, cursor + 1));
        pushText(text.slice(cursor));
        break;
      }
      const children = parseInline(text.slice(cursor + 1, close), lineIndex + cursor + 1, line);
      diagnostics.push(...children.diagnostics);
      inline.push({ kind: "emphasis", children: children.inline });
      cursor = close + 1;
      continue;
    }
    if (text[cursor] === "[") {
      const closeBracket = text.indexOf("]", cursor + 1);
      if (closeBracket < 0 || text[closeBracket + 1] !== "(") {
        diagnostics.push(makeDiagnostic("malformed_link", "Malformed link syntax.", lineIndex + cursor, Math.max(1, text.length - cursor), line, cursor + 1));
        pushText("[");
        cursor += 1;
        continue;
      }
      const closeParen = text.indexOf(")", closeBracket + 2);
      if (closeParen < 0) {
        diagnostics.push(makeDiagnostic("malformed_link", "Malformed link syntax.", lineIndex + cursor, text.length - cursor, line, cursor + 1));
        pushText(text.slice(cursor));
        break;
      }
      const label = text.slice(cursor + 1, closeBracket);
      const href = text.slice(closeBracket + 2, closeParen);
      if (label.length === 0) {
        diagnostics.push(makeDiagnostic("malformed_link", "Link label cannot be empty.", lineIndex + cursor, closeParen - cursor + 1, line, cursor + 1));
        pushText(text.slice(cursor, closeParen + 1));
        cursor = closeParen + 1;
        continue;
      }
      const labelInline = parseInline(label, lineIndex + cursor + 1, line);
      diagnostics.push(...labelInline.diagnostics);
      inline.push({ kind: "link", href, children: labelInline.inline });
      cursor = closeParen + 1;
      continue;
    }
    const specials = ["![", "`", "**", "*", "[", "\\"];
    let next = text.length;
    for (const special of specials) {
      const p = text.indexOf(special, cursor);
      if (p >= 0 && p < next) next = p;
    }
    if (next === cursor) {
      pushText(text[cursor]);
      cursor += 1;
      continue;
    }
    pushText(text.slice(cursor, next));
    cursor = next;
  }
  return { inline, diagnostics };
}
function classifyForbiddenBlock(line) {
  if (/^#{1,6}\s+/.test(line)) return "heading_forbidden";
  if (/^\d+\.\s+/.test(line)) return "unsupported_syntax";
  if (/^\s*-\s+\[[ xX]\]\s+/.test(line)) return "unsupported_syntax";
  if (/^>\s+/.test(line)) return "unsupported_syntax";
  if (/^```/.test(line)) return "unsupported_syntax";
  if (/^\s*<\/?[a-zA-Z][^>]*>/.test(line)) return "unsupported_syntax";
  if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) return "unsupported_syntax";
  return void 0;
}
function parseBulletLine(line) {
  if (line.startsWith("\\- ")) return void 0;
  if (line.startsWith("- ")) return { depth: 1, text: line.slice(2) };
  if (line.startsWith("  - ")) return { depth: 2, text: line.slice(4) };
  if (line.startsWith("    - ")) return { depth: 3, text: line.slice(6) };
  return void 0;
}
function parseMachinaTextInline(text) {
  return parseInline(text, 0, 1);
}
function parseMachinaText(source) {
  const src = typeof source === "string" ? { kind: "machina-text", text: source } : source;
  if (src?.kind !== "plain" && src?.kind !== "machina-text") {
    const diagnostic = makeDiagnostic("unsupported_syntax", "Unsupported MachinaText source kind.", 0, 0, 1, 1);
    return { ok: false, document: { blocks: [] }, diagnostics: [diagnostic] };
  }
  if (src.kind === "plain") {
    return {
      ok: true,
      document: { blocks: [{ kind: "paragraph", inline: [{ kind: "text", text: src.text }] }] },
      diagnostics: []
    };
  }
  const blocks = [];
  const diagnostics = [];
  const lines = toLines(src.text);
  let i = 0;
  while (i < lines.length) {
    const lineInfo = lines[i];
    const trimmed = lineInfo.text.trim();
    if (trimmed.length === 0) {
      i += 1;
      continue;
    }
    const forbiddenCode = classifyForbiddenBlock(lineInfo.text);
    if (forbiddenCode) {
      const code = forbiddenCode;
      diagnostics.push(makeDiagnostic(code, "Unsupported block syntax.", lineInfo.index, lineInfo.text.length || 1, lineInfo.line, 1));
      blocks.push({ kind: "paragraph", inline: [{ kind: "text", text: lineInfo.text }] });
      i += 1;
      continue;
    }
    const bullet = parseBulletLine(lineInfo.text);
    if (bullet) {
      const items = [];
      let lastTop;
      while (i < lines.length) {
        const current = lines[i];
        if (current.text.trim().length === 0) break;
        const currentBullet = parseBulletLine(current.text);
        if (!currentBullet) break;
        if (/^\s*-\s+\[[ xX]\]\s+/.test(current.text)) {
          diagnostics.push(makeDiagnostic("unsupported_syntax", "Task lists are not supported.", current.index, current.text.length || 1, current.line, 1));
        }
        if (currentBullet.depth > 2) {
          diagnostics.push(makeDiagnostic("max_list_depth_exceeded", "Maximum bullet depth is 2.", current.index, current.text.length || 1, current.line, 1));
          const parsed3 = parseInline(current.text.trim(), current.index + (current.text.length - current.text.trimStart().length), current.line);
          diagnostics.push(...parsed3.diagnostics);
          blocks.push({ kind: "paragraph", inline: parsed3.inline.length ? parsed3.inline : [{ kind: "text", text: current.text }] });
          i += 1;
          continue;
        }
        const parsed2 = parseInline(currentBullet.text, current.index + (currentBullet.depth === 1 ? 2 : 4), current.line);
        diagnostics.push(...parsed2.diagnostics);
        const item = { inline: parsed2.inline };
        if (currentBullet.depth === 1) {
          items.push(item);
          lastTop = item;
        } else if (lastTop) {
          if (!lastTop.children) lastTop.children = [];
          lastTop.children.push(item);
        } else {
          diagnostics.push(makeDiagnostic("unsupported_syntax", "Nested bullet requires a parent bullet.", current.index, current.text.length || 1, current.line, 1));
          blocks.push({ kind: "paragraph", inline: [{ kind: "text", text: current.text }] });
        }
        i += 1;
      }
      blocks.push({ kind: "bulletList", items });
      continue;
    }
    const paragraphLines = [];
    while (i < lines.length && lines[i].text.trim().length > 0 && !parseBulletLine(lines[i].text) && !classifyForbiddenBlock(lines[i].text)) {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    const paragraphText = paragraphLines.map((line) => line.text).join("\n");
    const first = paragraphLines[0];
    const parsed = parseInline(paragraphText, first?.index ?? 0, first?.line ?? 1);
    diagnostics.push(...parsed.diagnostics);
    blocks.push({ kind: "paragraph", inline: parsed.inline });
  }
  return { ok: diagnostics.every((d) => d.level !== "error"), document: { blocks }, diagnostics };
}

// src/text/react/MachinaTextView.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var DEFAULT_POLICY = { variant: "body", wrap: "word", overflow: "clip", align: "start", leading: "normal", blockGap: 8, listGap: 2, valign: "top" };
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
  if (isMachinaTextDocument(text)) return { document: text, diagnostics: [], policy: DEFAULT_POLICY };
  if (isMachinaTextSpec(text)) {
    const result2 = parseMachinaText(text.source);
    return { document: result2.document, diagnostics: result2.diagnostics, policy: normalizeSpecPolicy(text) };
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
  const wrapStyle = { word: { whiteSpace: "normal", overflowWrap: "anywhere" }, none: { whiteSpace: "nowrap" } };
  const overflowStyle = {
    clip: { overflow: "hidden" },
    ellipsis: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    scroll: { overflow: "auto" }
  };
  const alignStyle = { start: { textAlign: "left" }, center: { textAlign: "center" }, end: { textAlign: "right" } };
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
      return /* @__PURE__ */ jsx("code", { style: { fontFamily: INLINE_CODE_FONT, backgroundColor: "rgba(127, 127, 127, 0.15)", borderRadius: 3, padding: "0 0.25em" }, children: inline.text }, key);
    case "link": {
      const rel = props.linkTarget === "_blank" ? "noreferrer noopener" : void 0;
      return /* @__PURE__ */ jsx("a", { href: inline.href, target: props.linkTarget, rel, onClick: (event) => props.onLinkClick?.(inline.href, event), children: inline.children.map((c, i) => renderInline(c, `${key}-l-${i}`, props)) }, key);
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
    normalized.document.blocks.map((block, index) => block.kind === "paragraph" ? /* @__PURE__ */ jsx("p", { style: { margin: index === normalized.document.blocks.length - 1 ? "0" : `0 0 ${normalized.policy.blockGap}px 0` }, children: block.inline.map((i, idx) => renderInline(i, `b-${index}-${idx}`, props)) }, `b-${index}`) : /* @__PURE__ */ jsx("ul", { style: { margin: index === normalized.document.blocks.length - 1 ? "0" : `0 0 ${normalized.policy.blockGap}px 0`, paddingLeft: "1.25em" }, children: block.items.map((item, itemIndex) => renderBulletItem(item, `b-${index}-item-${itemIndex}`, props, normalized.policy.listGap)) }, `b-${index}`)),
    props.showDiagnostics && normalized.diagnostics.length > 0 ? /* @__PURE__ */ jsx("pre", { style: { margin: `${normalized.policy.blockGap}px 0 0 0`, padding: "0.5em", fontSize: "11px", fontFamily: INLINE_CODE_FONT, whiteSpace: "pre-wrap", background: "rgba(127, 127, 127, 0.12)" }, children: normalized.diagnostics.map((d) => `${d.code} (${d.line}:${d.column}) ${d.message}`).join("\n") }) : null
  ] }) });
}

export {
  parseMachinaTextInline,
  parseMachinaText,
  MachinaTextView
};
