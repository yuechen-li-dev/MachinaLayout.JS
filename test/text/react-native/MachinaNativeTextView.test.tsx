import React from "react";
import renderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import type { MachinaTextDocument } from "../../../src/text";
import { MachinaNativeTextView } from "../../../src/text/react-native";
import type { MachinaNativeTextViewProps } from "../../../src/text/react-native";

vi.mock("react-native", () => ({
  View: ({ children, ...props }: any) => React.createElement("rn-view", props, children),
  Text: ({ children, ...props }: any) => React.createElement("rn-text", props, children),
}));

describe("MachinaNativeTextView", () => {
  it("exports public api", () => {
    const _props: MachinaNativeTextViewProps = { text: "ok" };
    expect(_props.text).toBe("ok");
    expect(MachinaNativeTextView).toBeTypeOf("function");
  });

  it("renders core content and behavior", async () => {
    const onLinkPress = vi.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<MachinaNativeTextView text={{ kind: "text", source: { kind: "machina-text", text: "Hello **world**\n\nUse `rect`\n\nRead [docs](https://example.com)\n\n- Build rows\n- Resolve rectangles\n  - Preserve order\n- Render views" }, variant: "title", leading: "tight", align: "center", valign: "center", overflow: "ellipsis", wrap: "word", blockGap: 10, listGap: 3 }} onLinkPress={onLinkPress} contentStyle={{ backgroundColor: "black" }} style={{ color: "white" }} linkStyle={{ color: "red" }} codeStyle={{ color: "green" }} />);
    });
    const root = tree.root.findAllByType("rn-view" as any)[0];
    expect(root.props.style[0]).toMatchObject({ width: "100%", height: "100%", justifyContent: "center" });

    const texts = tree.root.findAllByType("rn-text" as any);
    expect(texts.some((n) => String(n.children.join("")).includes("Hello"))).toBe(true);
    expect(texts.some((n) => String(n.children.join("")).includes("world"))).toBe(true);
    expect(texts.some((n) => String(n.children.join("")).includes("rect"))).toBe(true);
    expect(texts.some((n) => String(n.children.join("")).includes("Build rows"))).toBe(true);
    const paragraph = texts.find((n) => n.props.numberOfLines === 1);
    expect(paragraph?.props.ellipsizeMode).toBe("tail");
    expect(paragraph?.props.style[0]).toMatchObject({ fontSize: 18, textAlign: "center" });
    expect(paragraph?.props.style[0].lineHeight).toBeCloseTo(20.7, 1);

    const link = texts.find((n) => typeof n.props.onPress === "function");
    link?.props.onPress();
    expect(onLinkPress).toHaveBeenCalledWith("https://example.com");
  });

  it("plain text and html are literal, diagnostics toggled", async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<MachinaNativeTextView text={{ kind: "plain", text: "Hello **not bold** <div>Hello</div>" }} />);
    });
    expect(tree.root.findAll((n) => (n.type as any) === "rn-text" && String(n.children.join(" ")).includes("**not bold**"))).toHaveLength(1);

    await act(async () => {
      tree.update(<MachinaNativeTextView text="# Forbidden" showDiagnostics />);
    });
    expect(tree.root.findAll((n) => (n.type as any) === "rn-text" && String(n.children.join(" ")).includes("heading_forbidden"))).toHaveLength(1);

    await act(async () => {
      tree.update(<MachinaNativeTextView text="# Forbidden" />);
    });
    expect(tree.root.findAll((n) => (n.type as any) === "rn-text" && String(n.children.join(" ")).includes("heading_forbidden"))).toHaveLength(0);
  });

  it("renders pre-parsed document", async () => {
    const doc: MachinaTextDocument = { blocks: [{ kind: "paragraph", inline: [{ kind: "text", text: "Pre parsed" }] }] };
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<MachinaNativeTextView text={doc} />);
    });
    expect(tree.root.findAll((n) => (n.type as any) === "rn-text" && String(n.children.join(" ")).includes("Pre parsed"))).toHaveLength(1);
  });
});
