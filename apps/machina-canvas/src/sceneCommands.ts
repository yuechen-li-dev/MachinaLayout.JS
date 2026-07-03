import type { CanvasDocument } from "./sceneModel";

export type CanvasCommand =
  | { kind: "select"; id?: string }
  | { kind: "move"; id: string; dx: number; dy: number }
  | { kind: "setFill"; id: string; fill: string };

export function applyCanvasCommand(
  document: CanvasDocument,
  command: CanvasCommand,
): CanvasDocument {
  if (command.kind === "select") {
    if (command.id !== undefined && document.objects[command.id] === undefined) return document;
    return { ...document, selectedObjectId: command.id };
  }

  const object = document.objects[command.id];
  if (object === undefined) return document;

  if (command.kind === "move") {
    return {
      ...document,
      objects: {
        ...document.objects,
        [command.id]: {
          ...object,
          x: object.x + command.dx,
          y: object.y + command.dy,
        },
      },
    };
  }

  return {
    ...document,
    objects: {
      ...document.objects,
      [command.id]: {
        ...object,
        fill: command.fill,
      },
    },
  };
}
