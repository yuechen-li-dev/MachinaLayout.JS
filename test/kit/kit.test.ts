import { describe, expect, it } from "vitest";
import { invariant, MachinaInvariantError, must, withDefaults } from "../../src/kit";
import { Text } from "../../src/text";

describe("withDefaults", () => {
  type Options = { readonly concept?: string; readonly label?: string; readonly id?: string };

  it("fills defaults and is not clobbered by explicit undefined", () => {
    const options: Options = { label: undefined, concept: "name" };
    expect({ ...{ concept: "concept", label: "label" }, ...options }.label).toBeUndefined(); // the bug
    expect(withDefaults(options, { concept: "concept", label: "label" })).toEqual({
      concept: "name",
      label: "label",
    });
    expect(withDefaults(undefined, { concept: "concept" })).toEqual({ concept: "concept" });
  });

  it("returns only defaulted keys, fully required and widened", () => {
    const columns = withDefaults({ id: "x" } as Options, { concept: "concept" });
    const concept: string = columns.concept;
    expect(concept).toBe("concept");
    // @ts-expect-error — `id` has no default, read it from options directly
    void columns.id;
  });

  it("rejects option values of the wrong type", () => {
    // @ts-expect-error — count is a number
    withDefaults({ count: "3" }, { count: 1 });
    expect(true).toBe(true);
  });
});

describe("must / invariant", () => {
  it("narrows and throws with a code", () => {
    const found = [1, 2, 3].find((n) => n === 2);
    const two: number = must(found, "missing 2");
    expect(two).toBe(2);
    expect(() => must(undefined, () => "lazy message", "NoValue")).toThrow(
      expect.objectContaining({ code: "NoValue", message: "lazy message" }),
    );
    expect(must(0, "zero is a value")).toBe(0);
  });

  it("invariant narrows like an if", () => {
    const value: string | number = "x" as string | number;
    invariant(typeof value === "string", "expected string");
    const s: string = value;
    expect(s).toBe("x");
    expect(() => invariant([].length > 0, "empty", "EmptyRows")).toThrow(MachinaInvariantError);
  });
});

describe("Text.lines / list / block", () => {
  it("skips omitted parts and keeps intentional blanks", () => {
    const description = "";
    expect(
      Text.lines(
        "Title",
        description && `Description: ${description}`,
        false,
        undefined,
        Text.blank,
        ["a", ["b"]],
      ),
    ).toBe("Title\n\na\nb");
  });

  it("renders lists with empty fallbacks", () => {
    expect(Text.lines(Text.list("Keys:", ["a", "b"]))).toBe("Keys:\n- a\n- b");
    expect(Text.lines(Text.list("Keys:", [], { empty: "Keys: none" }))).toBe("Keys: none");
    expect(Text.lines("x", Text.list("Keys:", []))).toBe("x");
    expect(Text.lines(Text.list("Items:", ["one\ntwo"]))).toBe("Items:\n- one\n  two");
  });

  it("indents blocks, including multi-line bodies", () => {
    expect(Text.lines(Text.block("Requires:", "Concept: A\nFields: none"))).toBe(
      "Requires:\n  Concept: A\n  Fields: none",
    );
  });
});
