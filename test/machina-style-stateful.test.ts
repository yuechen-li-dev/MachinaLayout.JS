import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  S,
  serializeMachinaStyleSheet,
  validateMachinaStyleSheet,
  type MachinaStyleLayer,
} from "../src/style";
import {
  artifact as dogfoodArtifact,
  sheet as dogfoodSheet,
} from "../samples/style-dogfood/src/style";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedCssPath = resolve(repoRoot, "samples/style-dogfood/src/generated.css");

describe("MachinaStyle stateful authoring", () => {
  const baseButton = S.style({
    surface: { fill: S.token("color", "primary"), opacity: 1 },
    text: { color: S.token("color", "onPrimary") },
  });

  const hoverLayerInput: MachinaStyleLayer = {
    surface: { fill: S.token("color", "primaryHover") },
  };

  it("creates fresh stateful styles without mutating input", () => {
    const input = {
      base: baseButton,
      states: {
        hover: hoverLayerInput,
      },
      description: "Button states",
    };

    const stateful = S.stateful("button", input);

    expect(stateful).toEqual({
      className: "button",
      base: baseButton,
      states: {
        hover: S.layer({
          surface: { fill: S.token("color", "primaryHover") },
        }),
      },
      description: "Button states",
    });
    expect(stateful).not.toBe(input);
    expect(stateful.base).not.toBe(baseButton);
    expect(stateful.states).not.toBe(input.states);
    expect(stateful.states.hover).not.toBe(hoverLayerInput);
    expect(hoverLayerInput).toEqual({
      surface: { fill: { kind: "token", group: "color", key: "primaryHover" } },
    });
  });

  it("resolves a named state by composing base and layer", () => {
    const button = S.stateful("button", {
      base: baseButton,
      states: {
        hover: S.layer({
          surface: { fill: S.token("color", "primaryHover") },
          text: { color: S.inherit() },
        }),
      },
    });

    expect(S.resolveState(button, "hover")).toEqual({
      surface: { fill: S.token("color", "primaryHover"), opacity: 1 },
      text: { color: S.token("color", "onPrimary") },
    });
  });

  it("throws a stable error for unknown states", () => {
    const button = S.stateful("button", {
      base: baseButton,
      states: {
        hover: S.layer({
          surface: { fill: S.token("color", "primaryHover") },
        }),
      },
    });

    expect(() => S.resolveState(button, "pressed")).toThrow(
      'Unknown MachinaStyle state "pressed" for class "button".',
    );
  });

  it("resolves all states deterministically", () => {
    const button = S.stateful("button", {
      base: baseButton,
      states: {
        pressed: S.layer({
          surface: { fill: S.token("color", "primaryPressed") },
        }),
        hover: S.layer({
          surface: { fill: S.token("color", "primaryHover") },
        }),
      },
    });

    expect(S.resolveStates(button)).toEqual({
      hover: {
        surface: { fill: S.token("color", "primaryHover"), opacity: 1 },
        text: { color: S.token("color", "onPrimary") },
      },
      pressed: {
        surface: { fill: S.token("color", "primaryPressed"), opacity: 1 },
        text: { color: S.token("color", "onPrimary") },
      },
    });
  });

  it("joins validated runtime states with S.dataState", () => {
    expect(S.dataState("hover", "pressed", "hover")).toBe("hover pressed");
    expect(() => S.dataState("bad state")).toThrow(/state name/);
  });
});

describe("MachinaStyle stateful serialization and validation", () => {
  const sheet = S.sheet({
    tokens: S.tokens({
      color: {
        onPrimary: "#ffffff",
        primary: "#2457d6",
        primaryHover: "#2f64ea",
        primaryPressed: "#183ea0",
        textDisabled: "#7d8592",
      },
    }),
    classes: {
      page: S.style({
        surface: { fill: "#ffffff" },
      }),
    },
    stateful: {
      button: S.stateful("button", {
        base: S.style({
          surface: { fill: S.token("color", "primary") },
          text: { color: S.token("color", "onPrimary") },
        }),
        states: {
          hover: S.layer({
            surface: { fill: S.token("color", "primaryHover") },
          }),
          pressed: S.layer({
            surface: { fill: S.token("color", "primaryPressed") },
          }),
          disabled: S.layer({
            surface: { opacity: 0.48 },
            text: { color: S.token("color", "textDisabled") },
          }),
        },
      }),
    },
  });

  it("lowers stateful base classes and data-state selectors without pseudo selectors", () => {
    const css = serializeMachinaStyleSheet(sheet, { includeHeader: false });

    expect(css).toContain(".button {");
    expect(css).toContain('.button[data-state~="hover"] {');
    expect(css).toContain('.button[data-state~="pressed"] {');
    expect(css).toContain('.button[data-state~="disabled"] {');
    expect(css).not.toContain(":hover");
    expect(css).not.toContain(":active");
    expect(css).not.toContain(":disabled");
    expect(css).toContain("background: var(--color-primary-hover);");
    expect(css).toContain("background: var(--color-primary-pressed);");
    expect(css).toContain("opacity: 0.48;");
    expect(css).toContain("color: var(--color-text-disabled);");
  });

  it("emits only state layer declarations in state selectors", () => {
    const css = serializeMachinaStyleSheet(sheet, { includeHeader: false });
    const hoverStart = css.indexOf('.button[data-state~="hover"] {');
    const hoverEnd = css.indexOf("}", hoverStart);
    const hoverBlock = css.slice(hoverStart, hoverEnd);

    expect(hoverBlock).toContain("background: var(--color-primary-hover);");
    expect(hoverBlock).not.toContain("color: var(--color-on-primary);");
  });

  it("keeps stateful output deterministic", () => {
    const first = serializeMachinaStyleSheet(sheet);
    const second = serializeMachinaStyleSheet(
      S.sheet({
        tokens: sheet.tokens,
        classes: {
          page: sheet.classes.page,
        },
        stateful: {
          button: S.stateful("button", {
            base: sheet.stateful!.button.base,
            states: {
              disabled: sheet.stateful!.button.states.disabled,
              hover: sheet.stateful!.button.states.hover,
              pressed: sheet.stateful!.button.states.pressed,
            },
          }),
        },
      }),
    );

    expect(first).toBe(second);
  });

  it("validates state names, duplicate class keys, unresolved base slots, unknown tokens, and unsupported state unsets", () => {
    const diagnostics = validateMachinaStyleSheet({
      tokens: {
        color: { primary: "#2457d6" },
      },
      classes: {
        button: {},
      },
      stateful: {
        button: {
          className: "bad class",
          base: {
            surface: { fill: S.set(S.token("color", "primary")) as never },
          },
          states: {
            "bad state": S.layer({
              surface: { fill: S.token("color", "missing") },
            }),
            hover: S.layer({
              surface: { fill: S.unset() },
            }),
          },
        },
      },
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "DuplicateClassKey",
      "InvalidClassName",
      "UnresolvedStyleSlot",
      "InvalidStateName",
      "UnknownTokenReference",
      "UnsupportedStateUnset",
    ]);
  });

  it("includes stateful class keys in S.classes and throws on duplicates", () => {
    const classes = S.classes(sheet);

    expect(classes.page).toBe("page");
    expect(classes.button).toBe("button");
    expect(() =>
      S.classes({
        classes: { button: S.style({}) },
        stateful: {
          button: S.stateful("statefulButton", {
            base: S.style({}),
            states: {},
          }),
        },
      }),
    ).toThrow(/Duplicate MachinaStyle class key "button"/);
  });
});

describe("MachinaStyle stateful dogfood", () => {
  it("keeps the generated dogfood CSS in sync and contains data-state selectors", () => {
    const generatedCss = readFileSync(generatedCssPath, "utf8");

    expect(generatedCss).toBe(dogfoodArtifact.css);
    expect(generatedCss).toBe(serializeMachinaStyleSheet(dogfoodSheet));
    expect(generatedCss).toContain('.statefulButton[data-state~="hover"] {');
    expect(generatedCss).toContain('.statefulButton[data-state~="pressed"] {');
    expect(generatedCss).toContain('.statefulButton[data-state~="disabled"] {');
    expect(generatedCss).not.toContain(":hover");
  });
});
