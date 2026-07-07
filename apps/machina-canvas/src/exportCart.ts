import {
  createCanvasExportBundle,
  serializeCompiledRuntimeSpriteToml,
  serializeCanvasRenderSvg,
  type CanvasExportBundle,
  type CanvasExportFile,
} from "./canvasExport";
import {
  formatCanvasExportValidationReport,
  validateCanvasExportBundle,
} from "./canvasExportValidation";
import { lowerCanvasDocumentToRasterBlob, normalizeRasterExportOptions } from "./rasterExport";
import type { CanvasEditorModeId } from "./editorModes";
import type { CanvasDocument, CanvasObject, ImageObject, SpriteSidecarObject } from "./sceneModel";
import { summarizeScene } from "./sceneSummary";
import { isMechanicalA4LandscapeSheet } from "./mechanicalAnnotations";
import {
  buildSpriteAuditReport,
  createSpriteAuditScreenshotDocument,
  formatSpriteAuditReport,
} from "./spriteAudit";
import { compileSpriteRuntimeSidecar, formatSpriteGuideCompileReport } from "./spriteGuideCompiler";
import { lowerCanvasDocumentToTsx } from "./tsxExport";

export type CanvasExportArtifactKind =
  | "mcanvas"
  | "documentJson"
  | "handoffToml"
  | "renderSvg"
  | "renderPng"
  | "spriteToml"
  | "spriteCompileReport"
  | "guideToml"
  | "blockoutToml"
  | "mechanicalJson"
  | "sketchToml"
  | "spriteAudit"
  | "diagnostics"
  | "frameTable"
  | "checkpoint"
  | "other";

export type CanvasExportArtifact = {
  readonly id: string;
  readonly kind: CanvasExportArtifactKind;
  readonly title: string;
  readonly description: string;
  readonly filename: string;
  readonly selectedByDefault: boolean;
  readonly required?: boolean;
  readonly dependsOn?: readonly string[];
  readonly sourceObjectId?: string;
  readonly group?: string;
  readonly create: () => Promise<Blob | string> | Blob | string;
};

export type CanvasExportCart = {
  readonly selectedArtifactIds: readonly string[];
  readonly presetId?: string;
  readonly checkoutMode: "downloadBundle" | "downloadFiles" | "copyText";
};

export type CanvasExportPreset = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly artifactKinds: readonly CanvasExportArtifactKind[];
  readonly artifactIds?: readonly string[];
};

export type CanvasCheckpoint = {
  readonly kind: "canvasCheckpoint";
  readonly id: string;
  readonly createdAt: string;
  readonly message?: string;
  readonly activeModeId?: CanvasEditorModeId;
  readonly scene: CanvasDocument;
  readonly selectedObjectId?: string;
  readonly selectedSpriteFrameId?: string;
  readonly overlaySettings?: unknown;
};

export type CanvasExportManifest = {
  readonly kind: "canvasExportManifest";
  readonly id: string;
  readonly createdAt: string;
  readonly activeModeId?: string;
  readonly artifactCount: number;
  readonly artifacts: readonly {
    readonly id: string;
    readonly kind: CanvasExportArtifactKind;
    readonly filename: string;
    readonly title: string;
    readonly sourceObjectId?: string;
  }[];
};

export type CanvasExportCheckoutResult =
  | {
      readonly kind: "ok";
      readonly artifactCount: number;
      readonly filenames: readonly string[];
      readonly manifest?: CanvasExportManifest;
    }
  | {
      readonly kind: "err";
      readonly message: string;
      readonly failedArtifactId?: string;
    };

export const CANVAS_EXPORT_PRESETS: readonly CanvasExportPreset[] = [
  {
    id: "sprite-handoff",
    title: "Sprite handoff",
    description:
      "Runtime-facing sprite exports: compiled sprite TOML, compile/audit reports, diagnostics, and handoff metadata.",
    artifactKinds: [
      "spriteToml",
      "spriteAudit",
      "spriteCompileReport",
      "diagnostics",
      "handoffToml",
      "other",
    ],
    artifactIds: ["tsx-export"],
  },
  {
    id: "visual-review",
    title: "Visual review",
    description:
      "Rendered previews and reports for human review, including mechanical annotations when the sheet uses drafting overlays.",
    artifactKinds: ["renderSvg", "renderPng", "diagnostics", "spriteAudit"],
  },
  {
    id: "full-archive",
    title: "Full archive",
    description:
      "Broad source + runtime archive: editable scene/source records, authoring sidecars including mechanical sheets, reports, and rendered artifacts.",
    artifactKinds: [
      "documentJson",
      "handoffToml",
      "renderSvg",
      "renderPng",
      "spriteToml",
      "spriteCompileReport",
      "guideToml",
      "blockoutToml",
      "mechanicalJson",
      "sketchToml",
      "spriteAudit",
      "diagnostics",
      "frameTable",
      "other",
    ],
  },
  {
    id: "source-checkpoint",
    title: "Source checkpoint",
    description:
      "Work-in-progress editor state for resuming later, not a runtime/export deliverable.",
    artifactKinds: ["checkpoint", "documentJson"],
  },
] as const;

type CheckoutEntry = {
  artifact: CanvasExportArtifact;
  filename: string;
  mimeType: string;
  payload: Blob | string;
};

function sanitizePathId(id: string): string {
  const sanitized = id.replace(/[^A-Za-z0-9._-]/g, "-");
  return sanitized.length > 0 ? sanitized : "untitled";
}

function inferMimeType(filename: string, payload: Blob | string): string {
  if (payload instanceof Blob && payload.type) return payload.type;
  if (filename.endsWith(".json")) return "application/json";
  if (filename.endsWith(".svg")) return "image/svg+xml";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".tsx")) return "text/typescript";
  if (filename.endsWith(".md")) return "text/markdown";
  if (filename.endsWith(".csv")) return "text/csv";
  if (filename.endsWith(".toml")) return "text/plain";
  return typeof payload === "string" ? "text/plain" : "application/octet-stream";
}

function getFile(bundle: CanvasExportBundle, path: string): CanvasExportFile {
  const file = bundle.files.find((candidate) => candidate.path === path);
  if (!file) {
    throw new Error(`Missing export file "${path}".`);
  }
  return file;
}

function getObjectAssetFilename(object: CanvasObject): string {
  if (object.kind === "sketchOverlay") {
    return `objects/${sanitizePathId(object.id)}.sketch.toml`;
  }
  if (object.kind === "guideSidecar") {
    return `objects/${sanitizePathId(object.id)}.guide.toml`;
  }
  if (object.kind === "blockoutSidecar") {
    return `objects/${sanitizePathId(object.id)}.blockout.toml`;
  }
  if (object.kind === "mechanicalAnnotationSidecar") {
    return `objects/${sanitizePathId(object.id)}.mechanical.json`;
  }
  if (object.kind === "spriteSidecar") {
    return `objects/${sanitizePathId(object.id)}.sprite.toml`;
  }
  return `objects/${sanitizePathId(object.id)}.toml`;
}

function getAttachedImage(
  document: CanvasDocument,
  sidecar: SpriteSidecarObject,
): ImageObject | undefined {
  if (!sidecar.targetId) return undefined;
  const target = document.objects[sidecar.targetId];
  return target?.kind === "image" ? target : undefined;
}

function getAttachedGuideSidecar(
  document: CanvasDocument,
  sidecar: SpriteSidecarObject,
): Extract<CanvasObject, { kind: "guideSidecar" }> | undefined {
  if (!sidecar.targetId) return undefined;
  return Object.values(document.objects).find(
    (object): object is Extract<CanvasObject, { kind: "guideSidecar" }> =>
      object.kind === "guideSidecar" && object.targetId === sidecar.targetId,
  );
}

function formatFrameTable(sidecar: SpriteSidecarObject): string {
  const header = [
    `# ${sidecar.name} frame table`,
    "",
    "| Frame | Label | X | Y | W | H | Source | Sprite | Animation |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |",
  ];
  const rows = sidecar.spec.frames.map(
    (frame) =>
      `| ${frame.id} | ${frame.label} | ${frame.x} | ${frame.y} | ${frame.width} | ${frame.height} | ${frame.sourceKind ?? "unknown"} | ${frame.spriteId ?? ""} | ${frame.animationId ?? ""} |`,
  );
  return `${[...header, ...rows].join("\n")}\n`;
}

function getSelectedSpriteFrameId(
  document: CanvasDocument,
  selectedObjectId?: string,
): string | undefined {
  if (!selectedObjectId) return undefined;
  const selected = document.objects[selectedObjectId];
  return selected?.kind === "spriteSidecar" ? selected.spec.selectedFrameId : undefined;
}

function hasMechanicalA4Sheet(scene: CanvasDocument): boolean {
  return Object.values(scene.objects).some(
    (object) =>
      object.kind === "mechanicalAnnotationSidecar" &&
      isMechanicalA4LandscapeSheet(object.annotations.sheet),
  );
}

function normalizeSelection(
  artifacts: readonly CanvasExportArtifact[],
  requestedIds: Iterable<string>,
): readonly string[] {
  const availableIds = new Set(artifacts.map((artifact) => artifact.id));
  const selected = new Set<string>();
  const queue = [...requestedIds];

  for (const artifact of artifacts) {
    if (artifact.required) {
      queue.push(artifact.id);
    }
  }

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || selected.has(id) || !availableIds.has(id)) continue;
    selected.add(id);
    const artifact = artifacts.find((candidate) => candidate.id === id);
    if (artifact?.dependsOn) {
      queue.push(...artifact.dependsOn);
    }
  }

  return artifacts.filter((artifact) => selected.has(artifact.id)).map((artifact) => artifact.id);
}

export function createExportCart(
  artifacts: readonly CanvasExportArtifact[],
  preset?: CanvasExportPreset,
): CanvasExportCart {
  if (preset) return applyExportPreset(artifacts, preset);
  return {
    selectedArtifactIds: normalizeSelection(
      artifacts,
      artifacts.filter((artifact) => artifact.selectedByDefault).map((artifact) => artifact.id),
    ),
    checkoutMode: "downloadFiles",
  };
}

export function applyExportPreset(
  artifacts: readonly CanvasExportArtifact[],
  preset: CanvasExportPreset,
): CanvasExportCart {
  const selectedIds = new Set<string>();
  for (const artifact of artifacts) {
    const kindMatch = preset.artifactKinds.includes(artifact.kind);
    const idMatch = preset.artifactIds?.includes(artifact.id) ?? false;
    if (kindMatch || idMatch) {
      selectedIds.add(artifact.id);
    }
  }
  return {
    selectedArtifactIds: normalizeSelection(artifacts, selectedIds),
    presetId: preset.id,
    checkoutMode: "downloadFiles",
  };
}

export function toggleExportArtifact(
  cart: CanvasExportCart,
  artifactId: string,
  artifacts?: readonly CanvasExportArtifact[],
): CanvasExportCart {
  const selected = new Set(cart.selectedArtifactIds);
  const artifact = artifacts?.find((candidate) => candidate.id === artifactId);
  if (selected.has(artifactId)) {
    if (artifact?.required) return cart;
    selected.delete(artifactId);
    return {
      ...cart,
      presetId: undefined,
      selectedArtifactIds: artifacts
        ? normalizeSelection(artifacts, selected)
        : [...selected].sort((a, b) => a.localeCompare(b)),
    };
  }
  selected.add(artifactId);
  return {
    ...cart,
    presetId: undefined,
    selectedArtifactIds: artifacts
      ? normalizeSelection(artifacts, selected)
      : [...selected].sort((a, b) => a.localeCompare(b)),
  };
}

export function reconcileExportCart(
  artifacts: readonly CanvasExportArtifact[],
  cart: CanvasExportCart | undefined,
  presets: readonly CanvasExportPreset[] = CANVAS_EXPORT_PRESETS,
): CanvasExportCart {
  if (!cart) return createExportCart(artifacts);
  if (cart.presetId) {
    const preset = presets.find((candidate) => candidate.id === cart.presetId);
    if (preset) {
      return applyExportPreset(artifacts, preset);
    }
  }
  return {
    ...cart,
    selectedArtifactIds: normalizeSelection(artifacts, cart.selectedArtifactIds),
  };
}

export function createCanvasCheckpoint(input: {
  readonly scene: CanvasDocument;
  readonly activeModeId?: CanvasEditorModeId;
  readonly selectedObjectId?: string;
  readonly selectedSpriteFrameId?: string;
  readonly message?: string;
  readonly overlaySettings?: unknown;
}): CanvasCheckpoint {
  return {
    kind: "canvasCheckpoint",
    id: `checkpoint-${sanitizePathId(input.scene.id)}`,
    createdAt: new Date().toISOString(),
    message: input.message,
    activeModeId: input.activeModeId,
    scene: input.scene,
    selectedObjectId: input.selectedObjectId,
    selectedSpriteFrameId: input.selectedSpriteFrameId,
    overlaySettings: input.overlaySettings,
  };
}

export function createCanvasCheckpointArtifact(input: {
  readonly scene: CanvasDocument;
  readonly activeModeId?: CanvasEditorModeId;
  readonly selectedObjectId?: string;
  readonly selectedSpriteFrameId?: string;
  readonly message?: string;
  readonly overlaySettings?: unknown;
}): CanvasExportArtifact {
  const checkpoint = createCanvasCheckpoint(input);
  const filename = `${sanitizePathId(input.scene.id)}.mcanvas-checkpoint.json`;
  return {
    id: "checkpoint",
    kind: "checkpoint",
    title: "Checkpoint",
    description: "Work-in-progress editor state for resuming later. Not a runtime/export artifact.",
    filename,
    selectedByDefault: false,
    group: "source",
    create: () => `${JSON.stringify(checkpoint, null, 2)}\n`,
  };
}

function createManifest(
  artifacts: readonly CanvasExportArtifact[],
  activeModeId?: string,
): CanvasExportManifest {
  return {
    kind: "canvasExportManifest",
    id: `export-manifest-${Date.now()}`,
    createdAt: new Date().toISOString(),
    activeModeId,
    artifactCount: artifacts.length,
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      filename: artifact.filename,
      title: artifact.title,
      sourceObjectId: artifact.sourceObjectId,
    })),
  };
}

export function collectCanvasExportArtifacts(input: {
  readonly scene: CanvasDocument;
  readonly activeModeId?: CanvasEditorModeId;
  readonly selectedObjectId?: string;
  readonly selectedSpriteFrameId?: string;
}): readonly CanvasExportArtifact[] {
  const bundle = createCanvasExportBundle(input.scene, {
    selectedObjectId: input.selectedObjectId,
    summary: summarizeScene(input.scene),
  });
  const isMechanicalA4 = hasMechanicalA4Sheet(input.scene);
  const artifacts: CanvasExportArtifact[] = [];

  artifacts.push({
    id: "document-json",
    kind: "documentJson",
    title: "Document index",
    description: "Scene graph, object index, and relation metadata for the current canvas.",
    filename: "document.json",
    selectedByDefault: true,
    group: "source",
    create: () => getFile(bundle, "document.json").text,
  });
  artifacts.push({
    id: "handoff-toml",
    kind: "handoffToml",
    title: "Handoff contract",
    description: "Bundle-level handoff metadata for downstream tools and pipelines.",
    filename: "handoff.toml",
    selectedByDefault: true,
    group: "handoff",
    create: () => getFile(bundle, "handoff.toml").text,
  });
  artifacts.push({
    id: "render-svg",
    kind: "renderSvg",
    title: isMechanicalA4 ? "A4 mechanical visual review" : "Rendered SVG",
    description: isMechanicalA4
      ? "Print-friendly SVG preview for A4 landscape office paper."
      : "Mechanical visual review: rendered SVG/preview with dimensions, notes, datums, and blocks when the scene includes drafting annotations.",
    filename: "render.svg",
    selectedByDefault: true,
    group: "review",
    create: () => getFile(bundle, "render.svg").text,
  });
  artifacts.push({
    id: "render-png",
    kind: "renderPng",
    title: "Rendered PNG",
    description: "Browser-lowered PNG snapshot of the current scene.",
    filename: "render.png",
    selectedByDefault: false,
    group: "review",
    create: async () =>
      lowerCanvasDocumentToRasterBlob(
        input.scene,
        normalizeRasterExportOptions({
          mimeType: "image/png",
          scale: 1,
          background: "transparent",
        }),
      ),
  });
  artifacts.push({
    id: "diagnostics-report",
    kind: "diagnostics",
    title: "Diagnostics report",
    description: "Validation report for the current exportable text bundle.",
    filename: "diagnostics-report.txt",
    selectedByDefault: true,
    group: "reports",
    create: () => formatCanvasExportValidationReport(validateCanvasExportBundle(bundle)),
  });
  artifacts.push(
    createCanvasCheckpointArtifact({
      scene: input.scene,
      activeModeId: input.activeModeId,
      selectedObjectId: input.selectedObjectId,
      selectedSpriteFrameId:
        input.selectedSpriteFrameId ??
        getSelectedSpriteFrameId(input.scene, input.selectedObjectId),
    }),
  );

  for (const object of Object.values(input.scene.objects)) {
    if (object.kind === "sketchOverlay") {
      const target =
        object.targetId !== undefined ? input.scene.objects[object.targetId] : undefined;
      artifacts.push({
        id: `sketch-toml:${object.id}`,
        kind: "sketchToml",
        title: `${object.name} sketch overlay`,
        description:
          target?.kind === "image"
            ? `Structured sketch overlay sidecar attached to ${target.name}.`
            : "Structured sketch overlay sidecar awaiting image attachment.",
        filename: getObjectAssetFilename(object),
        selectedByDefault: false,
        sourceObjectId: object.id,
        group: "sidecars",
        create: () => getFile(bundle, getObjectAssetFilename(object)).text,
      });
    }
    if (object.kind === "guideSidecar") {
      const target =
        object.targetId !== undefined ? input.scene.objects[object.targetId] : undefined;
      artifacts.push({
        id: `guide-toml:${object.id}`,
        kind: "guideToml",
        title: "Guide TOML (authoring)",
        description:
          target?.kind === "image"
            ? `Authoring guide IR for ${target.name}: regions, datums, dimensions, and alignment marks used only in the editor/source workflow.`
            : "Authoring guide IR awaiting image attachment. Guide regions and datums do not export into runtime sprite TOML.",
        filename: getObjectAssetFilename(object),
        selectedByDefault: false,
        sourceObjectId: object.id,
        group: "sidecars",
        create: () => getFile(bundle, getObjectAssetFilename(object)).text,
      });
    }
    if (object.kind === "blockoutSidecar") {
      const target =
        object.targetObjectId !== undefined
          ? input.scene.objects[object.targetObjectId]
          : undefined;
      artifacts.push({
        id: `blockout-toml:${object.id}`,
        kind: "blockoutToml",
        title: "Blockout TOML (authoring)",
        description:
          target !== undefined
            ? `Spatial feature/component mask IR for ${target.name}: boxes, points, and curves used during layout and authoring review.`
            : "Spatial feature/component mask IR awaiting attachment. Blockout remains authoring IR, not final geometry output.",
        filename: getObjectAssetFilename(object),
        selectedByDefault: false,
        sourceObjectId: object.id,
        group: "sidecars",
        create: () => getFile(bundle, getObjectAssetFilename(object)).text,
      });
    }
    if (object.kind === "mechanicalAnnotationSidecar") {
      const target =
        object.targetObjectId !== undefined
          ? input.scene.objects[object.targetObjectId]
          : undefined;
      artifacts.push({
        id: `mechanical-json:${object.id}`,
        kind: "mechanicalJson",
        title: "Mechanical drawing source",
        description:
          target !== undefined
            ? `Editable .mcanvas scene containing geometry and mechanical annotation records for ${target.name}. Mechanical annotation data includes dimensions, notes, datums, and title/revision/BOM table records.`
            : "Editable .mcanvas scene containing geometry and mechanical annotation records for the drawing sheet. Mechanical annotation data includes dimensions, notes, datums, and title/revision/BOM table records.",
        filename: getObjectAssetFilename(object),
        selectedByDefault: false,
        sourceObjectId: object.id,
        group: "sidecars",
        create: () => getFile(bundle, getObjectAssetFilename(object)).text,
      });
    }
    if (object.kind !== "spriteSidecar") continue;
    const image = getAttachedImage(input.scene, object);

    artifacts.push({
      id: `sprite-toml:${object.id}`,
      kind: "spriteToml",
      title: "Compiled sprite TOML",
      description: image
        ? `Runtime target for ${image.name}, compiled from the current sprite sidecar plus guide authoring data and safe for import/handoff pipelines.`
        : "Runtime sprite TOML awaiting image attachment.",
      filename: getObjectAssetFilename(object),
      selectedByDefault: false,
      sourceObjectId: object.id,
      group: "sidecars",
      create: () =>
        serializeCompiledRuntimeSpriteToml({
          spriteSidecar: object,
          guideSidecar: getAttachedGuideSidecar(input.scene, object),
        }),
    });

    artifacts.push({
      id: `sprite-toml-source:${object.id}`,
      kind: "other",
      title: "Sprite TOML (authoring source)",
      description: image
        ? `Authoring/source sprite sidecar for ${image.name}, preserving editor-facing metadata and legacy backcompat fields before runtime compile.`
        : "Authoring/source sprite sidecar TOML awaiting image attachment.",
      filename: `objects/${sanitizePathId(object.id)}.source.sprite.toml`,
      selectedByDefault: false,
      sourceObjectId: object.id,
      group: "source",
      create: () => getFile(bundle, getObjectAssetFilename(object)).text,
    });

    if (!image) continue;

    artifacts.push({
      id: `sprite-compile-report:${object.id}`,
      kind: "spriteCompileReport",
      title: "Sprite compile report",
      description: `How the runtime sprite TOML for ${image.name} was produced, including generated frames, preserved authored cuts, and overrides.`,
      filename: `reports/${sanitizePathId(object.id)}-sprite-compile.md`,
      selectedByDefault: true,
      sourceObjectId: object.id,
      group: "reports",
      create: () =>
        formatSpriteGuideCompileReport(
          compileSpriteRuntimeSidecar({
            spriteSidecar: object.spec,
            guideSidecar: getAttachedGuideSidecar(input.scene, object)?.guide,
            options: { mode: "runtime" },
          }).report,
        ),
    });

    artifacts.push({
      id: `sprite-audit:${object.id}`,
      kind: "spriteAudit",
      title: `${object.name} audit report`,
      description: `Geometry/cut quality audit for the sprite sidecar attached to ${image.name}, with findings and suggested fixes.`,
      filename: `reports/${sanitizePathId(object.id)}-sprite-audit.md`,
      selectedByDefault: true,
      sourceObjectId: object.id,
      group: "reports",
      create: () =>
        formatSpriteAuditReport(buildSpriteAuditReport(object, image, { document: input.scene })),
    });
    artifacts.push({
      id: `frame-table:${object.id}`,
      kind: "frameTable",
      title: `${object.name} frame table`,
      description: "Readable frame table for cut coordinates, source kinds, and labels.",
      filename: `reports/${sanitizePathId(object.id)}-frame-table.md`,
      selectedByDefault: false,
      sourceObjectId: object.id,
      group: "reports",
      create: () => formatFrameTable(object),
    });
    artifacts.push({
      id: `sprite-overlay-svg:${object.id}`,
      kind: "other",
      title: `${object.name} audit overlay`,
      description: "Overlay SVG snapshot showing sprite audit framing for visual review.",
      filename: `reports/${sanitizePathId(object.id)}-audit-overlay.svg`,
      selectedByDefault: false,
      sourceObjectId: object.id,
      group: "review",
      create: () =>
        serializeCanvasRenderSvg(
          createSpriteAuditScreenshotDocument(input.scene, object.id, "allFrames"),
        ),
    });
  }

  const hasUiComponent = Object.values(input.scene.objects).some(
    (object) => object.kind === "uiComponent",
  );
  if (hasUiComponent) {
    artifacts.push({
      id: "tsx-export",
      kind: "other",
      title: "Generated TSX page",
      description: "Lossy TSX lowering for web/UI component handoff.",
      filename: "generated-page.tsx",
      selectedByDefault: false,
      group: "webUi",
      create: () => lowerCanvasDocumentToTsx(input.scene, { componentName: "GeneratedPage" }).text,
    });
  }

  return artifacts;
}

export async function materializeExportCart(input: {
  readonly artifacts: readonly CanvasExportArtifact[];
  readonly cart: CanvasExportCart;
  readonly activeModeId?: string;
  readonly manifestFilename?: string;
}): Promise<
  | {
      readonly kind: "ok";
      readonly entries: readonly CheckoutEntry[];
      readonly manifest?: CanvasExportManifest;
    }
  | {
      readonly kind: "err";
      readonly message: string;
      readonly failedArtifactId?: string;
    }
> {
  const selected = input.artifacts.filter((artifact) =>
    input.cart.selectedArtifactIds.includes(artifact.id),
  );
  const entries: CheckoutEntry[] = [];

  for (const artifact of selected) {
    try {
      const payload = await artifact.create();
      entries.push({
        artifact,
        filename: artifact.filename,
        mimeType: inferMimeType(artifact.filename, payload),
        payload,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Could not create ${artifact.title}.`;
      return { kind: "err", message, failedArtifactId: artifact.id };
    }
  }

  let manifest: CanvasExportManifest | undefined;
  if (entries.length > 1) {
    manifest = createManifest(selected, input.activeModeId);
    entries.push({
      artifact: {
        id: "export-manifest",
        kind: "other",
        title: "Export manifest",
        description: "Checkout manifest listing every artifact included in this export.",
        filename: input.manifestFilename ?? "export-manifest.json",
        selectedByDefault: true,
        create: () => `${JSON.stringify(manifest, null, 2)}\n`,
      },
      filename: input.manifestFilename ?? "export-manifest.json",
      mimeType: "application/json",
      payload: `${JSON.stringify(manifest, null, 2)}\n`,
    });
  }

  return { kind: "ok", entries, manifest };
}

function downloadEntry(entry: CheckoutEntry) {
  if (typeof window === "undefined" || typeof globalThis.document === "undefined") return;
  const blob =
    entry.payload instanceof Blob
      ? entry.payload
      : new Blob([entry.payload], { type: entry.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  anchor.href = url;
  anchor.download = entry.filename.replace(/\//g, "__");
  globalThis.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyTextCheckout(entries: readonly CheckoutEntry[]): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard API is unavailable in this browser.");
  }
  const textEntries = entries.filter((entry) => typeof entry.payload === "string");
  const combined = textEntries
    .map((entry) => `# ${entry.filename}\n\n${entry.payload}`)
    .join("\n\n");
  await navigator.clipboard.writeText(combined);
}

export async function checkoutExportCart(input: {
  readonly artifacts: readonly CanvasExportArtifact[];
  readonly cart: CanvasExportCart;
  readonly activeModeId?: string;
  readonly manifestFilename?: string;
}): Promise<CanvasExportCheckoutResult> {
  const materialized = await materializeExportCart(input);
  if (materialized.kind === "err") return materialized;

  try {
    if (input.cart.checkoutMode === "copyText") {
      await copyTextCheckout(materialized.entries);
    } else {
      for (const entry of materialized.entries) {
        downloadEntry(entry);
      }
    }
  } catch (error) {
    return {
      kind: "err",
      message: error instanceof Error ? error.message : "Checkout failed.",
    };
  }

  return {
    kind: "ok",
    artifactCount: materialized.entries.length,
    filenames: materialized.entries.map((entry) => entry.filename),
    manifest: materialized.manifest,
  };
}
