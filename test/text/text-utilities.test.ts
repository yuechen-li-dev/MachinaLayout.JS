import { describe, expect, it } from "vitest";
import {
  camel,
  centerPad,
  kebab,
  leftPad,
  pascal,
  rightPad,
  slug,
  Text,
  TextFormatError,
  truncate,
} from "../../src/text";

describe("text utilities", () => {
  describe("padding", () => {
    it("leftPad pads spaces", () => {
      expect(leftPad("7", 3)).toBe("  7");
    });

    it("leftPad pads zero", () => {
      expect(leftPad("7", 3, "0")).toBe("007");
    });

    it("leftPad returns original if already long enough", () => {
      expect(leftPad("abc", 2)).toBe("abc");
    });

    it("leftPad supports multi-char fill", () => {
      expect(leftPad("x", 5, "ab")).toBe("ababx");
    });

    it("leftPad slices fill to exact length", () => {
      expect(leftPad("x", 4, "abc")).toBe("abcx");
    });

    it("leftPad rejects empty fill", () => {
      expect(() => leftPad("x", 3, "")).toThrow(TextFormatError);
      expect(() => leftPad("x", 3, "")).toThrow("Text pad fill must not be empty.");
      try {
        leftPad("x", 3, "");
      } catch (error) {
        expect(error).toBeInstanceOf(TextFormatError);
        expect((error as TextFormatError).code).toBe("InvalidTextFill");
      }
    });

    it("leftPad rejects invalid length", () => {
      expect(() => leftPad("x", Number.POSITIVE_INFINITY)).toThrow(TextFormatError);
      expect(() => leftPad("x", 1.5)).toThrow(TextFormatError);
      try {
        leftPad("x", -1);
      } catch (error) {
        expect(error).toBeInstanceOf(TextFormatError);
        expect((error as TextFormatError).code).toBe("InvalidTextLength");
      }
    });

    it("rightPad supports spaces, zeros, originals, multi-char fill, and slicing", () => {
      expect(rightPad("7", 3)).toBe("7  ");
      expect(rightPad("7", 3, "0")).toBe("700");
      expect(rightPad("abc", 2)).toBe("abc");
      expect(rightPad("x", 5, "ab")).toBe("xabab");
      expect(rightPad("x", 4, "abc")).toBe("xabc");
    });

    it("centerPad pads evenly", () => {
      expect(centerPad("x", 5)).toBe("  x  ");
    });

    it("centerPad puts odd extra padding on the right", () => {
      expect(centerPad("x", 4)).toBe(" x  ");
    });
  });

  describe("truncate", () => {
    it("returns original if short enough", () => {
      expect(truncate("abc", { maxLength: 5 })).toBe("abc");
    });

    it("uses default ellipsis", () => {
      expect(truncate("abcdef", { maxLength: 4 })).toBe("abc…");
    });

    it("uses custom ellipsis", () => {
      expect(truncate("abcdef", { maxLength: 4, ellipsis: "..." })).toBe("a...");
    });

    it("handles ellipsis longer than or equal to maxLength", () => {
      expect(truncate("abcdef", { maxLength: 3, ellipsis: "..." })).toBe("...");
      expect(truncate("abcdef", { maxLength: 2, ellipsis: "..." })).toBe("..");
    });

    it("rejects invalid maxLength", () => {
      expect(() => truncate("abc", { maxLength: 0 })).toThrow(TextFormatError);
      expect(() => truncate("abc", { maxLength: 1.5 })).toThrow(TextFormatError);
      try {
        truncate("abc", { maxLength: Number.NaN });
      } catch (error) {
        expect(error).toBeInstanceOf(TextFormatError);
        expect((error as TextFormatError).code).toBe("InvalidTruncateLength");
      }
    });
  });

  describe("case and slug", () => {
    it("kebab handles camelCase", () => {
      expect(kebab("buttonPrimary")).toBe("button-primary");
    });

    it("kebab handles PascalCase", () => {
      expect(kebab("ButtonPrimary")).toBe("button-primary");
    });

    it("kebab handles spaces and underscores", () => {
      expect(kebab("Button Primary")).toBe("button-primary");
      expect(kebab("button_primary")).toBe("button-primary");
    });

    it("kebab collapses repeated separators", () => {
      expect(kebab(" button--primary ")).toBe("button-primary");
    });

    it("pascal converts kebab and space separated values", () => {
      expect(pascal("button-primary")).toBe("ButtonPrimary");
      expect(pascal("button primary")).toBe("ButtonPrimary");
    });

    it("camel converts kebab and space separated values", () => {
      expect(camel("button-primary")).toBe("buttonPrimary");
      expect(camel("Button Primary")).toBe("buttonPrimary");
    });

    it("slug removes punctuation", () => {
      expect(slug("Hello, Machina!")).toBe("hello-machina");
    });

    it("slug collapses separators", () => {
      expect(slug("A/B Test #42")).toBe("a-b-test-42");
    });

    it("slug trims separators", () => {
      expect(slug("  A/B Test #42  ")).toBe("a-b-test-42");
    });
  });

  describe("exports", () => {
    it("named exports work", () => {
      expect(leftPad).toBeTypeOf("function");
      expect(rightPad).toBeTypeOf("function");
      expect(centerPad).toBeTypeOf("function");
      expect(truncate).toBeTypeOf("function");
      expect(kebab).toBeTypeOf("function");
      expect(camel).toBeTypeOf("function");
      expect(pascal).toBeTypeOf("function");
      expect(slug).toBeTypeOf("function");
      expect(TextFormatError).toBeTypeOf("function");
    });

    it("Text.leftPad works", () => {
      expect(Text.leftPad("7", 3, "0")).toBe("007");
    });
  });
});
