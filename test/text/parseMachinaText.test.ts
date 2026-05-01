import { describe, expect, it } from "vitest";
import { parseMachinaText } from "../../src";

function collectText(result: ReturnType<typeof parseMachinaText>): string {
  const pieces: string[] = [];
  for (const block of result.document.blocks) {
    if (block.kind === "paragraph") {
      for (const inline of block.inline) {
        if (inline.kind === "text") pieces.push(inline.text);
      }
    }
    if (block.kind === "bulletList") {
      for (const item of block.items) {
        for (const inline of item.inline) if (inline.kind === "text") pieces.push(inline.text);
        for (const child of item.children ?? []) for (const inline of child.inline) if (inline.kind === "text") pieces.push(inline.text);
      }
    }
  }
  return pieces.join("\n");
}

describe("parseMachinaText", () => {
  it("keeps plain source literal", () => {
    const result = parseMachinaText({ kind: "plain", text: "Hello **not bold**" });
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.document.blocks).toHaveLength(1);
    const block = result.document.blocks[0];
    expect(block.kind).toBe("paragraph");
    if (block.kind === "paragraph") expect(block.inline).toEqual([{ kind: "text", text: "Hello **not bold**" }]);
  });

  it("treats string input as machina-text", () => {
    const result = parseMachinaText("Hello **bold**");
    const block = result.document.blocks[0];
    expect(block.kind).toBe("paragraph");
    if (block.kind === "paragraph") expect(block.inline.some((i) => i.kind === "strong")).toBe(true);
  });

  it("parses paragraphs", () => {
    const result = parseMachinaText("First paragraph.\n\nSecond paragraph.");
    expect(result.document.blocks).toHaveLength(2);
    expect(result.document.blocks.every((b) => b.kind === "paragraph")).toBe(true);
  });

  it("parses strong/emphasis/code sequence", () => {
    const result = parseMachinaText("Hello **bold** and *em* and `code`.");
    const p = result.document.blocks[0];
    expect(p.kind).toBe("paragraph");
    if (p.kind === "paragraph") {
      expect(p.inline.map((i) => i.kind)).toEqual(["text", "strong", "text", "emphasis", "text", "code", "text"]);
    }
  });

  it("parses links", () => {
    const result = parseMachinaText("Read [docs](https://example.com).");
    const p = result.document.blocks[0];
    expect(p.kind).toBe("paragraph");
    if (p.kind === "paragraph") {
      const link = p.inline.find((i) => i.kind === "link");
      expect(link && link.kind === "link" ? link.href : "").toBe("https://example.com");
    }
  });

  it("diagnoses forbidden syntax and preserves text", () => {
    const samples = ["![alt](image.png)", "# Title", "1. First", "- [ ] Todo", "> quote", "<div>Hello</div>", "```ts\nconst x = 1;"];
    const expected = ["unsupported_syntax", "heading_forbidden", "unsupported_syntax", "unsupported_syntax", "unsupported_syntax", "unsupported_syntax", "unsupported_syntax"];
    samples.forEach((sample, idx) => {
      const result = parseMachinaText(sample);
      expect(result.ok).toBe(false);
      expect(result.diagnostics.some((d) => d.code === expected[idx])).toBe(true);
      expect(collectText(result)).toContain(sample.split("\n")[0]);
    });
  });

  it("parses bullet lists and nested bullets", () => {
    const result = parseMachinaText("- Build rows\n- Resolve rectangles\n  - Preserve order\n  - Apply z\n- Render views");
    expect(result.document.blocks).toHaveLength(1);
    const block = result.document.blocks[0];
    expect(block.kind).toBe("bulletList");
    if (block.kind === "bulletList") {
      expect(block.items).toHaveLength(3);
      expect(block.items[1].children).toHaveLength(2);
    }
  });

  it("diagnoses max list depth", () => {
    const result = parseMachinaText("- Top\n  - Nested\n    - Too deep");
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "max_list_depth_exceeded")).toBe(true);
    expect(collectText(result)).toContain("Too deep");
  });

  it("diagnoses malformed links", () => {
    const a = parseMachinaText("Read [docs](https://example.com");
    const b = parseMachinaText("Read [](https://example.com)");
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    expect(a.diagnostics.some((d) => d.code === "malformed_link")).toBe(true);
    expect(b.diagnostics.some((d) => d.code === "malformed_link")).toBe(true);
  });

  it("diagnoses unclosed inline markers", () => {
    ["Hello **bold", "Hello *em", "Hello `code"].forEach((sample) => {
      const result = parseMachinaText(sample);
      expect(result.ok).toBe(false);
      expect(result.diagnostics.some((d) => d.code === "unclosed_inline")).toBe(true);
      expect(collectText(result)).toContain(sample);
    });
  });

  it("includes diagnostic location", () => {
    const result = parseMachinaText("Line one\n# Bad heading");
    const d = result.diagnostics.find((x) => x.code === "heading_forbidden");
    expect(d?.line).toBe(2);
    expect(d?.column).toBe(1);
    expect(d?.index).toBe("Line one\n".length);
  });
});
