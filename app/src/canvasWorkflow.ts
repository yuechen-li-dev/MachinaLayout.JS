import {
  collectCanvasExportArtifacts,
  materializeExportCart,
  type CanvasExportArtifact,
  type CanvasExportCart,
} from "./exportCart";
import { createCanvasUnitSystem } from "./canvasUnits";
import type { CanvasEditorModeId } from "./editorModes";
import {
  createBlockoutSidecarObject,
  parseBlockoutSidecarToml,
  type CanvasBlockoutSidecar,
} from "./blockoutSidecar";
import {
  createGuideSidecarObject,
  parseGuideSidecarToml,
  type CanvasGuideSidecar,
} from "./guideSidecar";
import type { CanvasDocument, ImageObject, SpriteSidecarObject } from "./sceneModel";
import {
  buildSpriteAuditReport,
  formatSpriteAuditReport,
  type SpriteAuditReport,
} from "./spriteAudit";
import {
  compileSpriteRuntimeSidecar,
  formatSpriteGuideCompileReport,
  type SpriteGuideCompileOptions,
  type SpriteGuideCompileReport,
} from "./spriteGuideCompiler";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
  type SpriteSidecar,
  type SpriteTomlExportOptions,
} from "./spriteSidecar";
import { serializeCanvasSpriteToml } from "./canvasExport";

export type CanvasWorkflowLogLevel = "info" | "warning" | "error" | "success";

export type CanvasWorkflowLogEntry = {
  readonly level: CanvasWorkflowLogLevel;
  readonly message: string;
  readonly at: string;
};

export type CanvasWorkflowArtifact = {
  readonly kind: string;
  readonly path: string;
  readonly description?: string;
};

export type CanvasWorkflowResult = {
  readonly kind: "ok" | "err";
  readonly logs: readonly CanvasWorkflowLogEntry[];
  readonly artifacts: readonly CanvasWorkflowArtifact[];
  readonly error?: string;
};

export type CanvasWorkflowManifest = {
  readonly kind: "canvasWorkflowManifest";
  readonly workflow: string;
  readonly createdAt: string;
  readonly artifacts: readonly CanvasWorkflowArtifact[];
  readonly logs: readonly CanvasWorkflowLogEntry[];
};

export type CanvasWorkflowContext = {
  readonly cwd: string;
  readonly logs: readonly CanvasWorkflowLogEntry[];
  readonly artifacts: readonly CanvasWorkflowArtifact[];
  log(level: CanvasWorkflowLogLevel, message: string): void;
  artifact(kind: string, path: string, description?: string): void;
};

export type CanvasWorkflowClock = () => Date;

type WorkflowSpriteTomlInput =
  | string
  | {
      readonly source: string;
      readonly id: string;
      readonly name: string;
      readonly targetId?: string;
      readonly sourceName?: string;
    };

type WorkflowImageInput = {
  readonly id: string;
  readonly name?: string;
  readonly layerId?: string;
  readonly src?: string;
  readonly width: number;
  readonly height: number;
  readonly x?: number;
  readonly y?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatWorkflowError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeNow(now?: CanvasWorkflowClock): Date {
  return now ? now() : new Date();
}

function createIsoTimestamp(now?: CanvasWorkflowClock): string {
  return normalizeNow(now).toISOString();
}

function parseCanvasDocument(value: unknown): CanvasDocument {
  if (!isRecord(value)) {
    throw new Error("Canvas workflow document JSON must contain a top-level object.");
  }
  if (!Array.isArray(value.layers)) {
    throw new Error("Canvas workflow document JSON must contain a layers array.");
  }
  if (!isRecord(value.objects)) {
    throw new Error("Canvas workflow document JSON must contain an objects table.");
  }
  return value as CanvasDocument;
}

function createWorkflowImageObject(input: WorkflowImageInput): ImageObject {
  return {
    id: input.id,
    name: input.name ?? input.id,
    kind: "image",
    layerId: input.layerId ?? "workflow",
    visible: true,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width,
    height: input.height,
    src: input.src ?? "",
    role: "image",
    intrinsicWidth: input.width,
    intrinsicHeight: input.height,
    fit: "fill",
  };
}

function createRuntimeSpriteSidecarObject(spriteSidecar: SpriteSidecar): SpriteSidecarObject {
  const width = spriteSidecar.atlasWidth ?? 1;
  const height = spriteSidecar.atlasHeight ?? 1;
  const image = createWorkflowImageObject({
    id: spriteSidecar.targetId ?? "workflow-image",
    name: spriteSidecar.targetId ?? "workflow-image",
    width,
    height,
  });
  return attachSpriteSidecarToImage(image, spriteSidecar, {
    id: spriteSidecar.id ?? "workflow-sprite-sidecar",
    name: spriteSidecar.sourceName ?? "workflow.sprite.toml",
  });
}

export function createCanvasWorkflowContext(input: {
  readonly cwd: string;
  readonly now?: CanvasWorkflowClock;
}): CanvasWorkflowContext {
  const logs: CanvasWorkflowLogEntry[] = [];
  const artifacts: CanvasWorkflowArtifact[] = [];

  return {
    cwd: input.cwd,
    get logs() {
      return logs;
    },
    get artifacts() {
      return artifacts;
    },
    log(level, message) {
      logs.push({
        level,
        message,
        at: createIsoTimestamp(input.now),
      });
    },
    artifact(kind, path, description) {
      artifacts.push({ kind, path, description });
    },
  };
}

export function createCanvasWorkflowManifest(input: {
  readonly workflow: string;
  readonly context: Pick<CanvasWorkflowContext, "artifacts" | "logs">;
  readonly now?: CanvasWorkflowClock;
}): CanvasWorkflowManifest {
  return {
    kind: "canvasWorkflowManifest",
    workflow: input.workflow,
    createdAt: createIsoTimestamp(input.now),
    artifacts: [...input.context.artifacts],
    logs: [...input.context.logs],
  };
}

export function loadCanvasDocumentFromJson(source: string): CanvasDocument {
  return parseCanvasDocument(JSON.parse(source));
}

export function loadSpriteSidecarFromToml(input: WorkflowSpriteTomlInput): SpriteSidecar {
  if (typeof input === "string") {
    return parseSpriteSidecarToml(input, {
      id: "workflow-sprite-sidecar",
      name: "Workflow sprite sidecar",
      sourceName: "workflow.sprite.toml",
    });
  }
  return parseSpriteSidecarToml(input.source, {
    id: input.id,
    name: input.name,
    targetId: input.targetId,
    sourceName: input.sourceName,
  });
}

export function loadGuideSidecarFromToml(source: string): CanvasGuideSidecar {
  return parseGuideSidecarToml(source);
}

export function loadBlockoutSidecarFromToml(source: string): CanvasBlockoutSidecar {
  return parseBlockoutSidecarToml(source);
}

export function attachSpriteSidecarToImage(
  image: ImageObject,
  spriteSidecar: SpriteSidecar,
  options?: { readonly id?: string; readonly name?: string; readonly layerId?: string },
): SpriteSidecarObject {
  const sidecar = createSpriteSidecarObject(image, spriteSidecar);
  return {
    ...sidecar,
    id: options?.id ?? sidecar.id,
    name: options?.name ?? sidecar.name,
    layerId: options?.layerId ?? sidecar.layerId,
    spec: {
      ...sidecar.spec,
      id: options?.id ?? sidecar.spec.id,
      name: options?.name ?? sidecar.spec.name,
    },
  };
}

export function attachGuideSidecarToImage(
  image: ImageObject,
  guideSidecar: CanvasGuideSidecar,
  options?: { readonly id?: string; readonly name?: string; readonly layerId?: string },
) {
  return createGuideSidecarObject(image, guideSidecar, options);
}

export function attachBlockoutToImage(
  image: ImageObject,
  blockoutSidecar: CanvasBlockoutSidecar,
  options?: { readonly id?: string; readonly name?: string; readonly layerId?: string },
) {
  return createBlockoutSidecarObject(image, blockoutSidecar, options);
}

export function compileSpriteRuntimeToml(input: {
  readonly spriteSidecar: SpriteSidecar;
  readonly guideSidecar?: CanvasGuideSidecar;
  readonly options?: SpriteTomlExportOptions & SpriteGuideCompileOptions;
}): {
  readonly spriteSidecar: SpriteSidecar;
  readonly toml: string;
  readonly report: SpriteGuideCompileReport;
  readonly reportMarkdown: string;
} {
  const compiled = compileSpriteRuntimeSidecar(input);
  const runtimeObject = createRuntimeSpriteSidecarObject(compiled.spriteSidecar);
  return {
    spriteSidecar: compiled.spriteSidecar,
    toml: serializeCanvasSpriteToml(runtimeObject, { mode: "runtime" }),
    report: compiled.report,
    reportMarkdown: formatSpriteGuideCompileReport(compiled.report),
  };
}

export function auditSpriteWorkflow(input: {
  readonly spriteSidecar: SpriteSidecar;
  readonly guideSidecar?: CanvasGuideSidecar;
  readonly imageWidth?: number;
  readonly imageHeight?: number;
  readonly imageId?: string;
  readonly imageName?: string;
}): {
  readonly report: SpriteAuditReport;
  readonly reportMarkdown: string;
} {
  const width = input.imageWidth ?? input.spriteSidecar.atlasWidth ?? 1;
  const height = input.imageHeight ?? input.spriteSidecar.atlasHeight ?? 1;
  const image = createWorkflowImageObject({
    id: input.imageId ?? input.spriteSidecar.targetId ?? "workflow-image",
    name: input.imageName ?? input.spriteSidecar.targetId ?? "Workflow image",
    width,
    height,
  });
  const sidecar = attachSpriteSidecarToImage(image, input.spriteSidecar);
  const guide = input.guideSidecar
    ? attachGuideSidecarToImage(image, input.guideSidecar)
    : undefined;
  const document =
    guide === undefined
      ? undefined
      : ({
          name: "Workflow audit scene",
          id: "workflow-audit-scene",
          width,
          height,
          unit: "px",
          unitSystem: createCanvasUnitSystem("px"),
          layers: [
            {
              id: "workflow",
              name: "Workflow",
              visible: true,
              objectIds: [image.id, sidecar.id, guide.id],
            },
          ],
          objects: {
            [image.id]: image,
            [sidecar.id]: sidecar,
            [guide.id]: guide,
          },
          activeLayerId: "workflow",
          selectedObjectId: sidecar.id,
        } as CanvasDocument);
  const report = buildSpriteAuditReport(sidecar, image, { document });
  return {
    report,
    reportMarkdown: formatSpriteAuditReport(report),
  };
}

export function collectCanvasWorkflowExportArtifacts(input: {
  readonly scene: CanvasDocument;
  readonly selectedObjectId?: string;
  readonly selectedSpriteFrameId?: string;
  readonly activeModeId?: CanvasEditorModeId;
}): readonly CanvasExportArtifact[] {
  return collectCanvasExportArtifacts(input);
}

export async function checkoutCanvasWorkflowExportCart(input: {
  readonly artifacts: readonly CanvasExportArtifact[];
  readonly cart: CanvasExportCart;
  readonly activeModeId?: CanvasEditorModeId;
  readonly manifestFilename?: string;
}) {
  return materializeExportCart(input);
}

export async function runCanvasWorkflow(
  name: string,
  workflow: (context: CanvasWorkflowContext) => Promise<void> | void,
  options: {
    readonly cwd: string;
    readonly now?: CanvasWorkflowClock;
  },
): Promise<CanvasWorkflowResult> {
  const context = createCanvasWorkflowContext(options);
  context.log("info", `Starting workflow "${name}" in ${context.cwd}.`);
  try {
    await workflow(context);
    context.log(
      "success",
      `Completed workflow "${name}" with ${context.artifacts.length} artifact${context.artifacts.length === 1 ? "" : "s"}.`,
    );
    return {
      kind: "ok",
      logs: [...context.logs],
      artifacts: [...context.artifacts],
    };
  } catch (error) {
    const message = formatWorkflowError(error);
    context.log("error", `Workflow "${name}" failed in ${context.cwd}: ${message}`);
    return {
      kind: "err",
      logs: [...context.logs],
      artifacts: [...context.artifacts],
      error: message,
    };
  }
}
