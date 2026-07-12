import type {
  CanvasToolContext,
  CanvasToolDefinition,
  CanvasToolInput,
  CanvasToolResult,
} from "./types";

function validateToolId(id: string): string {
  const normalized = id.trim();
  if (normalized.length === 0) {
    throw new Error("Canvas tool id must be a non-empty string.");
  }
  return normalized;
}

function cloneResult(result: CanvasToolResult): CanvasToolResult {
  return {
    ...result,
    commands: result.commands ? [...result.commands] : undefined,
    commandResults: result.commandResults ? [...result.commandResults] : undefined,
    createdObjectIds: result.createdObjectIds ? [...result.createdObjectIds] : undefined,
    updatedObjectIds: result.updatedObjectIds ? [...result.updatedObjectIds] : undefined,
    notes: result.notes ? [...result.notes] : undefined,
  };
}

export function defineCanvasTools(
  tools: readonly CanvasToolDefinition[],
): readonly CanvasToolDefinition[] {
  const seen = new Set<string>();

  return Object.freeze(
    tools.map((tool) => {
      const id = validateToolId(tool.id);
      if (seen.has(id)) {
        throw new Error(`Duplicate canvas tool id "${id}".`);
      }
      seen.add(id);
      return Object.freeze({ ...tool, id });
    }),
  );
}

export function listCanvasTools(
  tools: readonly CanvasToolDefinition[],
): readonly CanvasToolDefinition[] {
  return [...tools];
}

export function getCanvasToolById(
  tools: readonly CanvasToolDefinition[],
  toolId: string,
): CanvasToolDefinition {
  const id = validateToolId(toolId);
  const tool = tools.find((candidate) => candidate.id === id);
  if (!tool) {
    throw new Error(`Canvas tool "${id}" was not found.`);
  }
  return tool;
}

export async function runCanvasTool(
  tools: readonly CanvasToolDefinition[],
  toolId: string,
  input: CanvasToolInput,
  context: CanvasToolContext,
): Promise<CanvasToolResult> {
  const tool = getCanvasToolById(tools, toolId);
  const result = await tool.run(input, context);
  if (!result || result.toolId !== tool.id) {
    throw new Error(`Canvas tool "${tool.id}" returned an invalid result.`);
  }
  return cloneResult(result);
}
