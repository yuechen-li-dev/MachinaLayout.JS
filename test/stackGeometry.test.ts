import { describe, expect, it } from "vitest";
import {
  MachinaLayoutError,
  getArrangeContentRect,
  getRemainingStackRect,
  getStackChildRects,
  getStackContentRect,
  getStackMainAxisMetrics,
  resolveLayoutRows,
  type LayoutRow,
  type MachinaLayoutErrorCode,
  type Rect,
  type ResolvedLayoutDocument,
} from "../src";

function expectCode(run: () => unknown, code: MachinaLayoutErrorCode): void {
  try {
    run();
    throw new Error("expected throw");
  } catch (error) {
    expect(error).toBeInstanceOf(MachinaLayoutError);
    expect((error as MachinaLayoutError).code).toBe(code);
  }
}

const parentRect: Rect = { x: 10, y: 20, width: 300, height: 200 };

function resolve(rows: LayoutRow[]): ResolvedLayoutDocument {
  return resolveLayoutRows(rows, { x: 0, y: 0, width: 800, height: 600 });
}

describe("getArrangeContentRect", () => {
  it("returns stack content after padding", () => {
    const content = getArrangeContentRect(parentRect, {
      kind: "stack",
      axis: "vertical",
      padding: { top: 2, right: 4, bottom: 6, left: 8 },
    });

    expect(content).toEqual({ x: 18, y: 22, width: 288, height: 192 });
  });

  it("returns grid content after padding", () => {
    const content = getArrangeContentRect(parentRect, {
      kind: "grid",
      columns: [{ kind: "fixed", size: 10 }],
      rows: [{ kind: "fixed", size: 10 }],
      padding: { top: 2, right: 4, bottom: 6, left: 8 },
    });

    expect(content).toEqual({ x: 18, y: 22, width: 288, height: 192 });
  });

  it("returns a fresh copy when arrange is omitted", () => {
    const content = getArrangeContentRect(parentRect);

    expect(content).toEqual(parentRect);
    expect(content).not.toBe(parentRect);
  });

  it("throws StackContentNegative for negative stack content", () => {
    expectCode(
      () =>
        getArrangeContentRect(
          { x: 0, y: 0, width: 10, height: 10 },
          { kind: "stack", axis: "vertical", padding: 6 },
        ),
      "StackContentNegative",
    );
  });
});

describe("stack geometry queries", () => {
  it("returns stack content rect for a resolved stack parent", () => {
    const layout = resolve([
      {
        id: "root",
        frame: { kind: "root" },
        arrange: { kind: "stack", axis: "vertical", padding: 10 },
      },
      { id: "child", parent: "root", frame: { kind: "fixed", width: 100, height: 100 } },
    ]);

    expect(getStackContentRect(layout, "root")).toEqual({ x: 10, y: 10, width: 780, height: 580 });
  });

  it("throws ExpectedStackArrange for a non-stack parent", () => {
    const layout = resolve([{ id: "root", frame: { kind: "root" } }]);

    expectCode(() => getStackContentRect(layout, "root"), "ExpectedStackArrange");
  });

  it("reports vertical main-axis metrics", () => {
    const layout = resolve([
      {
        id: "root",
        frame: { kind: "root" },
        arrange: {
          kind: "stack",
          axis: "vertical",
          gap: 5,
          padding: { top: 10, right: 20, bottom: 30, left: 40 },
        },
      },
      { id: "a", parent: "root", frame: { kind: "fixed", width: 100, height: 50 } },
      { id: "b", parent: "root", frame: { kind: "fixed", width: 100, height: 60 } },
      { id: "c", parent: "root", frame: { kind: "fixed", width: 100, height: 70 } },
    ]);

    const metrics = getStackMainAxisMetrics(layout, "root");

    expect(metrics.axis).toBe("vertical");
    expect(metrics.contentRect).toEqual({ x: 40, y: 10, width: 740, height: 560 });
    expect(metrics.childIds).toEqual(["a", "b", "c"]);
    expect(
      metrics.childMetrics.map(({ id, mainStart, mainEnd, mainSize }) => ({
        id,
        mainStart,
        mainEnd,
        mainSize,
      })),
    ).toEqual([
      { id: "a", mainStart: 0, mainEnd: 50, mainSize: 50 },
      { id: "b", mainStart: 55, mainEnd: 115, mainSize: 60 },
      { id: "c", mainStart: 120, mainEnd: 190, mainSize: 70 },
    ]);
    expect(metrics.totalChildMainSize).toBe(180);
    expect(metrics.totalGapSize).toBe(10);
    expect(metrics.usedMainSize).toBe(190);
    expect(metrics.unusedMainSize).toBe(370);
  });

  it("reports horizontal main-axis metrics", () => {
    const layout = resolve([
      {
        id: "root",
        frame: { kind: "root" },
        arrange: {
          kind: "stack",
          axis: "horizontal",
          gap: 4,
          padding: { top: 10, right: 20, bottom: 30, left: 40 },
        },
      },
      { id: "a", parent: "root", frame: { kind: "fixed", width: 50, height: 100 } },
      { id: "b", parent: "root", frame: { kind: "fixed", width: 60, height: 100 } },
    ]);

    const metrics = getStackMainAxisMetrics(layout, "root");

    expect(metrics.axis).toBe("horizontal");
    expect(metrics.contentMainSize).toBe(740);
    expect(metrics.contentCrossSize).toBe(560);
    expect(
      metrics.childMetrics.map(({ id, mainStart, mainEnd, mainSize }) => ({
        id,
        mainStart,
        mainEnd,
        mainSize,
      })),
    ).toEqual([
      { id: "a", mainStart: 0, mainEnd: 50, mainSize: 50 },
      { id: "b", mainStart: 54, mainEnd: 114, mainSize: 60 },
    ]);
    expect(metrics.totalChildMainSize).toBe(110);
    expect(metrics.totalGapSize).toBe(4);
    expect(metrics.usedMainSize).toBe(114);
    expect(metrics.unusedMainSize).toBe(626);
  });

  it("reports resolved fill child size", () => {
    const layout = resolve([
      {
        id: "root",
        frame: { kind: "root" },
        arrange: { kind: "stack", axis: "horizontal", gap: 10 },
      },
      { id: "fixed", parent: "root", frame: { kind: "fixed", width: 100, height: 50 } },
      { id: "fill", parent: "root", frame: { kind: "fill", weight: 1, cross: 50 } },
    ]);

    const metrics = getStackMainAxisMetrics(layout, "root");

    expect(metrics.childMetrics.find((metric) => metric.id === "fill")?.mainSize).toBe(690);
    expect(metrics.unusedMainSize).toBe(0);
  });

  it("returns direct child rect copies keyed by id", () => {
    const layout = resolve([
      { id: "root", frame: { kind: "root" }, arrange: { kind: "stack", axis: "vertical" } },
      { id: "child", parent: "root", frame: { kind: "fixed", width: 100, height: 50 } },
    ]);

    const rects = getStackChildRects(layout, "root");

    expect(rects).toEqual({ child: { x: 0, y: 0, width: 100, height: 50 } });
    expect(rects.child).not.toBe(layout.nodes.child.rect);
  });

  it("returns remaining vertical stack rect between after and before children", () => {
    const layout = resolve([
      { id: "root", frame: { kind: "root" }, arrange: { kind: "stack", axis: "vertical" } },
      { id: "hero", parent: "root", frame: { kind: "fixed", width: 800, height: 100 } },
      { id: "middle", parent: "root", frame: { kind: "fixed", width: 800, height: 280 } },
      { id: "inspector", parent: "root", frame: { kind: "fixed", width: 800, height: 120 } },
    ]);

    expect(
      getRemainingStackRect(layout, {
        parentId: "root",
        afterChildren: ["hero"],
        beforeChildren: ["inspector"],
      }),
    ).toEqual({
      x: 0,
      y: 100,
      width: 800,
      height: 280,
    });
  });

  it("returns remaining horizontal stack rect", () => {
    const layout = resolve([
      { id: "root", frame: { kind: "root" }, arrange: { kind: "stack", axis: "horizontal" } },
      { id: "left", parent: "root", frame: { kind: "fixed", width: 100, height: 600 } },
      { id: "middle", parent: "root", frame: { kind: "fixed", width: 500, height: 600 } },
      { id: "right", parent: "root", frame: { kind: "fixed", width: 200, height: 600 } },
    ]);

    expect(
      getRemainingStackRect(layout, {
        parentId: "root",
        afterChildren: ["left"],
        beforeChildren: ["right"],
      }),
    ).toEqual({
      x: 100,
      y: 0,
      width: 500,
      height: 600,
    });
  });

  it("returns full content rect when remaining stack rect has no bounds", () => {
    const layout = resolve([
      {
        id: "root",
        frame: { kind: "root" },
        arrange: { kind: "stack", axis: "vertical", padding: 10 },
      },
      { id: "child", parent: "root", frame: { kind: "fixed", width: 100, height: 50 } },
    ]);

    expect(getRemainingStackRect(layout, { parentId: "root" })).toEqual({
      x: 10,
      y: 10,
      width: 780,
      height: 580,
    });
  });

  it("throws StackQueryInvalidRange for invalid remaining stack bounds", () => {
    const layout = resolve([
      { id: "root", frame: { kind: "root" }, arrange: { kind: "stack", axis: "vertical" } },
      { id: "first", parent: "root", frame: { kind: "fixed", width: 800, height: 200 } },
      { id: "second", parent: "root", frame: { kind: "fixed", width: 800, height: 100 } },
    ]);

    expectCode(
      () =>
        getRemainingStackRect(layout, {
          parentId: "root",
          afterChildren: ["second"],
          beforeChildren: ["first"],
        }),
      "StackQueryInvalidRange",
    );
  });

  it("does not mutate inputs", () => {
    const layout = resolve([
      {
        id: "root",
        frame: { kind: "root" },
        arrange: { kind: "stack", axis: "vertical", padding: 10 },
      },
      { id: "child", parent: "root", frame: { kind: "fixed", width: 100, height: 50 } },
    ]);
    const before = JSON.stringify(layout);

    getStackContentRect(layout, "root");
    getStackMainAxisMetrics(layout, "root");
    getStackChildRects(layout, "root");
    getRemainingStackRect(layout, { parentId: "root" });

    expect(JSON.stringify(layout)).toBe(before);
  });
});
