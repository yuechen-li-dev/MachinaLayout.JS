import { describe, expect, it } from "vitest";
import { Table, TableError } from "../../src/table";
import {
  S,
  serializeMachinaStyleSheet,
  type StyleRuleRecord,
  type StyleTokenRecord,
} from "../../src/style";

function createTokenTable() {
  return Table.defineWithSchema({
    id: "themeTokens",
    schema: S.tokenTableSchema(["light", "dark"] as const),
    columns: {
      token: ["background", "foreground", "primary"],
      light: ["oklch(1 0 0)", "oklch(0.145 0 0)", "oklch(0.205 0 0)"],
      dark: ["oklch(0.145 0 0)", "oklch(0.985 0 0)", "oklch(0.922 0 0)"],
      description: [undefined, "Readable text", undefined],
    },
  });
}

function createRuleTable() {
  return Table.defineWithSchema({
    id: "bookingRules",
    schema: S.ruleTableSchema(),
    columns: {
      selector: [
        ".scheduling-booking-header",
        ".scheduling-booking-header",
        ".scheduling-booking-header.is-mobile",
      ],
      property: ["height", "padding", "padding"],
      value: ["100%", "0 24px", "0 16px"],
      state: [undefined, undefined, "selected"],
      breakpoint: [undefined, "phone", undefined],
      description: [undefined, "Header spacing", "Mobile spacing"],
    },
  });
}

describe("tabular style token authoring", () => {
  it("creates a token table schema", () => {
    expect(S.tokenTableSchema(["light", "dark"] as const)).toEqual({
      kind: "tableSchema",
      columns: {
        token: { kind: "string" },
        light: { kind: "string" },
        dark: { kind: "string" },
        description: { kind: "string", optional: true },
      },
    });
  });

  it("lowers token tables to token records in row order", () => {
    expect(S.tokensFromTable(createTokenTable())).toEqual([
      {
        kind: "styleToken",
        token: "background",
        values: {
          light: "oklch(1 0 0)",
          dark: "oklch(0.145 0 0)",
        },
      },
      {
        kind: "styleToken",
        token: "foreground",
        values: {
          light: "oklch(0.145 0 0)",
          dark: "oklch(0.985 0 0)",
        },
        description: "Readable text",
      },
      {
        kind: "styleToken",
        token: "primary",
        values: {
          light: "oklch(0.205 0 0)",
          dark: "oklch(0.922 0 0)",
        },
      },
    ] satisfies readonly StyleTokenRecord[]);
  });

  it("supports configurable theme columns", () => {
    const table = Table.defineWithSchema({
      id: "brandTokens",
      schema: S.tokenTableSchema(["base", "contrast"] as const),
      columns: {
        token: ["accent"],
        base: ["#111111"],
        contrast: ["#fafafa"],
        description: ["Brand accent"],
      },
    });

    expect(
      S.tokensFromTable(table, {
        themeColumns: ["base", "contrast"],
      }),
    ).toEqual([
      {
        kind: "styleToken",
        token: "accent",
        values: {
          base: "#111111",
          contrast: "#fafafa",
        },
        description: "Brand accent",
      },
    ]);
  });

  it("reports duplicate tokens, missing columns, invalid names, invalid values, and detailed paths", () => {
    const duplicateDiagnostics = S.validateStyleTokenTable(
      Table.define({
        id: "dupTokens",
        columns: {
          token: ["background", "background"],
          light: ["white", "black"],
          dark: ["black", "white"],
        },
      }),
    );
    expect(duplicateDiagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "DuplicateStyleToken",
    );

    const missingColumnDiagnostics = S.validateStyleTokenTable(
      Table.define({
        id: "missingTokens",
        columns: {
          light: ["white"],
        },
      }),
    );
    expect(missingColumnDiagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "MissingStyleTokenColumn",
      "MissingStyleThemeColumn",
    ]);

    const invalidDiagnostics = S.validateStyleTokenTable(
      Table.define({
        id: "badTokens",
        columns: {
          token: ["", "foreground"],
          light: ["oklch(1 0 0)", ""],
          dark: ["oklch(0 0 0)", "oklch(1 0 0)"],
          description: [12, undefined],
        },
      }),
    );
    expect(invalidDiagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "InvalidStyleTokenName",
      "InvalidStyleTokenDescription",
      "InvalidStyleTokenValue",
    ]);
    expect(invalidDiagnostics[0]).toMatchObject({
      tableId: "badTokens",
      column: "token",
      row: 0,
      path: "badTokens.token[0]",
    });
  });

  it("describes token tables by count and themes", () => {
    expect(S.describeStyleTokens(S.tokensFromTable(createTokenTable()), "themeTokens")).toEqual({
      kind: "styleTokenTableDescription",
      tableId: "themeTokens",
      tokenCount: 3,
      themes: ["light", "dark"],
    });
  });

  it("throws TableError for invalid token tables", () => {
    expect(() =>
      S.tokensFromTable(
        Table.define({
          id: "invalidTokens",
          columns: {
            token: [""],
            light: ["white"],
            dark: ["black"],
          },
        }),
      ),
    ).toThrow(TableError);
  });
});

describe("tabular style rule authoring", () => {
  it("creates a rule table schema", () => {
    expect(S.ruleTableSchema()).toEqual({
      kind: "tableSchema",
      columns: {
        selector: { kind: "string" },
        property: { kind: "string" },
        value: { kind: "string" },
        state: { kind: "string", optional: true },
        breakpoint: { kind: "string", optional: true },
        description: { kind: "string", optional: true },
      },
    });
  });

  it("lowers rule tables to rule records in row order", () => {
    expect(S.rulesFromTable(createRuleTable())).toEqual([
      {
        kind: "styleRule",
        selector: ".scheduling-booking-header",
        property: "height",
        value: "100%",
      },
      {
        kind: "styleRule",
        selector: ".scheduling-booking-header",
        property: "padding",
        value: "0 24px",
        breakpoint: "phone",
        description: "Header spacing",
      },
      {
        kind: "styleRule",
        selector: ".scheduling-booking-header.is-mobile",
        property: "padding",
        value: "0 16px",
        state: "selected",
        description: "Mobile spacing",
      },
    ] satisfies readonly StyleRuleRecord[]);
  });

  it("reports invalid selectors, properties, values, and optional field types with table cell paths", () => {
    const diagnostics = S.validateStyleRuleTable(
      Table.define({
        id: "badRules",
        columns: {
          selector: ["", ".ok"],
          property: ["height", ""],
          value: ["100%", ""],
          state: [false, undefined],
          breakpoint: [undefined, 12],
          description: [undefined, true],
        },
      }),
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "InvalidStyleSelector",
      "InvalidStyleState",
      "InvalidStyleProperty",
      "InvalidStyleValue",
      "InvalidStyleBreakpoint",
      "InvalidStyleRuleDescription",
    ]);
    expect(diagnostics[0]).toMatchObject({
      tableId: "badRules",
      column: "selector",
      row: 0,
      path: "badRules.selector[0]",
    });
  });

  it("describes rule tables by rule, selector, and property counts", () => {
    expect(S.describeStyleRules(S.rulesFromTable(createRuleTable()), "bookingRules")).toEqual({
      kind: "styleRuleTableDescription",
      tableId: "bookingRules",
      ruleCount: 3,
      selectorCount: 2,
      propertyCount: 2,
    });
  });

  it("throws TableError for invalid rule tables", () => {
    expect(() =>
      S.rulesFromTable(
        Table.define({
          id: "invalidRules",
          columns: {
            selector: [""],
            property: ["height"],
            value: ["100%"],
          },
        }),
      ),
    ).toThrow(TableError);
  });
});

describe("tabular style sheet lowering", () => {
  it("accepts token and rule tables and serializes them through the style serializer", () => {
    const sheet = S.sheetFromTables({
      id: "bookingStyles",
      tokens: createTokenTable(),
      rules: createRuleTable(),
    });

    const css = serializeMachinaStyleSheet(sheet, { includeHeader: false });

    expect(css).toContain(":root {\n  --background: oklch(1 0 0);");
    expect(css).toContain(".dark {\n  --background: oklch(0.145 0 0);");
    expect(css).toContain(".scheduling-booking-header {\n  height: 100%;");
    expect(css).toContain("  padding: 0 24px;");
    expect(css).toContain("@media (max-width: 639px) {");
    expect(css).toContain('.scheduling-booking-header.is-mobile[data-state~="selected"] {');
  });

  it("groups repeated selector properties into a single CSS rule", () => {
    const sheet = S.sheetFromTables({
      rules: Table.define({
        id: "groupedRules",
        columns: {
          selector: [".selector", ".selector"],
          property: ["height", "padding"],
          value: ["100%", "0 24px"],
        },
      }),
    });

    expect(serializeMachinaStyleSheet(sheet, { includeHeader: false })).toContain(`.selector {
  height: 100%;
  padding: 0 24px;
}`);
  });

  it("preserves existing style authoring alongside tabular lowering", () => {
    const css = serializeMachinaStyleSheet({
      classes: {
        card: S.style({
          surface: { fill: "#ffffff" },
        }),
      },
      tabular: {
        ruleRecords: [
          {
            kind: "styleRule",
            selector: ".extra",
            property: "display",
            value: "flex",
          },
        ],
      },
    });

    expect(css).toContain(".card {");
    expect(css).toContain(".extra {");
  });
});
