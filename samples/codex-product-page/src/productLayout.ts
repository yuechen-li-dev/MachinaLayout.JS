import { type LayoutRow, type Rect, resolveLayoutRows } from "machinalayout";
import { M } from "machinalayout/machina";

export const PRODUCT_LAYERS = M.defineLayers({
  base: { z: 0 },
  chrome: { z: 1 },
  media: { z: 0 },
});

const mobile = { maxWidth: 820 };

const sizeGrid = M.grid(
  "size-grid",
  {
    columns: [
      M.trackFixed(42),
      M.trackFixed(42),
      M.trackFixed(42),
      M.trackFixed(42),
      M.trackFixed(42),
    ],
    rows: [M.trackFixed(30), M.trackFixed(30)],
    columnGap: 6,
    rowGap: 6,
    padding: { top: 0, right: 0, bottom: 0, left: 8 },
    frame: { kind: "fill", weight: 0.52 },
  },
  M.gridRows([
    [
      M.area("size-34", { view: "Size34" }),
      M.area("size-35", { view: "Size35" }),
      M.area("size-36", { view: "Size36" }),
      M.area("size-37", { view: "Size37" }),
      M.area("size-38", { view: "Size38" }),
    ],
    [
      M.area("size-39", { view: "Size39" }),
      M.area("size-40", { view: "Size40" }),
      M.area("size-41", { view: "Size41" }),
      M.area("size-42", { view: "Size42" }),
      M.area("size-43", { view: "Size43" }),
    ],
  ]),
);

export const productRows: LayoutRow[] = M.rows(
  M.root(
    "codex-product-root",
    {
      view: "Page",
    },
    [
      M.anchor("top-wordmark", {
        left: 0,
        right: 0,
        top: 0,
        height: 92,
        view: "Wordmark",
        layer: M.onLayer("chrome"),
        variants: [
          M.when(mobile, { frame: { kind: "anchor", left: 0, right: 0, top: 0, height: 72 } }),
        ],
      }),
      M.hstack(
        "desktop-body",
        {
          frame: { kind: "anchor", left: 0, right: 0, top: 92, bottom: 0 },
          gap: 26,
          variants: [
            M.when(mobile, {
              frame: { kind: "anchor", left: 0, right: 0, top: 72, bottom: 0 },
              arrange: M.stackArrange("vertical"),
            }),
          ],
        },
        [
          M.fill("side-nav", 0.24, {
            view: "SideNav",
            layer: M.onLayer("chrome"),
            variants: [M.when(mobile, { frame: { kind: "fill", weight: 0.14 } })],
          }),
          M.fill("product-media", 1, {
            view: "ProductMedia",
            layer: M.onLayer("media"),
            variants: [M.when(mobile, { frame: { kind: "fill", weight: 0.72 } })],
          }),
          M.fill(
            "purchase-panel",
            0.52,
            {
              view: "PurchasePanel",
              arrange: M.stackArrange("vertical"),
              variants: [M.when(mobile, { frame: { kind: "fill", weight: 1.16 } })],
            },
            undefined,
            [
              M.fill("product-summary", 1, "ProductSummary"),
              M.fill("fit-note", 0.34, "FitNote"),
              sizeGrid,
              M.fill("size-guide", 0.28, "SizeGuide"),
              M.fill("apple-pay", 0.36, "ApplePayButton"),
              M.fill("add-to-bag", 0.36, "AddToBagButton"),
              M.fill("purchase-copy", 0.55, "PurchaseCopy"),
              M.fill(
                "detail-rows",
                1.25,
                {
                  view: "DetailRows",
                  arrange: M.stackArrange("vertical"),
                },
                undefined,
                [
                  M.fill("details-row", 1, "DetailsRow"),
                  M.fill("care-row", 1, "CareRow"),
                  M.fill("shipping-row", 1, "ShippingRow"),
                  M.fill("returns-row", 1, "ReturnsRow"),
                ],
              ),
            ],
          ),
        ],
      ),
      M.anchor("media-count", {
        right: 438,
        top: 104,
        width: 30,
        height: 30,
        view: "MediaCount",
        layer: M.onLayer("chrome"),
        z: 1,
        variants: [
          M.when(mobile, {
            frame: { kind: "anchor", top: 250, right: 24, width: 34, height: 34 },
          }),
        ],
      }),
    ],
  ),
);

export const productText = {
  title: M.text.plain("JUNO - SLINGBACK PUMP IN PATENT CALFSKIN"),
  price: M.text.mono("1100 USD"),
};

export function resolveProductLayout(rootRect: Rect) {
  return resolveLayoutRows(productRows, rootRect);
}
