import type {
  CanvasSpriteFrame,
  CanvasSpriteOverlaySettings,
  SpriteFrameSourceKind,
  SpriteOverlayDisplayMode,
  SpriteSidecarObject,
} from "./sceneModel";

export type SpriteOverlayFrameEmphasis =
  | "selected"
  | "hovered"
  | "audit"
  | "normal"
  | "dimmed"
  | "hidden";

export type SpriteOverlayLabelTone = "selected" | "hovered" | "audit" | "debug";

export type SpriteOverlaySubgridEmphasis = "context" | "normal" | "dimmed" | "hidden";

export type SpriteOverlayFramePresentation = {
  emphasis: SpriteOverlayFrameEmphasis;
  labelTone?: SpriteOverlayLabelTone;
  showRect: boolean;
  showLabel: boolean;
  showHandle: boolean;
  showChip: boolean;
  sourceKind: SpriteFrameSourceKind;
};

export type SpriteOverlaySubgridPresentation = {
  emphasis: SpriteOverlaySubgridEmphasis;
  showRect: boolean;
  showLabel: boolean;
};

export type SpriteOverlayRenderPlan = {
  displayMode: SpriteOverlayDisplayMode;
  framePresentations: ReadonlyMap<string, SpriteOverlayFramePresentation>;
  subgridPresentations: ReadonlyMap<string, SpriteOverlaySubgridPresentation>;
  auditFrameIds: ReadonlySet<string>;
};

export type SpriteOverlayRenderPlanOptions = {
  hoveredFrameId?: string;
};

export type SpriteOverlayLabelChip = {
  title: string;
  detail?: string;
  width: number;
  height: number;
  titleBaseline: number;
  detailBaseline?: number;
};

type RectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const SPRITE_OVERLAY_DISPLAY_MODES = [
  "focus",
  "cutEdit",
  "gridEdit",
  "audit",
  "debug",
] as const satisfies readonly SpriteOverlayDisplayMode[];

export const DEFAULT_SPRITE_OVERLAY_SETTINGS: CanvasSpriteOverlaySettings = {
  displayMode: "focus",
  showBounds: true,
  showLabels: false,
  selectedOnly: false,
  showSubgrids: true,
  showExactFrames: true,
};

export function normalizeSpriteOverlayDisplayMode(value: unknown): SpriteOverlayDisplayMode {
  return SPRITE_OVERLAY_DISPLAY_MODES.includes(value as SpriteOverlayDisplayMode)
    ? (value as SpriteOverlayDisplayMode)
    : "focus";
}

export function getSpriteOverlayDisplayModeLabel(mode: SpriteOverlayDisplayMode): string {
  switch (mode) {
    case "focus":
      return "Focus";
    case "cutEdit":
      return "Cut edit";
    case "gridEdit":
      return "Grid edit";
    case "audit":
      return "Audit";
    case "debug":
      return "Debug";
  }
}

export function getSpriteOverlayAuditFrameIds(sidecar: SpriteSidecarObject): ReadonlySet<string> {
  return new Set(sidecar.spec.diagnostics.flatMap((diagnostic) => diagnostic.frameIds ?? []));
}

function getOverlayFrameSourceKind(
  frame: Pick<CanvasSpriteFrame, "sourceKind" | "source" | "gridId" | "sourceGridId">,
): SpriteFrameSourceKind {
  if (frame.sourceKind) return frame.sourceKind;
  if (frame.source === "grid") return "grid";
  if (frame.source === "frame") return frame.gridId || frame.sourceGridId ? "exact" : "manual";
  if (frame.source === "inline") return "manual";
  return frame.gridId || frame.sourceGridId ? "exact" : "unknown";
}

function getModeFrameEmphasis(
  mode: SpriteOverlayDisplayMode,
  options: {
    isSelected: boolean;
    isHovered: boolean;
    isAudit: boolean;
    hasAuditFrames: boolean;
  },
): SpriteOverlayFrameEmphasis {
  const { hasAuditFrames, isAudit, isHovered, isSelected } = options;
  if (isSelected) return "selected";
  if (isHovered) return "hovered";
  if (mode === "audit" && isAudit) return "audit";
  switch (mode) {
    case "focus":
      return "dimmed";
    case "cutEdit":
      return "normal";
    case "gridEdit":
      return "dimmed";
    case "audit":
      return hasAuditFrames ? "hidden" : "dimmed";
    case "debug":
      return isAudit ? "audit" : "normal";
  }
}

function getModeSubgridPresentation(
  mode: SpriteOverlayDisplayMode,
  options: {
    isContext: boolean;
    isAuditContext: boolean;
    hasAuditContext: boolean;
  },
): SpriteOverlaySubgridPresentation {
  const { hasAuditContext, isAuditContext, isContext } = options;
  switch (mode) {
    case "focus":
      return isContext
        ? { emphasis: "context", showRect: true, showLabel: false }
        : { emphasis: "hidden", showRect: false, showLabel: false };
    case "cutEdit":
      return isContext
        ? { emphasis: "context", showRect: true, showLabel: false }
        : { emphasis: "hidden", showRect: false, showLabel: false };
    case "gridEdit":
      return {
        emphasis: isContext ? "context" : "dimmed",
        showRect: true,
        showLabel: true,
      };
    case "audit":
      if (isAuditContext) {
        return { emphasis: "context", showRect: true, showLabel: true };
      }
      if (hasAuditContext) {
        return { emphasis: "hidden", showRect: false, showLabel: false };
      }
      return isContext
        ? { emphasis: "context", showRect: true, showLabel: false }
        : { emphasis: "hidden", showRect: false, showLabel: false };
    case "debug":
      return {
        emphasis: isContext || isAuditContext ? "context" : "normal",
        showRect: true,
        showLabel: true,
      };
  }
}

export function createSpriteOverlayRenderPlan(
  sidecar: SpriteSidecarObject,
  options: SpriteOverlayRenderPlanOptions = {},
): SpriteOverlayRenderPlan {
  const displayMode = normalizeSpriteOverlayDisplayMode(sidecar.spec.overlay.displayMode);
  const auditFrameIds = getSpriteOverlayAuditFrameIds(sidecar);
  const hoveredFrameId = options.hoveredFrameId;
  const selectedFrame = sidecar.spec.frames.find(
    (frame) => frame.id === sidecar.spec.selectedFrameId,
  );
  const hoveredFrame = sidecar.spec.frames.find((frame) => frame.id === hoveredFrameId);
  const contextGridIds = new Set<string>();
  const auditGridIds = new Set<string>();
  if (selectedFrame?.sourceGridId) contextGridIds.add(selectedFrame.sourceGridId);
  if (hoveredFrame?.sourceGridId) contextGridIds.add(hoveredFrame.sourceGridId);
  for (const frame of sidecar.spec.frames) {
    if (auditFrameIds.has(frame.id) && frame.sourceGridId) {
      auditGridIds.add(frame.sourceGridId);
    }
  }
  const showAllLabels = displayMode === "debug" || sidecar.spec.overlay.showLabels;
  const hasAuditFrames = auditFrameIds.size > 0;
  const hasAuditContext = auditGridIds.size > 0;
  const framePresentations = new Map<string, SpriteOverlayFramePresentation>();

  for (const frame of sidecar.spec.frames) {
    const sourceKind = getOverlayFrameSourceKind(frame);
    const isSelected = frame.id === sidecar.spec.selectedFrameId;
    const isHovered = frame.id === hoveredFrameId;
    const isAudit = auditFrameIds.has(frame.id);
    const legacySelectedOnlyHidden =
      sidecar.spec.overlay.selectedOnly &&
      !isSelected &&
      !isHovered &&
      !(displayMode === "audit" && isAudit);
    const exactLike = sourceKind === "exact" || sourceKind === "manual" || sourceKind === "unknown";
    const hiddenByExactToggle =
      !sidecar.spec.overlay.showExactFrames &&
      exactLike &&
      !isSelected &&
      !isHovered &&
      !(displayMode === "audit" && isAudit);
    const emphasis =
      legacySelectedOnlyHidden || hiddenByExactToggle
        ? "hidden"
        : getModeFrameEmphasis(displayMode, {
            isSelected,
            isHovered,
            isAudit,
            hasAuditFrames,
          });
    const labelTone = showAllLabels
      ? "debug"
      : isSelected
        ? "selected"
        : isHovered
          ? "hovered"
          : displayMode === "audit" && isAudit
            ? "audit"
            : undefined;
    const showLabel =
      emphasis !== "hidden" &&
      (showAllLabels || isSelected || isHovered || (displayMode === "audit" && isAudit));
    framePresentations.set(frame.id, {
      emphasis,
      labelTone,
      showRect: sidecar.spec.overlay.showBounds && emphasis !== "hidden",
      showLabel,
      showHandle: isSelected,
      showChip: isSelected || (!sidecar.spec.selectedFrameId && isHovered),
      sourceKind,
    });
  }

  const subgridPresentations = new Map<string, SpriteOverlaySubgridPresentation>();
  for (const grid of sidecar.spec.grids) {
    const base = getModeSubgridPresentation(displayMode, {
      isContext: contextGridIds.has(grid.id),
      isAuditContext: auditGridIds.has(grid.id),
      hasAuditContext,
    });
    subgridPresentations.set(grid.id, {
      emphasis:
        !sidecar.spec.overlay.showSubgrids || !sidecar.spec.overlay.showBounds
          ? "hidden"
          : base.emphasis,
      showRect:
        sidecar.spec.overlay.showSubgrids && sidecar.spec.overlay.showBounds && base.showRect,
      showLabel:
        sidecar.spec.overlay.showSubgrids && sidecar.spec.overlay.showBounds && base.showLabel,
    });
  }

  return {
    displayMode,
    framePresentations,
    subgridPresentations,
    auditFrameIds,
  };
}

export function shouldRenderSpriteFrameLabel(
  frame: CanvasSpriteFrame,
  plan: SpriteOverlayRenderPlan,
): boolean {
  return plan.framePresentations.get(frame.id)?.showLabel ?? false;
}

export function buildSpriteOverlayLabelChip(
  frame: CanvasSpriteFrame,
  sourceKind: SpriteFrameSourceKind,
  emphasis: SpriteOverlayFrameEmphasis,
): SpriteOverlayLabelChip {
  const title = frame.id;
  const detail =
    emphasis === "selected"
      ? `${sourceKind} · ${frame.x},${frame.y} ${frame.width}x${frame.height}${
          frame.sourceStackframeId
            ? ` · ${frame.sourceStackframeId}[${frame.sourceStackIndex ?? "?"}]`
            : frame.sourceGridId
              ? ` · ${frame.sourceGridId}`
              : ""
        }`
      : undefined;
  const width = Math.max(
    112,
    Math.ceil(Math.max(title.length, detail?.length ?? 0) * (detail ? 6.2 : 6.8) + 16),
  );
  return detail
    ? {
        title,
        detail,
        width,
        height: 36,
        titleBaseline: 15,
        detailBaseline: 28,
      }
    : {
        title,
        width,
        height: 22,
        titleBaseline: 15,
      };
}

export function layoutSpriteOverlayLabelChip(
  rect: RectLike,
  imageRect: RectLike,
  chip: SpriteOverlayLabelChip,
) {
  const minX = imageRect.x + 4;
  const maxX = imageRect.x + imageRect.width - chip.width - 4;
  const x = Math.min(Math.max(rect.x, minX), Math.max(minX, maxX));
  const aboveY = rect.y - chip.height - 8;
  const y =
    aboveY >= imageRect.y + 4
      ? aboveY
      : Math.min(rect.y + 4, imageRect.y + imageRect.height - chip.height - 4);
  return {
    x,
    y,
    width: chip.width,
    height: chip.height,
    titleY: y + chip.titleBaseline,
    detailY: chip.detailBaseline ? y + chip.detailBaseline : undefined,
  };
}

export function getSpriteOverlayFrameClassNames(
  presentation: SpriteOverlayFramePresentation,
): string {
  const classes = ["canvas-sprite-frame"];
  if (presentation.sourceKind === "grid") {
    classes.push("sprite-frame--grid");
  } else if (presentation.sourceKind === "stackframe") {
    classes.push("sprite-frame--grid");
  } else if (presentation.sourceKind === "manual") {
    classes.push("sprite-frame--manual");
  } else {
    classes.push("sprite-frame--exact");
  }
  if (presentation.emphasis === "selected") classes.push("sprite-frame--selected");
  if (presentation.emphasis === "hovered") classes.push("sprite-frame--hovered");
  if (presentation.emphasis === "dimmed") classes.push("sprite-frame--dimmed");
  if (presentation.emphasis === "audit") classes.push("sprite-frame--audit");
  return classes.join(" ");
}

export function getSpriteOverlaySubgridClassNames(
  presentation: SpriteOverlaySubgridPresentation,
): string {
  const classes = ["canvas-sprite-subgrid"];
  if (presentation.emphasis === "context") classes.push("sprite-subgrid--context");
  if (presentation.emphasis === "dimmed") classes.push("sprite-subgrid--dimmed");
  return classes.join(" ");
}
