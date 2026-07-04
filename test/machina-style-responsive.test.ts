import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MACHINA_RESPONSIVE_PROFILE,
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

describe("MachinaStyle responsive authoring", () => {
  const tokens = S.tokens({
    color: { text: "#18202c" },
    font: {
      body: {
        family: "Inter, system-ui, sans-serif",
        size: 16,
        lineHeight: 1.5,
        weight: "normal",
      },
      display: {
        family: "Inter, system-ui, sans-serif",
        size: 42,
        lineHeight: 1.1,
        weight: "bold",
      },
    },
    space: { md: 16, xl: 32 },
  });

  const heroBase = S.style({
    box: { paddingX: S.token("space", "md") },
    text: { color: S.token("color", "text"), font: S.token("font", "body") },
  });

  const desktopLayerInput: MachinaStyleLayer = {
    box: { paddingX: S.token("space", "xl") },
    text: { font: S.token("font", "display") },
  };

  it("creates fresh responsive styles without mutating input", () => {
    const input = {
      base: heroBase,
      variants: {
        desktop: desktopLayerInput,
      },
      description: "Hero layout modes",
    };

    const responsive = S.responsive("hero", input);

    expect(responsive).toEqual({
      className: "hero",
      base: heroBase,
      variants: {
        desktop: S.layer(desktopLayerInput),
      },
      description: "Hero layout modes",
    });
    expect(responsive).not.toBe(input);
    expect(responsive.base).not.toBe(heroBase);
    expect(responsive.variants).not.toBe(input.variants);
    expect(responsive.variants.desktop).not.toBe(desktopLayerInput);
    expect(desktopLayerInput).toEqual({
      box: { paddingX: { kind: "token", group: "space", key: "xl" } },
      text: { font: { kind: "token", group: "font", key: "display" } },
    });
  });

  it("resolves one or all responsive variants against base", () => {
    const responsive = S.responsive("hero", {
      base: heroBase,
      variants: {
        desktop: S.layer({
          box: { paddingX: S.token("space", "xl") },
          text: { font: S.token("font", "display") },
        }),
        phone: S.layer({
          text: { color: S.inherit() },
        }),
      },
    });

    expect(S.resolveResponsive(responsive, "desktop")).toEqual({
      box: { paddingX: S.token("space", "xl") },
      text: { color: S.token("color", "text"), font: S.token("font", "display") },
    });
    expect(S.resolveResponsive(responsive, "tablet")).toEqual(heroBase);
    expect(S.resolveResponsiveVariants(responsive)).toEqual({
      desktop: {
        box: { paddingX: S.token("space", "xl") },
        text: { color: S.token("color", "text"), font: S.token("font", "display") },
      },
      tablet: heroBase,
      phone: heroBase,
    });
  });

  it("lowers responsive styles to deterministic fixed media queries", () => {
    const sheet = S.sheet({
      tokens,
      classes: {
        page: S.style({}),
      },
      responsive: {
        hero: S.responsive("hero", {
          base: heroBase,
          variants: {
            desktop: S.layer({
              box: { paddingX: S.token("space", "xl") },
              text: { font: S.token("font", "display") },
            }),
            tablet: S.layer({
              box: { paddingX: S.token("space", "md") },
            }),
            phone: S.layer({
              box: { paddingX: 10 },
            }),
          },
        }),
      },
    });

    const css = serializeMachinaStyleSheet(sheet, { includeHeader: false });
    const second = serializeMachinaStyleSheet(
      S.sheet({
        tokens,
        classes: { page: S.style({}) },
        responsive: {
          hero: S.responsive("hero", {
            base: heroBase,
            variants: {
              phone: S.layer({ box: { paddingX: 10 } }),
              tablet: S.layer({ box: { paddingX: S.token("space", "md") } }),
              desktop: S.layer({
                box: { paddingX: S.token("space", "xl") },
                text: { font: S.token("font", "display") },
              }),
            },
          }),
        },
      }),
      { includeHeader: false },
    );

    expect(DEFAULT_MACHINA_RESPONSIVE_PROFILE.desktopMinWidth).toBe(1024);
    expect(css).toBe(second);
    expect(css).toContain(".hero {");
    expect(css).toContain("@media (min-width: 1024px) {");
    expect(css).toContain("@media (min-width: 640px) and (max-width: 1023px) {");
    expect(css).toContain("@media (max-width: 639px) {");
    expect(css).toContain("padding-left: var(--space-xl);");
    expect(css).toContain("font-family: var(--font-display-family);");
    expect(css).toContain("font-size: var(--font-display-size);");
    expect(css).not.toContain("matchMedia");
    expect(css).not.toContain("@container");
    expect(css).not.toContain(":hover");
  });

  it("emits only responsive variant declarations inside media blocks", () => {
    const css = serializeMachinaStyleSheet(
      S.sheet({
        tokens,
        classes: {},
        responsive: {
          hero: S.responsive("hero", {
            base: heroBase,
            variants: {
              desktop: S.layer({
                box: { paddingX: S.token("space", "xl") },
              }),
            },
          }),
        },
      }),
      { includeHeader: false },
    );
    const mediaStart = css.indexOf("@media (min-width: 1024px)");
    const mediaBlock = css.slice(mediaStart);

    expect(mediaBlock).toContain("padding-left: var(--space-xl);");
    expect(mediaBlock).not.toContain("color: var(--color-text);");
  });

  it("includes responsive keys in S.classes and throws on duplicate keys", () => {
    const sheet = S.sheet({
      classes: { page: S.style({}) },
      responsive: {
        hero: S.responsive("heroClass", {
          base: heroBase,
          variants: {},
        }),
      },
    });

    expect(S.classes(sheet)).toEqual({ page: "page", hero: "heroClass" });
    expect(() =>
      S.classes({
        classes: { hero: S.style({}) },
        responsive: {
          hero: S.responsive("heroClass", {
            base: heroBase,
            variants: {},
          }),
        },
      }),
    ).toThrow(/Duplicate MachinaStyle class key "hero"/);
  });
});

describe("MachinaStyle responsive validation", () => {
  it("reports invalid variants, duplicate keys, unsupported unsets, invalid class names, and unknown tokens", () => {
    const diagnostics = validateMachinaStyleSheet({
      tokens: {
        color: { text: "#18202c" },
        space: { md: 16 },
      },
      classes: {
        hero: S.style({}),
      },
      stateful: {
        button: S.stateful("button", {
          base: S.style({}),
          states: {},
        }),
      },
      responsive: {
        hero: {
          className: "bad class",
          base: S.style({
            surface: { fill: S.set(S.token("color", "text")) as never },
          }),
          variants: {
            desktop: S.layer({
              box: { paddingX: S.unset() },
            }),
            sideways: S.layer({
              surface: { fill: S.token("color", "missing") },
            }),
          },
        },
        button: S.responsive("responsiveButton", {
          base: S.style({}),
          variants: {},
        }),
      } as never,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "DuplicateClassKey",
      "InvalidClassName",
      "UnresolvedStyleSlot",
      "UnsupportedResponsiveUnset",
      "InvalidResponsiveVariant",
      "UnknownTokenReference",
      "DuplicateClassKey",
    ]);
  });

  it("accepts a valid responsive sheet", () => {
    const diagnostics = validateMachinaStyleSheet({
      tokens: {
        color: { text: "#18202c" },
        space: { md: 16 },
      },
      classes: {},
      responsive: {
        hero: S.responsive("hero", {
          base: S.style({ text: { color: S.token("color", "text") } }),
          variants: {
            phone: S.layer({ box: { paddingX: S.token("space", "md") } }),
          },
        }),
      },
    });

    expect(diagnostics).toEqual([]);
  });
});

describe("MachinaStyle responsive dogfood", () => {
  it("keeps generated CSS in sync and contains fixed responsive media queries", () => {
    const generatedCss = readFileSync(generatedCssPath, "utf8");

    expect(generatedCss).toBe(dogfoodArtifact.css);
    expect(generatedCss).toBe(serializeMachinaStyleSheet(dogfoodSheet));
    expect(generatedCss).toContain(".responsiveHero {");
    expect(generatedCss).toContain("@media (min-width: 1024px) {");
    expect(generatedCss).toContain("@media (min-width: 640px) and (max-width: 1023px) {");
    expect(generatedCss).toContain("@media (max-width: 639px) {");
  });
});
