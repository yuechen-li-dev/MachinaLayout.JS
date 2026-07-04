import type { CanvasCommand, CanvasCommandApplyResult } from "../sceneCommands";
import type { CanvasDocument } from "../sceneModel";

export type CanvasToolTargetKind = "image-object" | "scene" | "document";

export type CanvasToolInput = {
  readonly targetObjectId?: string;
  readonly options?: Record<string, unknown>;
};

export type CanvasToolContext = {
  readonly document: CanvasDocument;
};

export type CanvasToolResult = {
  readonly toolId: string;
  readonly document?: CanvasDocument;
  readonly commands?: readonly CanvasCommand[];
  readonly commandResults?: readonly CanvasCommandApplyResult[];
  readonly createdObjectIds?: readonly string[];
  readonly updatedObjectIds?: readonly string[];
  readonly notes?: readonly string[];
};

export type CanvasToolDefinition = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly targetKind: CanvasToolTargetKind;
  readonly run: (
    input: CanvasToolInput,
    context: CanvasToolContext,
  ) => Promise<CanvasToolResult> | CanvasToolResult;
};
