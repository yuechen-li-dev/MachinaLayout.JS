import { mkdtempSync, readFileSync } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditSpriteWorkflow,
  compileSpriteRuntimeToml,
  createCanvasWorkflowContext,
  createCanvasWorkflowManifest,
  loadGuideSidecarFromToml,
  loadSpriteSidecarFromToml,
  runCanvasWorkflow,
} from "../../apps/machina-canvas/src/canvasWorkflow";
import {
  ensureDirectory,
  readTextFile,
  writeCanvasWorkflowManifest,
  writeTextFile,
} from "../../apps/machina-canvas/scripts/workflow/files";

const createdPaths: string[] = [];

const spriteToml = `
[atlas]
image = "sheet.png"
width = 64
height = 32

[cut_grids.body]
x = 0
y = 0
columns = 2
rows = 1
cell_width = 16
cell_height = 16

[sprites.hero]
kind = "actor"
display_name = "Hero"

[sprites.hero.animations.idle]
frames = ["body.0.0", "body.0.1"]
fps = 6
loop = true

[frames."body.0.1"]
x = 18
y = 0
width = 14
height = 16
source_kind = "manual"
source_grid = "body"
source_row = 0
source_column = 1

[frames."exact.prop"]
x = 32
y = 0
width = 16
height = 16
source_kind = "exact"
`;

const guideToml = `
id = "sheet-guide"
target = "sheet"
units = "px"

[[regions]]
id = "body"
kind = "sprite-region"
x = 0
y = 0
width = 32
height = 16
[regions.grid]
columns = 2
rows = 1
cell_width = 16
cell_height = 16

[[datums]]
id = "axis"
kind = "vertical"
x = 8

[[dimensions]]
id = "width"
kind = "linear"
from = [0, 0]
to = [32, 0]
label = "32 px"

[[alignment_marks]]
id = "origin"
kind = "point"
x = 0
y = 0
`;

function createTempPath(name: string): string {
  const root = mkdtempSync(join(tmpdir(), "machina-canvas-workflow-"));
  createdPaths.push(root);
  return join(root, name);
}

afterEach(async () => {
  await Promise.all(
    createdPaths.splice(0).map(async (path) => {
      await rm(path, { recursive: true, force: true });
    }),
  );
});

describe("MachinaCanvas workflow API", () => {
  it("creates a workflow context", () => {
    const ctx = createCanvasWorkflowContext({ cwd: "/tmp/workflow" });

    expect(ctx.cwd).toBe("/tmp/workflow");
    expect(ctx.logs).toEqual([]);
    expect(ctx.artifacts).toEqual([]);
  });

  it("collects logs in order", () => {
    const ctx = createCanvasWorkflowContext({
      cwd: "/tmp/workflow",
      now: () => new Date("2026-01-02T03:04:05.000Z"),
    });

    ctx.log("info", "first");
    ctx.log("warning", "second");

    expect(ctx.logs.map((entry) => `${entry.level}:${entry.message}`)).toEqual([
      "info:first",
      "warning:second",
    ]);
  });

  it("collects artifacts in order", () => {
    const ctx = createCanvasWorkflowContext({ cwd: "/tmp/workflow" });

    ctx.artifact("spriteToml", "out/runtime.sprite.toml");
    ctx.artifact("auditReport", "out/audit.md", "Audit markdown");

    expect(ctx.artifacts).toEqual([
      { kind: "spriteToml", path: "out/runtime.sprite.toml", description: undefined },
      { kind: "auditReport", path: "out/audit.md", description: "Audit markdown" },
    ]);
  });

  it("supports deterministic timestamps", () => {
    const ctx = createCanvasWorkflowContext({
      cwd: "/tmp/workflow",
      now: () => new Date("2026-07-07T12:00:00.000Z"),
    });

    ctx.log("success", "finished");

    expect(ctx.logs[0]?.at).toBe("2026-07-07T12:00:00.000Z");
  });

  it("returns ok on successful workflow runs", async () => {
    const result = await runCanvasWorkflow(
      "happy path",
      (ctx) => {
        ctx.log("info", "running");
        ctx.artifact("note", "artifact.txt");
      },
      {
        cwd: "/tmp/workflow",
        now: () => new Date("2026-07-07T12:00:00.000Z"),
      },
    );

    expect(result.kind).toBe("ok");
    expect(result.logs.map((entry) => entry.level)).toEqual(["info", "info", "success"]);
    expect(result.logs[0]?.message).toContain('Starting workflow "happy path" in /tmp/workflow.');
    expect(result.logs.at(-1)?.message).toContain(
      'Completed workflow "happy path" with 1 artifact.',
    );
    expect(result.artifacts).toEqual([
      { kind: "note", path: "artifact.txt", description: undefined },
    ]);
  });

  it("returns err on thrown workflow failures", async () => {
    const result = await runCanvasWorkflow(
      "broken",
      () => {
        throw new Error("workflow exploded");
      },
      { cwd: "/tmp/workflow" },
    );

    expect(result.kind).toBe("err");
    expect(result.error).toBe("workflow exploded");
    expect(result.logs.at(-1)?.level).toBe("error");
    expect(result.logs.at(-1)?.message).toContain('Workflow "broken" failed in /tmp/workflow');
  });

  it("creates manifests with logs and artifacts", () => {
    const ctx = createCanvasWorkflowContext({
      cwd: "/tmp/workflow",
      now: () => new Date("2026-07-07T12:34:56.000Z"),
    });
    ctx.log("info", "compiled");
    ctx.artifact("spriteToml", "out/runtime.sprite.toml");

    const manifest = createCanvasWorkflowManifest({
      workflow: "fixture",
      context: ctx,
      now: () => new Date("2026-07-07T12:34:56.000Z"),
    });

    expect(manifest).toEqual({
      kind: "canvasWorkflowManifest",
      workflow: "fixture",
      createdAt: "2026-07-07T12:34:56.000Z",
      artifacts: [{ kind: "spriteToml", path: "out/runtime.sprite.toml", description: undefined }],
      logs: [{ level: "info", message: "compiled", at: "2026-07-07T12:34:56.000Z" }],
    });
  });

  it("parses sprite TOML and produces runtime TOML through the workflow compile helper", () => {
    const spriteSidecar = loadSpriteSidecarFromToml({
      source: spriteToml,
      id: "sheet-sidecar",
      name: "Sheet sidecar",
      targetId: "sheet",
      sourceName: "sheet.sprite.toml",
    });
    const guideSidecar = loadGuideSidecarFromToml(guideToml);

    const compiled = compileSpriteRuntimeToml({
      spriteSidecar,
      guideSidecar,
      options: { mode: "runtime" },
    });

    expect(compiled.toml).toContain('image = "sheet.png"');
    expect(compiled.toml).toContain('[frames."body.0.0"]');
    expect(compiled.reportMarkdown).toContain("# Sprite compile report");
  });

  it("produces audit markdown through the workflow audit helper", () => {
    const spriteSidecar = loadSpriteSidecarFromToml({
      source: spriteToml,
      id: "sheet-sidecar",
      name: "Sheet sidecar",
      targetId: "sheet",
      sourceName: "sheet.sprite.toml",
    });
    const guideSidecar = loadGuideSidecarFromToml(guideToml);

    const audit = auditSpriteWorkflow({
      spriteSidecar,
      guideSidecar,
      imageWidth: 64,
      imageHeight: 32,
    });

    expect(audit.reportMarkdown).toContain("# Sprite Audit Report");
    expect(audit.reportMarkdown).toContain("Guide-region constraints");
  });

  it("writes and reads workflow files from the node helper layer", async () => {
    const outputPath = createTempPath(join("nested", "note.txt"));
    const manifestPath = createTempPath(join("nested", "workflow.json"));

    await ensureDirectory(dirname(outputPath));
    await writeTextFile(outputPath, "hello workflow\n");
    await writeCanvasWorkflowManifest(manifestPath, {
      kind: "canvasWorkflowManifest",
      workflow: "fixture",
      createdAt: "2026-07-07T12:00:00.000Z",
      artifacts: [],
      logs: [],
    });

    expect(await readTextFile(outputPath)).toBe("hello workflow\n");
    expect(JSON.parse(readFileSync(manifestPath, "utf8")).workflow).toBe("fixture");
    expect((await stat(manifestPath)).isFile()).toBe(true);
  });

  it("wires the TinyTown workflow script through the public workflow API", () => {
    const script = readFileSync(
      join(process.cwd(), "apps/machina-canvas/scripts/tinytown-sprite-workflow.ts"),
      "utf8",
    );

    expect(script).toContain('from "../src/canvasWorkflow"');
    expect(script).toContain("runCanvasWorkflow");
    expect(script).toContain("createCanvasWorkflowManifest");
    expect(script).toContain("Wrote guide authoring TOML");
  });

  it("keeps the browser-safe workflow core free of node imports", () => {
    const source = readFileSync(
      join(process.cwd(), "apps/machina-canvas/src/canvasWorkflow.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/from "node:/);
    expect(source).not.toMatch(/from 'node:/);
  });
});
