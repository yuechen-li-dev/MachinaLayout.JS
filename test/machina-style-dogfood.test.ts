import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  css,
  diagnosticProbeDiagnostics,
  sheet,
  sheetDiagnostics,
} from "../samples/style-dogfood/src/style";
import { serializeMachinaStyleSheet, validateMachinaStyleSheet } from "../src/style";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sampleRoot = resolve(repoRoot, "samples/style-dogfood");
const generatedCssPath = resolve(sampleRoot, "src/generated.css");

function classBlock(cssText: string, className: string): string {
  const match = cssText.match(new RegExp(`\\.${className} \\{[\\s\\S]*?\\n\\}`));
  if (!match) {
    throw new Error(`Missing .${className} block.`);
  }
  return match[0];
}

describe("MachinaStyle dogfood sample", () => {
  it("validates the sample sheet with no diagnostics", () => {
    expect(sheetDiagnostics).toEqual([]);
    expect(validateMachinaStyleSheet(sheet)).toEqual([]);
  });

  it("exercises validation diagnostics with the sample probe layer", () => {
    expect(diagnosticProbeDiagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "InvalidOpacity",
      "NegativeRadius",
    ]);
  });

  it("keeps checked-in generated CSS in sync with the serialized sheet", () => {
    const generatedCss = readFileSync(generatedCssPath, "utf8");

    expect(generatedCss).toBe(serializeMachinaStyleSheet(sheet));
    expect(generatedCss).toBe(css);
  });

  it("emits root token variables and composed sample classes", () => {
    const generatedCss = readFileSync(generatedCssPath, "utf8");

    expect(generatedCss).toContain(":root {");
    expect(generatedCss).toContain("--color-primary: #2457d6;");
    expect(generatedCss).toContain("--space-md: 14px;");
    expect(generatedCss).toContain(".buttonPrimary {");
    expect(generatedCss).toContain(".buttonGhost {");
    expect(generatedCss).toContain(".cardElevated {");
    expect(generatedCss).toContain(".badgeSuccess {");
  });

  it("lowers unset, inherit, and composed layers into concrete CSS", () => {
    const generatedCss = readFileSync(generatedCssPath, "utf8");
    const ghostButton = classBlock(generatedCss, "buttonGhost");
    const compactPrimaryButton = classBlock(generatedCss, "buttonCompactPrimary");

    expect(ghostButton).not.toContain("background:");
    expect(ghostButton).toContain("border-color: var(--color-primary);");
    expect(compactPrimaryButton).toContain("border-radius: var(--radius-md);");
    expect(compactPrimaryButton).toContain("padding-left: var(--space-sm);");
    expect(compactPrimaryButton).toContain("padding-top: var(--space-xs);");
  });

  it("does not leak unresolved slot markers into generated CSS", () => {
    const generatedCss = readFileSync(generatedCssPath, "utf8");

    expect(generatedCss).not.toContain("kind:");
    expect(generatedCss).not.toContain("[object Object]");
    expect(generatedCss).not.toContain("unset");
    expect(generatedCss).not.toContain("inherit");
  });

  it("builds the sample app", () => {
    execSync("npm run build", {
      cwd: sampleRoot,
      stdio: "pipe",
      env: {
        ...process.env,
        CI: "1",
      },
    });
  });
});
