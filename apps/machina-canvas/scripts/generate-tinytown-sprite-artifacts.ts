import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { serializeCanvasSpriteToml } from "../src/canvasExport";
import {
  parseGuideSidecarToml,
  stringifyGuideSidecarToml,
  validateGuideSidecar,
  type CanvasGuideSidecar,
} from "../src/guideSidecar";
import type {
  CanvasSpriteAnimation,
  CanvasSpriteFrame,
  CanvasSpriteSpec,
  CanvasSpriteStackframe,
  ImageObject,
} from "../src/sceneModel";
import { buildSpriteAuditReport, formatSpriteAuditReport } from "../src/spriteAudit";
import { createSpriteSidecarObject, parseSpriteSidecarToml } from "../src/spriteSidecar";
import { parseTomlDocument, stringifyTomlDocument } from "../src/tomlSyntax";

type TomlTable = Record<string, unknown>;

type TinyTownArtifacts = {
  guideToml: string;
  runtimeToml: string;
  compileReport: string;
  auditReport: string;
  overlayPath: string;
};

type OverlayPayload = {
  imagePath: string;
  outputPath: string;
  guideRegions: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  stackFrames: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  explicitFrames: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  highlightFrameId?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../..");
const artifactsDir = join(repoRoot, "apps", "machina-canvas", "artifacts");
const dominatusSpritesDir =
  "C:\\Users\\yuech\\source\\repos\\Dominatus\\samples\\Dominatus.GodotTinyTown\\assets\\sprites";
const sourceImagePath = join(dominatusSpritesDir, "tinytown_sprite_alpha.png");
const sourceSpriteTomlPath = join(dominatusSpritesDir, "tinytown_sprite_alpha.sprite.toml");
const sourceSpriteforgeTomlPath = join(
  dominatusSpritesDir,
  "tinytown_sprite_alpha.spriteforge.toml",
);
const fixtureImagePath = join(
  repoRoot,
  "apps",
  "machina-canvas",
  "public",
  "assets",
  "tinytown_sprite_alpha.png",
);
export const TINYTOWN_WORKFLOW_ARTIFACT_PATHS = {
  guideToml: join(artifactsDir, "tinytown_sprite_alpha.guide.toml"),
  runtimeToml: join(artifactsDir, "tinytown_sprite_alpha.compiled.sprite.toml"),
  compileReport: join(artifactsDir, "tinytown_sprite_alpha.compile-report.md"),
  auditReport: join(artifactsDir, "tinytown_sprite_alpha.audit.md"),
  overlay: join(artifactsDir, "tinytown_sprite_alpha.compiled-overlay.png"),
  manifest: join(artifactsDir, "tinytown_sprite_alpha.workflow.json"),
} as const;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRequiredTextFile(path: string, label: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Missing ${label} at ${path}: ${reason}`);
  }
}

function assertReadableFile(path: string, label: string): void {
  try {
    readFileSync(path);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Missing ${label} at ${path}: ${reason}`);
  }
}

function asTable(value: unknown): TomlTable | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as TomlTable)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getSpriteTables(root: TomlTable): Map<string, TomlTable> {
  const spritesTable = asTable(root.sprites) ?? {};
  return new Map(
    Object.entries(spritesTable).flatMap(([id, value]) => {
      const table = asTable(value);
      return table ? [[id, table] as const] : [];
    }),
  );
}

function createImageObject(spec: CanvasSpriteSpec): ImageObject {
  return {
    id: spec.targetId ?? "tinytown-sheet",
    name: "TinyTown sheet",
    kind: "image",
    layerId: "sprites",
    visible: true,
    x: 0,
    y: 0,
    width: spec.atlasWidth ?? 1440,
    height: spec.atlasHeight ?? 720,
    src: "/assets/tinytown_sprite_alpha.png",
    role: "image",
    intrinsicWidth: spec.atlasWidth ?? 1440,
    intrinsicHeight: spec.atlasHeight ?? 720,
    fit: "fill",
  };
}

function createGuideSpec(image: ImageObject): CanvasGuideSidecar {
  return {
    kind: "canvasGuideSidecar",
    id: "tinytown_sprite_alpha",
    target: image.id,
    units: "px",
    description:
      "TinyTown authoring IR. Regions and annotations describe the atlas layout without polluting runtime sprite metadata.",
    regions: [
      {
        id: "characters_down",
        kind: "sprite-region",
        x: 0,
        y: 0,
        width: 360,
        height: 480,
        description: "Facing-down character band.",
      },
      {
        id: "characters_left",
        kind: "sprite-region",
        x: 360,
        y: 0,
        width: 360,
        height: 480,
        description: "Facing-left character band.",
      },
      {
        id: "characters_right",
        kind: "sprite-region",
        x: 720,
        y: 0,
        width: 360,
        height: 480,
        description: "Facing-right character band.",
      },
      {
        id: "characters_up",
        kind: "sprite-region",
        x: 1080,
        y: 0,
        width: 360,
        height: 480,
        description: "Facing-up character band.",
      },
      {
        id: "props_top",
        kind: "sprite-region",
        x: 0,
        y: 480,
        width: 1440,
        height: 120,
        description: "Upper prop and destination row.",
        grid: { columns: 12, rows: 1, cellWidth: 120, cellHeight: 120 },
      },
      {
        id: "props_bottom",
        kind: "sprite-region",
        x: 0,
        y: 600,
        width: 1440,
        height: 120,
        description: "Lower prop and UI row.",
        grid: { columns: 12, rows: 1, cellWidth: 120, cellHeight: 120 },
      },
    ],
    datums: [
      { id: "face-split-left", kind: "vertical", x: 360, label: "left band split" },
      { id: "face-split-right", kind: "vertical", x: 720, label: "right band split" },
      { id: "face-split-up", kind: "vertical", x: 1080, label: "up band split" },
      { id: "prop-row-top", kind: "horizontal", y: 480, label: "props top" },
      { id: "prop-row-bottom", kind: "horizontal", y: 600, label: "props bottom" },
    ],
    dimensions: [
      {
        id: "character-cell",
        kind: "linear",
        from: [0, 0],
        to: [80, 0],
        label: "character cell 80 px",
        units: "px",
        region: "characters_down",
      },
      {
        id: "character-cell-height",
        kind: "linear",
        from: [0, 0],
        to: [0, 120],
        label: "character cell 120 px",
        units: "px",
        region: "characters_down",
      },
      {
        id: "prop-cell",
        kind: "linear",
        from: [0, 480],
        to: [120, 480],
        label: "prop cell 120 px",
        units: "px",
        region: "props_top",
      },
    ],
    alignmentMarks: [{ id: "atlas-origin", kind: "point", x: 0, y: 0, label: "atlas origin" }],
  };
}

function getCharacterSpriteIds(spec: CanvasSpriteSpec): string[] {
  const grouped = new Map<string, Set<string>>();
  for (const animation of spec.animations) {
    const current = grouped.get(animation.spriteId) ?? new Set<string>();
    current.add(animation.id);
    grouped.set(animation.spriteId, current);
  }
  return [...grouped.entries()]
    .filter(([, ids]) => ["down", "left", "right", "up"].every((id) => ids.has(id)))
    .map(([spriteId]) => spriteId);
}

function getCharacterRowOrder(spec: CanvasSpriteSpec, spriteIds: readonly string[]): string[] {
  const preferredOrder = ["maya", "theo", "lina", "nia"];
  const preferred = preferredOrder.filter((spriteId) => spriteIds.includes(spriteId));
  const remaining = [...spriteIds]
    .filter((spriteId) => !preferred.includes(spriteId))
    .map((spriteId) => {
      const frames = spec.frames.filter((frame) => frame.spriteId === spriteId);
      const minY = Math.min(...frames.map((frame) => frame.y));
      return { spriteId, minY };
    })
    .sort((a, b) => a.minY - b.minY)
    .map((entry) => entry.spriteId);
  return [...preferred, ...remaining];
}

function createCharacterStackframes(spec: CanvasSpriteSpec): CanvasSpriteStackframe[] {
  const spriteIds = getCharacterSpriteIds(spec);
  const rowOrder = getCharacterRowOrder(spec, spriteIds);
  const facings = [
    { id: "down", xs: [40, 153, 272], y: 12 },
    { id: "left", xs: [419, 527, 626], y: 13 },
    { id: "right", xs: [766, 880, 987], y: 16 },
    { id: "up", xs: [1117, 1214, 1329], y: 16 },
  ] as const;

  return facings.flatMap((facing) =>
    facing.xs.map((x, columnIndex) => ({
      id: `${facing.id}.${columnIndex}`,
      x,
      y: facing.y,
      width: 80,
      height: 120,
      count: rowOrder.length,
      direction: "vertical",
      step: 120,
      labels: rowOrder.map((spriteId) => `${spriteId}.${facing.id}.${columnIndex}`),
      column: columnIndex,
      description: `${facing.id} character column ${columnIndex}`,
    })),
  );
}

function getCharacterFrameIds(spec: CanvasSpriteSpec, spriteIds: readonly string[]): Set<string> {
  return new Set(
    spec.animations
      .filter((animation) => spriteIds.includes(animation.spriteId))
      .flatMap((animation) => animation.frameIds),
  );
}

function createPropFrames(
  spec: CanvasSpriteSpec,
  characterFrameIds: ReadonlySet<string>,
): CanvasSpriteFrame[] {
  return spec.frames
    .filter((frame) => !characterFrameIds.has(frame.id))
    .filter((frame) => frame.id !== "maya.down.idle_exact")
    .map((frame) => ({
      id: frame.id,
      label: frame.label,
      spriteId: frame.spriteId,
      kind: frame.kind,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      source: "frame",
      sourceKind: "manual",
      pivot: frame.pivot,
    }));
}

function createCharacterExactOverrideFrames(
  spec: CanvasSpriteSpec,
  characterFrameIds: ReadonlySet<string>,
): CanvasSpriteFrame[] {
  return spec.frames
    .filter((frame) => characterFrameIds.has(frame.id))
    .filter((frame) => frame.width !== 80 || frame.height !== 120)
    .filter((frame) => frame.id !== "maya.down.idle_exact")
    .map((frame) => ({
      id: frame.id,
      label: frame.label,
      spriteId: frame.spriteId,
      animationId: frame.animationId,
      kind: frame.kind,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      source: "frame",
      sourceKind: "exact",
      pivot: frame.pivot,
    }));
}

function createRuntimeSpritesRecord(
  spriteTables: Map<string, TomlTable>,
  animations: readonly CanvasSpriteAnimation[],
  propFrames: readonly CanvasSpriteFrame[],
): Record<string, unknown> {
  const propFrameIds = new Set(propFrames.map((frame) => frame.id));
  const spriteIds = new Set<string>([
    ...animations.map((animation) => animation.spriteId),
    ...propFrames.map((frame) => frame.spriteId).filter((id): id is string => Boolean(id)),
  ]);
  const record: Record<string, unknown> = {};

  for (const spriteId of [...spriteIds].sort()) {
    const sourceTable = spriteTables.get(spriteId);
    const entry: Record<string, unknown> = {};
    const displayName = asString(sourceTable?.display_name);
    const kind = asString(sourceTable?.kind);
    if (displayName) entry.display_name = displayName;
    if (kind) entry.kind = kind;

    const spriteAnimations = animations
      .filter((animation) => animation.spriteId === spriteId)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (spriteAnimations.length > 0) {
      entry.animations = Object.fromEntries(
        spriteAnimations.map((animation) => [
          animation.id,
          {
            frames: [...animation.frameIds],
            fps: animation.fps,
            loop: animation.loop,
          },
        ]),
      );
    }

    if (propFrameIds.has(spriteId)) {
      entry.frame = spriteId;
    }

    record[spriteId] = entry;
  }

  return record;
}

function createRuntimeTomlText(
  sourceSpec: CanvasSpriteSpec,
  spriteTables: Map<string, TomlTable>,
): string {
  const characterSpriteIds = getCharacterSpriteIds(sourceSpec);
  const characterFrameIds = getCharacterFrameIds(sourceSpec, characterSpriteIds);
  const characterExactOverrides = createCharacterExactOverrideFrames(sourceSpec, characterFrameIds);
  const propFrames = createPropFrames(sourceSpec, characterFrameIds);
  const characterAnimations = sourceSpec.animations
    .filter((animation) => characterSpriteIds.includes(animation.spriteId))
    .filter((animation) => animation.id !== "down_exact")
    .sort((a, b) => `${a.spriteId}.${a.id}`.localeCompare(`${b.spriteId}.${b.id}`));
  const stackframes = createCharacterStackframes(sourceSpec);

  const runtimeRecord = {
    atlas: {
      image: sourceSpec.atlasImage,
      width: sourceSpec.atlasWidth,
      height: sourceSpec.atlasHeight,
    },
    sprites: createRuntimeSpritesRecord(spriteTables, characterAnimations, [
      ...characterExactOverrides,
      ...propFrames,
    ]),
    stackframes: Object.fromEntries(
      stackframes.map((stackframe) => [
        stackframe.id,
        {
          x: stackframe.x,
          y: stackframe.y,
          width: stackframe.width,
          height: stackframe.height,
          count: stackframe.count,
          direction: stackframe.direction,
          step: stackframe.step,
          labels: stackframe.labels,
          sprite: stackframe.spriteId,
          animation: stackframe.animationId,
          row: stackframe.row,
          description: stackframe.description,
        },
      ]),
    ),
    frames: Object.fromEntries(
      [...characterExactOverrides, ...propFrames]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((frame) => [
          frame.id,
          {
            x: frame.x,
            y: frame.y,
            width: frame.width,
            height: frame.height,
            display_name: frame.label,
            sprite_id: frame.spriteId,
            source_kind: frame.sourceKind,
            pivot: frame.pivot,
            kind: frame.kind,
          },
        ]),
    ),
  };

  return `${stringifyTomlDocument(runtimeRecord).trimEnd()}\n`;
}

function createCompileReport(input: {
  sourceSpriteTomlPath: string;
  sourceSpriteforgeTomlPath: string;
  sourceImagePath: string;
  fixtureImagePath: string;
  guideArtifactPath: string;
  runtimeArtifactPath: string;
  guide: CanvasGuideSidecar;
  runtimeSpec: CanvasSpriteSpec;
}): string {
  const stackframeIds = input.runtimeSpec.stackframes.map((stackframe) => stackframe.id);
  const explicitFrames = input.runtimeSpec.frames.filter(
    (frame) => frame.sourceKind !== "stackframe",
  );
  const characterExactOverrides = explicitFrames.filter(
    (frame) =>
      frame.sourceKind === "exact" &&
      ["maya", "theo", "lina", "nia"].includes(frame.spriteId ?? ""),
  );
  const bottomPropFrames = explicitFrames.filter((frame) => frame.y >= 600);
  const missingAnimationReferences = input.runtimeSpec.animations.filter((animation) =>
    animation.frameIds.some(
      (frameId) => !input.runtimeSpec.frames.some((frame) => frame.id === frameId),
    ),
  );
  const warnings = [];
  warnings.push(
    "- Removed `maya.down.idle_exact` from the compiled artifact because the source extra sat outside the live atlas and the current UI has no remove action.",
  );
  warnings.push(
    "- Character runtime cuts now use three vertical `80x120` stackframes per facing region; prop/object frames remain explicit manual review artifacts.",
  );

  return [
    "# TinyTown sprite compile report",
    "",
    "## Sources",
    "",
    `- source atlas PNG: ${input.sourceImagePath}`,
    `- source runtime TOML reference: ${input.sourceSpriteTomlPath}`,
    `- source SpriteForge TOML reference: ${input.sourceSpriteforgeTomlPath}`,
    `- public MachinaCanvas fixture image: ${input.fixtureImagePath}`,
    "",
    "## Outputs",
    "",
    `- guide TOML: ${input.guideArtifactPath}`,
    `- compiled runtime sprite TOML: ${input.runtimeArtifactPath}`,
    `- guide regions: ${input.guide.regions.map((region) => region.id).join(", ")}`,
    `- generated stackframes: ${stackframeIds.length}`,
    `- explicit manual/runtime frames: ${explicitFrames.length}`,
    `- explicit character overrides preserved: ${characterExactOverrides.length}`,
    `- bottom prop/object frames preserved explicitly: ${bottomPropFrames.length}`,
    "",
    "## Runtime / authoring split",
    "",
    "- `*.guide.toml` owns guide regions, datums, dimensions, and alignment marks.",
    "- The compiled `*.sprite.toml` owns runtime stackframes, explicit frames, sprites, and animations.",
    "- The compiled runtime artifact omits guide scaffolding and omits legacy `cut_grids`.",
    "",
    "## Stackframes",
    "",
    ...stackframeIds.map((id) => `- ${id}`),
    "",
    "## Exact/manual character overrides",
    "",
    ...(characterExactOverrides.length > 0
      ? characterExactOverrides.map(
          (frame) => `- ${frame.id} (${frame.width}x${frame.height} at ${frame.x},${frame.y})`,
        )
      : ["- No explicit character overrides were required."]),
    "",
    "## Explicit frames preserved",
    "",
    ...explicitFrames.map(
      (frame) => `- ${frame.id} (${frame.width}x${frame.height} at ${frame.x},${frame.y})`,
    ),
    "",
    "## Caveats",
    "",
    ...warnings,
    ...(missingAnimationReferences.length > 0
      ? missingAnimationReferences.map(
          (animation) =>
            `- Missing animation reference remains in ${animation.spriteId}.${animation.id}; verify frame ids.`,
        )
      : ["- No missing animation references were found after runtime generation."]),
    "",
  ].join("\n");
}

function createAuditReport(
  runtimeSidecar: ReturnType<typeof createSpriteSidecarObject>,
  image: ImageObject,
): string {
  const report = buildSpriteAuditReport(runtimeSidecar, image, {
    includeAlphaAnalysis: true,
    alphaUnavailableReason:
      "Alpha-aware cut analysis was skipped in this scripted pass because the compiled runtime artifact intentionally omits guide grids and no DOM alpha mask was built.",
  });
  return [
    "# TinyTown compiled sprite audit",
    "",
    `- frame count: ${report.summary.totalFrames}`,
    `- stackframe count: ${report.summary.totalStackframes}`,
    `- exact/manual frame count: ${runtimeSidecar.spec.frames.filter((frame) => frame.sourceKind !== "stackframe").length}`,
    `- findings: ${report.summary.totalFindings} (${report.summary.errors} error, ${report.summary.warnings} warning, ${report.summary.notes} note)`,
    "",
    "## TinyTown notes",
    "",
    "- Manual prop crops are expected and may be intentional; verify crop bounds only if Godot review shows visible offset issues.",
    "- Character exact overrides are reserved for the few non-`80x120` source cuts that still need explicit preservation.",
    "- Bottom prop/object frames remain explicit on purpose so review can stay local instead of forcing them into synthetic stackframes.",
    "",
    formatSpriteAuditReport(report).trimEnd(),
    "",
  ].join("\n");
}

function renderOverlay(payload: OverlayPayload) {
  const tempDir = mkdtempSync(join(tmpdir(), "tinytown-overlay-"));
  const payloadPath = join(tempDir, "overlay.json");
  const scriptPath = join(tempDir, "render-overlay.ps1");
  writeFileSync(payloadPath, JSON.stringify(payload, null, 2));
  writeFileSync(
    scriptPath,
    `
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$payload = Get-Content -Raw -Path $args[0] | ConvertFrom-Json
$bitmap = [System.Drawing.Bitmap]::FromFile($payload.imagePath)
$overlay = New-Object System.Drawing.Bitmap $bitmap.Width, $bitmap.Height
$graphics = [System.Drawing.Graphics]::FromImage($overlay)
$graphics.Clear([System.Drawing.Color]::White)
$graphics.DrawImage($bitmap, 0, 0, $bitmap.Width, $bitmap.Height)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit

$guidePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 30, 90, 200), 3)
$stackPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 210, 110, 20), 2)
$manualPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 0, 150, 110), 2)
$highlightPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, 220, 30, 40), 4)
$guideBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(18, 30, 90, 200))
$stackBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(14, 210, 110, 20))
$manualBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(18, 0, 150, 110))
$labelBrush = [System.Drawing.Brushes]::Black
$font = New-Object System.Drawing.Font("Consolas", 10)

foreach ($region in $payload.guideRegions) {
  $graphics.FillRectangle($guideBrush, [int]$region.x, [int]$region.y, [int]$region.width, [int]$region.height)
  $graphics.DrawRectangle($guidePen, [int]$region.x, [int]$region.y, [int]$region.width, [int]$region.height)
  $graphics.DrawString($region.id, $font, $labelBrush, [single]($region.x + 4), [single]($region.y + 4))
}

foreach ($frame in $payload.stackFrames) {
  $graphics.FillRectangle($stackBrush, [int]$frame.x, [int]$frame.y, [int]$frame.width, [int]$frame.height)
  $graphics.DrawRectangle($stackPen, [int]$frame.x, [int]$frame.y, [int]$frame.width, [int]$frame.height)
}

foreach ($frame in $payload.explicitFrames) {
  $graphics.FillRectangle($manualBrush, [int]$frame.x, [int]$frame.y, [int]$frame.width, [int]$frame.height)
  $graphics.DrawRectangle($manualPen, [int]$frame.x, [int]$frame.y, [int]$frame.width, [int]$frame.height)
  if ($payload.highlightFrameId -eq $frame.id) {
    $graphics.DrawRectangle($highlightPen, [int]$frame.x, [int]$frame.y, [int]$frame.width, [int]$frame.height)
    $graphics.DrawString($frame.id, $font, $labelBrush, [single]($frame.x + 2), [single]($frame.y + 2))
  }
}

$overlay.Save($payload.outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$font.Dispose()
$guideBrush.Dispose()
$stackBrush.Dispose()
$manualBrush.Dispose()
$guidePen.Dispose()
$stackPen.Dispose()
$manualPen.Dispose()
$highlightPen.Dispose()
$graphics.Dispose()
$overlay.Dispose()
$bitmap.Dispose()
`,
  );

  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, payloadPath],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  rmSync(tempDir, { recursive: true, force: true });
  if (result.status !== 0) {
    throw new Error(`Overlay render failed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

export function generateTinyTownSpriteArtifacts(): TinyTownArtifacts {
  invariant(
    sourceImagePath && sourceSpriteTomlPath && sourceSpriteforgeTomlPath,
    "TinyTown source paths are not configured.",
  );

  const sourceSpriteToml = readRequiredTextFile(
    sourceSpriteTomlPath,
    "TinyTown runtime sprite TOML",
  );
  const sourceSpriteforgeToml = readRequiredTextFile(
    sourceSpriteforgeTomlPath,
    "TinyTown SpriteForge TOML",
  );
  assertReadableFile(sourceImagePath, "TinyTown atlas PNG");
  assertReadableFile(fixtureImagePath, "MachinaCanvas TinyTown fixture image");

  const sourceSpec = parseSpriteSidecarToml(sourceSpriteToml, {
    id: "tinytown-source",
    name: "TinyTown source",
    targetId: "tinytown-sheet",
    sourceName: "tinytown_sprite_alpha.sprite.toml",
  });
  const sourceSpriteforgeSpec = parseSpriteSidecarToml(sourceSpriteforgeToml, {
    id: "tinytown-source-spriteforge",
    name: "TinyTown source SpriteForge",
    targetId: "tinytown-sheet",
    sourceName: "tinytown_sprite_alpha.spriteforge.toml",
  });
  invariant(
    sourceSpec.atlasWidth === 1440 && sourceSpec.atlasHeight === 720,
    "Unexpected TinyTown atlas dimensions.",
  );
  invariant(
    sourceSpriteforgeSpec.atlasWidth === sourceSpec.atlasWidth &&
      sourceSpriteforgeSpec.atlasHeight === sourceSpec.atlasHeight,
    "Source runtime and SpriteForge atlas dimensions diverged.",
  );

  const sourceRoot = asTable(parseTomlDocument(sourceSpriteToml));
  invariant(sourceRoot, "TinyTown source TOML did not parse to a table.");
  const spriteTables = getSpriteTables(sourceRoot);

  const image = createImageObject(sourceSpec);
  const guide = createGuideSpec(image);
  const guideToml = stringifyGuideSidecarToml(guide);
  const reparsedGuide = parseGuideSidecarToml(guideToml);
  const guideDiagnostics = validateGuideSidecar(reparsedGuide, {
    imageWidth: image.intrinsicWidth,
    imageHeight: image.intrinsicHeight,
  });
  invariant(
    guideDiagnostics.length === 0,
    `Guide validation failed: ${JSON.stringify(guideDiagnostics, null, 2)}`,
  );

  const runtimeDraftToml = createRuntimeTomlText(sourceSpec, spriteTables);
  const parsedRuntimeDraft = parseSpriteSidecarToml(runtimeDraftToml, {
    id: "tinytown-compiled",
    name: "TinyTown compiled runtime",
    targetId: image.id,
    sourceName: "tinytown_sprite_alpha.compiled.sprite.toml",
  });
  invariant(
    parsedRuntimeDraft.diagnostics.length === 0,
    `Runtime draft diagnostics: ${JSON.stringify(parsedRuntimeDraft.diagnostics, null, 2)}`,
  );

  const runtimeSidecar = createSpriteSidecarObject(image, parsedRuntimeDraft);
  const runtimeToml = serializeCanvasSpriteToml(runtimeSidecar, { mode: "runtime" });
  const reparsedRuntime = parseSpriteSidecarToml(runtimeToml, {
    id: "tinytown-compiled",
    name: "TinyTown compiled runtime",
    targetId: image.id,
    sourceName: "tinytown_sprite_alpha.compiled.sprite.toml",
  });

  invariant(
    reparsedRuntime.diagnostics.length === 0,
    `Runtime parse diagnostics: ${JSON.stringify(reparsedRuntime.diagnostics, null, 2)}`,
  );
  invariant(
    reparsedRuntime.stackframes.length > 0,
    "Expected stackframes in compiled runtime artifact.",
  );
  invariant(
    !runtimeToml.includes("cut_grids"),
    "Compiled runtime artifact unexpectedly contains cut_grids.",
  );
  invariant(
    !runtimeToml.includes("[[regions]]"),
    "Compiled runtime artifact unexpectedly contains guide regions.",
  );
  invariant(
    !runtimeToml.includes("maya.down.idle_exact"),
    "Compiled runtime artifact unexpectedly retained maya.down.idle_exact.",
  );
  invariant(
    reparsedRuntime.frames.every(
      (frame) =>
        frame.x >= 0 &&
        frame.y >= 0 &&
        frame.x + frame.width <= (reparsedRuntime.atlasWidth ?? image.width) &&
        frame.y + frame.height <= (reparsedRuntime.atlasHeight ?? image.height),
    ),
    "Compiled runtime frames extend outside atlas bounds.",
  );

  const verifiedRuntimeSidecar = createSpriteSidecarObject(image, reparsedRuntime);
  const compileReport = createCompileReport({
    sourceSpriteTomlPath,
    sourceSpriteforgeTomlPath,
    sourceImagePath,
    fixtureImagePath,
    guideArtifactPath: TINYTOWN_WORKFLOW_ARTIFACT_PATHS.guideToml,
    runtimeArtifactPath: TINYTOWN_WORKFLOW_ARTIFACT_PATHS.runtimeToml,
    guide: reparsedGuide,
    runtimeSpec: reparsedRuntime,
  });
  const auditReport = createAuditReport(verifiedRuntimeSidecar, image);

  renderOverlay({
    imagePath: sourceImagePath,
    outputPath: TINYTOWN_WORKFLOW_ARTIFACT_PATHS.overlay,
    guideRegions: reparsedGuide.regions.map((region) => ({
      id: region.id,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    })),
    stackFrames: verifiedRuntimeSidecar.spec.frames
      .filter((frame) => frame.sourceKind === "stackframe")
      .map((frame) => ({
        id: frame.id,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
      })),
    explicitFrames: verifiedRuntimeSidecar.spec.frames
      .filter((frame) => frame.sourceKind !== "stackframe")
      .map((frame) => ({
        id: frame.id,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
      })),
    highlightFrameId: "theo.left.2",
  });

  return {
    guideToml,
    runtimeToml,
    compileReport,
    auditReport,
    overlayPath: TINYTOWN_WORKFLOW_ARTIFACT_PATHS.overlay,
  };
}
