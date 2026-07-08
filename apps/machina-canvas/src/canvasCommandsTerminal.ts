import { summarizeScene } from "./sceneSummary";
import { alignObjectByGuideMarks, type CanvasCommand } from "./sceneCommands";
import type { CanvasDocument, ImageObject, SpriteSidecarObject } from "./sceneModel";
import type { CanvasExportArtifact, CanvasExportCart, CanvasExportPreset } from "./exportCart";
import {
  getCoordinateProfile,
  visualDirectionDelta,
  type CanvasVisualDirection,
} from "./coordinateProfiles";
import { resolveGuideAlignmentMarks } from "./guideAlignment";
import {
  findDatumSnapTargetsForSpriteFrame,
  type SpriteFrameDatumAnchor,
} from "./spriteGuideDatums";

const CANVAS_TERMINAL_HELP =
  "help, summary, select <objectId>, select-frame|sf <sidecarId> <frameId>, nudge-frame|nudge <dx> <dy>, nudge-frame <up|down|left|right> [amount], set-frame-rect <x> <y> <w> <h>, clamp-frame [sidecarId] [frameId], list-datums, snap-frame <anchor> [datumId], snap-frame-nearest [anchor], list-alignment-marks, align-by-mark <sourceObjectId> <sourceMarkId> <targetObjectId> <targetMarkId>, align-selected-by-mark <sourceMarkId> <targetObjectId> <targetMarkId>, overlay-mode|sprite-mode|mode <focus|cutEdit|gridEdit|audit|debug>, toggle-sprite-overlay, toggle-sprite-labels, toggle-selected-only, export-summary, export-preset <presetId>, export-select <artifactId>, export-unselect <artifactId>, export-checkout, checkpoint [message...], clear";

export type CanvasTerminalLogEntry = {
  readonly kind: "info" | "success" | "error";
  readonly command?: string;
  readonly message: string;
  readonly at: number;
};

export type CanvasTerminalCommandContext = {
  document: CanvasDocument;
  exportArtifacts?: readonly CanvasExportArtifact[];
  exportCart?: CanvasExportCart;
  exportPresets?: readonly CanvasExportPreset[];
};

export type CanvasTerminalSideEffect =
  | {
      kind: "applyExportPreset";
      presetId: string;
    }
  | {
      kind: "setExportArtifactSelected";
      artifactId: string;
      selected: boolean;
    }
  | {
      kind: "checkoutExportCart";
    }
  | {
      kind: "saveCheckpoint";
      message?: string;
    };

export type CanvasTerminalCommandResult = {
  commands?: CanvasCommand[];
  clearLog?: boolean;
  logEntry?: CanvasTerminalLogEntry;
  sideEffects?: readonly CanvasTerminalSideEffect[];
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

function isDatumAnchor(value: string | undefined): value is SpriteFrameDatumAnchor {
  return ["left", "right", "centerX", "top", "bottom", "centerY"].includes(value ?? "");
}

function isVisualDirection(value: string | undefined): value is CanvasVisualDirection {
  return ["up", "down", "left", "right"].includes(value ?? "");
}

function getExportSummary(context: CanvasTerminalCommandContext) {
  const { document, exportArtifacts, exportCart, exportPresets } = context;
  const spriteSidecars = Object.values(document.objects).filter(
    (object): object is SpriteSidecarObject => object.kind === "spriteSidecar",
  );
  const images = Object.values(document.objects).filter(
    (object): object is ImageObject => object.kind === "image",
  );
  const baseSummary = `objects=${Object.keys(document.objects).length} images=${images.length} spriteSidecars=${spriteSidecars.length} frames=${spriteSidecars.reduce((total, sidecar) => total + sidecar.spec.frames.length, 0)}`;
  if (!exportArtifacts || !exportCart || !exportPresets) return baseSummary;
  const presetSummary = exportPresets.map((preset) => preset.id).join(", ");
  return `${baseSummary} artifacts=${exportArtifacts.length} selected=${exportCart.selectedArtifactIds.length} preset=${exportCart.presetId ?? "custom"} presets=[${presetSummary}]`;
}

function getAlignmentMarkList(document: CanvasDocument) {
  const marks = resolveGuideAlignmentMarks(document);
  if (marks.length === 0) {
    return "No resolved alignment marks. Add alignment_marks to a .guide.toml and attach it to an image.";
  }
  return marks
    .map(
      (mark) =>
        `${mark.targetObjectId}:${mark.markId}@${mark.scene.x.toFixed(1)},${mark.scene.y.toFixed(1)}${mark.label ? ` "${mark.label}"` : ""}`,
    )
    .join(" | ");
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
        logEntry: makeLog("info", CANVAS_TERMINAL_HELP, trimmed),
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
      const profile = getCoordinateProfile(context.document.coordinateProfileId);
      const [dx, dy] = isVisualDirection(tokens[1])
        ? visualDirectionDelta({
            direction: tokens[1],
            amount: parseIntNumber(tokens[2] ?? "1", "amount"),
            profile,
          })
        : [parseIntNumber(tokens[1], "dx"), parseIntNumber(tokens[2], "dy")];
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

    if (commandName === "clamp-frame") {
      const sidecarId = tokens[1];
      const frameId = tokens[2];
      const selected = getSelectedFrameSidecar(context.document);
      const resolvedSidecarId = sidecarId ?? selected?.sidecar.id;
      const resolvedFrameId = frameId ?? selected?.frame.id;
      if (!resolvedSidecarId || !resolvedFrameId) {
        throw new Error("clamp-frame requires a selected frame or sidecarId and frameId.");
      }
      return {
        commands: [
          {
            kind: "clampSpriteFrameToGuideRegion",
            sidecarId: resolvedSidecarId,
            frameId: resolvedFrameId,
          },
        ],
        logEntry: makeLog("success", `clamped ${resolvedFrameId} to guide region`, trimmed),
      };
    }

    if (commandName === "list-datums") {
      const selected = getSelectedFrameSidecar(context.document);
      if (!selected) throw new Error("No sprite frame selected.");
      const targets = findDatumSnapTargetsForSpriteFrame(context.document, {
        spriteSidecarId: selected.sidecar.id,
        frameId: selected.frame.id,
      });
      if (targets.length === 0) {
        throw new Error("No nearby datums. Add datums in a .guide.toml or increase snap distance.");
      }
      return {
        logEntry: makeLog(
          "info",
          targets
            .slice(0, 5)
            .map(
              (target) =>
                `${target.datumId} ${target.datumKind === "point" ? "center" : target.anchor} ${target.distance.toFixed(1)}px${target.regionId ? ` region=${target.regionId}` : ""}`,
            )
            .join(" | "),
          trimmed,
        ),
      };
    }

    if (commandName === "snap-frame") {
      const selected = getSelectedFrameSidecar(context.document);
      if (!selected) throw new Error("No sprite frame selected.");
      const anchor = tokens[1];
      if (!isDatumAnchor(anchor)) {
        throw new Error("snap-frame requires left, right, centerX, top, bottom, or centerY.");
      }
      const datumId = tokens[2];
      const target = findDatumSnapTargetsForSpriteFrame(context.document, {
        spriteSidecarId: selected.sidecar.id,
        frameId: selected.frame.id,
      }).find(
        (candidate) =>
          (candidate.anchor === anchor ||
            (candidate.datumKind === "point" && (anchor === "centerX" || anchor === "centerY"))) &&
          (datumId === undefined || candidate.datumId === datumId),
      );
      if (!target) {
        throw new Error(
          datumId
            ? `No nearby datum target found for anchor ${anchor} and datum ${datumId}.`
            : `No nearby datum target found for anchor ${anchor}.`,
        );
      }
      return {
        commands: [
          {
            kind: "snapSpriteFrameToDatum",
            sidecarId: selected.sidecar.id,
            frameId: selected.frame.id,
            anchor,
            datumId,
          },
        ],
        logEntry: makeLog(
          "success",
          `snapped ${selected.frame.id} to ${target.datumId} (${anchor})`,
          trimmed,
        ),
      };
    }

    if (commandName === "snap-frame-nearest") {
      const selected = getSelectedFrameSidecar(context.document);
      if (!selected) throw new Error("No sprite frame selected.");
      const anchor = tokens[1];
      if (anchor !== undefined && !isDatumAnchor(anchor)) {
        throw new Error(
          "snap-frame-nearest requires left, right, centerX, top, bottom, or centerY when an anchor is provided.",
        );
      }
      const target = findDatumSnapTargetsForSpriteFrame(context.document, {
        spriteSidecarId: selected.sidecar.id,
        frameId: selected.frame.id,
      }).find(
        (candidate) =>
          anchor === undefined ||
          candidate.anchor === anchor ||
          (candidate.datumKind === "point" && (anchor === "centerX" || anchor === "centerY")),
      );
      if (!target) {
        throw new Error(
          anchor
            ? `No nearby datum target found for anchor ${anchor}.`
            : "No nearby datum target found.",
        );
      }
      return {
        commands: [
          {
            kind: "snapSpriteFrameToNearestDatum",
            sidecarId: selected.sidecar.id,
            frameId: selected.frame.id,
            anchor,
          },
        ],
        logEntry: makeLog(
          "success",
          `snapped ${selected.frame.id} to ${target.datumId} (${target.datumKind === "point" ? "center" : target.anchor})`,
          trimmed,
        ),
      };
    }

    if (commandName === "list-alignment-marks") {
      return {
        logEntry: makeLog("info", getAlignmentMarkList(context.document), trimmed),
      };
    }

    if (commandName === "align-by-mark") {
      const sourceObjectId = tokens[1];
      const sourceMarkId = tokens[2];
      const targetObjectId = tokens[3];
      const targetMarkId = tokens[4];
      if (!sourceObjectId || !sourceMarkId || !targetObjectId || !targetMarkId) {
        throw new Error(
          "align-by-mark requires sourceObjectId, sourceMarkId, targetObjectId, and targetMarkId.",
        );
      }
      const preview = alignObjectByGuideMarks(context.document, {
        sourceObjectId,
        sourceMarkId,
        targetObjectId,
        targetMarkId,
      });
      if (!preview.ok) {
        return {
          logEntry: makeLog("error", preview.message, trimmed),
        };
      }
      return {
        commands: [
          {
            kind: "alignObjectByGuideMarks",
            sourceObjectId,
            sourceMarkId,
            targetObjectId,
            targetMarkId,
          },
        ],
        logEntry: makeLog(preview.ok ? "success" : "error", preview.message, trimmed),
      };
    }

    if (commandName === "align-selected-by-mark") {
      const sourceObjectId = context.document.selectedObjectId;
      const sourceMarkId = tokens[1];
      const targetObjectId = tokens[2];
      const targetMarkId = tokens[3];
      if (!sourceObjectId) throw new Error("Select an object first.");
      if (!sourceMarkId || !targetObjectId || !targetMarkId) {
        throw new Error(
          "align-selected-by-mark requires sourceMarkId, targetObjectId, and targetMarkId.",
        );
      }
      const preview = alignObjectByGuideMarks(context.document, {
        sourceObjectId,
        sourceMarkId,
        targetObjectId,
        targetMarkId,
      });
      if (!preview.ok) {
        return {
          logEntry: makeLog("error", preview.message, trimmed),
        };
      }
      return {
        commands: [
          {
            kind: "alignObjectByGuideMarks",
            sourceObjectId,
            sourceMarkId,
            targetObjectId,
            targetMarkId,
          },
        ],
        logEntry: makeLog(preview.ok ? "success" : "error", preview.message, trimmed),
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
      return { logEntry: makeLog("info", getExportSummary(context), trimmed) };
    }

    if (commandName === "export-preset") {
      const presetId = tokens[1];
      if (!presetId) throw new Error("export-preset requires a presetId.");
      if (!context.exportPresets?.some((preset) => preset.id === presetId)) {
        throw new Error(`Unknown export preset "${presetId}".`);
      }
      return {
        sideEffects: [{ kind: "applyExportPreset", presetId }],
        logEntry: makeLog("success", `export preset ${presetId} applied`, trimmed),
      };
    }

    if (commandName === "export-select" || commandName === "export-unselect") {
      const artifactId = tokens[1];
      if (!artifactId) throw new Error(`${commandName} requires an artifactId.`);
      if (!context.exportArtifacts?.some((artifact) => artifact.id === artifactId)) {
        throw new Error(`Unknown export artifact "${artifactId}".`);
      }
      const selected = commandName === "export-select";
      return {
        sideEffects: [{ kind: "setExportArtifactSelected", artifactId, selected }],
        logEntry: makeLog(
          "success",
          `${selected ? "selected" : "unselected"} export artifact ${artifactId}`,
          trimmed,
        ),
      };
    }

    if (commandName === "export-checkout") {
      return {
        sideEffects: [{ kind: "checkoutExportCart" }],
        logEntry: makeLog("success", "export checkout started", trimmed),
      };
    }

    if (commandName === "checkpoint") {
      const message = tokens.slice(1).join(" ") || undefined;
      return {
        sideEffects: [{ kind: "saveCheckpoint", message }],
        logEntry: makeLog("success", `checkpoint ${message ? `"${message}"` : "saved"}`, trimmed),
      };
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
