import type { GuideSidecarDiagnostic, GuideAlignmentMark } from "./guideSidecar";
import type { CanvasDocument, CanvasObject, GuideSidecarObject, ImageObject } from "./sceneModel";

export type ResolvedGuideAlignmentMark = {
  readonly guideSidecarId: string;
  readonly guideId: string;
  readonly markId: string;
  readonly targetObjectId: string;
  readonly local: {
    readonly x: number;
    readonly y: number;
  };
  readonly scene: {
    readonly x: number;
    readonly y: number;
  };
  readonly label?: string;
};

export type GuideAlignmentTranslation = {
  readonly kind: "translation";
  readonly dx: number;
  readonly dy: number;
  readonly sourceMark: ResolvedGuideAlignmentMark;
  readonly targetMark: ResolvedGuideAlignmentMark;
};

type TargetResolution =
  | {
      readonly kind: "resolved";
      readonly object: ImageObject;
    }
  | {
      readonly kind: "missingDefaultTarget";
      readonly message: string;
    }
  | {
      readonly kind: "unresolved";
      readonly message: string;
    }
  | {
      readonly kind: "ambiguous";
      readonly message: string;
    }
  | {
      readonly kind: "invalid";
      readonly object: CanvasObject;
      readonly message: string;
    };

function basename(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : undefined;
}

function getObjectAliases(object: CanvasObject): readonly string[] {
  const aliases = new Set<string>([object.id, object.name]);
  if (object.kind === "image") {
    const srcName = basename(object.src);
    if (srcName) aliases.add(srcName);
  }
  if (object.kind === "spriteSidecar" && object.spec.sourceName) {
    aliases.add(object.spec.sourceName);
  }
  if (object.kind === "guideSidecar") {
    aliases.add(object.guide.id);
  }
  return [...aliases].filter((value) => value.trim().length > 0);
}

function getGuideSidecars(scene: CanvasDocument): readonly GuideSidecarObject[] {
  return Object.values(scene.objects)
    .filter((object): object is GuideSidecarObject => object.kind === "guideSidecar")
    .sort((left, right) => left.id.localeCompare(right.id));
}

function mapImageLocalPointToScene(
  object: ImageObject,
  point: { readonly x: number; readonly y: number },
) {
  const sourceWidth = object.intrinsicWidth ?? object.width;
  const sourceHeight = object.intrinsicHeight ?? object.height;
  const scaleX = sourceWidth === 0 ? 1 : object.width / sourceWidth;
  const scaleY = sourceHeight === 0 ? 1 : object.height / sourceHeight;
  return {
    x: object.x + point.x * scaleX,
    y: object.y + point.y * scaleY,
  };
}

function resolveAlignmentMarkTarget(
  scene: CanvasDocument,
  guideObject: GuideSidecarObject,
  mark: GuideAlignmentMark,
): TargetResolution {
  if (!mark.target) {
    if (!guideObject.targetId) {
      return {
        kind: "missingDefaultTarget",
        message: `Guide alignment mark "${mark.id}" has no target and guide sidecar "${guideObject.id}" is unattached.`,
      };
    }
    const target = scene.objects[guideObject.targetId];
    if (!target) {
      return {
        kind: "unresolved",
        message: `Guide alignment mark "${mark.id}" default target "${guideObject.targetId}" does not exist.`,
      };
    }
    if (target.kind !== "image") {
      return {
        kind: "invalid",
        object: target,
        message: `Guide alignment mark "${mark.id}" default target "${guideObject.targetId}" is not an image object.`,
      };
    }
    return { kind: "resolved", object: target };
  }

  const matches = Object.values(scene.objects).filter((candidate) =>
    getObjectAliases(candidate).includes(mark.target as string),
  );
  if (matches.length === 0) {
    return {
      kind: "unresolved",
      message: `Guide alignment mark "${mark.id}" target "${mark.target}" could not be resolved.`,
    };
  }
  if (matches.length > 1) {
    return {
      kind: "ambiguous",
      message: `Guide alignment mark "${mark.id}" target "${mark.target}" is ambiguous across ${matches.length} objects.`,
    };
  }
  const [match] = matches;
  if (match.kind !== "image") {
    return {
      kind: "invalid",
      object: match,
      message: `Guide alignment mark "${mark.id}" target "${mark.target}" resolved to unsupported ${match.kind} object "${match.id}".`,
    };
  }
  return { kind: "resolved", object: match };
}

export function resolveGuideAlignmentMarks(
  scene: CanvasDocument,
): readonly ResolvedGuideAlignmentMark[] {
  const resolved: ResolvedGuideAlignmentMark[] = [];
  for (const guideObject of getGuideSidecars(scene)) {
    for (const mark of guideObject.guide.alignmentMarks) {
      const target = resolveAlignmentMarkTarget(scene, guideObject, mark);
      if (target.kind !== "resolved") continue;
      resolved.push({
        guideSidecarId: guideObject.id,
        guideId: guideObject.guide.id,
        markId: mark.id,
        targetObjectId: target.object.id,
        local: { x: mark.x, y: mark.y },
        scene: mapImageLocalPointToScene(target.object, { x: mark.x, y: mark.y }),
        label: mark.label,
      });
    }
  }
  return resolved.sort((left, right) => {
    const targetCompare = left.targetObjectId.localeCompare(right.targetObjectId);
    if (targetCompare !== 0) return targetCompare;
    const markCompare = left.markId.localeCompare(right.markId);
    if (markCompare !== 0) return markCompare;
    return left.guideSidecarId.localeCompare(right.guideSidecarId);
  });
}

export function computeGuideAlignmentTranslation(input: {
  readonly sourceMark: ResolvedGuideAlignmentMark;
  readonly targetMark: ResolvedGuideAlignmentMark;
}): GuideAlignmentTranslation {
  return {
    kind: "translation",
    dx: input.targetMark.scene.x - input.sourceMark.scene.x,
    dy: input.targetMark.scene.y - input.sourceMark.scene.y,
    sourceMark: input.sourceMark,
    targetMark: input.targetMark,
  };
}

function makeDiagnostic(
  severity: GuideSidecarDiagnostic["severity"],
  code: string,
  message: string,
  alignmentMarkId: string,
): GuideSidecarDiagnostic {
  return { severity, code, message, alignmentMarkId };
}

export function validateGuideAlignmentMarks(
  scene: CanvasDocument,
): readonly GuideSidecarDiagnostic[] {
  const diagnostics: GuideSidecarDiagnostic[] = [];
  const duplicateMarkTargets = new Map<string, GuideSidecarObject[]>();

  for (const guideObject of getGuideSidecars(scene)) {
    for (const mark of guideObject.guide.alignmentMarks) {
      const target = resolveAlignmentMarkTarget(scene, guideObject, mark);
      if (target.kind === "missingDefaultTarget" || target.kind === "unresolved") {
        diagnostics.push(
          makeDiagnostic("error", "UnresolvedGuideAlignmentTarget", target.message, mark.id),
        );
        continue;
      }
      if (target.kind === "ambiguous") {
        diagnostics.push(
          makeDiagnostic("error", "AmbiguousGuideAlignmentMark", target.message, mark.id),
        );
        continue;
      }
      if (target.kind === "invalid") {
        diagnostics.push(
          makeDiagnostic("error", "InvalidGuideAlignmentTarget", target.message, mark.id),
        );
        continue;
      }

      const sourceWidth = target.object.intrinsicWidth ?? target.object.width;
      const sourceHeight = target.object.intrinsicHeight ?? target.object.height;
      if (mark.x < 0 || mark.y < 0 || mark.x > sourceWidth || mark.y > sourceHeight) {
        diagnostics.push(
          makeDiagnostic(
            "warning",
            "GuideAlignmentMarkOutOfBounds",
            `Guide alignment mark "${mark.id}" lies outside target image "${target.object.id}" bounds.`,
            mark.id,
          ),
        );
      }

      const duplicateKey = `${target.object.id}::${mark.id}`;
      const existing = duplicateMarkTargets.get(duplicateKey) ?? [];
      duplicateMarkTargets.set(duplicateKey, [...existing, guideObject]);
    }
  }

  for (const [key, guides] of duplicateMarkTargets) {
    if (guides.length < 2) continue;
    const [targetObjectId, markId] = key.split("::");
    diagnostics.push(
      makeDiagnostic(
        "warning",
        "AmbiguousGuideAlignmentMark",
        `Alignment mark "${markId}" is duplicated across ${guides.length} guides for target "${targetObjectId}", so command lookup may be ambiguous.`,
        markId,
      ),
    );
  }

  return diagnostics.sort((left, right) => {
    const codeCompare = left.code.localeCompare(right.code);
    if (codeCompare !== 0) return codeCompare;
    return (left.alignmentMarkId ?? "").localeCompare(right.alignmentMarkId ?? "");
  });
}
