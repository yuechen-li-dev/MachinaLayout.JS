import { type LayoutRow, type Rect, resolveLayoutRows } from "machinalayout";
import { M } from "machinalayout/machina";

const compact = { maxWidth: 960 };

export function createAppLayout(): LayoutRow[] {
  return M.root("machina-canvas-root", {}, [
    M.grid(
      "app-grid",
      {
        frame: { kind: "anchor", left: 0, right: 0, top: 0, bottom: 0 },
        columns: [M.trackFixed(260), M.trackFill(1), M.trackFixed(360)],
        rows: [M.trackFill(1), M.trackFixed(220), M.trackFixed(36)],
        columnGap: 0,
        rowGap: 0,
        variants: [
          M.when(compact, {
            arrange: {
              kind: "grid",
              columns: [M.trackFixed(190), M.trackFill(1), M.trackFixed(270)],
              rows: [M.trackFill(1), M.trackFixed(180), M.trackFixed(36)],
              columnGap: 0,
              rowGap: 0,
            },
          }),
        ],
      },
      M.gridRows([
        [
          M.area("scene-tree", {
            rowSpan: 2,
            view: "SceneTree",
          }),
          M.area("canvas-panel", {
            view: "CanvasPanel",
          }),
          M.area("inspector", {
            rowSpan: 2,
            view: "Inspector",
          }),
        ],
        [
          M.area("scene-summary", {
            view: "SceneSummaryShelf",
          }),
        ],
        [
          M.area("breadcrumb", {
            colSpan: 3,
            view: "Breadcrumb",
          }),
        ],
      ]),
    ),
  ]).rows();
}

export function resolveAppLayout(rootRect: Rect) {
  return resolveLayoutRows(createAppLayout(), rootRect);
}
