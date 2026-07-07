import { describe, expect, it } from "vitest";
import {
  serializeCanvasSpriteToml,
  serializeCompiledRuntimeSpriteToml,
} from "../../apps/machina-canvas/src/canvasExport";
import {
  buildSpriteAuditReport,
  formatSpriteAuditReport,
} from "../../apps/machina-canvas/src/spriteAudit";
import {
  createSpriteSidecarObject,
  expandSpriteStackframe,
  parseSpriteSidecarToml,
  updateSpriteFrameRectInSpec,
} from "../../apps/machina-canvas/src/spriteSidecar";
import { compileSpriteRuntimeSidecar } from "../../apps/machina-canvas/src/spriteGuideCompiler";
import type { ImageObject } from "../../apps/machina-canvas/src/sceneModel";

const image: ImageObject = {
  id: "stack-sheet",
  name: "Stack Sheet",
  kind: "image",
  layerId: "sprites",
  visible: true,
  x: 0,
  y: 0,
  width: 960,
  height: 720,
  src: "/stack.png",
  role: "image",
  intrinsicWidth: 960,
  intrinsicHeight: 720,
  fit: "fill",
};

const runtimeStackToml = `
[atlas]
image = "stack.png"
width = 960
height = 720

[cut_grids.legacy]
x = 0
y = 600
columns = 2
rows = 1
cell_width = 32
cell_height = 32
labels = ["legacy.0.0", "legacy.0.1"]

[stackframes."maya.down"]
x = 24
y = 24
width = 72
height = 104
count = 3
direction = "vertical"
step = 120
labels = ["maya.down.0", "maya.down.1", "maya.down.2"]
sprite = "maya"
animation = "down"
description = "TinyTown walk down"

[stackframes."maya.right"]
x = 640
y = 24
width = 72
height = 104
count = 3
direction = "horizontal"
step = 120
labels = ["maya.right.0", "maya.right.1", "maya.right.2"]
sprite = "maya"
animation = "right"

[sprites.maya]
display_name = "Maya"

[sprites.maya.animations.down]
frames = ["maya.down.0", "maya.down.1", "maya.down.2"]
fps = 6
loop = true

[sprites.maya.animations.right]
frames = ["maya.right.0", "maya.right.1", "maya.right.2"]
fps = 6
loop = true
`;

function createSidecar(toml = runtimeStackToml) {
  const spec = parseSpriteSidecarToml(toml, {
    id: "stack-sidecar",
    name: "Stack sidecar",
    targetId: image.id,
    sourceName: "stack.sprite.toml",
  });
  return createSpriteSidecarObject(image, spec);
}

describe("MachinaCanvas sprite stackframes", () => {
  it("parses vertical and horizontal stackframes", () => {
    const spec = parseSpriteSidecarToml(runtimeStackToml, {
      id: "stack-sidecar",
      name: "Stack sidecar",
      targetId: image.id,
    });

    expect(spec.stackframes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "maya.down",
          direction: "vertical",
          count: 3,
          step: 120,
        }),
        expect.objectContaining({
          id: "maya.right",
          direction: "horizontal",
          count: 3,
          step: 120,
        }),
      ]),
    );
  });

  it("expands vertical and horizontal stackframes into explicit source-tagged frames", () => {
    const spec = parseSpriteSidecarToml(runtimeStackToml, {
      id: "stack-sidecar",
      name: "Stack sidecar",
      targetId: image.id,
    });
    const down = spec.stackframes.find((entry) => entry.id === "maya.down");
    const right = spec.stackframes.find((entry) => entry.id === "maya.right");
    if (!down || !right) throw new Error("Expected parsed stackframes.");

    expect(expandSpriteStackframe(down)).toEqual([
      expect.objectContaining({
        id: "maya.down.0",
        x: 24,
        y: 24,
        sourceKind: "stackframe",
        sourceStackframeId: "maya.down",
        sourceStackIndex: 0,
      }),
      expect.objectContaining({
        id: "maya.down.1",
        x: 24,
        y: 144,
        sourceKind: "stackframe",
        sourceStackframeId: "maya.down",
        sourceStackIndex: 1,
      }),
      expect.objectContaining({
        id: "maya.down.2",
        x: 24,
        y: 264,
        sourceKind: "stackframe",
        sourceStackframeId: "maya.down",
        sourceStackIndex: 2,
      }),
    ]);
    expect(expandSpriteStackframe(right)).toEqual([
      expect.objectContaining({ id: "maya.right.0", x: 640, y: 24 }),
      expect.objectContaining({ id: "maya.right.1", x: 760, y: 24 }),
      expect.objectContaining({ id: "maya.right.2", x: 880, y: 24 }),
    ]);
  });

  it("uses deterministic fallback labels when labels are omitted", () => {
    const spec = parseSpriteSidecarToml(
      `
[atlas]
width = 64
height = 64

[stackframes.hero]
x = 0
y = 0
width = 16
height = 16
count = 3
direction = "vertical"
step = 16
`,
      { id: "fallback", name: "Fallback", targetId: image.id },
    );

    expect(spec.frames.map((frame) => frame.id)).toEqual(["hero.0", "hero.1", "hero.2"]);
  });

  it("rejects invalid direction, count, step, and mismatched labels", () => {
    const spec = parseSpriteSidecarToml(
      `
[stackframes.bad]
x = 0
y = 0
width = 16
height = 16
count = 0
direction = "diagonal"
step = 0
labels = ["bad.0"]
`,
      { id: "bad", name: "Bad", targetId: image.id },
    );

    expect(spec.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "InvalidSpriteStackframeCount" }),
        expect.objectContaining({ code: "InvalidSpriteStackframeDirection" }),
        expect.objectContaining({ code: "InvalidSpriteStackframeStep" }),
        expect.objectContaining({ code: "InvalidSpriteStackframeLabels" }),
      ]),
    );
  });

  it("rejects duplicate stackframe-generated labels", () => {
    const spec = parseSpriteSidecarToml(
      `
[stackframes.a]
x = 0
y = 0
width = 16
height = 16
count = 1
direction = "vertical"
step = 16
labels = ["dup"]

[stackframes.b]
x = 16
y = 0
width = 16
height = 16
count = 1
direction = "vertical"
step = 16
labels = ["dup"]
`,
      { id: "dup", name: "Dup", targetId: image.id },
    );

    expect(spec.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "DuplicateSpriteStackframeFrameLabel" }),
      ]),
    );
  });

  it("lets explicit frames override stackframe-generated frames by id", () => {
    const spec = parseSpriteSidecarToml(
      `
[stackframes.hero]
x = 0
y = 0
width = 16
height = 16
count = 2
direction = "vertical"
step = 16
labels = ["hero.0", "hero.1"]

[frames."hero.1"]
x = 1
y = 17
width = 14
height = 14
source_kind = "manual"
source_stackframe = "hero"
source_stack_index = 1
`,
      { id: "override", name: "Override", targetId: image.id },
    );

    expect(spec.frames.find((frame) => frame.id === "hero.1")).toEqual(
      expect.objectContaining({
        x: 1,
        y: 17,
        width: 14,
        height: 14,
        sourceKind: "manual",
        sourceStackframeId: "hero",
        sourceStackIndex: 1,
      }),
    );
  });

  it("prefers stackframes over rough cut-grid labels on collisions", () => {
    const spec = parseSpriteSidecarToml(
      `
[cut_grids.legacy]
x = 0
y = 0
columns = 1
rows = 1
cell_width = 32
cell_height = 32
labels = ["hero.0"]

[stackframes.hero]
x = 8
y = 8
width = 16
height = 16
count = 1
direction = "vertical"
step = 16
labels = ["hero.0"]
`,
      { id: "collision", name: "Collision", targetId: image.id },
    );

    expect(spec.frames.find((frame) => frame.id === "hero.0")).toEqual(
      expect.objectContaining({
        x: 8,
        y: 8,
        width: 16,
        height: 16,
        sourceKind: "stackframe",
      }),
    );
  });

  it("preserves runtime stackframes, omits cut_grids, and re-parses exported TOML", () => {
    const sidecar = createSidecar();
    const runtimeToml = serializeCompiledRuntimeSpriteToml({ spriteSidecar: sidecar });

    expect(runtimeToml).toContain('[stackframes."maya.down"]');
    expect(runtimeToml).toContain('[stackframes."maya.right"]');
    expect(runtimeToml).not.toContain("cut_grids");
    expect(runtimeToml).toContain("[sprites.maya.animations.down]");

    const reparsed = parseSpriteSidecarToml(runtimeToml, {
      id: "reparsed",
      name: "Reparsed",
      targetId: image.id,
    });
    expect(reparsed.stackframes.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["maya.down", "maya.right"]),
    );
    expect(reparsed.animations.find((animation) => animation.id === "down")?.frameIds).toEqual([
      "maya.down.0",
      "maya.down.1",
      "maya.down.2",
    ]);
  });

  it("keeps imported stackframes during guide-to-runtime compile", () => {
    const sidecar = createSidecar();
    const compiled = compileSpriteRuntimeSidecar({
      spriteSidecar: sidecar.spec,
      guideSidecar: {
        kind: "canvasGuideSidecar",
        id: "guide",
        units: "px",
        regions: [{ id: "note", kind: "sprite-region", x: 0, y: 0, width: 16, height: 16 }],
        datums: [],
        dimensions: [],
        alignmentMarks: [],
      },
      options: { mode: "runtime" },
    });

    expect(compiled.spriteSidecar.stackframes.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["maya.down", "maya.right"]),
    );
  });

  it("exports edited stackframe-derived frames as explicit overrides", () => {
    const sidecar = createSidecar();
    const editedSpec = updateSpriteFrameRectInSpec(sidecar.spec, "maya.down.1", {
      x: 28,
      y: 144,
      width: 70,
      height: 102,
    });
    const editedSidecar = { ...sidecar, spec: editedSpec };
    const runtimeToml = serializeCanvasSpriteToml(editedSidecar, { mode: "runtime" });

    expect(runtimeToml).toContain('[stackframes."maya.down"]');
    expect(runtimeToml).toContain('[frames."maya.down.1"]');
    expect(runtimeToml).toContain('source_kind = "manual"');
    expect(runtimeToml).toContain('source_stackframe = "maya.down"');
    expect(runtimeToml).toContain("source_stack_index = 1");
  });

  it("includes stackframe counts and report sections in audits", () => {
    const sidecar = createSidecar();
    const report = buildSpriteAuditReport(sidecar, image);
    const text = formatSpriteAuditReport(report);

    expect(report.summary.totalStackframes).toBe(2);
    expect(report.frames.find((frame) => frame.frameId === "maya.down.1")).toEqual(
      expect.objectContaining({
        sourceKind: "stackframe",
        sourceStackframe: "maya.down",
        sourceStackIndex: 1,
      }),
    );
    expect(text).toContain("## Stackframes");
    expect(text).toContain("| stackframe | direction | count | step | frame size |");
    expect(text).toContain("| maya.down.1 | stackframe |");
  });
});
