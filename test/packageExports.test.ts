import { describe, expect, it } from "vitest";
import { parseMachinaText } from "../src/text";
import { summarizeMachinaDom } from "../src/inspect";
import { writeMachinaHandoffBundle } from "../src/handoff";
import { judgeUtility } from "../src/deus";

describe("package export entrypoints", () => {
  it("keeps text barrel framework-neutral", async () => {
    const textCore = await import("../src/text");
    expect(parseMachinaText).toBeTypeOf("function");
    expect("MachinaTextView" in textCore).toBe(false);
    expect("MachinaNativeTextView" in textCore).toBe(false);
    expect("MachinaVueTextView" in textCore).toBe(false);
  });

  it("exposes inspect and handoff subpath utilities", () => {
    expect(summarizeMachinaDom).toBeTypeOf("function");
    expect(writeMachinaHandoffBundle).toBeTypeOf("function");
  });

  it("exposes deus subpath utilities", () => {
    expect(judgeUtility).toBeTypeOf("function");
  });
});
