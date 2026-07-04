import { generateAlphaMapTool } from "./generateAlphaMap";
import { defineCanvasTools } from "./registry";

export const canvasTools = defineCanvasTools([generateAlphaMapTool]);

export { generateAlphaMapTool, GENERATE_ALPHA_MAP_TOOL_ID } from "./generateAlphaMap";
export { defineCanvasTools, getCanvasToolById, listCanvasTools, runCanvasTool } from "./registry";
export type {
  CanvasToolContext,
  CanvasToolDefinition,
  CanvasToolInput,
  CanvasToolResult,
  CanvasToolTargetKind,
} from "./types";
