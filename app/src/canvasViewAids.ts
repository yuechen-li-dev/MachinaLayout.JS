import type { CanvasEditorModeId } from "./editorModes";

export type CanvasAidToggles = {
  showReferenceGrid: boolean;
  showReferenceGridLines: boolean;
  showMeasurementLabels: boolean;
  showGeometryDiagnostics: boolean;
};

const DEFAULT_CANVAS_AID_TOGGLES: CanvasAidToggles = {
  showReferenceGrid: true,
  showReferenceGridLines: false,
  showMeasurementLabels: false,
  showGeometryDiagnostics: true,
};

export function getDefaultCanvasAidToggles(modeId?: CanvasEditorModeId): CanvasAidToggles {
  if (modeId === "sprites") {
    return {
      ...DEFAULT_CANVAS_AID_TOGGLES,
      showReferenceGrid: false,
      showReferenceGridLines: false,
    };
  }
  return { ...DEFAULT_CANVAS_AID_TOGGLES };
}
