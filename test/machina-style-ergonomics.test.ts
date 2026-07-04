import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertMachinaStyleArtifactText,
  createMachinaClassNames,
  createMachinaStyleArtifact,
  S,
  serializeMachinaStyleSheet,
  validateMachinaStyleSheet,
} from "../src/style";
import {
  artifact as dogfoodArtifact,
  classes as dogfoodClasses,
  sheet as dogfoodSheet,
} from "../samples/style-dogfood/src/style";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("MachinaStyle ergonomics", () => {
  it("creates token reference objects with S.token", () => {
    expect(S.token("color", "primary")).toEqual({
      kind: "token",
      group: "color",
      key: "primary",
    });
  });

  it("lowers token object refs to CSS variables and keeps string refs working", () => {
    const sheet = S.sheet({
      tokens: S.tokens({
        color: { primary: "#2457d6" },
        space: { md: 14 },
      }),
      classes: {
        panel: S.style({
          surface: { fill: S.token("color", "primary") },
          box: { paddingX: "space.md" },
        }),
      },
    });

    const css = serializeMachinaStyleSheet(sheet, { includeHeader: false });

    expect(css).toContain("background: var(--color-primary);");
    expect(css).toContain("padding-left: var(--space-md);");
  });

  it("validates token object refs, missing keys, empty keys, and invalid font groups", () => {
    const sheet = S.sheet({
      tokens: S.tokens({
        color: { primary: "#2457d6" },
      }),
      classes: {
        bad: S.style({
          surface: {
            fill: { kind: "token", group: "color", key: "" },
          },
          text: {
            font: S.token("color", "primary"),
          },
        }),
      },
    });

    const diagnostics = validateMachinaStyleSheet(sheet);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "InvalidTokenReference",
      "InvalidFontTokenReference",
    ]);
  });

  it("reports unknown token object refs clearly", () => {
    const sheet = S.sheet({
      tokens: S.tokens({
        color: { primary: "#2457d6" },
      }),
      classes: {
        bad: S.style({
          surface: {
            fill: S.token("color", "missing"),
          },
        }),
      },
    });

    const diagnostics = validateMachinaStyleSheet(sheet);
    expect(diagnostics[0]?.code).toBe("UnknownTokenReference");
    expect(diagnostics[0]?.message).toContain('group: "color"');
    expect(diagnostics[0]?.message).toContain('key: "missing"');
  });

  it("returns exact class names that align with serialized selectors", () => {
    const sheet = S.sheet({
      classes: {
        buttonPrimary: S.style({
          surface: { fill: "black" },
        }),
      },
    });

    const classes = S.classes(sheet);
    const css = serializeMachinaStyleSheet(sheet, { includeHeader: false });

    expect(classes.buttonPrimary).toBe("buttonPrimary");
    expect(css).toContain(`.${classes.buttonPrimary} {`);
  });

  it("returns fresh immutable-ish class name maps", () => {
    const sheet = S.sheet({
      classes: {
        buttonPrimary: S.style({}),
      },
    });

    const first = S.classes(sheet);
    const second = createMachinaClassNames(sheet);

    expect(first).toEqual({ buttonPrimary: "buttonPrimary" });
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("creates style artifacts with default and custom options", () => {
    const sheet = S.sheet({
      classes: {
        panel: S.style({
          surface: { fill: "black" },
        }),
      },
    });

    const artifact = createMachinaStyleArtifact(sheet);
    const noHeader = createMachinaStyleArtifact(sheet, {
      includeHeader: false,
      path: "sample.css",
    });

    expect(artifact.path).toBe("generated.css");
    expect(artifact.css).toBe(serializeMachinaStyleSheet(sheet));
    expect(noHeader.path).toBe("sample.css");
    expect(noHeader.css.startsWith(".panel")).toBe(true);
  });

  it("asserts artifact text deterministically", () => {
    const artifact = createMachinaStyleArtifact(dogfoodSheet);
    const result = assertMachinaStyleArtifactText(dogfoodSheet, artifact.css);

    expect(result.ok).toBe(true);
    expect(result.expected).toBe(artifact.css);
  });

  it("expands font tokens into multiple declarations and keeps explicit overrides after them", () => {
    const sheet = S.sheet({
      tokens: S.tokens({
        font: {
          ui: {
            family: "Inter, system-ui, sans-serif",
            size: 14,
            lineHeight: 1.45,
            weight: "medium",
            letterSpacing: 0,
          },
        },
      }),
      classes: {
        label: S.style({
          text: {
            font: S.token("font", "ui"),
            size: 16,
            letterSpacing: 1,
          },
        }),
        legacy: S.style({
          text: {
            font: "font.ui",
          },
        }),
      },
    });

    const css = serializeMachinaStyleSheet(sheet, { includeHeader: false });
    const labelStart = css.indexOf(".label {");
    const familyIndex = css.indexOf("font-family: var(--font-ui-family);", labelStart);
    const sizeVarIndex = css.indexOf("font-size: var(--font-ui-size);", labelStart);
    const sizeOverrideIndex = css.indexOf("font-size: 16px;", labelStart);
    const legacyStart = css.indexOf(".legacy {");

    expect(css).toContain("--font-ui-family: Inter, system-ui, sans-serif;");
    expect(css).toContain("--font-ui-letter-spacing: 0px;");
    expect(familyIndex).toBeGreaterThan(labelStart);
    expect(sizeVarIndex).toBeGreaterThan(familyIndex);
    expect(sizeOverrideIndex).toBeGreaterThan(sizeVarIndex);
    expect(css).toContain("letter-spacing: var(--font-ui-letter-spacing);");
    expect(css).toContain("letter-spacing: 1px;");
    expect(css.indexOf("font-family: var(--font-ui-family);", legacyStart)).toBeGreaterThan(
      legacyStart,
    );
  });

  it("keeps the dogfood artifact and class helper in sync", () => {
    const generatedCssPath = resolve(repoRoot, "samples/style-dogfood/src/generated.css");
    const generatedCss = readFileSync(generatedCssPath, "utf8");

    expect(dogfoodArtifact.path).toBe("generated.css");
    expect(dogfoodClasses.buttonPrimary).toBe("buttonPrimary");
    expect(generatedCss).toBe(dogfoodArtifact.css);
    expect(generatedCss).toContain("font-family: var(--font-ui-family);");
    expect(generatedCss).not.toContain("[object Object]");
  });
});
