import {
  slugMachinaArtifactName
} from "../chunk-33CKBEJH.js";
import "../chunk-VREK57S3.js";

// src/handoff/writeMachinaHandoffBundle.ts
import { copyFile, mkdir, writeFile } from "fs/promises";
import path from "path";
function artifactBaseName(input) {
  const candidate = input.artifactBaseName ?? input.task?.artifactBaseName ?? [
    input.route ?? input.task?.route,
    input.fixture ?? input.task?.fixture,
    input.task?.viewportKey
  ].filter((part) => typeof part === "string" && part.trim() !== "").join("-") ?? "";
  return slugMachinaArtifactName(candidate === "" ? "machina-handoff" : candidate);
}
function orderedUnique(...groups) {
  const result = [];
  for (const group of groups) {
    for (const tag of group ?? []) {
      if (!result.includes(tag)) result.push(tag);
    }
  }
  return result.length === 0 ? void 0 : result;
}
function json(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
function screenshotExtension(screenshotPath) {
  const extension = path.extname(screenshotPath);
  return extension === "" ? ".png" : extension;
}
async function writeMachinaHandoffBundle(input) {
  if (typeof input.outputDir !== "string" || input.outputDir.trim() === "") {
    throw new Error("outputDir must be a non-empty string");
  }
  const outputDir = path.resolve(input.outputDir);
  await mkdir(outputDir, { recursive: true });
  const base = artifactBaseName(input);
  const artifactNames = { manifest: `${base}__handoff.json` };
  const paths = {
    manifest: path.join(outputDir, artifactNames.manifest)
  };
  if (input.screenshotPath !== void 0) {
    artifactNames.screenshot = `${base}__screenshot${screenshotExtension(input.screenshotPath)}`;
    paths.screenshot = path.join(outputDir, artifactNames.screenshot);
    await copyFile(input.screenshotPath, paths.screenshot);
  }
  if (input.domSummary !== void 0) {
    artifactNames.domSummary = `${base}__dom-summary.json`;
    paths.domSummary = path.join(outputDir, artifactNames.domSummary);
    await writeFile(paths.domSummary, json(input.domSummary), "utf8");
  }
  if (input.layoutSnapshot !== void 0) {
    artifactNames.layoutSnapshot = `${base}__machina-snapshot.json`;
    paths.layoutSnapshot = path.join(outputDir, artifactNames.layoutSnapshot);
    await writeFile(paths.layoutSnapshot, json(input.layoutSnapshot), "utf8");
  }
  const tags = orderedUnique(input.task?.tags, input.tags);
  const manifest = {
    schemaVersion: 1,
    createdAt: input.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    artifacts: artifactNames
  };
  const route = input.route ?? input.task?.route;
  const fixture = input.fixture ?? input.task?.fixture;
  if (route !== void 0) manifest.route = route;
  if (fixture !== void 0) manifest.fixture = fixture;
  if (input.task !== void 0) {
    manifest.screenKey = input.task.screenKey;
    manifest.viewportKey = input.task.viewportKey;
    manifest.viewport = input.task.viewport;
  }
  if (tags !== void 0) manifest.tags = tags;
  manifest.artifactBaseName = base;
  if (input.metadata !== void 0) manifest.metadata = input.metadata;
  await writeFile(paths.manifest, json(manifest), "utf8");
  return { manifest, paths };
}
export {
  writeMachinaHandoffBundle
};
