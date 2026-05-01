import { MachinaLayoutError } from "./errors";
import type { AnchorFrame, FrameSpec, Rect } from "./types";
import { assertFiniteNumber, assertNonNegativeSize } from "./validation";

function validateParentRect(parent: Rect): void {
  assertFiniteNumber(parent.x, "parent.x");
  assertFiniteNumber(parent.y, "parent.y");
  assertNonNegativeSize(parent.width, "parent.width");
  assertNonNegativeSize(parent.height, "parent.height");
}

function hasNumber(value: number | undefined): value is number {
  return value !== undefined;
}

function resolveAnchor(parent: Rect, frame: AnchorFrame): Rect {
  if (hasNumber(frame.left)) assertFiniteNumber(frame.left, "frame.left");
  if (hasNumber(frame.right)) assertFiniteNumber(frame.right, "frame.right");
  if (hasNumber(frame.top)) assertFiniteNumber(frame.top, "frame.top");
  if (hasNumber(frame.bottom)) assertFiniteNumber(frame.bottom, "frame.bottom");
  if (hasNumber(frame.width)) assertNonNegativeSize(frame.width, "frame.width");
  if (hasNumber(frame.height)) assertNonNegativeSize(frame.height, "frame.height");

  const hasLeft = hasNumber(frame.left);
  const hasRight = hasNumber(frame.right);
  const hasWidth = hasNumber(frame.width);
  const horizontalCount = Number(hasLeft) + Number(hasRight) + Number(hasWidth);

  if (horizontalCount !== 2) {
    throw new MachinaLayoutError(
      "InvalidAnchorHorizontal",
      "Anchor frame must specify exactly two horizontal constraints: left, right, width."
    );
  }

  const hasTop = hasNumber(frame.top);
  const hasBottom = hasNumber(frame.bottom);
  const hasHeight = hasNumber(frame.height);
  const verticalCount = Number(hasTop) + Number(hasBottom) + Number(hasHeight);

  if (verticalCount !== 2) {
    throw new MachinaLayoutError(
      "InvalidAnchorVertical",
      "Anchor frame must specify exactly two vertical constraints: top, bottom, height."
    );
  }

  const left = frame.left;
  const right = frame.right;
  const top = frame.top;
  const bottom = frame.bottom;
  const explicitWidth = frame.width;
  const explicitHeight = frame.height;

  let x: number;
  let width: number;

  if (hasLeft && hasWidth) {
    x = parent.x + (left as number);
    width = explicitWidth as number;
  } else if (hasRight && hasWidth) {
    x = parent.x + parent.width - (right as number) - (explicitWidth as number);
    width = explicitWidth as number;
  } else {
    x = parent.x + (left as number);
    width = parent.width - (left as number) - (right as number);
  }

  let y: number;
  let height: number;

  if (hasTop && hasHeight) {
    y = parent.y + (top as number);
    height = explicitHeight as number;
  } else if (hasBottom && hasHeight) {
    y = parent.y + parent.height - (bottom as number) - (explicitHeight as number);
    height = explicitHeight as number;
  } else {
    y = parent.y + (top as number);
    height = parent.height - (top as number) - (bottom as number);
  }

  if (width < 0 || height < 0) {
    throw new MachinaLayoutError(
      "NegativeResolvedSize",
      `Resolved anchor frame size must be non-negative. Received width=${width}, height=${height}.`
    );
  }

  return { x, y, width, height };
}

export function resolveFrame(parent: Rect, frame: FrameSpec): Rect {
  validateParentRect(parent);

  switch (frame.kind) {
    case "absolute": {
      assertFiniteNumber(frame.x, "frame.x");
      assertFiniteNumber(frame.y, "frame.y");
      assertNonNegativeSize(frame.width, "frame.width");
      assertNonNegativeSize(frame.height, "frame.height");

      return {
        x: parent.x + frame.x,
        y: parent.y + frame.y,
        width: frame.width,
        height: frame.height,
      };
    }

    case "anchor":
      return resolveAnchor(parent, frame);

    case "root":
      throw new MachinaLayoutError("RootFrameWithoutRoot", "RootFrame can only be declared on the root row.");

    case "fixed": {
      assertNonNegativeSize(frame.width, "frame.width");
      assertNonNegativeSize(frame.height, "frame.height");
      throw new MachinaLayoutError(
        "FixedFrameWithoutArranger",
        "Fixed frames require an arranger to determine placement."
      );
    }
  }
}
