import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseGuideSidecarToml,
  validateGuideSidecar,
} from "../../apps/machina-canvas/src/guideSidecar";
import type { ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import { buildSpriteAuditReport } from "../../apps/machina-canvas/src/spriteAudit";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
} from "../../apps/machina-canvas/src/spriteSidecar";

const artifactsDir = join(process.cwd(), "apps", "machina-canvas", "artifacts");
const guideArtifactPath = join(artifactsDir, "tinytown_sprite_alpha.guide.toml");
const runtimeArtifactPath = join(artifactsDir, "tinytown_sprite_alpha.compiled.sprite.toml");
const compileReportPath = join(artifactsDir, "tinytown_sprite_alpha.compile-report.md");
const auditReportPath = join(artifactsDir, "tinytown_sprite_alpha.audit.md");

const image: ImageObject = {
  id: "tinytown-sheet",
  name: "TinyTown sheet",
  kind: "image",
  layerId: "sprites",
  visible: true,
  x: 0,
  y: 0,
  width: 1440,
  height: 720,
  src: "/assets/tinytown_sprite_alpha.png",
  role: "image",
  intrinsicWidth: 1440,
  intrinsicHeight: 720,
  fit: "fill",
};

describe("TinyTown generated artifacts", () => {
  it("parses the generated guide TOML and keeps the expected regions", () => {
    const text = readFileSync(guideArtifactPath, "utf8");
    const guide = parseGuideSidecarToml(text);
    const diagnostics = validateGuideSidecar(guide, { imageWidth: 1440, imageHeight: 720 });

    expect(diagnostics).toEqual([]);
    expect(guide.regions.map((region) => region.id)).toEqual(
      expect.arrayContaining([
        "characters_down",
        "characters_left",
        "characters_right",
        "characters_up",
        "props_top",
        "props_bottom",
      ]),
    );
  });

  it("parses the generated runtime sprite TOML with stackframes and without guide-only sections", () => {
    const text = readFileSync(runtimeArtifactPath, "utf8");
    const spec = parseSpriteSidecarToml(text, {
      id: "tinytown-compiled",
      name: "TinyTown compiled runtime",
      targetId: image.id,
      sourceName: "tinytown_sprite_alpha.compiled.sprite.toml",
    });

    expect(spec.diagnostics).toEqual([]);
    expect(spec.stackframes.length).toBeGreaterThan(0);
    expect(spec.stackframes.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["down.0", "down.1", "down.2", "left.0", "right.2", "up.1"]),
    );
    expect(spec.stackframes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "down.0",
          direction: "vertical",
          width: 80,
          height: 120,
          count: 4,
          step: 120,
        }),
      ]),
    );
    expect(text).not.toContain("cut_grids");
    expect(text).not.toContain("[[regions]]");
    expect(text).not.toContain("[[datums]]");
    expect(text).not.toContain("[[dimensions]]");
    expect(text).not.toContain("[[alignment_marks]]");
    expect(text).not.toContain("maya.down.idle_exact");
  });

  it("keeps bottom prop frames present as explicit runtime frames", () => {
    const text = readFileSync(runtimeArtifactPath, "utf8");
    const spec = parseSpriteSidecarToml(text, {
      id: "tinytown-compiled",
      name: "TinyTown compiled runtime",
      targetId: image.id,
      sourceName: "tinytown_sprite_alpha.compiled.sprite.toml",
    });

    expect(spec.frames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "campfire", sourceKind: "manual" }),
        expect.objectContaining({ id: "table", sourceKind: "manual" }),
        expect.objectContaining({ id: "speech_bubble", sourceKind: "manual" }),
        expect.objectContaining({ id: "theo.left.2", sourceKind: "exact" }),
      ]),
    );
  });

  it("includes the required runtime / authoring split explanation", () => {
    const report = readFileSync(compileReportPath, "utf8");
    expect(report).toContain("## Runtime / authoring split");
    expect(report).toContain("guide regions, datums, dimensions, and alignment marks");
    expect(report).toContain("compiled runtime artifact omits guide scaffolding");
  });

  it("records the explicit removal of the stray idle exact frame", () => {
    const report = readFileSync(compileReportPath, "utf8");
    expect(report).toContain("Removed `maya.down.idle_exact`");
  });

  it("keeps the generated audit report readable and rebuilds audit data without throwing", () => {
    const auditText = readFileSync(auditReportPath, "utf8");
    const runtimeText = readFileSync(runtimeArtifactPath, "utf8");
    const spec = parseSpriteSidecarToml(runtimeText, {
      id: "tinytown-compiled",
      name: "TinyTown compiled runtime",
      targetId: image.id,
      sourceName: "tinytown_sprite_alpha.compiled.sprite.toml",
    });
    const sidecar = createSpriteSidecarObject(image, spec);
    const report = buildSpriteAuditReport(sidecar, image, {
      includeAlphaAnalysis: true,
      alphaUnavailableReason: "test rebuild",
    });

    expect(auditText).toContain("# TinyTown compiled sprite audit");
    expect(auditText).toContain("may be intentional");
    expect(report.summary.totalFrames).toBe(spec.frames.length);
  });
});
