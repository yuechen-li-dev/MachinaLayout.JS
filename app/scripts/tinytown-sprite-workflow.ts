import process from "node:process";
import {
  createCanvasWorkflowManifest,
  runCanvasWorkflow,
  type CanvasWorkflowContext,
  type CanvasWorkflowResult,
} from "../src/canvasWorkflow";
import {
  TINYTOWN_WORKFLOW_ARTIFACT_PATHS,
  generateTinyTownSpriteArtifacts,
} from "./generate-tinytown-sprite-artifacts";
import { writeCanvasWorkflowManifest, writeTextFile } from "./workflow/files";

const TINYTOWN_WORKFLOW_NAME = "tinytown sprite workflow";

async function materializeTinyTownArtifacts(context: CanvasWorkflowContext): Promise<void> {
  context.log(
    "info",
    `Generating TinyTown guide/runtime/audit artifacts into ${TINYTOWN_WORKFLOW_ARTIFACT_PATHS.runtimeToml}.`,
  );
  const artifacts = generateTinyTownSpriteArtifacts();

  await writeTextFile(TINYTOWN_WORKFLOW_ARTIFACT_PATHS.guideToml, artifacts.guideToml);
  context.log(
    "info",
    `Wrote guide authoring TOML to ${TINYTOWN_WORKFLOW_ARTIFACT_PATHS.guideToml}.`,
  );
  context.artifact(
    "guideToml",
    TINYTOWN_WORKFLOW_ARTIFACT_PATHS.guideToml,
    "TinyTown guide-sidecar authoring IR artifact.",
  );

  await writeTextFile(TINYTOWN_WORKFLOW_ARTIFACT_PATHS.runtimeToml, artifacts.runtimeToml);
  context.log(
    "info",
    `Wrote compiled runtime sprite TOML to ${TINYTOWN_WORKFLOW_ARTIFACT_PATHS.runtimeToml}.`,
  );
  context.artifact(
    "spriteToml",
    TINYTOWN_WORKFLOW_ARTIFACT_PATHS.runtimeToml,
    "Compiled TinyTown runtime sprite TOML artifact.",
  );

  await writeTextFile(TINYTOWN_WORKFLOW_ARTIFACT_PATHS.compileReport, artifacts.compileReport);
  context.log(
    "info",
    `Wrote sprite compile report to ${TINYTOWN_WORKFLOW_ARTIFACT_PATHS.compileReport}.`,
  );
  context.artifact(
    "compileReport",
    TINYTOWN_WORKFLOW_ARTIFACT_PATHS.compileReport,
    "TinyTown workflow compile report.",
  );

  await writeTextFile(TINYTOWN_WORKFLOW_ARTIFACT_PATHS.auditReport, artifacts.auditReport);
  context.log(
    "info",
    `Wrote sprite audit report to ${TINYTOWN_WORKFLOW_ARTIFACT_PATHS.auditReport}.`,
  );
  context.artifact(
    "auditReport",
    TINYTOWN_WORKFLOW_ARTIFACT_PATHS.auditReport,
    "TinyTown workflow sprite audit report.",
  );

  context.artifact(
    "overlayPng",
    artifacts.overlayPath,
    "TinyTown workflow overlay preview showing guide regions and compiled sprite cuts.",
  );

  context.artifact(
    "workflowManifest",
    TINYTOWN_WORKFLOW_ARTIFACT_PATHS.manifest,
    "TinyTown workflow execution manifest listing logs and written artifacts.",
  );
  const manifest = createCanvasWorkflowManifest({
    workflow: TINYTOWN_WORKFLOW_NAME,
    context,
  });
  await writeCanvasWorkflowManifest(TINYTOWN_WORKFLOW_ARTIFACT_PATHS.manifest, manifest);
  context.log("info", `Wrote workflow manifest to ${TINYTOWN_WORKFLOW_ARTIFACT_PATHS.manifest}.`);
}

export async function runTinyTownSpriteWorkflow(): Promise<CanvasWorkflowResult> {
  return runCanvasWorkflow(TINYTOWN_WORKFLOW_NAME, materializeTinyTownArtifacts, {
    cwd: process.cwd(),
  });
}
