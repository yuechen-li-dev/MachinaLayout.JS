import { describe, expect, it } from "vitest";
import { MachinaTextView, type MachinaTextViewProps } from "../../../src/index";

describe("MachinaText react public api", () => {
  it("exports MachinaTextView and MachinaTextViewProps", () => {
    expect(MachinaTextView).toBeTypeOf("function");
    const props: MachinaTextViewProps = { text: "Hello" };
    expect(props.text).toBe("Hello");
  });
});
