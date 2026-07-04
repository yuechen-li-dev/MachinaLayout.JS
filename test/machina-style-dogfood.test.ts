import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  artifact,
  classes,
  css,
  diagnosticProbeDiagnostics,
  sheet,
  sheetDiagnostics,
} from "../samples/style-dogfood/src/style";
import {
  createMachinaStyleArtifact,
  serializeMachinaStyleSheet,
  validateMachinaStyleSheet,
} from "../src/style";

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

  it("keeps checked-in generated CSS in sync with the artifact helper and serializer", () => {
    const generatedCss = readFileSync(generatedCssPath, "utf8");

    expect(artifact).toEqual(createMachinaStyleArtifact(sheet));
    expect(generatedCss).toBe(serializeMachinaStyleSheet(sheet));
    expect(generatedCss).toBe(css);
  });

  it("emits root token variables, class helper names, and composed sample classes", () => {
    const generatedCss = readFileSync(generatedCssPath, "utf8");

    expect(classes.buttonPrimary).toBe("buttonPrimary");
    expect(generatedCss).toContain(":root {");
    expect(generatedCss).toContain("--color-primary: #2457d6;");
    expect(generatedCss).toContain("--space-md: 14px;");
    expect(generatedCss).toContain(
      "--font-ui-family: Inter, ui-sans-serif, system-ui, sans-serif;",
    );
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

  it("expands font tokens in generated sample CSS", () => {
    const generatedCss = readFileSync(generatedCssPath, "utf8");
    const buttonPrimary = classBlock(generatedCss, "buttonPrimary");

    expect(buttonPrimary).toContain("font-family: var(--font-ui-family);");
    expect(buttonPrimary).toContain("font-size: var(--font-ui-size);");
    expect(buttonPrimary).toContain("line-height: var(--font-ui-line-height);");
    expect(buttonPrimary).toContain("font-weight: var(--font-ui-weight);");
    expect(buttonPrimary).toContain("font-weight: 600;");
  });

  it("does not leak unresolved slot markers or token objects into generated CSS", () => {
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
