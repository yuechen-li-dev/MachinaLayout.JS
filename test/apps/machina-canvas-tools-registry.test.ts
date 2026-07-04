import { describe, expect, it } from "vitest";
import {
  defineCanvasTools,
  getCanvasToolById,
  listCanvasTools,
  runCanvasTool,
  type CanvasToolDefinition,
} from "../../apps/machina-canvas/src/tools";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";

const document: CanvasDocument = {
  id: "tool-registry-demo",
  name: "Tool Registry Demo",
  width: 100,
  height: 100,
  unit: "px",
  unitSystem: createCanvasUnitSystem("px"),
  layers: [],
  objects: {},
};

function testTool(id = "test-tool"): CanvasToolDefinition {
  return {
    id,
    label: "Test Tool",
    description: "A deterministic test tool.",
    targetKind: "document",
    run: () => ({
      toolId: id,
      createdObjectIds: ["created"],
      notes: ["ran"],
    }),
  };
}

describe("MachinaCanvas tool registry", () => {
  it("defines, lists, gets, and runs tools", async () => {
    const tools = defineCanvasTools([testTool()]);
    const listed = listCanvasTools(tools);
    const result = await runCanvasTool(tools, "test-tool", {}, { document });

    expect(listed).toHaveLength(1);
    expect(listed).not.toBe(tools);
    expect(getCanvasToolById(tools, "test-tool").label).toBe("Test Tool");
    expect(result).toEqual({
      toolId: "test-tool",
      createdObjectIds: ["created"],
      notes: ["ran"],
    });
  });

  it("rejects empty, duplicate, and missing tool ids with stable errors", async () => {
    expect(() => defineCanvasTools([testTool("")])).toThrow(/non-empty/);
    expect(() => defineCanvasTools([testTool("same"), testTool("same")])).toThrow(
      /Duplicate canvas tool id "same"/,
    );
    expect(() => getCanvasToolById(defineCanvasTools([testTool()]), "missing")).toThrow(
      /Canvas tool "missing" was not found/,
    );
  });

  it("returns fresh result arrays when running a tool", async () => {
    const tools = defineCanvasTools([testTool()]);
    const first = await runCanvasTool(tools, "test-tool", {}, { document });
    const second = await runCanvasTool(tools, "test-tool", {}, { document });

    expect(first.createdObjectIds).toEqual(second.createdObjectIds);
    expect(first.createdObjectIds).not.toBe(second.createdObjectIds);
    expect(first.notes).not.toBe(second.notes);
  });

  it("rejects malformed tool results", async () => {
    const tools = defineCanvasTools([
      {
        ...testTool("bad"),
        run: () => ({ toolId: "other" }),
      },
    ]);

    await expect(runCanvasTool(tools, "bad", {}, { document })).rejects.toThrow(
      /returned an invalid result/,
    );
  });
});
