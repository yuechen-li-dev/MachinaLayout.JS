import { describe, expect, it } from "vitest";
import { text } from "../../src/machina";

const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
    throw new Error("expected throw");
  } catch (error) {
    expect((error as { code?: string }).code).toBe(code);
  }
};

describe("machina text", () => {
  it("creates machina, plain, and mono specs", () => {
    expect(text("Hello **world**", { wrap: "word" })).toEqual({
      kind: "text",
      source: { kind: "machina-text", text: "Hello **world**" },
      wrap: "word",
    });
    expect(text.plain("Plain").source).toEqual({ kind: "plain", text: "Plain" });
    expect(text.mono("const x = 1;").variant).toBe("mono");
    expect(text.mono("x", { variant: "label" }).variant).toBe("label");
  });

  it("validates content and gaps and returns fresh objects", () => {
    expectCode(() => text(1 as any), "InvalidTextSpec");
    expectCode(() => text("x", { blockGap: Number.NaN }), "InvalidTextSpec");
    expectCode(() => text("x", { listGap: Infinity }), "InvalidTextSpec");
    expect(text("x")).not.toBe(text("x"));
  });
});
