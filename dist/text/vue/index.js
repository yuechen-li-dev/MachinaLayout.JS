import {
  parseMachinaText
} from "../../chunk-BJOQRPPX.js";

// src/text/vue/MachinaVueTextView.ts
import { computed, defineComponent, h } from "vue";
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
var isDocument = (v) => typeof v === "object" && v !== null && "blocks" in v;
var isSpec = (v) => typeof v === "object" && v !== null && "kind" in v && v.kind === "text";
var np = (v, f) => typeof v === "number" && Number.isFinite(v) && v > 0 ? v : f;
var nnn = (v, f) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : f;
var resolveLineHeight = (p) => p.leading === "tight" ? 1.15 : p.leading === "loose" ? 1.6 : typeof p.leading === "number" ? p.leading : VARIANT_STYLE[p.variant].lineHeight;
var normalizeLeading = (v) => v === void 0 ? DEFAULT_POLICY.leading : v === "tight" || v === "normal" || v === "loose" ? v : np(v, resolveLineHeight(DEFAULT_POLICY));
var normalizeSpecPolicy = (s) => ({
  variant: s.variant ?? DEFAULT_POLICY.variant,
  wrap: s.wrap ?? DEFAULT_POLICY.wrap,
  overflow: s.overflow ?? DEFAULT_POLICY.overflow,
  align: s.align ?? DEFAULT_POLICY.align,
  leading: normalizeLeading(s.leading),
  blockGap: nnn(s.blockGap, DEFAULT_POLICY.blockGap),
  listGap: nnn(s.listGap, DEFAULT_POLICY.listGap),
  valign: s.valign ?? DEFAULT_POLICY.valign
});
function normalizeText(text) {
  if (isDocument(text)) return { document: text, diagnostics: [], policy: DEFAULT_POLICY };
  if (isSpec(text)) {
    const r2 = parseMachinaText(text.source);
    return { document: r2.document, diagnostics: r2.diagnostics, policy: normalizeSpecPolicy(text) };
  }
  const r = parseMachinaText(typeof text === "string" ? { kind: "machina-text", text } : text);
  return { document: r.document, diagnostics: r.diagnostics, policy: DEFAULT_POLICY };
}
function policyStyle(policy) {
  const wrap = policy.wrap === "word" ? { whiteSpace: "normal", overflowWrap: "anywhere" } : { whiteSpace: "nowrap" };
  const ov = policy.overflow === "clip" ? { overflow: "hidden" } : policy.overflow === "ellipsis" ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : { overflow: "auto" };
  const align = policy.align === "center" ? { textAlign: "center" } : policy.align === "end" ? { textAlign: "right" } : { textAlign: "left" };
  const jc = policy.valign === "center" ? "center" : policy.valign === "bottom" ? "flex-end" : "flex-start";
  return {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: jc,
    minWidth: 0,
    ...VARIANT_STYLE[policy.variant],
    lineHeight: resolveLineHeight(policy),
    ...wrap,
    ...ov,
    ...align
  };
}
function renderInline(inline, key, props) {
  switch (inline.kind) {
    case "text":
      return inline.text;
    case "strong":
      return h(
        "strong",
        { key },
        inline.children.map((c, i) => renderInline(c, `${key}-s-${i}`, props))
      );
    case "emphasis":
      return h(
        "em",
        { key },
        inline.children.map((c, i) => renderInline(c, `${key}-e-${i}`, props))
      );
    case "code":
      return h(
        "code",
        {
          key,
          class: props.codeClass,
          style: [
            {
              fontFamily: INLINE_CODE_FONT,
              backgroundColor: "rgba(127, 127, 127, 0.15)",
              borderRadius: "3px",
              padding: "0 0.25em"
            },
            props.codeStyle
          ]
        },
        inline.text
      );
    case "link": {
      const rel = props.linkTarget === "_blank" ? "noreferrer noopener" : void 0;
      return h(
        "a",
        {
          key,
          href: inline.href,
          target: props.linkTarget,
          rel,
          class: props.linkClass,
          style: props.linkStyle,
          onClick: (e) => props.onLinkClick?.(inline.href, e)
        },
        inline.children.map((c, i) => renderInline(c, `${key}-l-${i}`, props))
      );
    }
  }
}
function renderBulletItem(item, path, props, listGap) {
  return h("li", { key: path, style: { marginBottom: `${listGap}px` } }, [
    ...item.inline.map((i, idx) => renderInline(i, `${path}-i-${idx}`, props)),
    ...item.children?.length ? [
      h(
        "ul",
        { style: { margin: "0.25em 0 0 0", paddingLeft: "1.25em" } },
        item.children.map((c, idx) => renderBulletItem(c, `${path}-c-${idx}`, props, listGap))
      )
    ] : []
  ]);
}
var MachinaVueTextView = defineComponent({
  name: "MachinaVueTextView",
  props: {
    text: { type: [String, Object], required: true },
    rootClass: { type: null, default: void 0 },
    rootStyle: { type: null, default: void 0 },
    linkTarget: { type: String, default: void 0 },
    onLinkClick: {
      type: Function,
      default: void 0
    },
    showDiagnostics: { type: Boolean, default: false },
    linkClass: { type: null, default: void 0 },
    linkStyle: { type: null, default: void 0 },
    codeClass: { type: null, default: void 0 },
    codeStyle: { type: null, default: void 0 }
  },
  setup(props) {
    const normalized = computed(() => normalizeText(props.text));
    return () => h(
      "div",
      { class: props.rootClass, style: [policyStyle(normalized.value.policy), props.rootStyle] },
      [
        h("div", { style: { minWidth: 0 } }, [
          ...normalized.value.document.blocks.map((block, index) => {
            const blockStyle = {
              margin: index === normalized.value.document.blocks.length - 1 ? "0" : `0 0 ${normalized.value.policy.blockGap}px 0`
            };
            return block.kind === "paragraph" ? h(
              "p",
              { key: `b-${index}`, style: blockStyle },
              block.inline.map((i, idx) => renderInline(i, `b-${index}-${idx}`, props))
            ) : h(
              "ul",
              { key: `b-${index}`, style: { ...blockStyle, paddingLeft: "1.25em" } },
              block.items.map(
                (item, itemIndex) => renderBulletItem(
                  item,
                  `b-${index}-item-${itemIndex}`,
                  props,
                  normalized.value.policy.listGap
                )
              )
            );
          }),
          ...props.showDiagnostics && normalized.value.diagnostics.length > 0 ? [
            h(
              "pre",
              {
                style: {
                  margin: `${normalized.value.policy.blockGap}px 0 0 0`,
                  padding: "0.5em",
                  fontSize: "11px",
                  fontFamily: INLINE_CODE_FONT,
                  whiteSpace: "pre-wrap",
                  background: "rgba(127, 127, 127, 0.12)"
                }
              },
              normalized.value.diagnostics.map((d) => `${d.code} (${d.line}:${d.column}) ${d.message}`).join("\n")
            )
          ] : []
        ])
      ]
    );
  }
});
export {
  MachinaVueTextView
};
