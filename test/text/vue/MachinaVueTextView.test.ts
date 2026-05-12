/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { MachinaVueTextView, type MachinaTextDocument } from "../../../src";
import type { MachinaVueTextViewProps } from "../../../src/text/vue";

describe("MachinaVueTextView", () => {
  it("exports component and props type", () => {
    const props: MachinaVueTextViewProps = { text: "Hello" };
    expect(MachinaVueTextView).toBeTruthy();
    expect(props.text).toBe("Hello");
  });
  it("renders string with strong", () => {
    const w = mount(MachinaVueTextView, { props: { text: "Hello **world**" } });
    expect(w.text()).toContain("Hello");
    expect(w.find("strong").text()).toBe("world");
  });
  it("plain source remains literal", () => {
    const w = mount(MachinaVueTextView, {
      props: { text: { kind: "plain", text: "Hello **not bold**" } },
    });
    expect(w.text()).toContain("Hello **not bold**");
    expect(w.find("strong").exists()).toBe(false);
  });
  it("policy variant leading align valign", () => {
    const w = mount(MachinaVueTextView, {
      props: {
        text: {
          kind: "text",
          source: { kind: "machina-text", text: "Title" },
          variant: "title",
          leading: "tight",
          align: "center",
          valign: "center",
        },
      },
    });
    const style = w.attributes("style");
    expect(style).toContain("font-size: 18px");
    expect(style).toContain("font-weight: 700");
    expect(style).toContain("line-height: 1.15");
    expect(style).toContain("text-align: center");
    expect(style).toContain("justify-content: center");
  });
  it("overflow ellipsis overrides wrap", () => {
    const w = mount(MachinaVueTextView, {
      props: {
        text: {
          kind: "text",
          source: { kind: "machina-text", text: "Long" },
          wrap: "word",
          overflow: "ellipsis",
        },
      },
    });
    const style = w.attributes("style");
    expect(style).toContain("white-space: nowrap");
    expect(style).toContain("overflow: hidden");
    expect(style).toContain("text-overflow: ellipsis");
  });
  it("wrap word + clip remains wrapping", () => {
    const w = mount(MachinaVueTextView, {
      props: {
        text: {
          kind: "text",
          source: { kind: "machina-text", text: "Long" },
          wrap: "word",
          overflow: "clip",
        },
      },
    });
    const style = w.attributes("style");
    expect(style).toContain("white-space: normal");
    expect(style).toContain("overflow-wrap: anywhere");
    expect(style).toContain("overflow: hidden");
  });
  it("renders inline code", () => {
    const w = mount(MachinaVueTextView, { props: { text: "Use `rect`" } });
    expect(w.find("code").text()).toBe("rect");
  });
  it("renders link and click callback", async () => {
    const onLinkClick = vi.fn();
    const w = mount(MachinaVueTextView, {
      props: { text: "Read [docs](https://example.com)", onLinkClick },
    });
    const a = w.find("a");
    expect(a.attributes("href")).toBe("https://example.com");
    expect(a.text()).toBe("docs");
    await a.trigger("click");
    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect(onLinkClick.mock.calls[0][0]).toBe("https://example.com");
  });
  it("link target blank sets rel", () => {
    const w = mount(MachinaVueTextView, {
      props: { text: "Read [docs](https://example.com)", linkTarget: "_blank" },
    });
    const a = w.find("a");
    expect(a.attributes("target")).toBe("_blank");
    expect(a.attributes("rel")).toContain("noopener");
    expect(a.attributes("rel")).toContain("noreferrer");
  });
  it("renders bullet list with nesting", () => {
    const w = mount(MachinaVueTextView, {
      props: { text: "- Build rows\n- Resolve rectangles\n  - Preserve order\n- Render views" },
    });
    expect(w.findAll("ul").length).toBeGreaterThan(1);
    expect(w.text()).toContain("Preserve order");
  });
  it("applies blockGap and listGap", () => {
    const w = mount(MachinaVueTextView, {
      props: {
        text: {
          kind: "text",
          source: { kind: "machina-text", text: "First\n\nSecond\n\n- A\n- B" },
          blockGap: 12,
          listGap: 6,
        },
      },
    });
    expect(w.findAll("p")[0].attributes("style")).toContain("margin: 0px 0px 12px");
    expect(w.find("li").attributes("style")).toContain("margin-bottom: 6px");
  });
  it("diagnostics show only when requested", () => {
    const on = mount(MachinaVueTextView, { props: { text: "# Forbidden", showDiagnostics: true } });
    expect(on.text()).toContain("heading_forbidden");
    const off = mount(MachinaVueTextView, { props: { text: "# Forbidden" } });
    expect(off.text()).not.toContain("heading_forbidden");
  });
  it("html remains literal", () => {
    const w = mount(MachinaVueTextView, { props: { text: "<div>Hello</div>" } });
    expect(w.text()).toContain("<div>Hello</div>");
  });
  it("renders pre-parsed document", () => {
    const doc: MachinaTextDocument = {
      blocks: [{ kind: "paragraph", inline: [{ kind: "text", text: "Manual" }] }],
    };
    const w = mount(MachinaVueTextView, { props: { text: doc } });
    expect(w.text()).toContain("Manual");
  });
  it("fills parent and hook styles/classes", () => {
    const w = mount(MachinaVueTextView, {
      props: {
        text: "Use `x` and [a](https://e.com)",
        rootClass: "root-x" as any,
        rootStyle: { color: "red" },
        linkClass: "lnk" as any,
        linkStyle: { color: "blue" },
        codeClass: "cd" as any,
        codeStyle: { color: "green" },
      },
    });
    expect(w.classes()).toContain("root-x");
    expect(w.attributes("style")).toContain("width: 100%");
    expect(w.attributes("style")).toContain("height: 100%");
    expect(w.attributes("style")).toContain("box-sizing: border-box");
    expect(w.find("a").classes()).toContain("lnk");
    expect(w.find("code").classes()).toContain("cd");
  });
});
