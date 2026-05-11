import { describe, expect, it } from "vitest";
import {
  compileLayoutRows,
  MachinaLayoutError,
  resolveLayoutRows,
  selectLayoutRowsForRoot,
  type LayoutRow,
} from "../src";

const rootRect = { x: 0, y: 0, width: 1000, height: 700 };

describe("selectLayoutRowsForRoot", () => {
  it("returns fresh rows, removes variants, and keeps base when no match", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "root" } },
      {
        id: "child",
        parent: "root",
        frame: { kind: "absolute", x: 0, y: 0, width: 100, height: 100 },
        variants: [{ when: { maxWidth: 200 }, frame: { kind: "absolute", x: 1, y: 1, width: 10, height: 10 } }],
      },
    ];

    const before = JSON.stringify(rows);
    const selected = selectLayoutRowsForRoot(rows, rootRect);
    expect(selected[1]).not.toBe(rows[1]);
    expect(selected[1].frame).toEqual(rows[1].frame);
    expect((selected[1] as LayoutRow & { variants?: unknown }).variants).toBeUndefined();
    expect(JSON.stringify(rows)).toBe(before);
  });

  it("uses first matching variant", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "root" } },
      {
        id: "child",
        parent: "root",
        frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 },
        variants: [
          { when: { maxWidth: 800 }, frame: { kind: "absolute", x: 1, y: 1, width: 10, height: 10 } },
          { when: { maxWidth: 1000 }, frame: { kind: "absolute", x: 2, y: 2, width: 20, height: 20 } },
        ],
      },
    ];
    const selected = selectLayoutRowsForRoot(rows, { x: 0, y: 0, width: 700, height: 700 });
    expect(selected[1].frame).toEqual({ kind: "absolute", x: 1, y: 1, width: 10, height: 10 });
  });

  it("supports inclusive width and height bounds and empty fallback", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "root" } },
      {
        id: "child",
        parent: "root",
        frame: { kind: "absolute", x: 0, y: 0, width: 10, height: 10 },
        variants: [
          { when: { minWidth: 500, maxWidth: 800, minHeight: 300, maxHeight: 600 }, frame: { kind: "absolute", x: 5, y: 5, width: 50, height: 50 } },
          { when: {}, frame: { kind: "absolute", x: 9, y: 9, width: 90, height: 90 } },
        ],
      },
    ];

    expect(selectLayoutRowsForRoot(rows, { x: 0, y: 0, width: 500, height: 300 })[1].frame).toEqual({ kind: "absolute", x: 5, y: 5, width: 50, height: 50 });
    expect(selectLayoutRowsForRoot(rows, { x: 0, y: 0, width: 800, height: 600 })[1].frame).toEqual({ kind: "absolute", x: 5, y: 5, width: 50, height: 50 });
    expect(selectLayoutRowsForRoot(rows, { x: 0, y: 0, width: 499, height: 500 })[1].frame).toEqual({ kind: "absolute", x: 9, y: 9, width: 90, height: 90 });
    expect(selectLayoutRowsForRoot(rows, { x: 0, y: 0, width: 801, height: 500 })[1].frame).toEqual({ kind: "absolute", x: 9, y: 9, width: 90, height: 90 });
  });

  it("overrides only provided fields and can override all allowed metadata", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "root" }, arrange: { kind: "stack", axis: "vertical", gap: 1 } },
      {
        id: "child",
        parent: "root",
        frame: { kind: "fixed", width: 100, height: 20 },
        view: "base-view",
        slot: "base-slot",
        z: 1,
        debugLabel: "base-label",
        offset: { x: 1, y: 2 },
        variants: [
          {
            when: { maxWidth: 1200 },
            frame: { kind: "fill", weight: 2, cross: "fill" },
            arrange: { kind: "stack", axis: "horizontal", gap: 2 },
            offset: { x: 3, y: 4 },
            z: -5,
            view: "variant-view",
            slot: "variant-slot",
            debugLabel: "variant-label",
          },
        ],
      },
    ];

    const selected = selectLayoutRowsForRoot(rows, rootRect)[1];
    expect(selected.frame).toEqual({ kind: "fill", weight: 2, cross: "fill" });
    expect(selected.arrange).toEqual({ kind: "stack", axis: "horizontal", gap: 2 });
    expect(selected.offset).toEqual({ x: 3, y: 4 });
    expect(selected.z).toBe(-5);
    expect(selected.view).toBe("variant-view");
    expect(selected.slot).toBe("variant-slot");
    expect(selected.debugLabel).toBe("variant-label");
  });

  it("ignores id/parent/order injected into variant via any", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "root" } },
      {
        id: "child",
        parent: "root",
        order: 9,
        frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 },
        variants: [
          ({ when: { maxWidth: 2000 }, parent: "other", id: "other", order: 0 } as unknown) as never,
        ],
      },
    ];
    const selected = selectLayoutRowsForRoot(rows, rootRect)[1];
    expect(selected.id).toBe("child");
    expect(selected.parent).toBe("root");
    expect(selected.order).toBe(9);
  });

  it("validates variant conditions and z", () => {
    const mk = (variant: object): LayoutRow[] => [
      { id: "root", frame: { kind: "root" } },
      { id: "child", parent: "root", frame: { kind: "absolute", x: 0, y: 0, width: 1, height: 1 }, variants: [variant as never] },
    ];

    expect(() => selectLayoutRowsForRoot(mk({ when: { maxWidth: Number.NaN } }), rootRect)).toThrowError(expect.objectContaining({ code: "NonFiniteNumber" }));
    expect(() => selectLayoutRowsForRoot(mk({ when: { minHeight: Number.POSITIVE_INFINITY } }), rootRect)).toThrowError(expect.objectContaining({ code: "NonFiniteNumber" }));
    expect(() => selectLayoutRowsForRoot(mk({ when: { minWidth: 900, maxWidth: 800 } }), rootRect)).toThrowError(expect.objectContaining({ code: "InvalidVariantCondition" }));
    expect(() => selectLayoutRowsForRoot(mk({ when: { minHeight: 700, maxHeight: 600 } }), rootRect)).toThrowError(expect.objectContaining({ code: "InvalidVariantCondition" }));

    expect(() => selectLayoutRowsForRoot(mk({ when: {}, z: 6 }), rootRect)).toThrowError(expect.objectContaining({ code: "InvalidZ" }));
    expect(() => selectLayoutRowsForRoot(mk({ when: {}, z: 1.5 }), rootRect)).toThrowError(expect.objectContaining({ code: "InvalidZ" }));
    expect(() => selectLayoutRowsForRoot(mk({ when: {}, z: Number.NaN }), rootRect)).toThrowError(expect.objectContaining({ code: "NonFiniteNumber" }));
    expect(() => selectLayoutRowsForRoot(mk({ when: {}, z: 5 }), rootRect)).not.toThrow();
    expect(() => selectLayoutRowsForRoot(mk({ when: {}, z: -5 }), rootRect)).not.toThrow();
  });

  it("validates rootRect", () => {
    const rows: LayoutRow[] = [{ id: "root", frame: { kind: "root" } }];
    expect(() => selectLayoutRowsForRoot(rows, { x: 0, y: 0, width: -1, height: 10 })).toThrowError(expect.objectContaining({ code: "NegativeSize" }));
    expect(() => selectLayoutRowsForRoot(rows, { x: 0, y: 0, width: 10, height: -1 })).toThrowError(expect.objectContaining({ code: "NegativeSize" }));
    expect(() => selectLayoutRowsForRoot(rows, { x: Number.NaN, y: 0, width: 10, height: 10 })).toThrowError(expect.objectContaining({ code: "NonFiniteNumber" }));
  });

  it("does not mutate input rows or nested variants", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "root" } },
      {
        id: "child",
        parent: "root",
        frame: { kind: "absolute", x: 0, y: 0, width: 100, height: 100 },
        variants: [{ when: { maxWidth: 800 }, frame: { kind: "absolute", x: 1, y: 1, width: 10, height: 10 } }],
      },
    ];
    const before = JSON.stringify(rows);
    selectLayoutRowsForRoot(rows, rootRect);
    expect(JSON.stringify(rows)).toBe(before);
  });
});

describe("responsive variants integration", () => {
  it("resolveLayoutRows applies variants before compile", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "root" } },
      { id: "child", parent: "root", frame: { kind: "absolute", x: 10, y: 10, width: 300, height: 100 }, variants: [{ when: { maxWidth: 600 }, frame: { kind: "absolute", x: 0, y: 0, width: 100, height: 40 } }] },
    ];

    const resolvedMatch = resolveLayoutRows(rows, { x: 0, y: 0, width: 500, height: 400 });
    expect(resolvedMatch.nodes.child.rect).toEqual({ x: 0, y: 0, width: 100, height: 40 });

    const resolvedNoMatch = resolveLayoutRows(rows, { x: 0, y: 0, width: 800, height: 400 });
    expect(resolvedNoMatch.nodes.child.rect).toEqual({ x: 10, y: 10, width: 300, height: 100 });
  });

  it("compileLayoutRows direct path ignores variants", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "root" } },
      { id: "child", parent: "root", frame: { kind: "absolute", x: 1, y: 2, width: 3, height: 4 }, view: "base", variants: [{ when: {}, frame: { kind: "absolute", x: 10, y: 20, width: 30, height: 40 }, view: "variant" }] },
    ];
    const document = compileLayoutRows(rows);
    expect(document.nodes.child.frame).toEqual({ kind: "absolute", x: 1, y: 2, width: 3, height: 4 });
    expect(document.nodes.child.view).toBe("base");
    expect((document.nodes.child as { variants?: unknown }).variants).toBeUndefined();
  });

  it("works with fill/stack behavior when variant changes frame", () => {
    const rows: LayoutRow[] = [
      { id: "root", frame: { kind: "root" }, arrange: { kind: "stack", axis: "horizontal", gap: 0 } },
      { id: "left", parent: "root", order: 0, frame: { kind: "fixed", width: 100, height: 100 } },
      { id: "right", parent: "root", order: 1, frame: { kind: "fixed", width: 100, height: 100 }, variants: [{ when: { maxWidth: 500 }, frame: { kind: "fill", weight: 1 } }] },
    ];
    const resolved = resolveLayoutRows(rows, { x: 0, y: 0, width: 400, height: 100 });
    expect(resolved.nodes.right.rect.width).toBe(300);
  });
});
