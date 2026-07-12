import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CanvasWorkflowManifest } from "../../src/canvasWorkflow";

export async function readTextFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeTextFile(path: string, text: string): Promise<void> {
  await ensureDirectory(dirname(path));
  await writeFile(path, text, "utf8");
}

export async function writeCanvasWorkflowManifest(
  path: string,
  manifest: CanvasWorkflowManifest,
): Promise<void> {
  await writeTextFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}
