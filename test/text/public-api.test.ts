import { describe, expect, it } from "vitest";
import { parseMachinaText } from "../../src";
import type { MachinaInline, MachinaTextDocument, MachinaTextSource, MachinaTextSpec } from "../../src";

describe("text public API", () => {
  it("exports key MachinaText types and parser", () => {
    const source: MachinaTextSource = { kind: "plain", text: "Hello" };
    const inline: MachinaInline = { kind: "text", text: "x" };
    const document: MachinaTextDocument = { blocks: [{ kind: "paragraph", inline: [inline] }] };
    const spec: MachinaTextSpec = { kind: "text", source };
    const result = parseMachinaText(source);

    expect(document.blocks[0].kind).toBe("paragraph");
    expect(spec.kind).toBe("text");
    expect(result.document.blocks.length).toBe(1);
  });
});
