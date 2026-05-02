import { describe, expect, it } from "vitest";
import { parseMachinaText } from "../../src";
import type { MachinaInline, MachinaTextDocument, MachinaTextLeading, MachinaTextSource, MachinaTextSpec, MachinaTextVerticalAlign } from "../../src";

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
  it("exports leading and vertical align types", () => {
    const leading: MachinaTextLeading = "tight";
    const valign: MachinaTextVerticalAlign = "center";
    expect(leading).toBe("tight");
    expect(valign).toBe("center");
  });
});
