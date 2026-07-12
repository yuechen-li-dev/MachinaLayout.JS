import type {
  CanvasDocument,
  CanvasSpriteAnimation,
  CanvasSpriteFrame,
  CanvasSpriteGridSpec,
  ImageObject,
  SpriteSidecarObject,
} from "./sceneModel";
import { getSpriteExpectedSourceRect, getSpriteFrameSourceKind } from "./spriteSidecar";
import { findGuideRegionForSpriteFrame } from "./spriteGuideRegions";

export type SpriteAuditSeverity = "error" | "warning" | "note";

export type SpriteAuditScope = "allFrames" | "selectedFrame";

export type SpriteAuditFinding = {
  severity: SpriteAuditSeverity;
  code: string;
  frameId?: string;
  spriteId?: string;
  animationId?: string;
  message: string;
  reason: string;
  suggestedFix?: string;
};

export type SpriteAuditFrameEntry = {
  frameId: string;
  label: string;
  spriteId?: string;
  animationId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceKind: "grid" | "stackframe" | "exact" | "manual" | "unknown";
  sourceGrid?: string;
  sourceRow?: number;
  sourceColumn?: number;
  sourceStackframe?: string;
  sourceStackIndex?: number;
  suspiciousFlags: string[];
};

export type SpriteAuditStackframeEntry = {
  stackframeId: string;
  direction: "vertical" | "horizontal";
  count: number;
  step: number;
  frameSize: string;
};

export type SpriteAuditSubgridEntry = {
  gridId: string;
  x: number;
  y: number;
  cell: string;
  rows: number;
  cols: number;
  frames: number;
};

export type SpriteAlphaMask = {
  width: number;
  height: number;
  isOpaque: (x: number, y: number) => boolean;
};

export type AlphaCutAnalysisOptions = {
  alphaThreshold?: number;
  sampleInset?: number;
  maxReportedHitsPerLine?: number;
};

export type SpriteAlphaCutLineEntry = {
  gridId: string;
  orientation: "vertical" | "horizontal";
  coordinate: number;
  boundaryIndex: number;
  opaqueHits: number;
  hitPoints: readonly { x: number; y: number }[];
  finding: string;
};

export type SpriteAlphaCutAnalysis = {
  available: boolean;
  entries: readonly SpriteAlphaCutLineEntry[];
  note?: string;
};

export type SpriteAuditSummary = {
  sidecarId: string;
  imageId: string;
  imageDimensions: { width: number; height: number };
  atlasDimensions?: { width: number; height: number };
  totalSprites: number;
  totalFrames: number;
  totalAnimations: number;
  totalSubgrids: number;
  totalStackframes: number;
  totalFindings: number;
  errors: number;
  warnings: number;
  notes: number;
  scope: SpriteAuditScope;
};

export type SpriteAuditReport = {
  summary: SpriteAuditSummary;
  subgrids: SpriteAuditSubgridEntry[];
  stackframes: SpriteAuditStackframeEntry[];
  frames: SpriteAuditFrameEntry[];
  findings: SpriteAuditFinding[];
  alphaCutAnalysis?: SpriteAlphaCutAnalysis;
  likelyIssues: string[];
  whyCutsWereProbablyWrong: string[];
  whatToAdjustNext: string[];
};

type GridSnapResult = {
  columnOffset: number;
  rowOffset: number;
  nearestColumn: number;
  nearestRow: number;
};

type Rect = { x: number; y: number; width: number; height: number };

function getEffectiveImageDimensions(image: ImageObject) {
  return {
    width: image.intrinsicWidth ?? image.width,
    height: image.intrinsicHeight ?? image.height,
  };
}

function getEffectiveAtlasDimensions(sidecar: SpriteSidecarObject, image: ImageObject) {
  const imageDimensions = getEffectiveImageDimensions(image);
  if (sidecar.spec.atlasWidth && sidecar.spec.atlasHeight) {
    return {
      width: sidecar.spec.atlasWidth,
      height: sidecar.spec.atlasHeight,
    };
  }
  return imageDimensions;
}

function isFrameSelected(
  sidecar: SpriteSidecarObject,
  frame: CanvasSpriteFrame,
  scope: SpriteAuditScope,
) {
  return scope === "allFrames" || frame.id === sidecar.spec.selectedFrameId;
}

function intersects(a: Pick<CanvasSpriteFrame, "x" | "y" | "width" | "height">, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function getGridSnap(frame: CanvasSpriteFrame, grid: CanvasSpriteGridSpec): GridSnapResult {
  const columnValue = (frame.x - grid.x) / grid.cellWidth;
  const rowValue = (frame.y - grid.y) / grid.cellHeight;
  const nearestColumn = Math.round(columnValue);
  const nearestRow = Math.round(rowValue);

  return {
    columnOffset: frame.x - (grid.x + nearestColumn * grid.cellWidth),
    rowOffset: frame.y - (grid.y + nearestRow * grid.cellHeight),
    nearestColumn,
    nearestRow,
  };
}

function getAnimationFrames(
  sidecar: SpriteSidecarObject,
  animation: CanvasSpriteAnimation,
  scope: SpriteAuditScope,
) {
  return animation.frameIds
    .map((frameId) => sidecar.spec.frames.find((frame) => frame.id === frameId))
    .filter((frame): frame is CanvasSpriteFrame => Boolean(frame))
    .filter((frame) => isFrameSelected(sidecar, frame, scope));
}

function formatFindingLine(finding: SpriteAuditFinding) {
  return `${finding.severity.toUpperCase()} ${finding.frameId ? `[${finding.frameId}] ` : ""}${finding.message}`;
}

function pushFinding(
  findings: SpriteAuditFinding[],
  finding: SpriteAuditFinding,
  seen: Set<string>,
) {
  const key = [
    finding.severity,
    finding.code,
    finding.frameId ?? "",
    finding.spriteId ?? "",
    finding.animationId ?? "",
    finding.message,
  ].join("|");
  if (seen.has(key)) return;
  seen.add(key);
  findings.push(finding);
}

function formatDelta(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function isGridParentExactCrop(
  frame: CanvasSpriteFrame,
  other: CanvasSpriteFrame,
  sidecar: SpriteSidecarObject,
) {
  if (getSpriteFrameSourceKind(frame) === "grid" && getSpriteFrameSourceKind(other) !== "grid") {
    const expected = getSpriteExpectedSourceRect(other, sidecar.spec.grids);
    return expected
      ? expected.x === frame.x &&
          expected.y === frame.y &&
          expected.width === frame.width &&
          expected.height === frame.height
      : false;
  }
  if (getSpriteFrameSourceKind(other) === "grid" && getSpriteFrameSourceKind(frame) !== "grid") {
    const expected = getSpriteExpectedSourceRect(frame, sidecar.spec.grids);
    return expected
      ? expected.x === other.x &&
          expected.y === other.y &&
          expected.width === other.width &&
          expected.height === other.height
      : false;
  }
  return false;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function analyzeBoundaryLine(
  mask: SpriteAlphaMask,
  grid: CanvasSpriteGridSpec,
  orientation: "vertical" | "horizontal",
  boundaryIndex: number,
  options: Required<AlphaCutAnalysisOptions>,
): SpriteAlphaCutLineEntry | undefined {
  const coordinate =
    orientation === "vertical"
      ? grid.x + boundaryIndex * grid.cellWidth
      : grid.y + boundaryIndex * grid.cellHeight;
  const maxHits = options.maxReportedHitsPerLine;
  const hitPoints: { x: number; y: number }[] = [];
  let opaqueHits = 0;

  if (orientation === "vertical") {
    const x = clamp(Math.round(coordinate), 0, mask.width - 1);
    const minY = clamp(Math.ceil(grid.y + options.sampleInset), 0, mask.height - 1);
    const maxY = clamp(
      Math.floor(grid.y + grid.height - 1 - options.sampleInset),
      0,
      mask.height - 1,
    );
    for (let y = minY; y <= maxY; y += 1) {
      if (!mask.isOpaque(x, y)) continue;
      opaqueHits += 1;
      if (hitPoints.length < maxHits) hitPoints.push({ x, y });
    }
  } else {
    const y = clamp(Math.round(coordinate), 0, mask.height - 1);
    const minX = clamp(Math.ceil(grid.x + options.sampleInset), 0, mask.width - 1);
    const maxX = clamp(
      Math.floor(grid.x + grid.width - 1 - options.sampleInset),
      0,
      mask.width - 1,
    );
    for (let x = minX; x <= maxX; x += 1) {
      if (!mask.isOpaque(x, y)) continue;
      opaqueHits += 1;
      if (hitPoints.length < maxHits) hitPoints.push({ x, y });
    }
  }

  if (opaqueHits < options.alphaThreshold) return undefined;
  const between =
    orientation === "vertical"
      ? `between columns ${boundaryIndex - 1} and ${boundaryIndex}`
      : `between rows ${boundaryIndex - 1} and ${boundaryIndex}`;
  return {
    gridId: grid.id,
    orientation,
    coordinate,
    boundaryIndex,
    opaqueHits,
    hitPoints,
    finding: `${grid.id} ${orientation} cut ${orientation === "vertical" ? "x" : "y"}=${coordinate} ${between} crosses ${opaqueHits} opaque pixel${opaqueHits === 1 ? "" : "s"}. This likely slices a sprite; verify grid origin or cell ${orientation === "vertical" ? "width" : "height"}.`,
  };
}

export function analyzeSpriteCutAlpha(
  grids: readonly CanvasSpriteGridSpec[],
  mask: SpriteAlphaMask,
  options?: AlphaCutAnalysisOptions,
): readonly SpriteAlphaCutLineEntry[] {
  const resolved = {
    alphaThreshold: Math.max(1, Math.round(options?.alphaThreshold ?? 1)),
    sampleInset: Math.max(0, options?.sampleInset ?? 0),
    maxReportedHitsPerLine: Math.max(1, Math.round(options?.maxReportedHitsPerLine ?? 6)),
  } satisfies Required<AlphaCutAnalysisOptions>;
  const entries: SpriteAlphaCutLineEntry[] = [];

  for (const grid of grids) {
    for (let columnBoundary = 1; columnBoundary < grid.columns; columnBoundary += 1) {
      const entry = analyzeBoundaryLine(mask, grid, "vertical", columnBoundary, resolved);
      if (entry) entries.push(entry);
    }
    for (let rowBoundary = 1; rowBoundary < grid.rows; rowBoundary += 1) {
      const entry = analyzeBoundaryLine(mask, grid, "horizontal", rowBoundary, resolved);
      if (entry) entries.push(entry);
    }
  }

  return entries;
}

export function buildSpriteAuditReport(
  sidecar: SpriteSidecarObject,
  image: ImageObject,
  options?: {
    scope?: SpriteAuditScope;
    document?: CanvasDocument;
    alphaMask?: SpriteAlphaMask;
    includeAlphaAnalysis?: boolean;
    alphaUnavailableReason?: string;
    alphaOptions?: AlphaCutAnalysisOptions;
  },
): SpriteAuditReport {
  const scope = options?.scope ?? "allFrames";
  const findings: SpriteAuditFinding[] = [];
  const seenFindings = new Set<string>();
  const grids = new Map(sidecar.spec.grids.map((grid) => [grid.id, grid]));
  const atlas = getEffectiveAtlasDimensions(sidecar, image);
  const imageDimensions = getEffectiveImageDimensions(image);
  const frames = sidecar.spec.frames.filter((frame) => isFrameSelected(sidecar, frame, scope));
  const frameIds = new Set(frames.map((frame) => frame.id));
  const frameFlags = new Map<string, string[]>();
  const selectedFrame =
    scope === "selectedFrame"
      ? sidecar.spec.frames.find((frame) => frame.id === sidecar.spec.selectedFrameId)
      : undefined;

  const addFlag = (frameId: string, value: string) => {
    const current = frameFlags.get(frameId) ?? [];
    if (!current.includes(value)) current.push(value);
    frameFlags.set(frameId, current);
  };

  if (
    sidecar.spec.atlasWidth !== undefined &&
    sidecar.spec.atlasHeight !== undefined &&
    (sidecar.spec.atlasWidth !== imageDimensions.width ||
      sidecar.spec.atlasHeight !== imageDimensions.height)
  ) {
    pushFinding(
      findings,
      {
        severity: "warning",
        code: "AtlasImageDimensionMismatch",
        message: `Atlas ${sidecar.spec.atlasWidth}x${sidecar.spec.atlasHeight} differs from image ${imageDimensions.width}x${imageDimensions.height}.`,
        reason:
          "The declared atlas size does not match the linked image dimensions, so otherwise valid frame cuts can look out of place.",
        suggestedFix:
          "Update atlas width/height or relink the sidecar to the matching source image.",
      },
      seenFindings,
    );
  }

  const labelOwners = new Map<string, string>();
  const rectOwners = new Map<string, string>();

  for (const frame of frames) {
    const sourceKind = getSpriteFrameSourceKind(frame);
    const expectedRect = getSpriteExpectedSourceRect(
      frame,
      sidecar.spec.grids,
      sidecar.spec.stackframes,
    );
    const parentGrid = frame.sourceGridId ? grids.get(frame.sourceGridId) : undefined;

    if (frame.width <= 0 || frame.height <= 0) {
      addFlag(frame.id, "invalid-size");
      pushFinding(
        findings,
        {
          severity: "error",
          code: "InvalidFrameSize",
          frameId: frame.id,
          spriteId: frame.spriteId,
          animationId: frame.animationId,
          message: `${frame.id} has width ${frame.width} and height ${frame.height}.`,
          reason: "Frames need positive dimensions to describe a valid sprite cut.",
          suggestedFix: "Set width and height above 0.",
        },
        seenFindings,
      );
    }

    if (
      frame.x < 0 ||
      frame.y < 0 ||
      frame.x + frame.width > atlas.width ||
      frame.y + frame.height > atlas.height
    ) {
      addFlag(frame.id, "out-of-bounds");
      pushFinding(
        findings,
        {
          severity: "error",
          code: "FrameOutOfBounds",
          frameId: frame.id,
          spriteId: frame.spriteId,
          animationId: frame.animationId,
          message: `${frame.id} lies outside atlas bounds ${atlas.width}x${atlas.height}.`,
          reason:
            "Part of the cut extends past the declared atlas rectangle, so the exported crop cannot fully exist in the source sheet.",
          suggestedFix: "Move the frame back inside the atlas or correct the atlas dimensions.",
        },
        seenFindings,
      );
    }

    const priorLabelOwner = labelOwners.get(frame.label);
    if (priorLabelOwner && priorLabelOwner !== frame.id) {
      addFlag(frame.id, "duplicate-label");
      addFlag(priorLabelOwner, "duplicate-label");
      pushFinding(
        findings,
        {
          severity: "warning",
          code: "DuplicateLabel",
          frameId: frame.id,
          spriteId: frame.spriteId,
          animationId: frame.animationId,
          message: `${frame.id} shares label "${frame.label}" with ${priorLabelOwner}.`,
          reason: "Duplicate labels make human review and LLM selection ambiguous.",
          suggestedFix: "Rename one of the frames so labels are unique.",
        },
        seenFindings,
      );
    } else {
      labelOwners.set(frame.label, frame.id);
    }

    const rectKey = `${frame.x},${frame.y},${frame.width},${frame.height}`;
    const priorRectOwner = rectOwners.get(rectKey);
    if (priorRectOwner && priorRectOwner !== frame.id) {
      addFlag(frame.id, "duplicate-rect");
      addFlag(priorRectOwner, "duplicate-rect");
      pushFinding(
        findings,
        {
          severity: "warning",
          code: "DuplicateRect",
          frameId: frame.id,
          spriteId: frame.spriteId,
          animationId: frame.animationId,
          message: `${frame.id} reuses the same rect as ${priorRectOwner}.`,
          reason:
            "Repeated rectangles under different IDs often indicate duplicate cuts or mislabeled animation frames.",
          suggestedFix:
            "Verify whether both IDs should point to the same art or whether one rect was copied accidentally.",
        },
        seenFindings,
      );
    } else {
      rectOwners.set(rectKey, frame.id);
    }

    if (frame.sourceGridId && !parentGrid) {
      addFlag(frame.id, "missing-grid");
      pushFinding(
        findings,
        {
          severity: "error",
          code: "MissingGrid",
          frameId: frame.id,
          spriteId: frame.spriteId,
          animationId: frame.animationId,
          message: `${frame.id} references missing grid ${frame.sourceGridId}.`,
          reason: "The frame keeps source grid context but the grid definition is unavailable.",
          suggestedFix: "Restore the grid definition or remove the stale grid reference.",
        },
        seenFindings,
      );
    }

    if (sourceKind === "grid" && expectedRect) {
      if (frame.x !== expectedRect.x || frame.y !== expectedRect.y) {
        addFlag(frame.id, "off-grid");
        pushFinding(
          findings,
          {
            severity: "error",
            code: "OffGridFrame",
            frameId: frame.id,
            spriteId: frame.spriteId,
            animationId: frame.animationId,
            message: `${frame.id} is offset by ${frame.x - expectedRect.x}px x and ${frame.y - expectedRect.y}px y from its source grid cell.`,
            reason: "A grid-derived frame should land exactly on its source cell origin.",
            suggestedFix: "Snap the frame back to its source grid cell bounds.",
          },
          seenFindings,
        );
      }
      if (frame.width !== expectedRect.width || frame.height !== expectedRect.height) {
        addFlag(frame.id, "grid-size-mismatch");
        pushFinding(
          findings,
          {
            severity: "error",
            code: "GridCellSizeMismatch",
            frameId: frame.id,
            spriteId: frame.spriteId,
            animationId: frame.animationId,
            message: `${frame.id} size ${frame.width}x${frame.height} differs from expected grid size ${expectedRect.width}x${expectedRect.height}.`,
            reason: "A grid-derived frame should match its source grid cell dimensions exactly.",
            suggestedFix: "Resize the frame back to the source grid cell size.",
          },
          seenFindings,
        );
      }
    } else if (sourceKind === "manual" && expectedRect) {
      if (
        frame.x !== expectedRect.x ||
        frame.y !== expectedRect.y ||
        frame.width !== expectedRect.width ||
        frame.height !== expectedRect.height
      ) {
        addFlag(frame.id, "manual-grid-override");
        pushFinding(
          findings,
          {
            severity: "warning",
            code: "EditedGridFrameManualOverride",
            frameId: frame.id,
            spriteId: frame.spriteId,
            animationId: frame.animationId,
            message: `${frame.id} no longer matches source grid ${frame.sourceGridId} cell row ${frame.sourceRow ?? "?"}, col ${frame.sourceColumn ?? "?"}.`,
            reason:
              "This frame appears to have started from a grid cell but now preserves a manual override rectangle.",
            suggestedFix:
              "Keep it as an explicit frame override if intentional, or snap it back to the source grid cell.",
          },
          seenFindings,
        );
      }
    } else if ((sourceKind === "exact" || sourceKind === "manual") && expectedRect) {
      const dx = frame.x - expectedRect.x;
      const dy = frame.y - expectedRect.y;
      const dw = frame.width - expectedRect.width;
      const dh = frame.height - expectedRect.height;
      if (dx !== 0 || dy !== 0 || dw !== 0 || dh !== 0) {
        addFlag(frame.id, "exact-crop-context");
        pushFinding(
          findings,
          {
            severity: "note",
            code: "ExactCropInsideGridCell",
            frameId: frame.id,
            spriteId: frame.spriteId,
            animationId: frame.animationId,
            message: `${frame.id} is an exact crop inside grid ${frame.sourceGridId} at row ${frame.sourceRow ?? "?"}, col ${frame.sourceColumn ?? "?"}. It is offset ${formatDelta(dx)},${formatDelta(dy)} and smaller by ${Math.max(0, -dw)}x${Math.max(0, -dh)} px. This may be intentional; verify the crop bounds.`,
            reason:
              "Exact/custom crops can intentionally sit inside a larger parent grid cell for idle or asymmetrical art.",
            suggestedFix:
              "Confirm the crop bounds against the intended sprite silhouette and keep it explicit if the smaller cut is correct.",
          },
          seenFindings,
        );
      }
    } else if ((sourceKind === "exact" || sourceKind === "manual") && parentGrid) {
      const snap = getGridSnap(frame, parentGrid);
      if (
        snap.columnOffset !== 0 ||
        snap.rowOffset !== 0 ||
        frame.width !== parentGrid.cellWidth ||
        frame.height !== parentGrid.cellHeight
      ) {
        addFlag(frame.id, "custom-frame");
        pushFinding(
          findings,
          {
            severity: "note",
            code: "CustomFrameNearGrid",
            frameId: frame.id,
            spriteId: frame.spriteId,
            animationId: frame.animationId,
            message: `${frame.id} does not match full ${parentGrid.cellWidth}x${parentGrid.cellHeight} grid cells on ${parentGrid.id}; it may be an intentional custom crop.`,
            reason:
              "The frame keeps parent-grid context but does not fully describe a regular cell-sized cut.",
            suggestedFix:
              "Verify the crop bounds and keep it explicit if the custom frame is intentional.",
          },
          seenFindings,
        );
      }
    }

    if (options?.document) {
      const guideContext = findGuideRegionForSpriteFrame(options.document, {
        spriteSidecarId: sidecar.id,
        frameId: frame.id,
      });
      if (guideContext?.relation === "intersects") {
        addFlag(frame.id, "guide-region-overflow");
        pushFinding(
          findings,
          {
            severity: "warning",
            code: "SpriteFrameOutsideGuideRegion",
            frameId: frame.id,
            spriteId: frame.spriteId,
            animationId: frame.animationId,
            message: `${frame.id} extends outside guide region ${guideContext.regionId}.`,
            reason:
              "Guide regions are authoring constraints for sprite editing, so a partial overlap suggests the frame has drifted out of its intended edit region.",
            suggestedFix: "Clamp the frame back into the guide region or resize the crop to fit.",
          },
          seenFindings,
        );
      } else if (guideContext?.relation === "nearest") {
        addFlag(frame.id, "missing-guide-region");
        pushFinding(
          findings,
          {
            severity: "warning",
            code: "SpriteFrameMissingGuideRegion",
            frameId: frame.id,
            spriteId: frame.spriteId,
            animationId: frame.animationId,
            message: `${frame.id} is not contained by any guide region.`,
            reason:
              "The current frame sits outside the available guide regions, so edits are no longer localized to the intended authoring region.",
            suggestedFix: "Clamp or move the frame into the intended guide region.",
          },
          seenFindings,
        );
      }
      if (
        guideContext &&
        (frame.width > guideContext.region.width || frame.height > guideContext.region.height)
      ) {
        addFlag(frame.id, "larger-than-guide-region");
        pushFinding(
          findings,
          {
            severity: "warning",
            code: "SpriteFrameLargerThanGuideRegion",
            frameId: frame.id,
            spriteId: frame.spriteId,
            animationId: frame.animationId,
            message: `${frame.id} is larger than guide region ${guideContext.regionId}.`,
            reason:
              "A frame that exceeds its guide region cannot stay fully localized to that authoring constraint.",
            suggestedFix: "Shrink the frame or enlarge the guide region intentionally.",
          },
          seenFindings,
        );
      }
    }
  }

  for (let index = 0; index < frames.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < frames.length; compareIndex += 1) {
      const frame = frames[index];
      const other = frames[compareIndex];
      if (!intersects(frame, other)) continue;
      if (
        frame.x === other.x &&
        frame.y === other.y &&
        frame.width === other.width &&
        frame.height === other.height
      ) {
        continue;
      }

      if (isGridParentExactCrop(frame, other, sidecar)) {
        const exact = getSpriteFrameSourceKind(frame) === "grid" ? other : frame;
        const grid = getSpriteFrameSourceKind(frame) === "grid" ? frame : other;
        const expected = getSpriteExpectedSourceRect(
          exact,
          sidecar.spec.grids,
          sidecar.spec.stackframes,
        );
        const dx = expected ? exact.x - expected.x : 0;
        const dy = expected ? exact.y - expected.y : 0;
        const dw = expected ? exact.width - expected.width : 0;
        const dh = expected ? exact.height - expected.height : 0;
        addFlag(exact.id, "parent-grid-overlap");
        pushFinding(
          findings,
          {
            severity: "note",
            code: "ExactCropOverlapsParentGrid",
            frameId: exact.id,
            spriteId: exact.spriteId,
            animationId: exact.animationId,
            message: `${exact.id} is an exact crop inside grid frame ${grid.id}. It is offset ${formatDelta(dx)},${formatDelta(dy)} and smaller by ${Math.max(0, -dw)}x${Math.max(0, -dh)} px. This may be intentional; verify the crop bounds.`,
            reason:
              "An exact crop overlapping its parent full-cell frame is expected when the atlas mixes grid-derived cuts with explicit tighter crops.",
            suggestedFix:
              "Keep the overlap if the tighter crop is intentional, otherwise adjust the explicit frame bounds.",
          },
          seenFindings,
        );
        continue;
      }

      addFlag(frame.id, "overlap");
      addFlag(other.id, "overlap");
      pushFinding(
        findings,
        {
          severity: "warning",
          code: "OverlappingFrames",
          frameId: frame.id,
          spriteId: frame.spriteId,
          animationId: frame.animationId,
          message: `${frame.id} overlaps ${other.id}.`,
          reason:
            "Intersecting cuts can mean a frame leaks into a neighboring cell or two unrelated cuts are competing for the same pixels.",
          suggestedFix: "Separate the frame bounds unless this overlap is intentional.",
        },
        seenFindings,
      );
    }
  }

  for (const animation of sidecar.spec.animations) {
    const animationFrames = getAnimationFrames(sidecar, animation, scope);
    if (animationFrames.length === 0) continue;

    const sizeSet = new Set(animationFrames.map((frame) => `${frame.width}x${frame.height}`));
    const sourceSet = new Set(animationFrames.map((frame) => getSpriteFrameSourceKind(frame)));

    if (sizeSet.size > 1 && sourceSet.size === 1 && sourceSet.has("grid")) {
      for (const frame of animationFrames) addFlag(frame.id, "animation-size-mismatch");
      pushFinding(
        findings,
        {
          severity: "warning",
          code: "AnimationSizeMismatch",
          spriteId: animation.spriteId,
          animationId: animation.id,
          message: `Animation ${animation.spriteId}.${animation.id} mixes grid-derived frame sizes: ${[...sizeSet].join(", ")}.`,
          reason:
            "Mixed dimensions across grid-derived frames usually produce visible jitter or broken atlas assumptions.",
          suggestedFix: "Normalize the frame sizes or restore the expected grid cuts.",
        },
        seenFindings,
      );
    } else if (
      sizeSet.size > 1 &&
      (sourceSet.has("grid") || sourceSet.has("stackframe")) &&
      sourceSet.size > 1
    ) {
      pushFinding(
        findings,
        {
          severity: "note",
          code: "AnimationMixedGridAndExactFrames",
          spriteId: animation.spriteId,
          animationId: animation.id,
          message: `Animation ${animation.spriteId}.${animation.id} mixes exact/custom crop frames with generated runtime frames. This may be intentional, but may cause visual jitter if dimensions are expected to match.`,
          reason:
            "Atlases often use a tighter idle crop beside full generated frames; that mix is valid but can shift silhouettes if playback expects uniform extents.",
          suggestedFix:
            "Verify whether the mixed crop sizes are intentional for this animation and normalize only if playback should stay dimensionally stable.",
        },
        seenFindings,
      );
    }

    const frameIdCounts = new Map<string, number>();
    for (const frameId of animation.frameIds) {
      if (!frameIds.has(frameId)) continue;
      frameIdCounts.set(frameId, (frameIdCounts.get(frameId) ?? 0) + 1);
    }
    for (const [frameId, count] of frameIdCounts) {
      if (count < 2) continue;
      addFlag(frameId, "repeated-animation-frame");
      pushFinding(
        findings,
        {
          severity: "note",
          code: "RepeatedAnimationFrame",
          frameId,
          spriteId: animation.spriteId,
          animationId: animation.id,
          message: `Animation ${animation.spriteId}.${animation.id} repeats ${frameId} ${count} times.`,
          reason:
            "Repeated frame references can be intentional holds, but they are also a common sign of an earlier miscut or copy/paste mistake.",
          suggestedFix: "Confirm the hold is intentional or replace the duplicate frame reference.",
        },
        seenFindings,
      );
    }
  }

  let alphaCutAnalysis: SpriteAlphaCutAnalysis | undefined;
  if (options?.includeAlphaAnalysis) {
    const alphaGrids =
      scope === "selectedFrame" && selectedFrame?.sourceGridId
        ? sidecar.spec.grids.filter((grid) => grid.id === selectedFrame.sourceGridId)
        : sidecar.spec.grids;
    if (options.alphaMask) {
      const entries = analyzeSpriteCutAlpha(alphaGrids, options.alphaMask, options.alphaOptions);
      alphaCutAnalysis = { available: true, entries };
      for (const entry of entries) {
        pushFinding(
          findings,
          {
            severity: "warning",
            code: "SpriteCutLineHitsOpaquePixels",
            message: entry.finding,
            reason:
              "On non-tiling sprite sheets, transparent gutters usually mark the safe places to cut between cells.",
            suggestedFix:
              "Adjust the grid origin or cell size, or keep the rough grid and convert exceptions into exact/manual frame overrides.",
          },
          seenFindings,
        );
      }
    } else {
      const note =
        options.alphaUnavailableReason ?? "Alpha-aware cut validation unavailable for this image.";
      alphaCutAnalysis = {
        available: false,
        entries: [],
        note,
      };
      pushFinding(
        findings,
        {
          severity: "note",
          code: "SpriteAlphaUnavailable",
          message: note,
          reason:
            "Alpha-aware cut validation needs readable image pixels from the source atlas before it can inspect transparent gutters.",
          suggestedFix:
            "Use a same-origin or local image asset, or continue with geometric audit findings only.",
        },
        seenFindings,
      );
    }
  }

  const subgrids: SpriteAuditSubgridEntry[] = sidecar.spec.grids.map((grid) => ({
    gridId: grid.id,
    x: grid.x,
    y: grid.y,
    cell: `${grid.cellWidth}x${grid.cellHeight}`,
    rows: grid.rows,
    cols: grid.columns,
    frames: sidecar.spec.frames.filter((frame) => frame.sourceGridId === grid.id).length,
  }));

  const frameEntries: SpriteAuditFrameEntry[] = frames.map((frame) => ({
    frameId: frame.id,
    label: frame.label,
    spriteId: frame.spriteId,
    animationId: frame.animationId,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    sourceKind: getSpriteFrameSourceKind(frame),
    sourceGrid: frame.sourceGridId,
    sourceRow: frame.sourceRow,
    sourceColumn: frame.sourceColumn,
    sourceStackframe: frame.sourceStackframeId,
    sourceStackIndex: frame.sourceStackIndex,
    suspiciousFlags: frameFlags.get(frame.id) ?? [],
  }));
  const stackframeEntries: SpriteAuditStackframeEntry[] = sidecar.spec.stackframes.map(
    (stackframe) => ({
      stackframeId: stackframe.id,
      direction: stackframe.direction,
      count: stackframe.count,
      step: stackframe.step,
      frameSize: `${stackframe.width}x${stackframe.height}`,
    }),
  );

  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const noteCount = findings.filter((finding) => finding.severity === "note").length;
  const spriteIds = new Set(
    sidecar.spec.frames
      .map((frame) => frame.spriteId)
      .filter((value): value is string => Boolean(value)),
  );

  const orderedFindings = [...findings].sort((left, right) => {
    const severityRank = { error: 0, warning: 1, note: 2 };
    const bySeverity = severityRank[left.severity] - severityRank[right.severity];
    if (bySeverity !== 0) return bySeverity;
    return (left.frameId ?? left.animationId ?? left.code).localeCompare(
      right.frameId ?? right.animationId ?? right.code,
    );
  });

  const likelyIssues =
    orderedFindings.length > 0
      ? orderedFindings.slice(0, 4).map((finding) => formatFindingLine(finding))
      : ["No suspicious cuts were detected in the current audit scope."];
  const whyCutsWereProbablyWrong =
    orderedFindings.length > 0
      ? orderedFindings
          .slice(0, 3)
          .map(
            (finding) =>
              `${finding.frameId ?? finding.animationId ?? finding.code}: ${finding.reason}`,
          )
      : ["The current frames line up with the declared subgrid and atlas information."];
  const whatToAdjustNext =
    orderedFindings.length > 0
      ? orderedFindings
          .slice(0, 3)
          .map(
            (finding) =>
              `${finding.frameId ?? finding.animationId ?? finding.code}: ${finding.suggestedFix ?? "Review the cut against the overlay and adjust the frame rectangle."}`,
          )
      : ["No immediate adjustment stands out from the current audit scope."];

  return {
    summary: {
      sidecarId: sidecar.id,
      imageId: image.id,
      imageDimensions,
      atlasDimensions:
        sidecar.spec.atlasWidth !== undefined && sidecar.spec.atlasHeight !== undefined
          ? {
              width: sidecar.spec.atlasWidth,
              height: sidecar.spec.atlasHeight,
            }
          : undefined,
      totalSprites: spriteIds.size,
      totalFrames: frameEntries.length,
      totalAnimations: sidecar.spec.animations.length,
      totalSubgrids: subgrids.length,
      totalStackframes: stackframeEntries.length,
      totalFindings: orderedFindings.length,
      errors: errorCount,
      warnings: warningCount,
      notes: noteCount,
      scope,
    },
    subgrids,
    stackframes: stackframeEntries,
    frames: frameEntries,
    findings: orderedFindings,
    alphaCutAnalysis,
    likelyIssues,
    whyCutsWereProbablyWrong,
    whatToAdjustNext,
  };
}

export function createSpriteAuditScreenshotDocument(
  document: CanvasDocument,
  sidecarId: string,
  scope: SpriteAuditScope,
): CanvasDocument {
  const sidecar = document.objects[sidecarId];
  if (sidecar?.kind !== "spriteSidecar") return document;
  return {
    ...document,
    objects: {
      ...document.objects,
      [sidecar.id]: {
        ...sidecar,
        visible: true,
        spec: {
          ...sidecar.spec,
          overlay: {
            ...sidecar.spec.overlay,
            displayMode: "audit",
            showBounds: true,
            showLabels: false,
            showSubgrids: true,
            showExactFrames: true,
            selectedOnly: scope === "selectedFrame",
          },
        },
      },
    },
    selectedObjectId: sidecar.id,
  };
}

function formatSubgridTable(report: SpriteAuditReport) {
  const lines = [
    "| Grid | X | Y | Cell | Rows | Cols | Frames |",
    "| --- | ---: | ---: | --- | ---: | ---: | ---: |",
  ];

  for (const grid of report.subgrids) {
    lines.push(
      `| ${grid.gridId} | ${grid.x} | ${grid.y} | ${grid.cell} | ${grid.rows} | ${grid.cols} | ${grid.frames} |`,
    );
  }

  return lines.join("\n");
}

function formatFrameTable(report: SpriteAuditReport) {
  const lines = [
    "| Frame | Source | Grid | Row | Col | Stackframe | Stack Index | Sprite | Animation | X | Y | W | H | Flags |",
    "| --- | --- | --- | ---: | ---: | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const frame of report.frames) {
    lines.push(
      `| ${frame.frameId} | ${frame.sourceKind} | ${frame.sourceGrid ?? "-"} | ${frame.sourceRow ?? "-"} | ${frame.sourceColumn ?? "-"} | ${frame.sourceStackframe ?? "-"} | ${frame.sourceStackIndex ?? "-"} | ${frame.spriteId ?? "-"} | ${frame.animationId ?? "-"} | ${frame.x} | ${frame.y} | ${frame.width} | ${frame.height} | ${frame.suspiciousFlags.join(", ") || "-"} |`,
    );
  }

  return lines.join("\n");
}

function formatStackframeTable(report: SpriteAuditReport) {
  const lines = [
    "| stackframe | direction | count | step | frame size |",
    "| --- | --- | ---: | ---: | --- |",
  ];

  for (const stackframe of report.stackframes) {
    lines.push(
      `| ${stackframe.stackframeId} | ${stackframe.direction} | ${stackframe.count} | ${stackframe.step} | ${stackframe.frameSize} |`,
    );
  }

  if (report.stackframes.length === 0) {
    lines.push("| - | - | 0 | - | - |");
  }

  return lines.join("\n");
}

function formatAlphaCutTable(report: SpriteAuditReport) {
  const lines = [
    "| Grid | Line | Coordinate | Boundary | Opaque hits | Finding |",
    "| --- | --- | ---: | --- | ---: | --- |",
  ];

  if (!report.alphaCutAnalysis) return lines.join("\n");
  if (!report.alphaCutAnalysis.available) {
    lines.push(
      `| - | - | - | - | - | ${report.alphaCutAnalysis.note ?? "Alpha-aware cut analysis unavailable for this image."} |`,
    );
    return lines.join("\n");
  }

  for (const entry of report.alphaCutAnalysis.entries) {
    const boundary =
      entry.orientation === "vertical"
        ? `cols ${entry.boundaryIndex - 1}-${entry.boundaryIndex}`
        : `rows ${entry.boundaryIndex - 1}-${entry.boundaryIndex}`;
    lines.push(
      `| ${entry.gridId} | ${entry.orientation} | ${entry.coordinate} | ${boundary} | ${entry.opaqueHits} | ${entry.finding} |`,
    );
  }

  if (report.alphaCutAnalysis.entries.length === 0) {
    lines.push("| - | - | - | - | 0 | No cut lines crossed opaque pixels. |");
  }

  return lines.join("\n");
}

export function formatSpriteAuditReport(report: SpriteAuditReport): string {
  const { summary } = report;
  const guideRegionFindings = report.findings.filter((finding) =>
    [
      "SpriteFrameOutsideGuideRegion",
      "SpriteFrameIntersectsGuideRegion",
      "SpriteFrameLargerThanGuideRegion",
      "SpriteFrameMissingGuideRegion",
    ].includes(finding.code),
  );
  const lines = [
    "# Sprite Audit Report",
    "",
    "## High-level summary",
    `- sprite sidecar id: ${summary.sidecarId}`,
    `- linked image id: ${summary.imageId}`,
    `- image dimensions: ${summary.imageDimensions.width}x${summary.imageDimensions.height}`,
    `- atlas dimensions: ${summary.atlasDimensions ? `${summary.atlasDimensions.width}x${summary.atlasDimensions.height}` : "unknown"}`,
    `- total subgrids: ${summary.totalSubgrids}`,
    `- total stackframes: ${summary.totalStackframes}`,
    `- total sprites: ${summary.totalSprites}`,
    `- total frames: ${summary.totalFrames}`,
    `- total animations: ${summary.totalAnimations}`,
    `- total diagnostics / suspicious findings: ${summary.totalFindings} (${summary.errors} error, ${summary.warnings} warning, ${summary.notes} note)`,
    `- audit scope: ${summary.scope === "selectedFrame" ? "selected frame only" : "all frames"}`,
    "",
    "## Subgrids",
    formatSubgridTable(report),
    "",
    "## Stackframes",
    formatStackframeTable(report),
    "",
    "## Frame list",
    formatFrameTable(report),
    "",
    "## Alpha-aware cut analysis",
    formatAlphaCutTable(report),
    "",
    "## Guide-region constraints",
    ...(guideRegionFindings.length > 0
      ? guideRegionFindings.map(
          (finding) =>
            `- [${finding.severity}] ${finding.message} Why: ${finding.reason}${finding.suggestedFix ? ` Suggested next step: ${finding.suggestedFix}` : ""}`,
        )
      : ["- No guide-region warnings in the current audit scope."]),
    "",
    "## Suspicion analysis",
  ];

  if (report.findings.length === 0) {
    lines.push("- No suspicious cuts were detected.");
  } else {
    for (const finding of report.findings) {
      lines.push(
        `- [${finding.severity}] ${finding.message} Why: ${finding.reason}${finding.suggestedFix ? ` Suggested next step: ${finding.suggestedFix}` : ""}`,
      );
    }
  }

  lines.push(
    "",
    "## Likely issues found",
    ...report.likelyIssues.map((line) => `- ${line}`),
    "",
    "## Why previous cuts were probably wrong",
    ...report.whyCutsWereProbablyWrong.map((line) => `- ${line}`),
    "",
    "## What to adjust next",
    ...report.whatToAdjustNext.map((line) => `- ${line}`),
    "",
  );

  return lines.join("\n");
}
