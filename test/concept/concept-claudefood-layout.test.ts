import { describe, expect, it } from "vitest";
import { formatConceptDiagnostics, T } from "../../src/concept";
import type {
  AbsoluteFrame,
  AnchorFrame,
  FrameSpec,
  GridArrange,
  LayoutRow,
  StackArrange,
  UiLength,
} from "../../src/types";

// Claudefood: model Machina's real layout record types as concepts and pin
// them to the hand-written types with T.implements, so neither can drift.

const Px = T.concept({ id: "Px", fields: { unit: T.literal("px"), value: T.number() } });
const Ui = T.concept({ id: "Ui", fields: { unit: T.literal("ui"), value: T.number() } });
const UiLengthC = T.union(T.number(), Px, Ui);

const _uiLengthCheck: T.Matches<typeof UiLengthC, UiLength> = true;

const EdgeRef = T.concept({
  id: "EdgeRef",
  fields: {
    ref: T.string({ nonEmpty: true }),
    edge: T.oneOf("left", "right", "top", "bottom", "centerX", "centerY"),
    offset: T.optional(UiLengthC),
  },
});
const GuideLength = T.union(UiLengthC, EdgeRef);

const RootFrame = T.concept({ id: "RootFrame", closed: true, fields: { kind: T.literal("root") } });
const AbsoluteFrameC = T.implements<AbsoluteFrame>()(
  T.concept({
    id: "AbsoluteFrame",
    closed: true,
    fields: {
      kind: T.literal("absolute"),
      x: T.number({ finite: true }),
      y: T.number({ finite: true }),
      width: T.number({ finite: true, min: 0 }),
      height: T.number({ finite: true, min: 0 }),
    },
  }),
);
const AnchorFrameC = T.implements<AnchorFrame>()(
  T.concept({
    id: "AnchorFrame",
    closed: true,
    fields: {
      kind: T.literal("anchor"),
      left: T.optional(UiLengthC),
      right: T.optional(UiLengthC),
      top: T.optional(UiLengthC),
      bottom: T.optional(UiLengthC),
      width: T.optional(UiLengthC),
      height: T.optional(UiLengthC),
    },
  }),
);
const GuideFrame = T.concept({
  id: "GuideFrame",
  closed: true,
  fields: {
    kind: T.literal("guide"),
    left: T.optional(GuideLength),
    right: T.optional(GuideLength),
    top: T.optional(GuideLength),
    bottom: T.optional(GuideLength),
    width: T.optional(UiLengthC),
    height: T.optional(UiLengthC),
  },
});
const FixedFrame = T.concept({
  id: "FixedFrame",
  closed: true,
  fields: {
    kind: T.literal("fixed"),
    width: T.optional(T.number({ min: 0 })),
    height: T.optional(T.number({ min: 0 })),
  },
});
const FillFrame = T.concept({
  id: "FillFrame",
  closed: true,
  fields: {
    kind: T.literal("fill"),
    weight: T.optional(T.number({ min: 0 })),
    cross: T.optional(T.union(T.number(), T.literal("fill"))),
  },
});
const CellFrame = T.concept({
  id: "CellFrame",
  closed: true,
  fields: {
    kind: T.literal("cell"),
    col: T.number({ int: true, min: 0 }),
    row: T.number({ int: true, min: 0 }),
    colSpan: T.optional(T.number({ int: true, min: 1 })),
    rowSpan: T.optional(T.number({ int: true, min: 1 })),
  },
});
const FrameSpecC = T.union(
  RootFrame,
  AbsoluteFrameC,
  AnchorFrameC,
  FixedFrame,
  FillFrame,
  CellFrame,
  GuideFrame,
);

const _frameCheck: T.Matches<typeof FrameSpecC, FrameSpec> = true;

const EdgeInsets = T.concept({
  id: "EdgeInsets",
  fields: { top: T.number(), right: T.number(), bottom: T.number(), left: T.number() },
});
const Padding = T.union(T.number(), EdgeInsets);
const StackArrangeC = T.implements<StackArrange>()(
  T.concept({
    id: "StackArrange",
    closed: true,
    fields: {
      kind: T.literal("stack"),
      axis: T.oneOf("horizontal", "vertical"),
      gap: T.optional(T.number({ min: 0 })),
      padding: T.optional(Padding),
      justify: T.optional(T.oneOf("start", "center", "end", "space-between")),
      align: T.optional(T.oneOf("start", "center", "end")),
    },
  }),
);
const GridTrack = T.union(
  T.concept({ id: "FixedTrack", fields: { kind: T.literal("fixed"), size: T.number() } }),
  T.concept({
    id: "FillTrack",
    fields: { kind: T.literal("fill"), weight: T.optional(T.number()) },
  }),
);
const GridArrangeC = T.implements<GridArrange>()(
  T.concept({
    id: "GridArrange",
    closed: true,
    fields: {
      kind: T.literal("grid"),
      columns: T.array(GridTrack),
      rows: T.array(GridTrack),
      columnGap: T.optional(T.number({ min: 0 })),
      rowGap: T.optional(T.number({ min: 0 })),
      padding: T.optional(Padding),
    },
  }),
);
const ArrangeSpec = T.union(StackArrangeC, GridArrangeC);
const OffsetSpec = T.concept({
  id: "OffsetSpec",
  closed: true,
  fields: { x: T.optional(UiLengthC), y: T.optional(UiLengthC) },
});

const rowCommon = {
  arrange: T.optional(ArrangeSpec),
  offset: T.optional(OffsetSpec),
  z: T.optional(T.number({ int: true })),
  view: T.optional(T.string()),
  slot: T.optional(T.string()),
  debugLabel: T.optional(T.string()),
  layer: T.optional(T.string()),
} as const;

const LayoutRowVariant = T.concept({
  id: "LayoutRowVariant",
  closed: true,
  fields: {
    when: T.concept({
      id: "LayoutVariantCondition",
      closed: true,
      fields: {
        minWidth: T.optional(T.number()),
        maxWidth: T.optional(T.number()),
        minHeight: T.optional(T.number()),
        maxHeight: T.optional(T.number()),
      },
    }),
    frame: T.optional(FrameSpecC),
    ...rowCommon,
  },
});

const LayoutRowC = T.implements<LayoutRow>()(
  T.concept({
    id: "LayoutRow",
    closed: true,
    description: "One flat Machina layout record.",
    fields: {
      id: T.string({ nonEmpty: true }),
      parent: T.optional(T.string({ nonEmpty: true })),
      order: T.optional(T.number({ int: true })),
      frame: FrameSpecC,
      variants: T.optional(T.array(LayoutRowVariant)),
      ...rowCommon,
    },
  }),
);

describe("claudefood: Machina LayoutRow as a concept", () => {
  it("accepts real rows and narrows with T.is", () => {
    const value: unknown = {
      id: "sidebar",
      parent: "root",
      frame: {
        kind: "anchor",
        left: 0,
        top: { unit: "px", value: 8 },
        width: { unit: "ui", value: 0.25 },
      },
      arrange: {
        kind: "stack",
        axis: "vertical",
        gap: 4,
        padding: { top: 1, right: 1, bottom: 1, left: 1 },
      },
    };
    expect(T.validate(LayoutRowC, value)).toEqual([]);
    if (T.is(LayoutRowC, value)) {
      const row: LayoutRow = value; // narrowed to the real type, no cast
      expect(row.frame.kind).toBe("anchor");
    }
  });

  it("explains typical LLM-authored mistakes in one line each", () => {
    const diagnostics = T.validate(LayoutRowC, {
      id: "card",
      frame: { kind: "absolute", x: 0, y: 0, width: Number.NaN, heigth: 40 },
      arrange: { kind: "stack", axis: "vertical", paddingX: 8 },
      zIndex: 2,
    });
    expect(formatConceptDiagnostics(diagnostics)).toMatchInlineSnapshot(`
      "[error] InvalidConceptNumber at frame.width: NaN is not allowed [fix: set frame.width to number(finite, >=0)]
      [error] MissingConceptField at frame.height: missing required number(finite, >=0); found 'heigth' — did you mean 'height'? [fix: rename frame.heigth → height]
      [error] UnknownConceptField at arrange.paddingX: unknown key on closed StackArrange; did you mean 'padding'? [fix: rename arrange.paddingX → padding]
      [error] UnknownConceptField at zIndex: unknown key on closed LayoutRow (allowed: id, parent, order, frame, variants, arrange, offset, z, view, slot, debugLabel, layer) [fix: remove zIndex]"
    `);
  });

  it("routes discriminated unions to the right branch and suggests kinds", () => {
    const wrongKind = T.validate(LayoutRowC, { id: "a", frame: { kind: "anchr", left: 0 } });
    expect(formatConceptDiagnostics(wrongKind)).toMatchInlineSnapshot(
      `"[error] InvalidConceptDiscriminant at frame.kind: "anchr" is not one of "root" | "absolute" | "anchor" | "fixed" | "fill" | "cell" | "guide"; did you mean "anchor"? [fix: set frame.kind to "anchor"]"`,
    );

    const cell = T.validate(LayoutRowC, { id: "a", frame: { kind: "cell", col: 1.5, row: 0 } });
    expect(cell.map((d) => `${d.code}@${d.path}`)).toEqual(["InvalidConceptNumber@frame.col"]);
  });

  it("validates nested arrays with indexed paths", () => {
    const diagnostics = T.validate(LayoutRowC, {
      id: "grid",
      frame: { kind: "root" },
      arrange: {
        kind: "grid",
        columns: [{ kind: "fixed", size: 10 }, { kind: "fixed" }],
        rows: [],
      },
    });
    expect(diagnostics.map((d) => `${d.code}@${d.path}`)).toEqual([
      "MissingConceptField@arrange.columns[1].size",
    ]);
  });

  it("generates fixtures that agree with the validator", () => {
    const row = T.example(LayoutRowC);
    expect(row).toEqual({ id: "id", frame: { kind: "root" } });
    const bad = T.counterexamples(LayoutRowC);
    expect(bad.length).toBeGreaterThan(10);
    expect(new Set(bad.map((entry) => entry.expectedCode))).toEqual(
      new Set([
        "MissingConceptField",
        "InvalidConceptFieldType",
        "InvalidConceptString",
        "InvalidConceptNumber",
        "UnknownConceptField",
        "NoMatchingUnionBranch",
      ]),
    );
  });
});
