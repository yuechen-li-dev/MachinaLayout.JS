import { describe, expect, it } from "vitest";
import { serializeCanvasObjectToml } from "../../apps/machina-canvas/src/canvasExport";
import {
  analyzeSpriteCutAlpha,
  buildSpriteAuditReport,
  formatSpriteAuditReport,
  type SpriteAlphaMask,
} from "../../apps/machina-canvas/src/spriteAudit";
import type { ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
  updateSpriteFrameRectInSpec,
} from "../../apps/machina-canvas/src/spriteSidecar";

const image: ImageObject = {
  id: "sheet",
  name: "Sheet",
  kind: "image",
  layerId: "sprites",
  visible: true,
  x: 0,
  y: 0,
  width: 64,
  height: 32,
  src: "/rough-sheet.png",
  role: "image",
  intrinsicWidth: 64,
  intrinsicHeight: 32,
  fit: "fill",
};

const cutGridToml = `
[atlas]
image = "rough-sheet.png"
width = 64
height = 32

[cut_grids.props]
x = 0
y = 0
cell_width = 16
cell_height = 16
columns = 2
rows = 2
kind = "prop"
prefix = "prop"
start_index = 10
`;

const labeledCutGridToml = `
[atlas]
image = "rough-sheet.png"
width = 48
height = 16

[cut_grids.props]
x = 0
y = 0
cell_width = 16
cell_height = 16
columns = 3
rows = 1
kind = "prop"
labels = ["well", "stall", "crate"]
`;

const invalidLabelsToml = `
[atlas]
image = "rough-sheet.png"
width = 32
height = 16

[cut_grids.props]
x = 0
y = 0
cell_width = 16
cell_height = 16
columns = 2
rows = 1
labels = ["only-one"]
`;

function createMask(
  width: number,
  height: number,
  predicate: (x: number, y: number) => boolean,
): SpriteAlphaMask {
  return {
    width,
    height,
    isOpaque: predicate,
  };
}

describe("MachinaCanvas sprite cut grids", () => {
  it("parses cut_grids into rough-cut subgrid regions and grid-derived frames", () => {
    const spec = parseSpriteSidecarToml(cutGridToml, {
      id: "rough-sidecar",
      name: "Rough sidecar",
      targetId: image.id,
    });

    expect(spec.grids).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "props",
          source: "roughCutGrid",
          width: 32,
          height: 32,
          gridKind: "prop",
          framePrefix: "prop",
          frameStartIndex: 10,
        }),
      ]),
    );
    expect(spec.frames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "prop.10",
          sourceKind: "grid",
          sourceGridId: "props",
          sourceRow: 0,
          sourceColumn: 0,
        }),
        expect.objectContaining({
          id: "prop.13",
          sourceKind: "grid",
          sourceGridId: "props",
          sourceRow: 1,
          sourceColumn: 1,
        }),
      ]),
    );
  });

  it("uses cut grid labels as deterministic frame ids when provided", () => {
    const spec = parseSpriteSidecarToml(labeledCutGridToml, {
      id: "labeled-sidecar",
      name: "Labeled sidecar",
      targetId: image.id,
    });

    expect(spec.frames.map((frame) => frame.id)).toEqual(["well", "stall", "crate"]);
  });

  it("reports invalid cut grid label counts", () => {
    const spec = parseSpriteSidecarToml(invalidLabelsToml, {
      id: "broken-sidecar",
      name: "Broken sidecar",
      targetId: image.id,
    });

    expect(spec.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "InvalidCutGridLabels",
        }),
      ]),
    );
  });

  it("exports rough cut grids and preserves manual overrides on reparse", () => {
    const spec = updateSpriteFrameRectInSpec(
      parseSpriteSidecarToml(cutGridToml, {
        id: "rough-sidecar",
        name: "Rough sidecar",
        targetId: image.id,
      }),
      "prop.11",
      {
        x: 19,
        y: 1,
        width: 13,
        height: 15,
      },
    );
    const sidecar = createSpriteSidecarObject(image, spec);
    const text = serializeCanvasObjectToml(sidecar);
    const reparsed = parseSpriteSidecarToml(text, {
      id: "rough-sidecar",
      name: "Rough sidecar",
      targetId: image.id,
    });

    expect(text).toContain("[cut_grids.props]");
    expect(text).toContain('prefix = "prop"');
    expect(text).toContain('[frames."prop.11"]');
    expect(text).toContain('source_kind = "manual"');
    expect(reparsed.grids).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "props", source: "roughCutGrid" })]),
    );
    expect(reparsed.frames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "prop.11",
          x: 19,
          y: 1,
          width: 13,
          height: 15,
          sourceKind: "manual",
        }),
      ]),
    );
  });

  it("finds no alpha cut warnings when internal boundaries stay in transparent gutters", () => {
    const spec = parseSpriteSidecarToml(cutGridToml, {
      id: "rough-sidecar",
      name: "Rough sidecar",
      targetId: image.id,
    });
    const entries = analyzeSpriteCutAlpha(
      spec.grids,
      createMask(
        64,
        32,
        (x, y) =>
          ((x >= 1 && x <= 13) || (x >= 17 && x <= 29)) &&
          ((y >= 1 && y <= 13) || (y >= 17 && y <= 29)),
      ),
    );

    expect(entries).toEqual([]);
  });

  it("warns when vertical or horizontal cut lines cross opaque pixels", () => {
    const spec = parseSpriteSidecarToml(cutGridToml, {
      id: "rough-sidecar",
      name: "Rough sidecar",
      targetId: image.id,
    });
    const entries = analyzeSpriteCutAlpha(
      spec.grids,
      createMask(
        64,
        32,
        (x, y) => (x === 16 && y >= 0 && y < 32) || (y === 16 && x >= 0 && x < 32),
      ),
    );

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gridId: "props",
          orientation: "vertical",
          coordinate: 16,
        }),
        expect.objectContaining({
          gridId: "props",
          orientation: "horizontal",
          coordinate: 16,
        }),
      ]),
    );
    expect(entries[0]?.finding).toContain("likely slices a sprite");
  });

  it("includes alpha-aware report sections and unavailable notes without failing the audit", () => {
    const sidecar = createSpriteSidecarObject(
      image,
      parseSpriteSidecarToml(cutGridToml, {
        id: "rough-sidecar",
        name: "Rough sidecar",
        targetId: image.id,
      }),
    );
    const report = buildSpriteAuditReport(sidecar, image, {
      includeAlphaAnalysis: true,
    });
    const text = formatSpriteAuditReport(report);

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SpriteAlphaUnavailable",
          severity: "note",
        }),
      ]),
    );
    expect(text).toContain("## Alpha-aware cut analysis");
    expect(text).toContain("Alpha-aware cut validation unavailable for this image.");
  });
});
