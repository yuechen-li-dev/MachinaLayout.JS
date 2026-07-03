import { describe, expect, it } from "vitest";
import {
  defineMachinaAtlas,
  formatMachinaAtlasValidationReport,
  validateMachinaAtlas,
} from "../../src/atlas";

const sourceText = `// @machina-section Provider Setup

function ProviderSetupView() {
  return <SchedulingShell />;
}

function ProviderSetupForm() {
  return null;
}

// @machina-section Shared Shell

function SchedulingShell() {
  return null;
}
`;

function baseAtlas() {
  return defineMachinaAtlas({
    app: "Scheduling",
    sections: [
      {
        key: "provider-setup",
        name: "Provider Setup",
        marker: "Provider Setup",
        owns: ["ProviderSetupView", "ProviderSetupForm"],
        uses: ["shared-shell"],
        dependsOn: ["shared-shell"],
      },
      { key: "shared-shell", name: "Shared Shell", owns: ["SchedulingShell"] },
    ],
  });
}

function codes(result: ReturnType<typeof validateMachinaAtlas>) {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

describe("validateMachinaAtlas", () => {
  it("passes the happy path", () => {
    const result = validateMachinaAtlas({ atlas: baseAtlas(), sourceText });
    expect(result).toEqual({ ok: true, diagnostics: [] });
  });

  it("reports missing markers", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [{ key: "missing", name: "Missing" }],
    });
    const result = validateMachinaAtlas({ atlas, sourceText });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("AtlasMarkerMissing");
  });

  it("reports unmapped markers when requested", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [{ key: "provider", name: "Provider Setup" }],
    });
    const result = validateMachinaAtlas({
      atlas,
      sourceText,
      options: { requireAtlasForEveryMarker: true },
    });
    expect(codes(result)).toContain("AtlasMarkerUnmapped");
  });

  it("reports missing owned symbols", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [{ key: "provider", name: "Provider Setup", owns: ["MissingComponent"] }],
    });
    const result = validateMachinaAtlas({ atlas, sourceText });
    expect(codes(result)).toContain("AtlasOwnedSymbolMissing");
  });

  it("leaves used symbol checking off by default", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [{ key: "provider", name: "Provider Setup", uses: ["MissingSymbol"] }],
    });
    const result = validateMachinaAtlas({ atlas, sourceText });
    expect(codes(result)).not.toContain("AtlasUsedSymbolMissing");
  });

  it("reports missing used symbols when requested", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [{ key: "provider", name: "Provider Setup", uses: ["MissingSymbol"] }],
    });
    const result = validateMachinaAtlas({ atlas, sourceText, options: { checkUses: true } });
    expect(codes(result)).toContain("AtlasUsedSymbolMissing");
  });

  it("treats uses entries matching section keys as relations", () => {
    const result = validateMachinaAtlas({
      atlas: baseAtlas(),
      sourceText,
      options: { checkUses: true, checkRelations: true },
    });
    expect(codes(result)).not.toContain("AtlasUsedSymbolMissing");
  });

  it("reports unknown usedBy relations", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [{ key: "provider", name: "Provider Setup", usedBy: ["missing"] }],
    });
    expect(codes(validateMachinaAtlas({ atlas, sourceText }))).toContain("AtlasUnknownRelation");
  });

  it("reports unknown dependsOn relations", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [{ key: "provider", name: "Provider Setup", dependsOn: ["missing"] }],
    });
    expect(codes(validateMachinaAtlas({ atlas, sourceText }))).toContain("AtlasUnknownRelation");
  });

  it("reports duplicate ownership as a warning", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [
        { key: "provider", name: "Provider Setup", owns: ["SchedulingShell"] },
        { key: "shell", name: "Shared Shell", owns: ["SchedulingShell"] },
      ],
    });
    const result = validateMachinaAtlas({ atlas, sourceText });
    const duplicate = result.diagnostics.find(
      (diagnostic) => diagnostic.code === "AtlasDuplicateOwnership",
    );
    expect(duplicate?.severity).toBe("warning");
  });

  it("identifier matching avoids substring false positives", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [{ key: "provider", name: "Provider Setup", owns: ["ProviderSetupView"] }],
    });
    const result = validateMachinaAtlas({
      atlas,
      sourceText: "// @machina-section Provider Setup\nfunction ProviderSetupViewModel() {}",
    });
    expect(codes(result)).toContain("AtlasOwnedSymbolMissing");
  });

  it("substring mode allows substring matches", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [{ key: "provider", name: "Provider Setup", owns: ["ProviderSetupView"] }],
    });
    const result = validateMachinaAtlas({
      atlas,
      sourceText: "// @machina-section Provider Setup\nfunction ProviderSetupViewModel() {}",
      options: { symbolMatch: "substring" },
    });
    expect(codes(result)).not.toContain("AtlasOwnedSymbolMissing");
  });

  it("does not throw on extraction failures", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [{ key: "provider", name: "Provider Setup" }],
    });
    expect(() =>
      validateMachinaAtlas({
        atlas,
        sourceText:
          "// @machina-section Provider Setup\nconst a = 1;\n// @machina-section Provider Setup\nconst b = 2;",
      }),
    ).not.toThrow();
    expect(
      codes(
        validateMachinaAtlas({
          atlas,
          sourceText:
            "// @machina-section Provider Setup\nconst a = 1;\n// @machina-section Provider Setup\nconst b = 2;",
        }),
      ),
    ).toContain("AtlasSectionExtractFailed");
  });

  it("formats ok reports", () => {
    expect(formatMachinaAtlasValidationReport({ ok: true, diagnostics: [] })).toBe(
      "MachinaAtlas validation: ok\nDiagnostics: 0",
    );
  });

  it("formats failed reports", () => {
    const report = formatMachinaAtlasValidationReport({
      ok: false,
      diagnostics: [
        {
          code: "AtlasOwnedSymbolMissing",
          severity: "error",
          sectionKey: "provider",
          sectionName: "Provider Setup",
          symbol: "ProviderSetupView",
          message: "Missing symbol.",
        },
        {
          code: "AtlasUnknownRelation",
          severity: "error",
          sectionKey: "provider",
          relation: "dependsOn",
          targetKey: "missing",
          message: "Missing relation.",
        },
      ],
    });
    expect(report).toContain("MachinaAtlas validation: failed");
    expect(report).toContain("AtlasOwnedSymbolMissing");
    expect(report).toContain("section: provider — Provider Setup");
    expect(report).toContain("symbol: ProviderSetupView");
    expect(report).toContain("relation: dependsOn");
    expect(report).toContain("target: missing");
  });

  it("does not mutate the atlas", () => {
    const atlas = baseAtlas();
    const before = JSON.parse(JSON.stringify(atlas));
    validateMachinaAtlas({ atlas, sourceText, options: { checkUses: true } });
    expect(atlas).toEqual(before);
  });
});
