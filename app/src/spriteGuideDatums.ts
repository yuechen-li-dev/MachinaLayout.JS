import type { GuideDatum } from "./guideSidecar";
import type { CanvasDocument } from "./sceneModel";
import type { SpriteFrameRect } from "./spriteFrameEditor";
import {
  findGuideRegionForSpriteFrame,
  getGuideSidecarsForSpriteSidecar,
  type SpriteFrameGuideRegionContext,
} from "./spriteGuideRegions";

export const DEFAULT_SPRITE_FRAME_DATUM_SNAP_DISTANCE = 8;

export type SpriteFrameDatumAnchor = "left" | "right" | "centerX" | "top" | "bottom" | "centerY";

export type SpriteFrameDatumSnapTarget = {
  readonly guideSidecarId: string;
  readonly guideId: string;
  readonly datumId: string;
  readonly datumKind: "vertical" | "horizontal" | "point";
  readonly anchor: SpriteFrameDatumAnchor;
  readonly coordinate: number;
  readonly coordinateY?: number;
  readonly distance: number;
  readonly regionId?: string;
};

export type SpriteFrameDatumSnapOptions = {
  readonly maxDistance?: number;
  readonly restrictToRegion?: boolean;
};

type InternalSpriteFrameDatumSnapTarget = SpriteFrameDatumSnapTarget & {
  readonly sameRegion: boolean;
};

const ANCHOR_ORDER: Record<SpriteFrameDatumAnchor, number> = {
  left: 0,
  right: 1,
  centerX: 2,
  top: 3,
  bottom: 4,
  centerY: 5,
};

function rectRight(rect: SpriteFrameRect) {
  return rect.x + rect.width;
}

function rectBottom(rect: SpriteFrameRect) {
  return rect.y + rect.height;
}

function rectCenterX(rect: SpriteFrameRect) {
  return rect.x + rect.width / 2;
}

function rectCenterY(rect: SpriteFrameRect) {
  return rect.y + rect.height / 2;
}

function getFrameRect(
  scene: CanvasDocument,
  spriteSidecarId: string,
  frameId: string,
): SpriteFrameRect | undefined {
  const sidecar = scene.objects[spriteSidecarId];
  if (sidecar?.kind !== "spriteSidecar") return undefined;
  const frame = sidecar.spec.frames.find((candidate) => candidate.id === frameId);
  if (!frame) return undefined;
  return {
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  };
}

function isSameRegionDatum(
  datum: GuideDatum,
  guideSidecarId: string,
  regionContext: SpriteFrameGuideRegionContext | undefined,
) {
  return (
    datum.region !== undefined &&
    regionContext !== undefined &&
    guideSidecarId === regionContext.guideSidecarId &&
    datum.region === regionContext.regionId
  );
}

function compareTargets(
  a: InternalSpriteFrameDatumSnapTarget,
  b: InternalSpriteFrameDatumSnapTarget,
) {
  if (a.distance !== b.distance) return a.distance - b.distance;
  if (a.sameRegion !== b.sameRegion) return a.sameRegion ? -1 : 1;
  const datumDiff = a.datumId.localeCompare(b.datumId);
  if (datumDiff !== 0) return datumDiff;
  return ANCHOR_ORDER[a.anchor] - ANCHOR_ORDER[b.anchor];
}

function buildVerticalTargets(
  datum: Extract<GuideDatum, { kind: "vertical" }>,
  input: {
    readonly guideSidecarId: string;
    readonly guideId: string;
    readonly frameRect: SpriteFrameRect;
    readonly sameRegion: boolean;
  },
) {
  const frameRect = input.frameRect;
  return [
    {
      guideSidecarId: input.guideSidecarId,
      guideId: input.guideId,
      datumId: datum.id,
      datumKind: datum.kind,
      anchor: "left" as const,
      coordinate: datum.x,
      distance: Math.abs(frameRect.x - datum.x),
      regionId: datum.region,
      sameRegion: input.sameRegion,
    },
    {
      guideSidecarId: input.guideSidecarId,
      guideId: input.guideId,
      datumId: datum.id,
      datumKind: datum.kind,
      anchor: "right" as const,
      coordinate: datum.x,
      distance: Math.abs(rectRight(frameRect) - datum.x),
      regionId: datum.region,
      sameRegion: input.sameRegion,
    },
    {
      guideSidecarId: input.guideSidecarId,
      guideId: input.guideId,
      datumId: datum.id,
      datumKind: datum.kind,
      anchor: "centerX" as const,
      coordinate: datum.x,
      distance: Math.abs(rectCenterX(frameRect) - datum.x),
      regionId: datum.region,
      sameRegion: input.sameRegion,
    },
  ] satisfies readonly InternalSpriteFrameDatumSnapTarget[];
}

function buildHorizontalTargets(
  datum: Extract<GuideDatum, { kind: "horizontal" }>,
  input: {
    readonly guideSidecarId: string;
    readonly guideId: string;
    readonly frameRect: SpriteFrameRect;
    readonly sameRegion: boolean;
  },
) {
  const frameRect = input.frameRect;
  return [
    {
      guideSidecarId: input.guideSidecarId,
      guideId: input.guideId,
      datumId: datum.id,
      datumKind: datum.kind,
      anchor: "top" as const,
      coordinate: datum.y,
      distance: Math.abs(frameRect.y - datum.y),
      regionId: datum.region,
      sameRegion: input.sameRegion,
    },
    {
      guideSidecarId: input.guideSidecarId,
      guideId: input.guideId,
      datumId: datum.id,
      datumKind: datum.kind,
      anchor: "bottom" as const,
      coordinate: datum.y,
      distance: Math.abs(rectBottom(frameRect) - datum.y),
      regionId: datum.region,
      sameRegion: input.sameRegion,
    },
    {
      guideSidecarId: input.guideSidecarId,
      guideId: input.guideId,
      datumId: datum.id,
      datumKind: datum.kind,
      anchor: "centerY" as const,
      coordinate: datum.y,
      distance: Math.abs(rectCenterY(frameRect) - datum.y),
      regionId: datum.region,
      sameRegion: input.sameRegion,
    },
  ] satisfies readonly InternalSpriteFrameDatumSnapTarget[];
}

function buildPointTargets(
  datum: Extract<GuideDatum, { kind: "point" }>,
  input: {
    readonly guideSidecarId: string;
    readonly guideId: string;
    readonly frameRect: SpriteFrameRect;
    readonly sameRegion: boolean;
  },
) {
  return [
    {
      guideSidecarId: input.guideSidecarId,
      guideId: input.guideId,
      datumId: datum.id,
      datumKind: datum.kind,
      // Point snapping keeps M38c narrow by moving the frame center onto the point.
      anchor: "centerX" as const,
      coordinate: datum.x,
      coordinateY: datum.y,
      distance: Math.hypot(
        rectCenterX(input.frameRect) - datum.x,
        rectCenterY(input.frameRect) - datum.y,
      ),
      regionId: datum.region,
      sameRegion: input.sameRegion,
    },
  ] satisfies readonly InternalSpriteFrameDatumSnapTarget[];
}

export function findDatumSnapTargetsForSpriteFrame(
  scene: CanvasDocument,
  input: {
    readonly spriteSidecarId: string;
    readonly frameId: string;
    readonly options?: SpriteFrameDatumSnapOptions;
  },
): readonly SpriteFrameDatumSnapTarget[] {
  const frameRect = getFrameRect(scene, input.spriteSidecarId, input.frameId);
  if (!frameRect) return [];

  const guideSidecars = getGuideSidecarsForSpriteSidecar(scene, input.spriteSidecarId);
  if (guideSidecars.length === 0) return [];

  const regionContext = findGuideRegionForSpriteFrame(scene, {
    spriteSidecarId: input.spriteSidecarId,
    frameId: input.frameId,
  });
  const maxDistance = input.options?.maxDistance ?? DEFAULT_SPRITE_FRAME_DATUM_SNAP_DISTANCE;
  const restrictToRegion = input.options?.restrictToRegion ?? regionContext !== undefined;

  const candidates: InternalSpriteFrameDatumSnapTarget[] = [];
  for (const guideSidecar of guideSidecars) {
    for (const datum of guideSidecar.guide.datums) {
      const sameRegion = isSameRegionDatum(datum, guideSidecar.id, regionContext);
      const baseInput = {
        guideSidecarId: guideSidecar.id,
        guideId: guideSidecar.guide.id,
        frameRect,
        sameRegion,
      };
      const targets =
        datum.kind === "vertical"
          ? buildVerticalTargets(datum, baseInput)
          : datum.kind === "horizontal"
            ? buildHorizontalTargets(datum, baseInput)
            : buildPointTargets(datum, baseInput);
      for (const target of targets) {
        if (target.distance <= maxDistance) {
          candidates.push(target);
        }
      }
    }
  }

  if (candidates.length === 0) return [];
  const restrictedTargets =
    restrictToRegion &&
    regionContext !== undefined &&
    candidates.some((candidate) => candidate.sameRegion)
      ? candidates.filter((candidate) => candidate.sameRegion)
      : candidates;
  return [...restrictedTargets]
    .sort(compareTargets)
    .map(({ sameRegion: _sameRegion, ...target }) => target);
}

export function snapSpriteFrameRectToDatum(
  rect: SpriteFrameRect,
  target: SpriteFrameDatumSnapTarget,
): SpriteFrameRect {
  if (target.datumKind === "point") {
    const centerX = target.coordinate;
    const centerY = target.coordinateY ?? rectCenterY(rect);
    return {
      x: Math.round(centerX - rect.width / 2),
      y: Math.round(centerY - rect.height / 2),
      width: rect.width,
      height: rect.height,
    };
  }

  if (target.anchor === "left") {
    return { x: Math.round(target.coordinate), y: rect.y, width: rect.width, height: rect.height };
  }
  if (target.anchor === "right") {
    return {
      x: Math.round(target.coordinate - rect.width),
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }
  if (target.anchor === "centerX") {
    return {
      x: Math.round(target.coordinate - rect.width / 2),
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }
  if (target.anchor === "top") {
    return { x: rect.x, y: Math.round(target.coordinate), width: rect.width, height: rect.height };
  }
  if (target.anchor === "bottom") {
    return {
      x: rect.x,
      y: Math.round(target.coordinate - rect.height),
      width: rect.width,
      height: rect.height,
    };
  }
  return {
    x: rect.x,
    y: Math.round(target.coordinate - rect.height / 2),
    width: rect.width,
    height: rect.height,
  };
}
