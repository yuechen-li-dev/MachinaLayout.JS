import type {
  CanvasSpriteAnimation,
  CanvasSpriteDiagnostics,
  CanvasSpriteFrame,
  CanvasSpriteGridSpec,
  CanvasSpriteSpec,
  ImageObject,
  SpriteSidecarObject,
} from "./sceneModel";

type TomlValue = string | number | boolean | readonly TomlValue[] | TomlTable;
type TomlTable = { [key: string]: TomlValue };

const defaultOverlay = {
  showBounds: true,
  showLabels: true,
  selectedOnly: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTable(value: TomlValue | undefined): TomlTable | undefined {
  return isRecord(value) ? (value as TomlTable) : undefined;
}

function asString(value: TomlValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: TomlValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: TomlValue | undefined): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asArray(value: TomlValue | undefined): readonly TomlValue[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function parsePrimitive(value: string): TomlValue {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return JSON.parse(trimmed) as string;
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return splitTomlArray(trimmed.slice(1, -1)).map(parsePrimitive);
  }
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) return numeric;
  return trimmed;
}

function splitTomlArray(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inString = false;
  let escaped = false;

  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      current += char;
      continue;
    }
    if (char === "," && !inString) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function splitTomlPath(path: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inString = false;
  let escaped = false;

  for (const char of path) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      current += char;
      continue;
    }
    if (char === "." && !inString) {
      parts.push(unquotePathPart(current.trim()));
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) parts.push(unquotePathPart(current.trim()));
  return parts;
}

function unquotePathPart(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value) as string;
  return value;
}

function getOrCreateTable(root: TomlTable, path: readonly string[]): TomlTable {
  let current = root;
  for (const part of path) {
    const existing = current[part];
    if (!isRecord(existing)) current[part] = {};
    current = current[part] as TomlTable;
  }
  return current;
}

export function parseTomlTables(text: string): TomlTable {
  const root: TomlTable = {};
  let current = root;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim();
    if (!line) continue;

    const tableMatch = /^\[([^\]]+)\]$/.exec(line);
    if (tableMatch) {
      current = getOrCreateTable(root, splitTomlPath(tableMatch[1]));
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex < 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    current[key] = parsePrimitive(value);
  }

  return root;
}

function stripTomlComment(line: string): string {
  let inString = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (char === "#" && !inString) return line.slice(0, index);
  }
  return line;
}

function pushDiagnostic(
  diagnostics: CanvasSpriteDiagnostics[],
  code: string,
  message: string,
  frameIds?: readonly string[],
) {
  diagnostics.push({ severity: "warning", code, message, frameIds });
}

function readGrid(id: string, table: TomlTable, diagnostics: CanvasSpriteDiagnostics[]) {
  const grid: CanvasSpriteGridSpec = {
    id,
    x: asNumber(table.origin_x) ?? asNumber(table.x) ?? 0,
    y: asNumber(table.origin_y) ?? asNumber(table.y) ?? 0,
    columns: asNumber(table.columns) ?? 0,
    rows: asNumber(table.rows) ?? 0,
    cellWidth: asNumber(table.cell_width) ?? asNumber(table.width) ?? 0,
    cellHeight: asNumber(table.cell_height) ?? asNumber(table.height) ?? 0,
    pivot: asString(table.default_pivot) ?? asString(table.pivot),
  };

  if (grid.columns <= 0 || grid.rows <= 0 || grid.cellWidth <= 0 || grid.cellHeight <= 0) {
    pushDiagnostic(diagnostics, "InvalidSpriteGrid", `Grid ${id} has invalid dimensions.`);
  }
  return grid;
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
    source?: "grid" | "frame" | "inline";
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
    source: options.source ?? "grid",
    gridId: grid.id,
    pivot: options.pivot ?? grid.pivot,
  };
}

function readExplicitFrame(id: string, table: TomlTable): CanvasSpriteFrame | undefined {
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
    x,
    y,
    width,
    height,
    row: asNumber(table.row),
    column: asNumber(table.col) ?? asNumber(table.column),
    source: "frame",
    pivot: asString(table.pivot),
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

export function parseSpriteSidecarToml(
  text: string,
  options: { id: string; name: string; targetId: string; sourceName?: string },
): CanvasSpriteSpec {
  const root = parseTomlTables(text);
  const diagnostics: CanvasSpriteDiagnostics[] = [];
  const atlas = asTable(root.atlas);
  const gridsTable = asTable(root.grids) ?? {};
  const spritesTable = asTable(root.sprites) ?? {};
  const framesTable = asTable(root.frames) ?? {};
  const grids = Object.entries(gridsTable)
    .filter((entry): entry is [string, TomlTable] => isRecord(entry[1]))
    .map(([id, table]) => readGrid(id, table, diagnostics));
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

  for (const [spriteId, value] of Object.entries(spritesTable)) {
    const sprite = asTable(value);
    if (!sprite) continue;
    const spriteLabel = asString(sprite.display_name) ?? spriteId;
    const spriteKind = asString(sprite.kind);
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
    if (directGrid && directRow !== undefined && directColumn !== undefined) {
      addFrame(
        frames,
        frameById,
        makeGridFrame(directGrid, directRow, directColumn, {
          id: spriteId,
          label: spriteLabel,
          spriteId,
          kind: spriteKind,
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

      if (!gridId || !grid || row === undefined) {
        pushDiagnostic(
          diagnostics,
          "InvalidSpriteAnimation",
          `Animation ${spriteId}.${animationId} needs grid and row.`,
        );
        continue;
      }

      for (const [index, frameRef] of frameRefs.entries()) {
        if (typeof frameRef === "number") {
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
          } else {
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
    grids.length > 0 || Object.keys(spritesTable).length > 0 ? "spriteforge" : "sprite";
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
    overlay: defaultOverlay,
    selectedFrameId: frames[0]?.id,
    rawToml: text,
  } satisfies Omit<CanvasSpriteSpec, "diagnostics">;
  validateFrames(specWithoutDiagnostics, diagnostics);

  if (frames.length === 0) {
    pushDiagnostic(diagnostics, "EmptySpriteSidecar", "Sprite sidecar did not produce any frames.");
  }

  return { ...specWithoutDiagnostics, diagnostics };
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

export function getSpriteFrameSummary(frame: CanvasSpriteFrame): string {
  const rowColumn =
    frame.row !== undefined || frame.column !== undefined
      ? ` row ${frame.row ?? "?"}, col ${frame.column ?? "?"}`
      : "";
  return `${frame.id}: ${frame.x},${frame.y} ${frame.width}x${frame.height}${rowColumn}`;
}
