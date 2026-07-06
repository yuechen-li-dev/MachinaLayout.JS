/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasCommandTerminal } from "../../apps/machina-canvas/src/CanvasCommandTerminal";
import {
  executeCanvasTerminalCommand,
  type CanvasTerminalLogEntry,
} from "../../apps/machina-canvas/src/canvasCommandsTerminal";
import { applyCanvasCommands } from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument, ImageObject } from "../../apps/machina-canvas/src/sceneModel";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import {
  createSpriteSidecarObject,
  parseSpriteSidecarToml,
} from "../../apps/machina-canvas/src/spriteSidecar";

afterEach(() => {
  cleanup();
});

const spriteToml = `
[atlas]
width = 64
height = 64

[frames."hero.idle"]
x = 0
y = 0
width = 16
height = 16
`;

function createTerminalDocument() {
  const image: ImageObject = {
    id: "sheet",
    name: "Sheet",
    kind: "image",
    layerId: "sprites",
    visible: true,
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    src: "/sheet.png",
    intrinsicWidth: 64,
    intrinsicHeight: 64,
  };
  const base: CanvasDocument = {
    id: "doc",
    name: "Terminal Doc",
    width: 320,
    height: 240,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [{ id: "sprites", name: "Sprites", visible: true, objectIds: [image.id] }],
    objects: { [image.id]: image },
    selectedObjectId: image.id,
  };
  const spec = parseSpriteSidecarToml(spriteToml, {
    id: "sheet-sidecar",
    name: "Sheet sidecar",
    targetId: image.id,
  });
  const sidecar = createSpriteSidecarObject(image, spec);
  return applyCanvasCommands(base, [
    { kind: "addSpriteSidecarObject", object: sidecar, attach: true },
    { kind: "select", id: sidecar.id },
    { kind: "selectSpriteFrame", sidecarId: sidecar.id, frameId: "hero.idle" },
  ]).document;
}

function applyTerminal(input: string, document: CanvasDocument) {
  const result = executeCanvasTerminalCommand(input, { document });
  return result.commands?.length
    ? applyCanvasCommands(document, result.commands).document
    : document;
}

describe("MachinaCanvas terminal commands", () => {
  it("returns the help command list", () => {
    expect(
      executeCanvasTerminalCommand("help", { document: createTerminalDocument() }).logEntry
        ?.message,
    ).toContain("select-frame|sf");
  });

  it("reports scene summary", () => {
    expect(
      executeCanvasTerminalCommand("summary", { document: createTerminalDocument() }).logEntry
        ?.message,
    ).toContain("Overlay mode Focus");
  });

  it("selects an object", () => {
    const result = executeCanvasTerminalCommand("select sheet", {
      document: createTerminalDocument(),
    });
    const next = result.commands
      ? applyCanvasCommands(createTerminalDocument(), result.commands).document
      : createTerminalDocument();
    expect(next.selectedObjectId).toBe("sheet");
  });

  it("selects a sidecar frame", () => {
    const result = executeCanvasTerminalCommand("select-frame sheet-sidecar hero.idle", {
      document: createTerminalDocument(),
    });
    const next = result.commands
      ? applyCanvasCommands(createTerminalDocument(), result.commands).document
      : createTerminalDocument();
    const sidecar = next.objects["sheet-sidecar"];
    expect(next.selectedObjectId).toBe("sheet-sidecar");
    expect(sidecar.kind === "spriteSidecar" ? sidecar.spec.selectedFrameId : "").toBe("hero.idle");
  });

  it("nudges the selected frame", () => {
    const next = applyTerminal("nudge-frame 1 2", createTerminalDocument());
    const sidecar = next.objects["sheet-sidecar"];
    expect(sidecar.kind === "spriteSidecar" ? sidecar.spec.frames[0].x : -1).toBe(1);
    expect(sidecar.kind === "spriteSidecar" ? sidecar.spec.frames[0].y : -1).toBe(2);
  });

  it("sets the selected frame rect", () => {
    const next = applyTerminal("set-frame-rect 4 5 18 19", createTerminalDocument());
    const sidecar = next.objects["sheet-sidecar"];
    expect(sidecar.kind === "spriteSidecar" ? sidecar.spec.frames[0] : undefined).toEqual(
      expect.objectContaining({ x: 4, y: 5, width: 18, height: 19 }),
    );
  });

  it("toggles sprite overlay visibility", () => {
    const next = applyTerminal("toggle-sprite-overlay", createTerminalDocument());
    const sidecar = next.objects["sheet-sidecar"];
    expect(sidecar.kind === "spriteSidecar" ? sidecar.visible : true).toBe(false);
  });

  it("toggles sprite labels", () => {
    const next = applyTerminal("toggle-sprite-labels", createTerminalDocument());
    const sidecar = next.objects["sheet-sidecar"];
    expect(sidecar.kind === "spriteSidecar" ? sidecar.spec.overlay.showLabels : false).toBe(true);
  });

  it("toggles selected-only overlay mode", () => {
    const next = applyTerminal("toggle-selected-only", createTerminalDocument());
    const sidecar = next.objects["sheet-sidecar"];
    expect(sidecar.kind === "spriteSidecar" ? sidecar.spec.overlay.selectedOnly : false).toBe(true);
  });

  it("sets sprite overlay display mode from the terminal", () => {
    const next = applyTerminal("overlay-mode debug", createTerminalDocument());
    const sidecar = next.objects["sheet-sidecar"];
    expect(sidecar.kind === "spriteSidecar" ? sidecar.spec.overlay.displayMode : "").toBe("debug");
  });

  it("returns export summary counts", () => {
    expect(
      executeCanvasTerminalCommand("export-summary", { document: createTerminalDocument() })
        .logEntry?.message,
    ).toContain("spriteSidecars=1");
  });

  it("returns an error for unknown commands", () => {
    expect(
      executeCanvasTerminalCommand("wat", { document: createTerminalDocument() }).logEntry?.kind,
    ).toBe("error");
  });

  it("returns an error for invalid args", () => {
    expect(
      executeCanvasTerminalCommand("nudge-frame nope 2", { document: createTerminalDocument() })
        .logEntry?.kind,
    ).toBe("error");
  });

  it("clears the log through a clear action", () => {
    expect(
      executeCanvasTerminalCommand("clear", { document: createTerminalDocument() }).clearLog,
    ).toBe(true);
  });

  it("does not eval arbitrary code", () => {
    expect(
      executeCanvasTerminalCommand("alert(1)", { document: createTerminalDocument() }).logEntry
        ?.kind,
    ).toBe("error");
  });
});

describe("CanvasCommandTerminal UI", () => {
  it("can collapse and expand", () => {
    function Wrapper() {
      const [collapsed, setCollapsed] = React.useState(true);
      const [input, setInput] = React.useState("");
      return (
        <CanvasCommandTerminal
          collapsed={collapsed}
          inputValue={input}
          log={[]}
          onChangeInput={setInput}
          onSubmitCommand={() => undefined}
          onToggleCollapsed={() => setCollapsed((current) => !current)}
        />
      );
    }

    render(<Wrapper />);
    expect(screen.queryByLabelText("Terminal log")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByLabelText("Terminal log")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByLabelText("Terminal log")).not.toBeInTheDocument();
  });

  it("submits command input", () => {
    const onSubmitCommand = vi.fn();
    const log: CanvasTerminalLogEntry[] = [];
    function Wrapper() {
      const [input, setInput] = React.useState("");
      return (
        <CanvasCommandTerminal
          collapsed={false}
          inputValue={input}
          log={log}
          onChangeInput={setInput}
          onSubmitCommand={onSubmitCommand}
          onToggleCollapsed={() => undefined}
        />
      );
    }
    render(<Wrapper />);

    fireEvent.change(screen.getByLabelText("Command input"), { target: { value: "help" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "Run" }).closest("form") as HTMLFormElement,
    );
    expect(onSubmitCommand).toHaveBeenCalledWith("help");
  });
});
