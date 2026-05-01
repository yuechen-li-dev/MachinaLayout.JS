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
});
