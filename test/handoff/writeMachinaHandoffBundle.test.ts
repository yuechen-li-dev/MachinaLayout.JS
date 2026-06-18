import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { MachinaScreenViewportTask } from "../../src/screenCatalog";
import { writeMachinaHandoffBundle } from "../../src/handoff";

async function tempDir() {
  return mkdtemp(path.join(os.tmpdir(), "machina-handoff-"));
}

async function readJson(file: string) {
  return JSON.parse(await readFile(file, "utf8"));
}

describe("writeMachinaHandoffBundle", () => {
  it("writes a manifest-only bundle", async () => {
    const outputDir = await tempDir();
    const result = await writeMachinaHandoffBundle({
      outputDir,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.paths.manifest).toBe(path.join(outputDir, "machina-handoff__handoff.json"));
    await expect(stat(result.paths.manifest)).resolves.toBeTruthy();
    const manifest = await readJson(result.paths.manifest);
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      artifacts: { manifest: "machina-handoff__handoff.json" },
    });
    expect(path.isAbsolute(result.paths.manifest)).toBe(true);
  });

  it("writes provided DOM summary and layout snapshot JSON", async () => {
    const outputDir = await tempDir();
    const domSummary = { schemaVersion: 1 as const, nodes: [] };
    const layoutSnapshot = { nodes: { root: { rect: { x: 0, y: 0, width: 1, height: 1 } } } };
    const result = await writeMachinaHandoffBundle({
      outputDir,
      artifactBaseName: "Case",
      domSummary,
      layoutSnapshot,
    });
    expect(await readJson(result.paths.domSummary!)).toEqual(domSummary);
    expect(await readJson(result.paths.layoutSnapshot!)).toEqual(layoutSnapshot);
    expect(result.manifest.artifacts).toMatchObject({
      domSummary: "case__dom-summary.json",
      layoutSnapshot: "case__machina-snapshot.json",
    });
  });

  it("copies an existing screenshot with preserved extension", async () => {
    const outputDir = await tempDir();
    const source = path.join(outputDir, "source.png");
    await writeFile(source, "fake png bytes");
    const result = await writeMachinaHandoffBundle({
      outputDir,
      artifactBaseName: "Shot",
      screenshotPath: source,
    });
    expect(await readFile(result.paths.screenshot!, "utf8")).toBe("fake png bytes");
    expect(result.manifest.artifacts.screenshot).toBe("shot__screenshot.png");
  });

  it("integrates task metadata", async () => {
    const outputDir = await tempDir();
    const task: MachinaScreenViewportTask = {
      key: "settings-phone",
      screenKey: "settings",
      viewportKey: "phone",
      route: "/settings",
      fixture: "default",
      viewport: { key: "phone", width: 390, height: 844, tags: ["mobile"] },
      screen: { key: "settings", route: "/settings", fixture: "default", tags: ["screen"] },
      tags: ["screen", "phone"],
      artifactBaseName: "settings-phone",
    };
    const result = await writeMachinaHandoffBundle({ outputDir, task, createdAt: "fixed" });
    expect(result.manifest).toMatchObject({
      route: "/settings",
      fixture: "default",
      screenKey: "settings",
      viewportKey: "phone",
      viewport: task.viewport,
      tags: ["screen", "phone"],
      artifactBaseName: "settings-phone",
    });
  });

  it("merges and de-duplicates tags preserving order", async () => {
    const outputDir = await tempDir();
    const task = {
      tags: ["a", "b"],
      route: "/r",
      viewportKey: "desktop",
      screenKey: "s",
      viewport: { key: "desktop", width: 1, height: 1 },
      screen: { key: "s", route: "/r" },
      key: "k",
      artifactBaseName: "k",
    } satisfies MachinaScreenViewportTask;
    const result = await writeMachinaHandoffBundle({ outputDir, task, tags: ["b", "c", "a"] });
    expect(result.manifest.tags).toEqual(["a", "b", "c"]);
  });

  it("slugs artifact base names", async () => {
    const outputDir = await tempDir();
    const result = await writeMachinaHandoffBundle({
      outputDir,
      artifactBaseName: "Provider Setup / Phone!",
    });
    expect(path.basename(result.paths.manifest)).toBe("provider-setup-phone__handoff.json");
  });

  it("rejects empty outputDir", async () => {
    await expect(writeMachinaHandoffBundle({ outputDir: "" })).rejects.toThrow("outputDir");
  });

  it("does not mutate input objects", async () => {
    const outputDir = await tempDir();
    const input = {
      outputDir,
      tags: ["b"],
      metadata: { nested: { ok: true } },
      domSummary: { schemaVersion: 1 as const, nodes: [] },
    };
    const before = JSON.stringify(input);
    await writeMachinaHandoffBundle(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
