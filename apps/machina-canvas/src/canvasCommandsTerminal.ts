import { summarizeScene } from "./sceneSummary";
import type { CanvasCommand } from "./sceneCommands";
import type { CanvasDocument, ImageObject, SpriteSidecarObject } from "./sceneModel";

export type CanvasTerminalLogEntry = {
  readonly kind: "info" | "success" | "error";
  readonly command?: string;
  readonly message: string;
  readonly at: number;
};

export type CanvasTerminalCommandContext = {
  document: CanvasDocument;
};

export type CanvasTerminalCommandResult = {
  commands?: CanvasCommand[];
  clearLog?: boolean;
  logEntry?: CanvasTerminalLogEntry;
};

function makeLog(
  kind: CanvasTerminalLogEntry["kind"],
  message: string,
  command?: string,
): CanvasTerminalLogEntry {
  return { kind, command, message, at: Date.now() };
}

function findSelectedSpriteSidecar(document: CanvasDocument): SpriteSidecarObject | undefined {
  const selected = document.selectedObjectId
    ? document.objects[document.selectedObjectId]
    : undefined;
  if (selected?.kind === "spriteSidecar") return selected;
  if (selected?.kind === "image" && selected.spriteSidecarId) {
    const sidecar = document.objects[selected.spriteSidecarId];
    if (sidecar?.kind === "spriteSidecar") return sidecar;
  }
  return undefined;
}

function getSelectedFrameSidecar(document: CanvasDocument) {
  const sidecar = findSelectedSpriteSidecar(document);
  if (!sidecar?.spec.selectedFrameId) return undefined;
  const frame = sidecar.spec.frames.find(
    (candidate) => candidate.id === sidecar.spec.selectedFrameId,
  );
  return frame ? { sidecar, frame } : undefined;
}

function tokenize(input: string) {
  return input.trim().split(/\s+/).filter(Boolean);
}

function parseNumber(value: string | undefined, label: string) {
  const number = value === undefined ? Number.NaN : Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return number;
}

function parseIntNumber(value: string | undefined, label: string) {
  const number = parseNumber(value, label);
  return Math.round(number);
}

function getExportSummary(document: CanvasDocument) {
  const spriteSidecars = Object.values(document.objects).filter(
    (object): object is SpriteSidecarObject => object.kind === "spriteSidecar",
  );
  const images = Object.values(document.objects).filter(
    (object): object is ImageObject => object.kind === "image",
  );
  return `objects=${Object.keys(document.objects).length} images=${images.length} spriteSidecars=${spriteSidecars.length} frames=${spriteSidecars.reduce((total, sidecar) => total + sidecar.spec.frames.length, 0)}`;
}

export function executeCanvasTerminalCommand(
  input: string,
  context: CanvasTerminalCommandContext,
): CanvasTerminalCommandResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { logEntry: makeLog("error", "Enter a command.") };
  }

  const tokens = tokenize(trimmed);
  const commandName = tokens[0].toLowerCase();

  try {
    if (commandName === "help") {
      return {
        logEntry: makeLog(
          "info",
          "help, summary, select <objectId>, select-frame|sf <sidecarId> <frameId>, nudge-frame|nudge <dx> <dy>, set-frame-rect <x> <y> <w> <h>, overlay-mode|sprite-mode|mode <focus|cutEdit|gridEdit|audit|debug>, toggle-sprite-overlay, toggle-sprite-labels, toggle-selected-only, export-summary, clear",
          trimmed,
        ),
      };
    }

    if (commandName === "summary") {
      return { logEntry: makeLog("info", summarizeScene(context.document), trimmed) };
    }

    if (commandName === "select") {
      const objectId = tokens[1];
      if (!objectId) throw new Error("select requires an objectId.");
      return {
        commands: [{ kind: "select", id: objectId }],
        logEntry: makeLog("success", `selected ${objectId}`, trimmed),
      };
    }

    if (commandName === "select-frame" || commandName === "sf") {
      const sidecarId = tokens[1];
      const frameId = tokens[2];
      if (!sidecarId || !frameId) throw new Error("select-frame requires sidecarId and frameId.");
      return {
        commands: [
          { kind: "select", id: sidecarId },
          { kind: "selectSpriteFrame", sidecarId, frameId },
        ],
        logEntry: makeLog("success", `selected frame ${frameId}`, trimmed),
      };
    }

    if (commandName === "nudge-frame" || commandName === "nudge") {
      const selected = getSelectedFrameSidecar(context.document);
      if (!selected) throw new Error("Select a sprite sidecar frame first.");
      const dx = parseIntNumber(tokens[1], "dx");
      const dy = parseIntNumber(tokens[2], "dy");
      return {
        commands: [
          {
            kind: "nudgeSpriteFrame",
            sidecarId: selected.sidecar.id,
            frameId: selected.frame.id,
            dx,
            dy,
          },
        ],
        logEntry: makeLog("success", `moved ${selected.frame.id} by ${dx},${dy}`, trimmed),
      };
    }

    if (commandName === "set-frame-rect") {
      const selected = getSelectedFrameSidecar(context.document);
      if (!selected) throw new Error("Select a sprite sidecar frame first.");
      const x = parseIntNumber(tokens[1], "x");
      const y = parseIntNumber(tokens[2], "y");
      const width = parseIntNumber(tokens[3], "width");
      const height = parseIntNumber(tokens[4], "height");
      return {
        commands: [
          {
            kind: "updateSpriteFrameRect",
            sidecarId: selected.sidecar.id,
            frameId: selected.frame.id,
            rect: { x, y, width, height },
          },
        ],
        logEntry: makeLog(
          "success",
          `set ${selected.frame.id} to x=${x} y=${y} w=${width} h=${height}`,
          trimmed,
        ),
      };
    }

    if (commandName === "toggle-sprite-overlay") {
      const sidecar = findSelectedSpriteSidecar(context.document);
      if (!sidecar) throw new Error("Select an image or sprite sidecar first.");
      return {
        commands: [
          {
            kind: "setSpriteSidecarVisible",
            sidecarId: sidecar.id,
            visible: !sidecar.visible,
          },
        ],
        logEntry: makeLog(
          "success",
          `sprite overlay ${!sidecar.visible ? "shown" : "hidden"}`,
          trimmed,
        ),
      };
    }

    if (commandName === "toggle-sprite-labels") {
      const sidecar = findSelectedSpriteSidecar(context.document);
      if (!sidecar) throw new Error("Select an image or sprite sidecar first.");
      return {
        commands: [
          {
            kind: "setSpriteOverlayOption",
            sidecarId: sidecar.id,
            option: "showLabels",
            value: !sidecar.spec.overlay.showLabels,
          },
        ],
        logEntry: makeLog(
          "success",
          `sprite labels ${!sidecar.spec.overlay.showLabels ? "shown" : "hidden"}`,
          trimmed,
        ),
      };
    }

    if (commandName === "toggle-selected-only") {
      const sidecar = findSelectedSpriteSidecar(context.document);
      if (!sidecar) throw new Error("Select an image or sprite sidecar first.");
      return {
        commands: [
          {
            kind: "setSpriteOverlayOption",
            sidecarId: sidecar.id,
            option: "selectedOnly",
            value: !sidecar.spec.overlay.selectedOnly,
          },
        ],
        logEntry: makeLog(
          "success",
          `selected-only overlay ${!sidecar.spec.overlay.selectedOnly ? "enabled" : "disabled"}`,
          trimmed,
        ),
      };
    }

    if (commandName === "overlay-mode" || commandName === "sprite-mode" || commandName === "mode") {
      const sidecar = findSelectedSpriteSidecar(context.document);
      if (!sidecar) throw new Error("Select an image or sprite sidecar first.");
      const mode = tokens[1];
      if (!["focus", "cutEdit", "gridEdit", "audit", "debug"].includes(mode ?? "")) {
        throw new Error("overlay-mode requires focus, cutEdit, gridEdit, audit, or debug.");
      }
      return {
        commands: [
          {
            kind: "setSpriteOverlayDisplayMode",
            sidecarId: sidecar.id,
            mode: mode as "focus" | "cutEdit" | "gridEdit" | "audit" | "debug",
          },
        ],
        logEntry: makeLog("success", `sprite overlay mode ${mode}`, trimmed),
      };
    }

    if (commandName === "export-summary") {
      return { logEntry: makeLog("info", getExportSummary(context.document), trimmed) };
    }

    if (commandName === "clear") {
      return { clearLog: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command failed.";
    return { logEntry: makeLog("error", message, trimmed) };
  }

  return {
    logEntry: makeLog("error", `Unknown command "${tokens[0]}". Run help for commands.`, trimmed),
  };
}
