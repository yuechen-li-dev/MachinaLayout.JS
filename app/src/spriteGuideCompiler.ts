import type { CanvasGuideSidecar, GuideRegion } from "./guideSidecar";
import type { CanvasSpriteFrame, CanvasSpriteSpec } from "./sceneModel";
import {
  getSpriteFrameSourceKind,
  revalidateSpriteSpec,
  type SpriteSidecar,
  type SpriteTomlExportOptions,
} from "./spriteSidecar";

export type SpriteGuideCompileOptions = {
  readonly includeRegions?: readonly string[];
  readonly excludeRegions?: readonly string[];
  readonly frameIdPrefix?: string;
};

export type SpriteGuideCompiledFrame = {
  readonly frameId: string;
  readonly rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly source: {
    readonly kind: "guideRegionGrid";
    readonly guideSidecarId: string;
    readonly regionId: string;
    readonly row: number;
    readonly column: number;
  };
};

export type SpriteGuideCompileFinding = {
  readonly severity: "error" | "warning" | "note";
  readonly code: string;
  readonly message: string;
  readonly regionId?: string;
  readonly frameId?: string;
};

export type SpriteGuideCompileReport = {
  readonly kind: "spriteGuideCompileReport";
  readonly spriteSidecarId: string;
  readonly guideSidecarId?: string;
  readonly generatedFrameCount: number;
  readonly preservedFrameCount: number;
  readonly overrideFrameCount: number;
  readonly skippedRegionCount: number;
  readonly findings: readonly SpriteGuideCompileFinding[];
};

function createInitialReport(
  spriteSidecar: SpriteSidecar,
  guideSidecar?: CanvasGuideSidecar,
): SpriteGuideCompileReport {
  return {
    kind: "spriteGuideCompileReport",
    spriteSidecarId: spriteSidecar.id,
    guideSidecarId: guideSidecar?.id,
    generatedFrameCount: 0,
    preservedFrameCount: 0,
    overrideFrameCount: 0,
    skippedRegionCount: 0,
    findings: [],
  };
}

function withFinding(
  report: SpriteGuideCompileReport,
  finding: SpriteGuideCompileFinding,
): SpriteGuideCompileReport {
  return {
    ...report,
    findings: [...report.findings, finding],
  };
}

function includeRegion(region: GuideRegion, options?: SpriteGuideCompileOptions): boolean {
  if (options?.includeRegions && !options.includeRegions.includes(region.id)) return false;
  if (options?.excludeRegions?.includes(region.id)) return false;
  return true;
}

function findExistingFrameId(
  spriteSidecar: SpriteSidecar,
  regionId: string,
  row: number,
  column: number,
): string | undefined {
  return spriteSidecar.frames.find(
    (frame) =>
      (frame.sourceGridId === regionId || frame.gridId === regionId) &&
      frame.sourceRow === row &&
      frame.sourceColumn === column,
  )?.id;
}

function createGeneratedFrameId(
  spriteSidecar: SpriteSidecar,
  regionId: string,
  row: number,
  column: number,
  options?: SpriteGuideCompileOptions,
): string {
  const existing = findExistingFrameId(spriteSidecar, regionId, row, column);
  if (existing) return existing;
  const baseId = `${regionId}.${row}.${column}`;
  return options?.frameIdPrefix ? `${options.frameIdPrefix}${baseId}` : baseId;
}

export function compileGuideRegionsToSpriteFrames(input: {
  readonly spriteSidecar: SpriteSidecar;
  readonly guideSidecar?: CanvasGuideSidecar;
  readonly options?: SpriteGuideCompileOptions;
}): {
  readonly frames: readonly SpriteGuideCompiledFrame[];
  readonly report: SpriteGuideCompileReport;
} {
  const { spriteSidecar, guideSidecar, options } = input;
  let report = createInitialReport(spriteSidecar, guideSidecar);
  const frames: SpriteGuideCompiledFrame[] = [];
  const seenFrameIds = new Set<string>();

  if (!guideSidecar) {
    return { frames, report };
  }

  for (const region of guideSidecar.regions) {
    if (!includeRegion(region, options)) {
      report = { ...report, skippedRegionCount: report.skippedRegionCount + 1 };
      continue;
    }

    if (!region.grid) {
      report = {
        ...report,
        skippedRegionCount: report.skippedRegionCount + 1,
      };
      report = withFinding(report, {
        severity: "note",
        code: "GuideRegionSkippedNoGrid",
        message: `Guide region ${region.id} has no grid and was skipped.`,
        regionId: region.id,
      });
      continue;
    }

    const expectedWidth = region.grid.columns * region.grid.cellWidth;
    const expectedHeight = region.grid.rows * region.grid.cellHeight;
    if (expectedWidth !== region.width || expectedHeight !== region.height) {
      report = withFinding(report, {
        severity: "warning",
        code: "GuideRegionGridSizeMismatch",
        message: `Guide region ${region.id} grid cells do not exactly fill the region bounds.`,
        regionId: region.id,
      });
    }

    for (let row = 0; row < region.grid.rows; row += 1) {
      for (let column = 0; column < region.grid.columns; column += 1) {
        const frameId = createGeneratedFrameId(spriteSidecar, region.id, row, column, options);
        if (seenFrameIds.has(frameId)) {
          report = withFinding(report, {
            severity: "error",
            code: "DuplicateGeneratedFrameId",
            message: `Guide compilation generated duplicate frame id ${frameId}.`,
            regionId: region.id,
            frameId,
          });
          continue;
        }
        seenFrameIds.add(frameId);
        frames.push({
          frameId,
          rect: {
            x: region.x + column * region.grid.cellWidth,
            y: region.y + row * region.grid.cellHeight,
            width: region.grid.cellWidth,
            height: region.grid.cellHeight,
          },
          source: {
            kind: "guideRegionGrid",
            guideSidecarId: guideSidecar.id,
            regionId: region.id,
            row,
            column,
          },
        });
      }
    }
  }

  report = {
    ...report,
    generatedFrameCount: frames.length,
  };
  return { frames, report };
}

function createCompiledFrame(
  generatedFrame: SpriteGuideCompiledFrame,
  existingFrame?: CanvasSpriteFrame,
): CanvasSpriteFrame {
  return {
    id: generatedFrame.frameId,
    label: existingFrame?.label ?? generatedFrame.frameId,
    spriteId: existingFrame?.spriteId,
    animationId: existingFrame?.animationId,
    clipId: existingFrame?.clipId,
    kind: existingFrame?.kind,
    x: generatedFrame.rect.x,
    y: generatedFrame.rect.y,
    width: generatedFrame.rect.width,
    height: generatedFrame.rect.height,
    row: generatedFrame.source.row,
    column: generatedFrame.source.column,
    source: "frame",
    gridId: undefined,
    sourceKind: "grid",
    sourceGridId: generatedFrame.source.regionId,
    sourceRow: generatedFrame.source.row,
    sourceColumn: generatedFrame.source.column,
    sourceFrameId: existingFrame?.sourceFrameId,
    pivot: existingFrame?.pivot,
  };
}

function createRuntimeSpec(
  spriteSidecar: CanvasSpriteSpec,
  frames: readonly CanvasSpriteFrame[],
  options?: SpriteTomlExportOptions,
): CanvasSpriteSpec {
  return revalidateSpriteSpec({
    ...spriteSidecar,
    dialect: "sprite",
    grids:
      options?.mode === "authoring" || options?.includeLegacyCutGrids ? spriteSidecar.grids : [],
    stackframes:
      options?.mode === "authoring" || options?.includeStackframes === false
        ? spriteSidecar.stackframes
        : spriteSidecar.stackframes,
    frames,
    rawToml: undefined,
  });
}

export function compileSpriteRuntimeSidecar(input: {
  readonly spriteSidecar: SpriteSidecar;
  readonly guideSidecar?: CanvasGuideSidecar;
  readonly options?: SpriteTomlExportOptions & SpriteGuideCompileOptions;
}): {
  readonly spriteSidecar: SpriteSidecar;
  readonly report: SpriteGuideCompileReport;
} {
  const compile = compileGuideRegionsToSpriteFrames(input);
  let report = compile.report;
  const generatedById = new Map<string, CanvasSpriteFrame>();
  const existingById = new Map(input.spriteSidecar.frames.map((frame) => [frame.id, frame]));

  for (const generatedFrame of compile.frames) {
    generatedById.set(
      generatedFrame.frameId,
      createCompiledFrame(generatedFrame, existingById.get(generatedFrame.frameId)),
    );
  }

  const compiledFrames = new Map<string, CanvasSpriteFrame>(generatedById);
  let preservedFrameCount = 0;
  let overrideFrameCount = 0;

  for (const frame of input.spriteSidecar.frames) {
    const sourceKind = getSpriteFrameSourceKind(frame);
    const generated = generatedById.get(frame.id);
    const shouldPreserveExplicitly =
      sourceKind === "exact" || sourceKind === "manual" || sourceKind === "unknown";

    if (generated) {
      if (shouldPreserveExplicitly) {
        compiledFrames.set(frame.id, { ...frame, source: "frame", sourceKind });
        overrideFrameCount += 1;
        report = withFinding(report, {
          severity: "note",
          code: "GeneratedFrameOverridden",
          message: `Frame ${frame.id} overrides generated guide-region output with an authored ${sourceKind} frame.`,
          frameId: frame.id,
        });
      } else if (
        frame.x !== generated.x ||
        frame.y !== generated.y ||
        frame.width !== generated.width ||
        frame.height !== generated.height
      ) {
        report = withFinding(report, {
          severity: "warning",
          code: "LegacyGridFrameReplaced",
          message: `Legacy grid frame ${frame.id} differed from guide-region output and was replaced during runtime compile.`,
          frameId: frame.id,
        });
      }
      continue;
    }

    compiledFrames.set(frame.id, { ...frame, source: "frame", sourceKind });
    preservedFrameCount += 1;
  }

  for (const animation of input.spriteSidecar.animations) {
    for (const frameId of animation.frameIds) {
      if (!compiledFrames.has(frameId)) {
        report = withFinding(report, {
          severity: "warning",
          code: "AnimationMissingFrame",
          message: `Animation ${animation.spriteId}.${animation.id} references missing frame ${frameId}.`,
          frameId,
        });
      }
    }
  }

  report = {
    ...report,
    preservedFrameCount,
    overrideFrameCount,
  };

  return {
    spriteSidecar: createRuntimeSpec(
      input.spriteSidecar,
      [...compiledFrames.values()].sort((a, b) => a.id.localeCompare(b.id)),
      input.options,
    ),
    report,
  };
}

export function formatSpriteGuideCompileReport(report: SpriteGuideCompileReport): string {
  const findings =
    report.findings.length > 0
      ? report.findings.map((finding) => {
          const target = finding.frameId ?? finding.regionId;
          return `- ${finding.severity.toUpperCase()} ${finding.code}${
            target ? ` (${target})` : ""
          }: ${finding.message}`;
        })
      : ["- No compile findings."];

  return [
    "# Sprite compile report",
    "",
    "## Summary",
    "",
    `- sprite sidecar id: ${report.spriteSidecarId}`,
    `- guide sidecar id: ${report.guideSidecarId ?? "none"}`,
    `- generated frames: ${report.generatedFrameCount}`,
    `- preserved frames: ${report.preservedFrameCount}`,
    `- overrides: ${report.overrideFrameCount}`,
    `- skipped regions: ${report.skippedRegionCount}`,
    `- findings: ${report.findings.length}`,
    "",
    "## Generated frames",
    "",
    `Generated ${report.generatedFrameCount} frame candidate${report.generatedFrameCount === 1 ? "" : "s"} from guide-region grids.`,
    "",
    "## Preserved exact/manual frames",
    "",
    `Preserved ${report.preservedFrameCount} authored frame${report.preservedFrameCount === 1 ? "" : "s"} that remained explicit in the runtime sidecar.`,
    "",
    "## Overrides",
    "",
    `Applied ${report.overrideFrameCount} authored override${report.overrideFrameCount === 1 ? "" : "s"} over generated guide-region frames.`,
    "",
    "## Findings",
    "",
    ...findings,
    "",
  ].join("\n");
}
