import type { GuideRegion } from "./guideSidecar";
import type {
  CanvasDocument,
  CanvasSpriteDiagnostics,
  CanvasSpriteFrame,
  GuideSidecarObject,
  SpriteSidecarObject,
} from "./sceneModel";
import type { SpriteFrameRect } from "./spriteFrameEditor";

export type SpriteFrameGuideRegionContext = {
  readonly guideSidecarId: string;
  readonly guideId: string;
  readonly regionId: string;
  readonly region: GuideRegion;
  readonly relation: "contains" | "intersects" | "nearest" | "none";
  readonly frameRect: SpriteFrameRect;
  readonly regionRect: SpriteFrameRect;
  readonly deltaToRegion?: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
};

type CandidateRegionContext = Omit<SpriteFrameGuideRegionContext, "deltaToRegion"> & {
  readonly containingArea: number;
  readonly intersectionArea: number;
  readonly nearestDistanceSquared: number;
};

function getFrameRect(
  frame: Pick<CanvasSpriteFrame, "x" | "y" | "width" | "height">,
): SpriteFrameRect {
  return {
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  };
}

function getRegionRect(region: GuideRegion): SpriteFrameRect {
  return {
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
  };
}

function rectRight(rect: SpriteFrameRect) {
  return rect.x + rect.width;
}

function rectBottom(rect: SpriteFrameRect) {
  return rect.y + rect.height;
}

function getRegionDelta(frameRect: SpriteFrameRect, regionRect: SpriteFrameRect) {
  return {
    left: frameRect.x - regionRect.x,
    top: frameRect.y - regionRect.y,
    right: rectRight(regionRect) - rectRight(frameRect),
    bottom: rectBottom(regionRect) - rectBottom(frameRect),
  };
}

function containsRect(container: SpriteFrameRect, rect: SpriteFrameRect) {
  return (
    rect.x >= container.x &&
    rect.y >= container.y &&
    rectRight(rect) <= rectRight(container) &&
    rectBottom(rect) <= rectBottom(container)
  );
}

function getIntersectionArea(a: SpriteFrameRect, b: SpriteFrameRect) {
  const overlapWidth = Math.min(rectRight(a), rectRight(b)) - Math.max(a.x, b.x);
  const overlapHeight = Math.min(rectBottom(a), rectBottom(b)) - Math.max(a.y, b.y);
  if (overlapWidth <= 0 || overlapHeight <= 0) return 0;
  return overlapWidth * overlapHeight;
}

function getNearestDistanceSquared(a: SpriteFrameRect, b: SpriteFrameRect) {
  const dx = rectRight(a) < b.x ? b.x - rectRight(a) : rectRight(b) < a.x ? a.x - rectRight(b) : 0;
  const dy =
    rectBottom(a) < b.y ? b.y - rectBottom(a) : rectBottom(b) < a.y ? a.y - rectBottom(b) : 0;
  return dx * dx + dy * dy;
}

function compareCandidates(a: CandidateRegionContext, b: CandidateRegionContext) {
  if (a.relation !== b.relation) {
    const rank = { contains: 0, intersects: 1, nearest: 2, none: 3 } as const;
    return rank[a.relation] - rank[b.relation];
  }
  if (a.relation === "contains") {
    if (a.containingArea !== b.containingArea) return a.containingArea - b.containingArea;
  } else if (a.relation === "intersects") {
    if (a.intersectionArea !== b.intersectionArea) return b.intersectionArea - a.intersectionArea;
  } else if (a.relation === "nearest") {
    if (a.nearestDistanceSquared !== b.nearestDistanceSquared) {
      return a.nearestDistanceSquared - b.nearestDistanceSquared;
    }
  }
  const areaDiff =
    a.regionRect.width * a.regionRect.height - b.regionRect.width * b.regionRect.height;
  if (areaDiff !== 0) return areaDiff;
  const guideDiff = a.guideSidecarId.localeCompare(b.guideSidecarId);
  if (guideDiff !== 0) return guideDiff;
  return a.regionId.localeCompare(b.regionId);
}

export function getGuideSidecarsForSpriteSidecar(
  scene: CanvasDocument,
  spriteSidecarId: string,
): readonly GuideSidecarObject[] {
  const sidecar = scene.objects[spriteSidecarId];
  if (sidecar?.kind !== "spriteSidecar" || !sidecar.targetId) return [];
  return Object.values(scene.objects).filter(
    (candidate): candidate is GuideSidecarObject =>
      candidate.kind === "guideSidecar" && candidate.targetId === sidecar.targetId,
  );
}

export function findGuideRegionForSpriteFrame(
  scene: CanvasDocument,
  input: {
    readonly spriteSidecarId: string;
    readonly frameId: string;
  },
): SpriteFrameGuideRegionContext | undefined {
  const sidecar = scene.objects[input.spriteSidecarId];
  if (sidecar?.kind !== "spriteSidecar") return undefined;
  const frame = sidecar.spec.frames.find((candidate) => candidate.id === input.frameId);
  if (!frame) return undefined;
  const guideSidecars = getGuideSidecarsForSpriteSidecar(scene, input.spriteSidecarId);
  if (guideSidecars.length === 0) return undefined;

  const frameRect = getFrameRect(frame);
  const candidates: CandidateRegionContext[] = [];
  for (const guideSidecar of guideSidecars) {
    for (const region of guideSidecar.guide.regions) {
      const regionRect = getRegionRect(region);
      const containingArea = regionRect.width * regionRect.height;
      const intersectionArea = getIntersectionArea(frameRect, regionRect);
      const relation = containsRect(regionRect, frameRect)
        ? "contains"
        : intersectionArea > 0
          ? "intersects"
          : "nearest";
      candidates.push({
        guideSidecarId: guideSidecar.id,
        guideId: guideSidecar.guide.id,
        regionId: region.id,
        region,
        relation,
        frameRect,
        regionRect,
        containingArea,
        intersectionArea,
        nearestDistanceSquared: getNearestDistanceSquared(frameRect, regionRect),
      });
    }
  }

  if (candidates.length === 0) return undefined;
  candidates.sort(compareCandidates);
  const winner = candidates[0];
  return {
    guideSidecarId: winner.guideSidecarId,
    guideId: winner.guideId,
    regionId: winner.regionId,
    region: winner.region,
    relation: winner.relation,
    frameRect: winner.frameRect,
    regionRect: winner.regionRect,
    deltaToRegion: getRegionDelta(winner.frameRect, winner.regionRect),
  };
}

export function clampSpriteFrameRectToGuideRegion(
  rect: SpriteFrameRect,
  region: GuideRegion,
): SpriteFrameRect {
  const regionX = Math.round(region.x);
  const regionY = Math.round(region.y);
  const regionWidth = Math.max(1, Math.round(region.width));
  const regionHeight = Math.max(1, Math.round(region.height));
  const regionRight = regionX + regionWidth;
  const regionBottom = regionY + regionHeight;
  const width = Math.min(Math.max(1, Math.round(rect.width)), regionWidth);
  const height = Math.min(Math.max(1, Math.round(rect.height)), regionHeight);
  return {
    x: Math.min(Math.max(Math.round(rect.x), regionX), regionRight - width),
    y: Math.min(Math.max(Math.round(rect.y), regionY), regionBottom - height),
    width,
    height,
  };
}

function buildOverflowMessage(
  frameId: string,
  context: SpriteFrameGuideRegionContext,
  code: string,
): CanvasSpriteDiagnostics {
  const delta = context.deltaToRegion;
  const overflow: string[] = [];
  if (delta) {
    if (delta.left < 0) overflow.push(`${Math.abs(delta.left)}px on the left`);
    if (delta.top < 0) overflow.push(`${Math.abs(delta.top)}px on the top`);
    if (delta.right < 0) overflow.push(`${Math.abs(delta.right)}px on the right`);
    if (delta.bottom < 0) overflow.push(`${Math.abs(delta.bottom)}px on the bottom`);
  }
  return {
    severity: "warning",
    code,
    frameIds: [frameId],
    message:
      overflow.length > 0
        ? `${frameId} extends outside guide region ${context.regionId} by ${overflow.join(", ")}.`
        : `${frameId} extends outside guide region ${context.regionId}.`,
  };
}

export function collectGuideRegionDiagnosticsForSpriteSidecar(
  scene: CanvasDocument,
  sidecar: SpriteSidecarObject,
): readonly CanvasSpriteDiagnostics[] {
  const guideSidecars = getGuideSidecarsForSpriteSidecar(scene, sidecar.id);
  if (guideSidecars.length === 0) return [];

  const diagnostics: CanvasSpriteDiagnostics[] = [];
  for (const frame of sidecar.spec.frames) {
    const context = findGuideRegionForSpriteFrame(scene, {
      spriteSidecarId: sidecar.id,
      frameId: frame.id,
    });
    if (!context) continue;

    if (context.relation === "intersects") {
      diagnostics.push(buildOverflowMessage(frame.id, context, "SpriteFrameOutsideGuideRegion"), {
        severity: "warning",
        code: "SpriteFrameIntersectsGuideRegion",
        frameIds: [frame.id],
        message: `${frame.id} only partially overlaps guide region ${context.regionId}.`,
      });
    } else if (context.relation === "nearest" || context.relation === "none") {
      diagnostics.push({
        severity: "warning",
        code: "SpriteFrameMissingGuideRegion",
        frameIds: [frame.id],
        message: `${frame.id} is not contained by any guide region; nearest region is ${context.regionId}.`,
      });
    }

    if (frame.width > context.region.width || frame.height > context.region.height) {
      diagnostics.push({
        severity: "warning",
        code: "SpriteFrameLargerThanGuideRegion",
        frameIds: [frame.id],
        message: `${frame.id} is larger than guide region ${context.regionId}.`,
      });
    }
  }
  return diagnostics;
}
