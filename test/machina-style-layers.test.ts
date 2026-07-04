import { describe, expect, it } from "vitest";
import {
  S,
  serializeMachinaStyleSheet,
  validateMachinaStyleLayer,
  validateMachinaStyleSheet,
  type MachinaStyleLayer,
  type MachinaStyleRecord,
} from "../src/style";

function containsSlot(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  if ("kind" in value) {
    const kind = (value as { kind?: unknown }).kind;
    if (kind === "set" || kind === "inherit" || kind === "unset") {
      return true;
    }
  }
  return Object.values(value).some((nestedValue) => containsSlot(nestedValue));
}

describe("MachinaStyle slot helpers", () => {
  it("creates fresh set, inherit, and unset slots", () => {
    const first = S.set("color.primary");
    const second = S.set("color.primary");

    expect(first).toEqual({ kind: "set", value: "color.primary" });
    expect(second).toEqual({ kind: "set", value: "color.primary" });
    expect(first).not.toBe(second);
    expect(S.inherit()).toEqual({ kind: "inherit" });
    expect(S.unset()).toEqual({ kind: "unset" });
  });

  it("rejects undefined and null set values at runtime", () => {
    expect(() => S.set(undefined)).toThrow(/undefined/);
    expect(() => S.set(null)).toThrow(/defined/);
  });
});

describe("MachinaStyle layers", () => {
  it("accepts plain values and explicit slots without mutating input", () => {
    const input: MachinaStyleLayer = {
      surface: {
        fill: "color.primary",
        radius: S.set("radius.md"),
        opacity: S.inherit(),
      },
      border: {
        color: S.unset(),
      },
    };

    const layer = S.layer(input);

    expect(layer).toEqual({
      surface: {
        fill: { kind: "set", value: "color.primary" },
        radius: { kind: "set", value: "radius.md" },
        opacity: { kind: "inherit" },
      },
      border: {
        color: { kind: "unset" },
      },
    });
    expect(layer).not.toBe(input);
    expect(layer.surface).not.toBe(input.surface);
    expect(input.surface?.fill).toBe("color.primary");
  });

  it("validates malformed layer slots and existing numeric rules", () => {
    const diagnostics = validateMachinaStyleLayer({
      surface: {
        fill: { kind: "unknown" } as never,
        radius: S.set(-1),
        opacity: S.set(2),
      },
      border: {
        width: S.set(-1),
      },
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "InvalidOpacity",
      "NegativeRadius",
      "NegativeBorderWidth",
      "InvalidStyleSlot",
    ]);
  });
});

describe("MachinaStyle layer composition", () => {
  const base = S.style({
    box: {
      paddingX: "space.md",
      paddingY: "space.sm",
    },
    surface: {
      fill: "color.panel",
      radius: "radius.md",
      opacity: 0.8,
    },
    text: {
      color: "color.text",
      weight: "normal",
    },
    border: {
      color: "color.border",
      width: 1,
    },
  });

  it("overlays plain values, set slots, missing fields, inherit slots, and unset slots", () => {
    const top = S.layer({
      surface: {
        fill: "color.primary",
        radius: S.inherit(),
        opacity: S.unset(),
      },
      text: {
        weight: S.set("semibold"),
      },
      border: {
        color: "color.primary",
      },
    });

    expect(S.over(top, base)).toEqual({
      box: {
        paddingX: "space.md",
        paddingY: "space.sm",
      },
      surface: {
        fill: "color.primary",
        radius: "radius.md",
      },
      text: {
        color: "color.text",
        weight: "semibold",
      },
      border: {
        color: "color.primary",
        width: 1,
      },
    });
  });

  it("handles empty base, empty top, single layer, and zero-layer composition", () => {
    expect(S.over({ surface: { fill: "color.primary" } }, {})).toEqual({
      surface: { fill: "color.primary" },
    });
    expect(S.over({}, base)).toEqual(base);
    expect(S.compose()).toEqual({});
    expect(S.compose(S.layer({ surface: { fill: S.set("color.primary") } }))).toEqual({
      surface: { fill: "color.primary" },
    });
  });

  it("composes later layers over earlier layers without mutating inputs", () => {
    const variant = S.layer({
      surface: { fill: "color.primary" },
      text: { color: "color.onPrimary" },
    });
    const state = S.layer({
      border: { color: "color.focus" },
    });
    const local = S.layer({
      surface: { fill: S.unset() },
      text: { weight: "bold" },
    });
    const baseBefore = structuredClone(base);
    const variantBefore = structuredClone(variant);

    const composed = S.compose(base, variant, state, local);

    expect(composed).toEqual({
      box: {
        paddingX: "space.md",
        paddingY: "space.sm",
      },
      surface: {
        radius: "radius.md",
        opacity: 0.8,
      },
      text: {
        color: "color.onPrimary",
        weight: "bold",
      },
      border: {
        color: "color.focus",
        width: 1,
      },
    });
    expect(containsSlot(composed)).toBe(false);
    expect(base).toEqual(baseBefore);
    expect(variant).toEqual(variantBefore);
  });
});

describe("MachinaStyle unresolved slot validation and serialization", () => {
  it("diagnoses unresolved slots in concrete sheets", () => {
    const sheet = {
      classes: {
        button: {
          surface: {
            fill: S.unset(),
          },
        } as unknown as MachinaStyleRecord,
      },
    };

    const diagnostics = validateMachinaStyleSheet(sheet);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["UnresolvedStyleSlot"]);
    expect(diagnostics[0]?.path).toBe("classes.button.surface.fill");
  });

  it("throws a stable serializer error for unresolved slots", () => {
    const sheet = {
      classes: {
        button: {
          surface: {
            fill: S.unset(),
          },
        } as unknown as MachinaStyleRecord,
      },
    };

    expect(() => serializeMachinaStyleSheet(sheet)).toThrow(
      "Cannot serialize unresolved MachinaStyleSlot at classes.button.surface.fill. Call S.compose/S.over first.",
    );
  });

  it("serializes composed styles and lowers token refs correctly", () => {
    const tokens = S.tokens({
      color: {
        onPrimary: "#fff",
        primary: "#7c5cff",
        text: "#111",
      },
      radius: {
        md: 12,
      },
    });
    const baseButton = S.style({
      surface: {
        fill: "color.text",
        radius: "radius.md",
      },
      text: {
        color: "color.text",
      },
    });
    const primaryButton = S.compose(
      baseButton,
      S.layer({
        surface: { fill: "color.primary" },
        text: { color: "color.onPrimary" },
      }),
    );

    expect(validateMachinaStyleSheet({ tokens, classes: { primaryButton } })).toEqual([]);
    expect(
      serializeMachinaStyleSheet({ tokens, classes: { primaryButton } }, { includeHeader: false }),
    ).toContain("background: var(--color-primary);");
  });
});
