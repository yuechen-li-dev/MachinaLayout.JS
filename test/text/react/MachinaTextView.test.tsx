// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MachinaTextView, type MachinaTextDocument } from "../../../src/index";

describe("MachinaTextView", () => {
  afterEach(() => cleanup());
  it("renders plain string", () => {
    const { container } = render(<MachinaTextView text="Hello **world**" />);
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
    expect(container.querySelector("strong")?.textContent).toBe("world");
  });
  it("renders plain source literally", () => {
    const { container } = render(<MachinaTextView text={{ kind: "plain", text: "Hello **not bold**" }} />);
    expect(screen.getByText("Hello **not bold**")).toBeInTheDocument();
    expect(container.querySelector("strong")).toBeNull();
  });
  it("renders spec policy", () => {
    const { container } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "Title" }, variant: "title", wrap: "none", overflow: "ellipsis", align: "center" }} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveStyle({ fontSize: "18px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" });
  });
  it("maps leading presets and numeric values", () => {
    const { container: tight } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "Hello" }, leading: "tight" }} />);
    expect(tight.firstElementChild).toHaveStyle({ lineHeight: "1.15" });
    cleanup();
    const { container: loose } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "Hello" }, leading: "loose" }} />);
    expect(loose.firstElementChild).toHaveStyle({ lineHeight: "1.6" });
    cleanup();
    const { container: numeric } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "Hello" }, leading: 2 }} />);
    expect(numeric.firstElementChild).toHaveStyle({ lineHeight: "2" });
  });
  it("leading normal preserves variant default", () => {
    const { container } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "Hello" }, variant: "mono", leading: "normal" }} />);
    expect(container.firstElementChild).toHaveStyle({ lineHeight: "1.35" });
  });
  it("applies blockGap", () => {
    const { container } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "First\n\nSecond" }, blockGap: 12 }} />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs[0]).toHaveStyle({ marginBottom: "12px" });
    expect(paragraphs[1]).toHaveStyle({ margin: "0" });
  });
  it("supports blockGap zero", () => {
    const { container } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "First\n\nSecond" }, blockGap: 0 }} />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs[0]).toHaveStyle({ marginBottom: "0px" });
  });
  it("applies listGap", () => {
    const { container } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "- One\n- Two" }, listGap: 6 }} />);
    const items = container.querySelectorAll("li");
    expect(items[0]).toHaveStyle({ marginBottom: "6px" });
  });
  it("maps vertical alignment", () => {
    const { container: top } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "Top" }, valign: "top" }} />);
    expect(top.firstElementChild).toHaveStyle({ justifyContent: "flex-start" });
    cleanup();
    const { container: center } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "Center" }, valign: "center" }} />);
    expect(center.firstElementChild).toHaveStyle({ justifyContent: "center" });
    cleanup();
    const { container: bottom } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "Bottom" }, valign: "bottom" }} />);
    expect(bottom.firstElementChild).toHaveStyle({ justifyContent: "flex-end" });
  });
  it("defaults vertical alignment to top", () => {
    const { container } = render(<MachinaTextView text="Default" />);
    expect(container.firstElementChild).toHaveStyle({ justifyContent: "flex-start" });
  });
  it("renders inline code", () => {
    const { container } = render(<MachinaTextView text="Use `rect` now" />);
    expect(container.querySelector("code")?.textContent).toBe("rect");
  });
  it("renders link", () => {
    render(<MachinaTextView text="Read [docs](https://example.com)" />);
    const anchor = screen.getByRole("link", { name: "docs" });
    expect(anchor).toHaveAttribute("href", "https://example.com");
  });
  it("sets link target and rel", () => {
    render(<MachinaTextView text="Read [docs](https://example.com)" linkTarget="_blank" />);
    const anchor = screen.getByRole("link", { name: "docs" });
    expect(anchor).toHaveAttribute("target", "_blank");
    expect(anchor.getAttribute("rel") ?? "").toContain("noopener");
    expect(anchor.getAttribute("rel") ?? "").toContain("noreferrer");
  });
  it("calls link click callback", () => {
    const onLinkClick = vi.fn();
    render(<MachinaTextView text="Read [docs](https://example.com)" onLinkClick={onLinkClick} />);
    const anchor = screen.getByRole("link", { name: "docs" });
    fireEvent.click(anchor);
    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect(onLinkClick.mock.calls[0][0]).toBe("https://example.com");
  });
  it("renders bullet list", () => {
    const text = "- Build rows\n- Resolve rectangles\n  - Preserve order\n  - Apply z\n- Render views";
    const { container } = render(<MachinaTextView text={text} />);
    expect(screen.getByText("Build rows")).toBeInTheDocument();
    expect(screen.getByText("Preserve order")).toBeInTheDocument();
    expect(container.querySelectorAll("ul").length).toBeGreaterThan(1);
    expect(container.querySelectorAll("li").length).toBe(5);
  });
  it("renders diagnostics when requested", () => {
    render(<MachinaTextView text="# Forbidden" showDiagnostics />);
    expect(screen.getByText("# Forbidden")).toBeInTheDocument();
    expect(screen.getByText(/heading_forbidden/)).toBeInTheDocument();
  });
  it("hides diagnostics by default", () => {
    render(<MachinaTextView text="# Forbidden" />);
    expect(screen.queryByText(/heading_forbidden/)).toBeNull();
    expect(screen.getByText("# Forbidden")).toBeInTheDocument();
  });
  it("does not use dangerous html", () => {
    const { container } = render(<MachinaTextView text="<div>Hello</div>" />);
    expect(screen.getByText("<div>Hello</div>")).toBeInTheDocument();
    expect(screen.queryByText("Hello")).toBeNull();
  });
  it("renders pre-parsed document", () => {
    const doc: MachinaTextDocument = { blocks: [{ kind: "paragraph", inline: [{ kind: "text", text: "Manual" }] }] };
    render(<MachinaTextView text={doc} />);
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });
  it("fills parent box and merges className/style", () => {
    const { container } = render(<MachinaTextView text="x" className="marker" style={{ color: "red" }} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("marker");
    expect(root).toHaveStyle({ width: "100%", height: "100%", boxSizing: "border-box", color: "rgb(255, 0, 0)" });
  });
  it("keeps nowrap + ellipsis overflow behavior", () => {
    const { container } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "Long text" }, wrap: "none", overflow: "ellipsis" }} />);
    expect(container.firstElementChild).toHaveStyle({ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });
  });
  it("falls back for invalid numeric policy values", () => {
    const { container } = render(<MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "Hello\n\nWorld\n- One\n- Two" }, leading: 0 as unknown as number, blockGap: -1 as unknown as number, listGap: -1 as unknown as number }} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveStyle({ lineHeight: "1.4" });
    const firstParagraph = container.querySelector("p");
    expect(firstParagraph).toHaveStyle({ marginBottom: "8px" });
    const firstItem = container.querySelector("li");
    expect(firstItem).toHaveStyle({ marginBottom: "2px" });
  });
});
