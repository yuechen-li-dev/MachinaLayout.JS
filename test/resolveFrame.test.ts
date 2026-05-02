import { describe, expect, it } from "vitest";
import {
  MachinaLayoutError,
  resolveFrame,
  type FrameSpec,
  type Rect,
} from "../src";

function expectErrorCode(run: () => unknown, code: string): void {
  try {
    run();
    throw new Error(`Expected error code ${code} but no error was thrown`);
  } catch (error) {
    expect(error).toBeInstanceOf(MachinaLayoutError);
    expect((error as MachinaLayoutError).code).toBe(code);
  }
}

const parent: Rect = { x: 100, y: 200, width: 800, height: 600 };

describe("resolveFrame absolute", () => {
  it("resolves absolute frame with parent origin offset", () => {
    const rect = resolveFrame(parent, {
      kind: "absolute",
      x: 10,
      y: 20,
      width: 300,
      height: 40,
    });
    expect(rect).toEqual({ x: 110, y: 220, width: 300, height: 40 });
  });

  it("allows negative absolute position offsets", () => {
    const rect = resolveFrame(
      { x: 100, y: 100, width: 200, height: 200 },
      { kind: "absolute", x: -10, y: -20, width: 30, height: 40 }
    );
    expect(rect).toEqual({ x: 90, y: 80, width: 30, height: 40 });
  });

  it("allows zero size", () => {
    const rect = resolveFrame(parent, {
      kind: "absolute",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
    expect(rect).toEqual({ x: 100, y: 200, width: 0, height: 0 });
  });
});

describe("resolveFrame anchor", () => {
  it("resolves horizontal left + width", () => {
    const rect = resolveFrame(parent, { kind: "anchor", left: 16, width: 200, top: 10, height: 20 });
    expect(rect.x).toBe(116);
    expect(rect.width).toBe(200);
  });

  it("resolves horizontal right + width", () => {
    const rect = resolveFrame(parent, { kind: "anchor", right: 16, width: 200, top: 10, height: 20 });
    expect(rect.x).toBe(684);
    expect(rect.width).toBe(200);
  });

  it("resolves horizontal left + right", () => {
    const rect = resolveFrame(parent, { kind: "anchor", left: 16, right: 24, top: 10, height: 20 });
    expect(rect.x).toBe(116);
    expect(rect.width).toBe(760);
  });

  it("resolves vertical top + height", () => {
    const rect = resolveFrame(parent, { kind: "anchor", left: 10, width: 20, top: 16, height: 100 });
    expect(rect.y).toBe(216);
    expect(rect.height).toBe(100);
  });

  it("resolves vertical bottom + height", () => {
    const rect = resolveFrame(parent, { kind: "anchor", left: 10, width: 20, bottom: 16, height: 100 });
    expect(rect.y).toBe(684);
    expect(rect.height).toBe(100);
  });

  it("resolves vertical top + bottom", () => {
    const rect = resolveFrame(parent, { kind: "anchor", left: 10, width: 20, top: 16, bottom: 24 });
    expect(rect.y).toBe(216);
    expect(rect.height).toBe(560);
  });

  it("supports fill with all four anchors", () => {
    const rect = resolveFrame(parent, { kind: "anchor", left: 0, right: 0, top: 0, bottom: 0 });
    expect(rect).toEqual(parent);
  });

  it("supports top bar", () => {
    const rect = resolveFrame(parent, { kind: "anchor", left: 16, right: 16, top: 12, height: 48 });
    expect(rect).toEqual({ x: 116, y: 212, width: 768, height: 48 });
  });

  it("supports bottom-right fixed-size", () => {
    const rect = resolveFrame(parent, {
      kind: "anchor",
      right: 8,
      bottom: 8,
      width: 120,
      height: 32,
    });
    expect(rect).toEqual({ x: 772, y: 760, width: 120, height: 32 });
  });


  it("supports ui lengths on anchor fields", () => {
    const rect = resolveFrame(parent, {
      kind: "anchor",
      left: { unit: "ui", value: 0.25 },
      width: 200,
      top: 10,
      height: 20,
    });
    expect(rect).toEqual({ x: 300, y: 210, width: 200, height: 20 });
  });

  it("supports right+width and left+right with ui units", () => {
    const rightWidth = resolveFrame(parent, { kind: "anchor", right: { unit: "ui", value: 0.125 }, width: { unit: "ui", value: 0.25 }, top: 0, height: 10 });
    expect(rightWidth.x).toBe(600);
    expect(rightWidth.width).toBe(200);

    const leftRight = resolveFrame(parent, { kind: "anchor", left: { unit: "ui", value: 0.25 }, right: { unit: "ui", value: 0.25 }, top: 0, height: 10 });
    expect(leftRight.width).toBe(400);
  });

  it("supports vertical ui units", () => {
    const rect = resolveFrame(parent, { kind: "anchor", left: 10, width: 20, top: { unit: "ui", value: 0.1 }, height: { unit: "ui", value: 0.2 } });
    expect(rect.y).toBe(260);
    expect(rect.height).toBe(120);
  });
  it("allows negative anchor offsets when resolved size remains non-negative", () => {
    const rect = resolveFrame(parent, { kind: "anchor", left: -8, right: -8, top: -4, bottom: -4 });
    expect(rect).toEqual({ x: 92, y: 196, width: 816, height: 608 });
  });
  it("allows negative positional anchors with explicit width", () => {
    const leftWidth = resolveFrame(parent, { kind: "anchor", left: -10, width: 100, top: 0, height: 20 });
    expect(leftWidth).toEqual({ x: 90, y: 200, width: 100, height: 20 });
    const leftUiWidth = resolveFrame(parent, { kind: "anchor", left: { unit: "ui", value: -0.1 }, width: 100, top: 0, height: 20 });
    expect(leftUiWidth).toEqual({ x: 20, y: 200, width: 100, height: 20 });
    const rightWidth = resolveFrame(parent, { kind: "anchor", right: -10, width: 100, top: 0, height: 20 });
    expect(rightWidth).toEqual({ x: 810, y: 200, width: 100, height: 20 });
  });
});

describe("resolveFrame errors", () => {
  it("rejects invalid horizontal anchor combinations", () => {
    const verticalValid = { top: 0, height: 1 };
    const invalid: FrameSpec[] = [
      { kind: "anchor", ...verticalValid },
      { kind: "anchor", left: 1, ...verticalValid },
      { kind: "anchor", width: 1, ...verticalValid },
      { kind: "anchor", left: 1, right: 2, width: 3, ...verticalValid },
    ];

    for (const frame of invalid) {
      expectErrorCode(() => resolveFrame(parent, frame), "InvalidAnchorHorizontal");
    }
  });

  it("rejects invalid vertical anchor combinations", () => {
    const horizontalValid = { left: 0, width: 1 };
    const invalid: FrameSpec[] = [
      { kind: "anchor", ...horizontalValid },
      { kind: "anchor", top: 1, ...horizontalValid },
      { kind: "anchor", height: 1, ...horizontalValid },
      { kind: "anchor", top: 1, bottom: 2, height: 3, ...horizontalValid },
    ];

    for (const frame of invalid) {
      expectErrorCode(() => resolveFrame(parent, frame), "InvalidAnchorVertical");
    }
  });

  it("rejects negative resolved width/height", () => {
    expectErrorCode(
      () =>
        resolveFrame({ x: 0, y: 0, width: 100, height: 100 }, { kind: "anchor", left: 80, right: 40, top: 0, height: 10 }),
      "NegativeResolvedSize"
    );

    expectErrorCode(
      () =>
        resolveFrame({ x: 0, y: 0, width: 100, height: 100 }, { kind: "anchor", left: 0, width: 10, top: 80, bottom: 40 }),
      "NegativeResolvedSize"
    );
  });

  it("rejects direct RootFrame resolution", () => {
    expectErrorCode(() => resolveFrame(parent, { kind: "root" }), "RootFrameWithoutRoot");
  });

  it("rejects direct fixed frame resolution", () => {
    expectErrorCode(
      () => resolveFrame(parent, { kind: "fixed", width: 10, height: 20 }),
      "FixedFrameWithoutArranger"
    );
  });

  it("rejects direct fill frame resolution", () => {
    expectErrorCode(() => resolveFrame(parent, { kind: "fill" }), "FillFrameWithoutArranger");
  });

  it("rejects invalid ui length units", () => {
    expectErrorCode(() => resolveFrame(parent, { kind: "anchor", left: { unit: "percent", value: 0.2 } as never, width: 1, top: 0, height: 1 }), "InvalidLengthUnit");
  });

  it("rejects non-finite numbers", () => {
    expectErrorCode(
      () => resolveFrame({ x: Number.NaN, y: 0, width: 10, height: 10 }, { kind: "absolute", x: 0, y: 0, width: 1, height: 1 }),
      "NonFiniteNumber"
    );
    expectErrorCode(
      () => resolveFrame(parent, { kind: "absolute", x: Number.POSITIVE_INFINITY, y: 0, width: 1, height: 1 }),
      "NonFiniteNumber"
    );
    expectErrorCode(
      () => resolveFrame(parent, { kind: "anchor", left: Number.NaN, width: 1, top: 0, height: 1 }),
      "NonFiniteNumber"
    );
  });

  it("rejects negative sizes", () => {
    expectErrorCode(
      () => resolveFrame({ x: 0, y: 0, width: -1, height: 1 }, { kind: "absolute", x: 0, y: 0, width: 1, height: 1 }),
      "NegativeSize"
    );
    expectErrorCode(
      () => resolveFrame({ x: 0, y: 0, width: 1, height: -1 }, { kind: "absolute", x: 0, y: 0, width: 1, height: 1 }),
      "NegativeSize"
    );
    expectErrorCode(() => resolveFrame(parent, { kind: "absolute", x: 0, y: 0, width: -1, height: 1 }), "NegativeSize");
    expectErrorCode(() => resolveFrame(parent, { kind: "absolute", x: 0, y: 0, width: 1, height: -1 }), "NegativeSize");
    expectErrorCode(() => resolveFrame(parent, { kind: "anchor", left: 0, width: -1, top: 0, height: 1 }), "NegativeSize");
    expectErrorCode(() => resolveFrame(parent, { kind: "anchor", left: 0, width: { unit: "ui", value: -0.25 }, top: 0, height: 1 }), "NegativeSize");
    expectErrorCode(() => resolveFrame(parent, { kind: "anchor", left: 0, width: 1, top: 0, height: -1 }), "NegativeSize");
    expectErrorCode(() => resolveFrame(parent, { kind: "anchor", left: 0, width: 1, top: 0, height: { unit: "ui", value: -0.25 } }), "NegativeSize");
  });

  it("returns fresh rect and does not mutate parent/frame", () => {
    const p: Rect = { x: 1, y: 2, width: 3, height: 4 };
    const frame: FrameSpec = { kind: "absolute", x: 5, y: 6, width: 7, height: 8 };
    const parentBefore = { ...p };
    const frameBefore = { ...frame };

    const result = resolveFrame(p, frame);

    expect(result).not.toBe(p);
    expect(p).toEqual(parentBefore);
    expect(frame).toEqual(frameBefore);
  });
});
