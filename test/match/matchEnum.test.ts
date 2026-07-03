import { describe, expect, it } from "vitest";
import {
  assertNever,
  enumTable,
  type EnumCaseMap,
  matchEnum,
  MatchEnumError,
} from "../../src/match";

type Mode = "collapsed" | "nonInteractiveOverlay" | "interactivePanel";

describe("matchEnum", () => {
  it("calls the matching handler and returns its result", () => {
    const calls: string[] = [];
    const result = matchEnum<Mode, string>("interactivePanel", {
      collapsed: () => {
        calls.push("collapsed");
        return "Collapsed";
      },
      nonInteractiveOverlay: () => {
        calls.push("nonInteractiveOverlay");
        return "Overlay";
      },
      interactivePanel: () => {
        calls.push("interactivePanel");
        return "Panel";
      },
    });

    expect(result).toBe("Panel");
    expect(calls).toEqual(["interactivePanel"]);
  });

  it("supports number-like enum keys", () => {
    type Step = 0 | 1 | 2;

    expect(
      matchEnum<Step, string>(1, {
        0: () => "zero",
        1: () => "one",
        2: () => "two",
      }),
    ).toBe("one");
  });

  it("throws a typed error for a missing runtime case", () => {
    const cases = {
      collapsed: () => "Collapsed",
    } as unknown as EnumCaseMap<Mode, string>;

    expect(() => matchEnum<Mode, string>("interactivePanel", cases)).toThrow(MatchEnumError);
    try {
      matchEnum<Mode, string>("interactivePanel", cases);
    } catch (error) {
      expect(error).toBeInstanceOf(MatchEnumError);
      expect((error as MatchEnumError).code).toBe("MissingEnumCase");
    }
  });

  it("does not swallow handler errors", () => {
    const failure = new Error("handler failed");

    expect(() =>
      matchEnum<Mode, string>("collapsed", {
        collapsed: () => {
          throw failure;
        },
        nonInteractiveOverlay: () => "Overlay",
        interactivePanel: () => "Panel",
      }),
    ).toThrow(failure);
  });

  it("compiles exhaustive usage and rejects missing cases at typecheck time", () => {
    const mode: Mode = "collapsed";
    const label = matchEnum<Mode, string>(mode, {
      collapsed: () => "Collapsed",
      nonInteractiveOverlay: () => "Overlay",
      interactivePanel: () => "Panel",
    });
    const labels = enumTable<Mode, string>({
      collapsed: "Collapsed",
      nonInteractiveOverlay: "Overlay",
      interactivePanel: "Panel",
    });

    // @ts-expect-error Missing interactivePanel is intentionally non-exhaustive.
    const missingCases: EnumCaseMap<Mode, string> = {
      collapsed: () => "Collapsed",
      nonInteractiveOverlay: () => "Overlay",
    };

    expect(label).toBe("Collapsed");
    expect(labels[mode]).toBe("Collapsed");
    void missingCases;
  });
});

describe("enumTable", () => {
  it("returns table values accessible by enum key", () => {
    const behaviorByMode = enumTable<Mode, { visible: boolean; pointerEvents: "none" | "auto" }>({
      collapsed: { visible: false, pointerEvents: "none" },
      nonInteractiveOverlay: { visible: true, pointerEvents: "none" },
      interactivePanel: { visible: true, pointerEvents: "auto" },
    });

    expect(behaviorByMode.interactivePanel.pointerEvents).toBe("auto");
  });

  it("returns a shallow copy without mutating input", () => {
    const input = {
      collapsed: "Collapsed",
      nonInteractiveOverlay: "Overlay",
      interactivePanel: "Panel",
    } satisfies Record<Mode, string>;

    const output = enumTable<Mode, string>(input);
    input.collapsed = "Changed";

    expect(output).not.toBe(input);
    expect(output.collapsed).toBe("Collapsed");
  });
});

describe("assertNever", () => {
  it("throws with a default message", () => {
    expect(() => assertNever("unexpected" as never)).toThrow(
      "Unexpected value reached assertNever.",
    );
  });

  it("throws with a custom message", () => {
    expect(() => assertNever("unexpected" as never, "Unhandled mode.")).toThrow("Unhandled mode.");
  });
});

describe("match subpath smoke", () => {
  it("exposes match helpers from the match barrel", () => {
    expect(matchEnum).toBeTypeOf("function");
    expect(enumTable).toBeTypeOf("function");
    expect(assertNever).toBeTypeOf("function");
    expect(MatchEnumError).toBeTypeOf("function");
  });
});
