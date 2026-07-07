import type {
  CanvasSpriteAnimation,
  CanvasSpriteDiagnostics,
  CanvasSpriteFrame,
  CanvasSpriteGridSpec,
  CanvasSpriteSpec,
  ImageObject,
  SpriteFrameSourceKind,
  SpriteSidecarObject,
} from "./sceneModel";
import {
  DEFAULT_SPRITE_OVERLAY_SETTINGS,
  normalizeSpriteOverlayDisplayMode,
} from "./spriteOverlay";
import { parseTomlDocument } from "./tomlSyntax";

export type SpriteSidecar = CanvasSpriteSpec;

export type SpriteSidecarExportMode = "authoring" | "runtime";

export type SpriteTomlExportOptions = {
  readonly mode?: SpriteSidecarExportMode;
  readonly includeLegacyCutGrids?: boolean;
};

const defaultOverlay = DEFAULT_SPRITE_OVERLAY_SETTINGS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTable(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asArray(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function pushDiagnostic(
  diagnostics: CanvasSpriteDiagnostics[],
  code: string,
  message: string,
  frameIds?: readonly string[],
) {
  diagnostics.push({ severity: "warning", code, message, frameIds });
}

function formatSpriteTomlError(
  code: "InvalidTomlSyntax" | "InvalidSpriteTomlDocument",
  detail: string,
): string {
  return `${code}: ${detail}`;
}

function parseSpriteTomlRoot(text: string): Record<string, unknown> {
  try {
    const root = parseTomlDocument(text);
    if (!isRecord(root)) {
      throw new Error(
        formatSpriteTomlError(
          "InvalidSpriteTomlDocument",
          "Sprite sidecar TOML must contain a top-level table.",
        ),
      );
    }
    return root;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("InvalidSpriteTomlDocument:")) {
      throw error;
    }
    const detail =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : "Sprite sidecar TOML could not be parsed.";
    throw new Error(formatSpriteTomlError("InvalidTomlSyntax", detail));
  }
}

function readGrid(
  id: string,
  table: Record<string, unknown>,
  diagnostics: CanvasSpriteDiagnostics[],
  options?: {
    source?: CanvasSpriteGridSpec["source"];
    gridKind?: string;
    framePrefix?: string;
    frameStartIndex?: number;
    frameLabels?: readonly string[];
  },
) {
  const grid: CanvasSpriteGridSpec = {
    kind: "spriteSubgridRegion",
    id,
    x: asNumber(table.origin_x) ?? asNumber(table.x) ?? 0,
    y: asNumber(table.origin_y) ?? asNumber(table.y) ?? 0,
    columns: asNumber(table.columns) ?? 0,
    rows: asNumber(table.rows) ?? 0,
    cellWidth: asNumber(table.cell_width) ?? asNumber(table.width) ?? 0,
    cellHeight: asNumber(table.cell_height) ?? asNumber(table.height) ?? 0,
    width: 0,
    height: 0,
    source: options?.source ?? "spriteforgeGrid",
    gridKind: options?.gridKind,
    framePrefix: options?.framePrefix,
    frameStartIndex: options?.frameStartIndex,
    frameLabels: options?.frameLabels,
    pivot: asString(table.default_pivot) ?? asString(table.pivot),
  };

  grid.width = grid.columns * grid.cellWidth;
  grid.height = grid.rows * grid.cellHeight;

  if (grid.columns <= 0 || grid.rows <= 0 || grid.cellWidth <= 0 || grid.cellHeight <= 0) {
    pushDiagnostic(diagnostics, "InvalidSpriteGrid", `Grid ${id} has invalid dimensions.`);
  }
  return grid;
}

function readStringArray(value: unknown): readonly string[] | undefined {
  const items = asArray(value);
  if (!items) return undefined;
  return items.every((item) => typeof item === "string") ? (items as readonly string[]) : undefined;
}

function createCutGridFrameId(
  grid: CanvasSpriteGridSpec,
  row: number,
  column: number,
  index: number,
) {
  const labelId = grid.frameLabels?.[index];
  if (labelId && labelId.trim().length > 0) return labelId.trim();
  if (grid.framePrefix) {
    return `${grid.framePrefix}.${(grid.frameStartIndex ?? 0) + index}`;
  }
  return `${grid.id}.${row}.${column}`;
}

function createCutGridFrameLabel(
  grid: CanvasSpriteGridSpec,
  row: number,
  column: number,
  index: number,
) {
  return grid.frameLabels?.[index] ?? createCutGridFrameId(grid, row, column, index);
}

function makeGridFrame(
  grid: CanvasSpriteGridSpec,
  row: number,
  column: number,
  options: {
    id: string;
    label: string;
    spriteId?: string;
    animationId?: string;
    kind?: string;
    sourceKind?: SpriteFrameSourceKind;
    pivot?: string;
  },
): CanvasSpriteFrame {
  return {
    id: options.id,
    label: options.label,
    spriteId: options.spriteId,
    animationId: options.animationId,
    kind: options.kind,
    x: grid.x + column * grid.cellWidth,
    y: grid.y + row * grid.cellHeight,
    width: grid.cellWidth,
    height: grid.cellHeight,
    row,
    column,
    source: "grid",
    gridId: grid.id,
    sourceKind: options.sourceKind ?? "grid",
    sourceGridId: grid.id,
    sourceRow: row,
    sourceColumn: column,
    pivot: options.pivot ?? grid.pivot,
  };
}

function readExplicitFrame(
  id: string,
  table: Record<string, unknown>,
): CanvasSpriteFrame | undefined {
  const x = asNumber(table.x);
  const y = asNumber(table.y);
  const width = asNumber(table.width) ?? asNumber(table.w);
  const height = asNumber(table.height) ?? asNumber(table.h);
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return undefined;
  }
  return {
    id,
    label: asString(table.display_name) ?? asString(table.name) ?? id,
    spriteId: asString(table.sprite_id),
    animationId: asString(table.animation_id),
    x,
    y,
    width,
    height,
    row: asNumber(table.row),
    column: asNumber(table.col) ?? asNumber(table.column),
    source: "frame",
    gridId: asString(table.grid) ?? asString(table.source_grid),
    sourceKind: (asString(table.source_kind) as SpriteFrameSourceKind | undefined) ?? "exact",
    sourceGridId: asString(table.source_grid) ?? asString(table.grid),
    sourceRow: asNumber(table.source_row) ?? asNumber(table.row),
    sourceColumn:
      asNumber(table.source_col) ??
      asNumber(table.source_column) ??
      asNumber(table.col) ??
      asNumber(table.column),
    sourceFrameId: asString(table.source_frame) ?? asString(table.source_frame_id),
    pivot: asString(table.pivot),
  };
}

type SpriteCellRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getSpriteGridCellRect(
  grid: CanvasSpriteGridSpec,
  row: number,
  column: number,
): SpriteCellRect {
  return {
    x: grid.x + column * grid.cellWidth,
    y: grid.y + row * grid.cellHeight,
    width: grid.cellWidth,
    height: grid.cellHeight,
  };
}

export function getSpriteExpectedSourceRect(
  frame: Pick<CanvasSpriteFrame, "sourceGridId" | "sourceRow" | "sourceColumn">,
  grids: readonly CanvasSpriteGridSpec[],
): SpriteCellRect | undefined {
  if (
    frame.sourceGridId === undefined ||
    frame.sourceRow === undefined ||
    frame.sourceColumn === undefined
  ) {
    return undefined;
  }
  const grid = grids.find((candidate) => candidate.id === frame.sourceGridId);
  if (!grid) return undefined;
  return getSpriteGridCellRect(grid, frame.sourceRow, frame.sourceColumn);
}

export function getSpriteFrameSourceKind(
  frame: Pick<CanvasSpriteFrame, "sourceKind" | "source" | "gridId" | "sourceGridId">,
): SpriteFrameSourceKind {
  if (frame.sourceKind) return frame.sourceKind;
  if (frame.source === "grid") return "grid";
  if (frame.source === "frame") return frame.gridId || frame.sourceGridId ? "exact" : "manual";
  if (frame.source === "inline") return "manual";
  return frame.gridId || frame.sourceGridId ? "exact" : "unknown";
}

function frameMatchesRect(
  frame: Pick<CanvasSpriteFrame, "x" | "y" | "width" | "height">,
  rect: SpriteCellRect,
) {
  return (
    frame.x === rect.x &&
    frame.y === rect.y &&
    frame.width === rect.width &&
    frame.height === rect.height
  );
}

function inferCellColumn(grid: CanvasSpriteGridSpec, frame: CanvasSpriteFrame) {
  const column = Math.floor((frame.x - grid.x) / grid.cellWidth);
  return column >= 0 && column < grid.columns ? column : undefined;
}

function frameContainedWithinCell(frame: CanvasSpriteFrame, cell: SpriteCellRect) {
  return (
    frame.x >= cell.x &&
    frame.y >= cell.y &&
    frame.x + frame.width <= cell.x + cell.width &&
    frame.y + frame.height <= cell.y + cell.height
  );
}

function applyInferredFrameSourceContext(
  frame: CanvasSpriteFrame,
  grid: CanvasSpriteGridSpec,
  row: number,
): CanvasSpriteFrame {
  const sourceColumn =
    frame.sourceColumn ??
    frame.column ??
    (() => {
      const inferred = inferCellColumn(grid, frame);
      if (inferred === undefined) return undefined;
      const cell = getSpriteGridCellRect(grid, row, inferred);
      return frameContainedWithinCell(frame, cell) ? inferred : undefined;
    })();
  return {
    ...frame,
    gridId: frame.gridId ?? grid.id,
    sourceGridId: frame.sourceGridId ?? grid.id,
    sourceRow: frame.sourceRow ?? row,
    sourceColumn,
    sourceKind: frame.sourceKind === "unknown" ? "exact" : frame.sourceKind,
  };
}

function frameKey(frame: CanvasSpriteFrame): string {
  return `${frame.x},${frame.y},${frame.width},${frame.height}`;
}

function addFrame(
  frames: CanvasSpriteFrame[],
  frameById: Map<string, CanvasSpriteFrame>,
  frame: CanvasSpriteFrame,
  diagnostics: CanvasSpriteDiagnostics[],
) {
  if (frameById.has(frame.id)) {
    pushDiagnostic(
      diagnostics,
      "DuplicateSpriteFrameId",
      `Duplicate sprite frame id ${frame.id}.`,
      [frame.id],
    );
    return;
  }
  frameById.set(frame.id, frame);
  frames.push(frame);
}

function validateFrames(
  spec: Omit<CanvasSpriteSpec, "diagnostics">,
  diagnostics: CanvasSpriteDiagnostics[],
) {
  const seenLabels = new Map<string, string>();
  for (const frame of spec.frames) {
    if (frame.width <= 0 || frame.height <= 0) {
      pushDiagnostic(diagnostics, "InvalidSpriteFrameRect", `Frame ${frame.id} has invalid size.`, [
        frame.id,
      ]);
    }
    if (
      spec.atlasWidth !== undefined &&
      spec.atlasHeight !== undefined &&
      (frame.x < 0 ||
        frame.y < 0 ||
        frame.x + frame.width > spec.atlasWidth ||
        frame.y + frame.height > spec.atlasHeight)
    ) {
      pushDiagnostic(
        diagnostics,
        "SpriteFrameOutOfBounds",
        `Frame ${frame.id} exceeds the atlas.`,
        [frame.id],
      );
    }

    const duplicateLabel = seenLabels.get(frame.label);
    if (duplicateLabel && duplicateLabel !== frame.id) {
      pushDiagnostic(
        diagnostics,
        "DuplicateSpriteFrameLabel",
        `Frames ${duplicateLabel} and ${frame.id} share label ${frame.label}.`,
        [duplicateLabel, frame.id],
      );
    } else {
      seenLabels.set(frame.label, frame.id);
    }
  }

  const uniqueRects = new Map<string, string>();
  for (const frame of spec.frames) {
    const rectKey = frameKey(frame);
    const existing = uniqueRects.get(rectKey);
    if (existing && existing !== frame.id) {
      pushDiagnostic(
        diagnostics,
        "DuplicateSpriteFrameRect",
        `Frames ${existing} and ${frame.id} use the same rectangle.`,
        [existing, frame.id],
      );
    } else {
      uniqueRects.set(rectKey, frame.id);
    }
  }
}

function createValidatedSpriteSpec(
  spec: Omit<CanvasSpriteSpec, "diagnostics">,
  baseDiagnostics: readonly CanvasSpriteDiagnostics[] = [],
): CanvasSpriteSpec {
  const diagnostics: CanvasSpriteDiagnostics[] = [...baseDiagnostics];
  validateFrames(spec, diagnostics);
  if (spec.frames.length === 0) {
    pushDiagnostic(diagnostics, "EmptySpriteSidecar", "Sprite sidecar did not produce any frames.");
  }
  return { ...spec, diagnostics };
}

export function parseSpriteSidecarToml(
  text: string,
  options: { id: string; name: string; targetId?: string; sourceName?: string },
): CanvasSpriteSpec {
  const root = parseSpriteTomlRoot(text);
  const diagnostics: CanvasSpriteDiagnostics[] = [];
  const atlas = asTable(root.atlas);
  const gridsTable = asTable(root.grids) ?? {};
  const cutGridsTable = asTable(root.cut_grids) ?? {};
  const spritesTable = asTable(root.sprites) ?? {};
  const framesTable = asTable(root.frames) ?? {};
  const grids = Object.entries(gridsTable)
    .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
    .map(([id, table]) => readGrid(id, table, diagnostics));
  for (const [id, value] of Object.entries(cutGridsTable)) {
    const table = asTable(value);
    if (!table) continue;
    const labels = readStringArray(table.labels);
    const expectedLabels = (asNumber(table.columns) ?? 0) * (asNumber(table.rows) ?? 0);
    const providedLabels = asArray(table.labels);
    if (providedLabels && (!labels || labels.length !== expectedLabels)) {
      pushDiagnostic(
        diagnostics,
        "InvalidCutGridLabels",
        `Cut grid ${id} labels must contain exactly ${expectedLabels} string entries.`,
      );
    }
    grids.push(
      readGrid(id, table, diagnostics, {
        source: "roughCutGrid",
        gridKind: asString(table.kind),
        framePrefix: asString(table.prefix),
        frameStartIndex: asNumber(table.start_index) ?? 0,
        frameLabels: labels && labels.length === expectedLabels ? labels : undefined,
      }),
    );
  }
  const gridById = new Map(grids.map((grid) => [grid.id, grid]));
  const frames: CanvasSpriteFrame[] = [];
  const frameById = new Map<string, CanvasSpriteFrame>();
  const animations: CanvasSpriteAnimation[] = [];

  for (const [frameId, value] of Object.entries(framesTable)) {
    const table = asTable(value);
    if (!table) continue;
    const frame = readExplicitFrame(frameId, table);
    if (!frame) {
      pushDiagnostic(
        diagnostics,
        "InvalidSpriteFrame",
        `Frame ${frameId} is missing x/y/width/height.`,
      );
      continue;
    }
    addFrame(frames, frameById, frame, diagnostics);
  }

  for (const grid of grids) {
    if (grid.source !== "roughCutGrid") continue;
    let index = 0;
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.columns; column += 1) {
        addFrame(
          frames,
          frameById,
          makeGridFrame(grid, row, column, {
            id: createCutGridFrameId(grid, row, column, index),
            label: createCutGridFrameLabel(grid, row, column, index),
            kind: grid.gridKind,
            sourceKind: "grid",
            pivot: grid.pivot,
          }),
          diagnostics,
        );
        index += 1;
      }
    }
  }

  for (const [spriteId, value] of Object.entries(spritesTable)) {
    const sprite = asTable(value);
    if (!sprite) continue;
    const spriteLabel = asString(sprite.display_name) ?? spriteId;
    const spriteKind = asString(sprite.kind);
    const directFrameId = asString(sprite.frame);
    const directGridId = asString(sprite.grid);
    const directGrid = directGridId ? gridById.get(directGridId) : undefined;
    const directRow = asNumber(sprite.row);
    const directColumn = asNumber(sprite.col) ?? asNumber(sprite.column);

    if (directGridId && !directGrid) {
      pushDiagnostic(
        diagnostics,
        "MissingSpriteGrid",
        `Sprite ${spriteId} references missing grid ${directGridId}.`,
      );
    }
    if (directFrameId) {
      const directFrame = frameById.get(directFrameId);
      if (!directFrame) {
        pushDiagnostic(
          diagnostics,
          "MissingSpriteFrame",
          `Sprite ${spriteId} references missing frame ${directFrameId}.`,
          [directFrameId],
        );
      } else {
        const enrichedFrame = {
          ...directFrame,
          spriteId,
          kind: directFrame.kind ?? spriteKind,
        };
        frameById.set(directFrameId, enrichedFrame);
        const indexToReplace = frames.findIndex((candidate) => candidate.id === directFrameId);
        if (indexToReplace >= 0) frames[indexToReplace] = enrichedFrame;
      }
    }
    if (directGrid && directRow !== undefined && directColumn !== undefined) {
      addFrame(
        frames,
        frameById,
        makeGridFrame(directGrid, directRow, directColumn, {
          id: spriteId,
          label: spriteLabel,
          spriteId,
          kind: spriteKind,
          sourceKind: "grid",
          pivot: asString(sprite.pivot),
        }),
        diagnostics,
      );
    }

    const animationsTable = asTable(sprite.animations) ?? {};
    for (const [animationId, animationValue] of Object.entries(animationsTable)) {
      const animation = asTable(animationValue);
      if (!animation) continue;
      const gridId = asString(animation.grid);
      const grid = gridId ? gridById.get(gridId) : undefined;
      const row = asNumber(animation.row);
      const frameRefs = asArray(animation.frames) ?? [];
      const animationFrameIds: string[] = [];
      const canResolveByFrameIds = frameRefs.every((frameRef) => typeof frameRef === "string");

      if ((!gridId || !grid || row === undefined) && !canResolveByFrameIds) {
        pushDiagnostic(
          diagnostics,
          "InvalidSpriteAnimation",
          `Animation ${spriteId}.${animationId} needs grid and row.`,
        );
        continue;
      }

      for (const [index, frameRef] of frameRefs.entries()) {
        if (typeof frameRef === "number") {
          if (!grid || row === undefined) {
            pushDiagnostic(
              diagnostics,
              "InvalidSpriteAnimation",
              `Animation ${spriteId}.${animationId} cannot use numeric frame columns without grid and row.`,
            );
            continue;
          }
          const id = `${spriteId}.${animationId}.${index}`;
          addFrame(
            frames,
            frameById,
            makeGridFrame(grid, row, frameRef, {
              id,
              label: `${spriteLabel} ${animationId} ${index}`,
              spriteId,
              animationId,
              kind: spriteKind,
              sourceKind: "grid",
            }),
            diagnostics,
          );
          animationFrameIds.push(id);
        } else if (typeof frameRef === "string") {
          const exact = frameById.get(frameRef);
          if (!exact) {
            pushDiagnostic(
              diagnostics,
              "MissingSpriteFrame",
              `Animation ${spriteId}.${animationId} references missing frame ${frameRef}.`,
              [frameRef],
            );
            animationFrameIds.push(frameRef);
          } else {
            const enrichedFrame =
              grid && row !== undefined
                ? applyInferredFrameSourceContext(exact, grid, row)
                : {
                    ...exact,
                    spriteId: exact.spriteId ?? spriteId,
                    animationId: exact.animationId ?? animationId,
                    kind: exact.kind ?? spriteKind,
                  };
            frameById.set(frameRef, enrichedFrame);
            const indexToReplace = frames.findIndex((candidate) => candidate.id === frameRef);
            if (indexToReplace >= 0) frames[indexToReplace] = enrichedFrame;
            animationFrameIds.push(frameRef);
          }
        }
      }

      animations.push({
        id: animationId,
        spriteId,
        gridId,
        row,
        frameIds: animationFrameIds,
        fps: asNumber(animation.fps),
        loop: asBoolean(animation.loop),
      });
    }
  }

  const dialect =
    grids.length > 0 ||
    Object.keys(spritesTable).length > 0 ||
    Object.keys(cutGridsTable).length > 0
      ? "spriteforge"
      : "sprite";
  const specWithoutDiagnostics = {
    id: options.id,
    name: options.name,
    dialect,
    targetId: options.targetId,
    sourceName: options.sourceName,
    atlasImage: asString(atlas?.image),
    atlasWidth: asNumber(atlas?.width),
    atlasHeight: asNumber(atlas?.height),
    grids,
    frames,
    animations,
    overlay: {
      displayMode:
        normalizeSpriteOverlayDisplayMode(asString(asTable(root.overlay)?.display_mode)) ??
        defaultOverlay.displayMode,
      showBounds: asBoolean(asTable(root.overlay)?.show_bounds) ?? defaultOverlay.showBounds,
      showLabels: asBoolean(asTable(root.overlay)?.show_labels) ?? defaultOverlay.showLabels,
      selectedOnly: asBoolean(asTable(root.overlay)?.selected_only) ?? defaultOverlay.selectedOnly,
      showSubgrids: asBoolean(asTable(root.overlay)?.show_subgrids) ?? defaultOverlay.showSubgrids,
      showExactFrames:
        asBoolean(asTable(root.overlay)?.show_exact_frames) ?? defaultOverlay.showExactFrames,
    },
    selectedFrameId: frames[0]?.id,
    rawToml: text,
  } satisfies Omit<CanvasSpriteSpec, "diagnostics">;
  return createValidatedSpriteSpec(specWithoutDiagnostics, diagnostics);
}

export function createSpriteSidecarObject(
  target: ImageObject,
  spec: CanvasSpriteSpec,
): SpriteSidecarObject {
  const id = spec.id;
  return {
    id,
    name: spec.name,
    kind: "spriteSidecar",
    layerId: target.layerId,
    visible: true,
    x: target.x,
    y: target.y,
    width: target.width,
    height: target.height,
    role: "spriteSidecar",
    targetId: target.id,
    tags: ["sprite", "sidecar"],
    notes: `${spec.frames.length} sprite frame${spec.frames.length === 1 ? "" : "s"} for ${target.id}.`,
    spec: { ...spec, targetId: target.id },
  };
}

export function createUnattachedSpriteSidecarObject(
  spec: CanvasSpriteSpec,
  options: {
    id?: string;
    name?: string;
    layerId: string;
  },
): SpriteSidecarObject {
  const id = options.id ?? spec.id;
  return {
    id,
    name: options.name ?? spec.name,
    kind: "spriteSidecar",
    layerId: options.layerId,
    visible: true,
    x: 0,
    y: 0,
    width: spec.atlasWidth ?? 0,
    height: spec.atlasHeight ?? 0,
    role: "spriteSidecar",
    targetId: spec.targetId,
    tags: ["sprite", "sidecar", "unattached"],
    notes: `${spec.frames.length} sprite frame${spec.frames.length === 1 ? "" : "s"} awaiting attachment.`,
    spec: {
      ...spec,
      id,
      name: options.name ?? spec.name,
    },
  };
}

export function getSpriteFrameSummary(frame: CanvasSpriteFrame): string {
  const rowColumn =
    frame.sourceRow !== undefined || frame.sourceColumn !== undefined
      ? ` row ${frame.sourceRow ?? "?"}, col ${frame.sourceColumn ?? "?"}`
      : "";
  return `${frame.id}: ${frame.x},${frame.y} ${frame.width}x${frame.height}; ${frame.sourceKind}${rowColumn}`;
}

export function revalidateSpriteSpec(spec: CanvasSpriteSpec): CanvasSpriteSpec {
  const selectedFrameId = spec.selectedFrameId
    ? spec.frames.some((frame) => frame.id === spec.selectedFrameId)
      ? spec.selectedFrameId
      : spec.frames[0]?.id
    : spec.frames[0]?.id;
  return createValidatedSpriteSpec(
    {
      ...spec,
      selectedFrameId,
    },
    spec.diagnostics,
  );
}

export function selectSpriteFrameInSpec(
  spec: CanvasSpriteSpec,
  frameId: string | undefined,
): CanvasSpriteSpec {
  const resolvedFrameId =
    frameId === undefined || spec.frames.some((frame) => frame.id === frameId)
      ? frameId
      : spec.selectedFrameId;
  return revalidateSpriteSpec({
    ...spec,
    selectedFrameId: resolvedFrameId,
  });
}

export function updateSpriteFrameRectInSpec(
  spec: CanvasSpriteSpec,
  frameId: string,
  rect: Pick<CanvasSpriteFrame, "x" | "y" | "width" | "height">,
): CanvasSpriteSpec {
  const expectedRects = new Map(
    spec.frames.map((frame) => [frame.id, getSpriteExpectedSourceRect(frame, spec.grids)]),
  );
  return revalidateSpriteSpec({
    ...spec,
    rawToml: undefined,
    frames: spec.frames.map((frame) =>
      frame.id === frameId
        ? (() => {
            const next = {
              ...frame,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
            const expectedRect = expectedRects.get(frame.id);
            const stillGridAligned = expectedRect ? frameMatchesRect(next, expectedRect) : false;
            const priorSourceKind = getSpriteFrameSourceKind(frame);
            const nextSourceKind =
              priorSourceKind === "exact"
                ? "exact"
                : priorSourceKind === "grid"
                  ? stillGridAligned
                    ? "grid"
                    : "manual"
                  : priorSourceKind === "manual"
                    ? "manual"
                    : expectedRect && stillGridAligned
                      ? "grid"
                      : "manual";
            return {
              ...next,
              source: nextSourceKind === "grid" ? "grid" : "frame",
              sourceKind: nextSourceKind,
            };
          })()
        : frame,
    ),
  });
}
