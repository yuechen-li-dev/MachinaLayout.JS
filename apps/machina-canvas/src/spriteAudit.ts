import type {
  CanvasDocument,
  CanvasSpriteAnimation,
  CanvasSpriteFrame,
  CanvasSpriteGridSpec,
  ImageObject,
  SpriteSidecarObject,
} from "./sceneModel";

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
  gridSource?: string;
  cutSource: "grid" | "exact" | "manual" | "inline";
  suspiciousFlags: string[];
};

export type SpriteAuditSummary = {
  sidecarId: string;
  imageId: string;
  imageDimensions: { width: number; height: number };
  atlasDimensions?: { width: number; height: number };
  totalSprites: number;
  totalFrames: number;
  totalAnimations: number;
  totalFindings: number;
  errors: number;
  warnings: number;
  notes: number;
  scope: SpriteAuditScope;
};

export type SpriteAuditReport = {
  summary: SpriteAuditSummary;
  frames: SpriteAuditFrameEntry[];
  findings: SpriteAuditFinding[];
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

function toCutSource(frame: CanvasSpriteFrame): SpriteAuditFrameEntry["cutSource"] {
  if (frame.source === "grid") return "grid";
  if (frame.source === "inline") return "inline";
  if (frame.source === "frame") return frame.gridId ? "exact" : "manual";
  return frame.gridId ? "exact" : "manual";
}

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

function intersects(a: CanvasSpriteFrame, b: CanvasSpriteFrame) {
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

export function buildSpriteAuditReport(
  sidecar: SpriteSidecarObject,
  image: ImageObject,
  options?: { scope?: SpriteAuditScope },
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

    if (frame.gridId) {
      const grid = grids.get(frame.gridId);
      if (!grid) {
        addFlag(frame.id, "missing-grid");
        pushFinding(
          findings,
          {
            severity: "error",
            code: "MissingGrid",
            frameId: frame.id,
            spriteId: frame.spriteId,
            animationId: frame.animationId,
            message: `${frame.id} references missing grid ${frame.gridId}.`,
            reason: "The frame claims grid alignment but the grid definition is unavailable.",
            suggestedFix: "Restore the grid definition or remove the stale grid reference.",
          },
          seenFindings,
        );
      } else {
        const snap = getGridSnap(frame, grid);
        if (snap.columnOffset !== 0 || snap.rowOffset !== 0) {
          addFlag(frame.id, "off-grid");
          pushFinding(
            findings,
            {
              severity: frame.source === "grid" ? "error" : "warning",
              code: "OffGridFrame",
              frameId: frame.id,
              spriteId: frame.spriteId,
              animationId: frame.animationId,
              message: `${frame.id} is offset by ${snap.columnOffset}px x and ${snap.rowOffset}px y from grid ${grid.id}.`,
              reason:
                "The frame origin does not land on the declared grid cell origin, so the cut appears shifted between cells.",
              suggestedFix: `Snap the frame back to grid ${grid.id} near column ${snap.nearestColumn}, row ${snap.nearestRow}.`,
            },
            seenFindings,
          );
        }

        if (frame.width !== grid.cellWidth || frame.height !== grid.cellHeight) {
          addFlag(frame.id, "grid-size-mismatch");
          pushFinding(
            findings,
            {
              severity: frame.source === "grid" ? "error" : "warning",
              code: "GridCellSizeMismatch",
              frameId: frame.id,
              spriteId: frame.spriteId,
              animationId: frame.animationId,
              message: `${frame.id} size ${frame.width}x${frame.height} differs from expected grid size ${grid.cellWidth}x${grid.cellHeight}.`,
              reason:
                "This cut is tied to a grid definition, but its dimensions do not match the grid cell size.",
              suggestedFix:
                "Resize the frame to the grid cell size or detach it from the grid-backed expectation.",
            },
            seenFindings,
          );
        }
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
            "Intersecting cuts can mean a frame leaks into a neighboring cell or two cuts are competing for the same pixels.",
          suggestedFix: "Separate the frame bounds unless this overlap is intentional.",
        },
        seenFindings,
      );
    }
  }

  for (const animation of sidecar.spec.animations) {
    const animationFrames = getAnimationFrames(sidecar, animation, scope);
    if (animationFrames.length === 0) continue;
    const animationGrid = animation.gridId ? grids.get(animation.gridId) : undefined;
    if (animationGrid) {
      for (const frame of animationFrames) {
        if (frame.gridId) continue;
        const snap = getGridSnap(frame, animationGrid);
        if (snap.columnOffset !== 0 || snap.rowOffset !== 0) {
          addFlag(frame.id, "off-grid");
          pushFinding(
            findings,
            {
              severity: "warning",
              code: "OffGridFrame",
              frameId: frame.id,
              spriteId: animation.spriteId,
              animationId: animation.id,
              message: `${frame.id} is offset by ${snap.columnOffset}px x and ${snap.rowOffset}px y from animation grid ${animationGrid.id}.`,
              reason:
                "This exact frame sits between grid cells relative to the animation's declared grid, so it looks shifted beside its neighboring cuts.",
              suggestedFix: `Move the frame toward grid ${animationGrid.id} near column ${snap.nearestColumn}, row ${snap.nearestRow}.`,
            },
            seenFindings,
          );
        }
        if (frame.width !== animationGrid.cellWidth || frame.height !== animationGrid.cellHeight) {
          addFlag(frame.id, "grid-size-mismatch");
          pushFinding(
            findings,
            {
              severity: "warning",
              code: "GridCellSizeMismatch",
              frameId: frame.id,
              spriteId: animation.spriteId,
              animationId: animation.id,
              message: `${frame.id} size ${frame.width}x${frame.height} differs from animation grid size ${animationGrid.cellWidth}x${animationGrid.cellHeight}.`,
              reason:
                "The exact frame does not match the neighboring grid-backed cuts that the animation claims to follow.",
              suggestedFix:
                "Resize the exact frame to match the grid cell or intentionally document it as a custom non-grid cut.",
            },
            seenFindings,
          );
        }
      }
    }
    const sizeSet = new Set(animationFrames.map((frame) => `${frame.width}x${frame.height}`));
    if (sizeSet.size > 1) {
      for (const frame of animationFrames) {
        addFlag(frame.id, "animation-size-mismatch");
      }
      pushFinding(
        findings,
        {
          severity: "warning",
          code: "AnimationSizeMismatch",
          spriteId: animation.spriteId,
          animationId: animation.id,
          message: `Animation ${animation.spriteId}.${animation.id} mixes frame sizes: ${[...sizeSet].join(", ")}.`,
          reason:
            "Mixed dimensions inside one animation often produce jitter or alignment drift when the frames are played in sequence.",
          suggestedFix:
            "Normalize the frame sizes or verify the animation intentionally uses mixed crops.",
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

  const frameEntries: SpriteAuditFrameEntry[] = frames.map((frame) => ({
    frameId: frame.id,
    label: frame.label,
    spriteId: frame.spriteId,
    animationId: frame.animationId,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    gridSource: frame.gridId,
    cutSource: toCutSource(frame),
    suspiciousFlags: frameFlags.get(frame.id) ?? [],
  }));

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
      : ["The current frames line up with the declared atlas and grid information."];
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
      totalFindings: orderedFindings.length,
      errors: errorCount,
      warnings: warningCount,
      notes: noteCount,
      scope,
    },
    frames: frameEntries,
    findings: orderedFindings,
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
            showBounds: true,
            showLabels: true,
            selectedOnly: scope === "selectedFrame",
          },
        },
      },
    },
    selectedObjectId: sidecar.id,
  };
}

function formatFrameTable(report: SpriteAuditReport) {
  const lines = [
    "| Frame | Sprite | Animation | X | Y | W | H | Grid | Source | Flags |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |",
  ];

  for (const frame of report.frames) {
    lines.push(
      `| ${frame.frameId} | ${frame.spriteId ?? "-"} | ${frame.animationId ?? "-"} | ${frame.x} | ${frame.y} | ${frame.width} | ${frame.height} | ${frame.gridSource ?? "-"} | ${frame.cutSource} | ${frame.suspiciousFlags.join(", ") || "-"} |`,
    );
  }

  return lines.join("\n");
}

export function formatSpriteAuditReport(report: SpriteAuditReport): string {
  const { summary } = report;
  const lines = [
    "# Sprite Audit Report",
    "",
    "## High-level summary",
    `- sprite sidecar id: ${summary.sidecarId}`,
    `- linked image id: ${summary.imageId}`,
    `- image dimensions: ${summary.imageDimensions.width}x${summary.imageDimensions.height}`,
    `- atlas dimensions: ${summary.atlasDimensions ? `${summary.atlasDimensions.width}x${summary.atlasDimensions.height}` : "unknown"}`,
    `- total sprites: ${summary.totalSprites}`,
    `- total frames: ${summary.totalFrames}`,
    `- total animations: ${summary.totalAnimations}`,
    `- total diagnostics / suspicious findings: ${summary.totalFindings} (${summary.errors} error, ${summary.warnings} warning, ${summary.notes} note)`,
    `- audit scope: ${summary.scope === "selectedFrame" ? "selected frame only" : "all frames"}`,
    "",
    "## Frame list",
    formatFrameTable(report),
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
