import { describe, expect, it } from "vitest";
import {
  M,
  MachinaAuthoringError,
  area,
  cell,
  fill,
  grid,
  gridRows,
  skip,
  trackFill,
  trackFixed,
} from "../../src/machina";

function expectCode(fn: () => unknown, code: string) {
  expect(fn).toThrow(MachinaAuthoringError);
  try {
    fn();
  } catch (error) {
    expect((error as MachinaAuthoringError).code).toBe(code);
  }
}
const gridOptions = {
  columns: [trackFixed(100), trackFill(1)],
  rows: [trackFixed(50), trackFill(1)],
};

describe("machina grid matrix", () => {
  it("lowers a grid container and matrix areas", () => {
    const rows = grid(
      "g",
      gridOptions,
      gridRows([
        [area("header", { colSpan: 2, view: "Header" })],
        [area("main", { view: "Main" }), area("side", { view: "Side" })],
      ]),
    ).rows();
    expect(rows[0]).toMatchObject({
      id: "g",
      frame: { kind: "fill", weight: 1 },
      arrange: { kind: "grid", ...gridOptions },
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "header",
          parent: "g",
          frame: { kind: "cell", col: 0, row: 0, colSpan: 2, rowSpan: undefined },
        }),
        expect.objectContaining({
          id: "main",
          parent: "g",
          frame: { kind: "cell", col: 0, row: 1, colSpan: undefined, rowSpan: undefined },
        }),
        expect.objectContaining({
          id: "side",
          parent: "g",
          frame: { kind: "cell", col: 1, row: 1, colSpan: undefined, rowSpan: undefined },
        }),
      ]),
    );
  });

  it("preserves grid metadata and explicit children", () => {
    const variant = { when: { minWidth: 1 }, z: 2 };
    const rows = grid(
      "g",
      {
        ...gridOptions,
        view: "Grid",
        slot: "s",
        debugLabel: "G",
        layer: "l",
        z: 1,
        variants: [variant],
      },
      [cell("c", 0, 0, { view: "Cell" })],
    ).rows();
    expect(rows[0]).toMatchObject({
      view: "Grid",
      slot: "s",
      debugLabel: "G",
      layer: "l",
      z: 1,
      variants: [variant],
    });
    expect(rows[1]).toMatchObject({ id: "c", parent: "g", view: "Cell" });
  });

  it("supports rowSpan, skip, empty rows, unoccupied cells, and fresh lowering", () => {
    const layout = grid(
      "g",
      {
        columns: [trackFixed(1), trackFixed(1), trackFixed(1)],
        rows: [trackFixed(1), trackFixed(1), trackFixed(1)],
      },
      gridRows([[area("left", { rowSpan: 2 }), skip(), area("right")], [area("middle")], []]),
    );
    const first = layout.rows();
    const second = layout.rows();
    expect(first[1]).not.toBe(second[1]);
    expect(first).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "left",
          frame: { kind: "cell", col: 0, row: 0, colSpan: undefined, rowSpan: 2 },
        }),
        expect.objectContaining({
          id: "right",
          frame: { kind: "cell", col: 2, row: 0, colSpan: undefined, rowSpan: undefined },
        }),
        expect.objectContaining({
          id: "middle",
          frame: { kind: "cell", col: 1, row: 1, colSpan: undefined, rowSpan: undefined },
        }),
      ]),
    );
  });

  it("injects area children parent chain and stack axis", () => {
    const rows = grid(
      "g",
      gridOptions,
      gridRows([[area("a", { arrange: { kind: "stack", axis: "horizontal" } }, [fill("child")])]]),
    ).rows();
    expect(rows[2]).toMatchObject({ id: "child", parent: "a", frame: { kind: "fill" } });
  });

  it("validates matrix bounds, overlap, and duplicates", () => {
    expectCode(() => grid("g", { ...gridOptions, columns: [] }, []).rows(), "InvalidGridMatrix");
    expectCode(() => grid("g", { ...gridOptions, rows: [] }, []).rows(), "InvalidGridMatrix");
    expectCode(() => grid("g", { ...gridOptions, columnGap: -1 }, []).rows(), "InvalidGridMatrix");
    expectCode(
      () => grid("g", gridOptions, gridRows([[], [], []])).rows(),
      "GridMatrixOutOfBounds",
    );
    expectCode(() => grid("g", gridOptions, gridRows([[skip(3)]])).rows(), "GridMatrixOutOfBounds");
    expectCode(
      () => grid("g", gridOptions, gridRows([[area("a", { colSpan: 3 })]])).rows(),
      "GridMatrixOutOfBounds",
    );
    expectCode(
      () => grid("g", gridOptions, gridRows([[area("a", { rowSpan: 3 })]])).rows(),
      "GridMatrixOutOfBounds",
    );
    expectCode(
      () =>
        grid(
          "g",
          gridOptions,
          gridRows([[skip(), area("a", { rowSpan: 2 })], [area("c", { colSpan: 2 })]]),
        ).rows(),
      "GridMatrixOverlap",
    );
    expectCode(
      () => grid("g", gridOptions, gridRows([[area("a"), area("a")]])).rows(),
      "DuplicateNodeId",
    );
  });

  it("exports grid helpers through M", () => {
    expect(
      [M.grid, M.gridRows, M.area, M.skip, M.cell, M.trackFixed, M.trackFill].every(
        (fn) => typeof fn === "function",
      ),
    ).toBe(true);
  });
});
