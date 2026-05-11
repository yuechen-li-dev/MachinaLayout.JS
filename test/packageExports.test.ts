import { describe, expect, it } from "vitest";
import { MachinaReactView } from "../src/react";
import { parseMachinaText } from "../src/text";
import { MachinaTextView } from "../src/text/react";
import { MachinaVueView } from "../src/vue";

describe("package export entrypoints", () => {
  it("exposes react and text barrel exports", () => {
    expect(typeof MachinaReactView).toBe("function");
    expect(typeof parseMachinaText).toBe("function");
    expect(typeof MachinaTextView).toBe("function");
    expect(typeof MachinaVueView).toBe("object");
  });
});
