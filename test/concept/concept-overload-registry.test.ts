import { describe, expect, it } from "vitest";
import { acceptsValue, ConceptError, conceptRefines, T } from "../../src/concept";

const Point = T.concept({
  id: "Point",
  fields: { x: T.number({ finite: true }), y: T.number({ finite: true }) },
});
const Rect = T.compose({
  id: "Rect",
  concepts: [Point],
  fields: { width: T.number({ min: 0 }), height: T.number({ min: 0 }) },
});
const Square = T.compose({
  id: "Square",
  concepts: [Rect],
  fields: { kind: T.literal("square") },
});
const Named = T.concept({ id: "Named", fields: { name: T.string() } });

const pointLabel = T.template({
  id: "pointLabel",
  requires: Point,
  run: (p) => `point ${p.x},${p.y}`,
});
const rectLabel = T.template({
  id: "rectLabel",
  requires: Rect,
  run: (r) => `rect ${r.width}x${r.height}`,
});
const squareLabel = T.template({
  id: "squareLabel",
  requires: Square,
  run: (s) => `square ${s.width}`,
});
const namedLabel = T.template({
  id: "namedLabel",
  requires: Named,
  run: (n) => `named ${n.name}`,
});

describe("structural refinement", () => {
  it("orders concepts by refinement, not declaration", () => {
    expect(conceptRefines(Square, Rect, acceptsValue)).toBe(true);
    expect(conceptRefines(Rect, Point, acceptsValue)).toBe(true);
    expect(conceptRefines(Point, Rect, acceptsValue)).toBe(false);
    // Independently declared but structurally narrower still counts.
    const Unit = T.concept({
      id: "Unit",
      fields: { x: T.number({ finite: true, min: 0, max: 1 }), y: T.literal(0) },
    });
    expect(conceptRefines(Unit, Point, acceptsValue)).toBe(true);
  });

  it("treats enum ⊂ wider enum and literal ⊂ enum as refinement", () => {
    const Status = T.concept({ id: "S", fields: { s: T.oneOf("new", "paid", "done") } });
    const Paid = T.concept({ id: "P", fields: { s: T.literal("paid") } });
    const Some = T.concept({ id: "Q", fields: { s: T.oneOf("new", "paid") } });
    expect(conceptRefines(Paid, Status, acceptsValue)).toBe(true);
    expect(conceptRefines(Some, Status, acceptsValue)).toBe(true);
    expect(conceptRefines(Status, Some, acceptsValue)).toBe(false);
  });
});

describe("T.overload", () => {
  const label = T.overload("label", [pointLabel, rectLabel, squareLabel, namedLabel]);

  it("dispatches to the most specific matching template regardless of order", () => {
    expect(label.call({ x: 0, y: 0 })).toBe("point 0,0");
    expect(label.call({ x: 0, y: 0, width: 2, height: 3 })).toBe("rect 2x3");
    expect(label.call({ x: 0, y: 0, width: 2, height: 2, kind: "square" })).toBe("square 2");
    expect(label.templates.map((t) => t.id).slice(0, 3)).toEqual([
      "squareLabel",
      "rectLabel",
      "pointLabel",
    ]);
  });

  it("reports ambiguity instead of picking the first match", () => {
    const resolution = label.resolve({ x: 0, y: 0, name: "origin" });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.code).toBe("AmbiguousOverload");
      expect(resolution.candidates).toEqual(["pointLabel", "namedLabel"]);
    }
    expect(() => label.call({ x: 0, y: 0, name: "origin" })).toThrow(/AmbiguousOverload/);
  });

  it("explains a miss by ranking candidates by closeness", () => {
    const resolution = label.resolve({ x: 0, y: Number.NaN });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.code).toBe("NoMatchingOverload");
      expect(resolution.diagnostics[0].message).toBe(
        "pointLabel (requires Point): y NaN is not allowed",
      );
    }
  });

  it("rejects overload sets where a template can never win", () => {
    const PointAgain = T.concept({ id: "PointAgain", fields: Point.fields });
    const dup = T.template({ id: "dup", requires: PointAgain, run: () => "dup" });
    expect(() => T.overload("broken", [pointLabel, dup])).toThrow(ConceptError);
  });

  it("types call() as the union of template inputs and outputs", () => {
    const small = T.overload("small", [pointLabel, namedLabel]);
    const out: string = small.call({ name: "n" });
    expect(out).toBe("named n");
    // @ts-expect-error — neither Point nor Named
    expect(() => small.call({ z: 1 })).toThrow(/NoMatchingOverload/);
  });

  it("describes the candidate lattice", () => {
    expect(label.describe()).toMatchInlineSnapshot(`
      "Overload: label
      Candidates (most specific first):
      - squareLabel requires Square (refines Rect, Point)
      - rectLabel requires Rect (refines Point)
      - pointLabel requires Point
      - namedLabel requires Named"
    `);
  });
});

describe("T.registry", () => {
  const registry = T.registry().register(pointLabel, rectLabel, squareLabel, namedLabel);

  it("answers 'what can I do with this value?' most specific first", () => {
    expect(registry.capabilities({ x: 1, y: 2, width: 3, height: 4 }).map((c) => c.id)).toEqual([
      "rectLabel",
      "pointLabel",
    ]);
  });

  it("answers 'what accepts every value of this concept?' statically", () => {
    expect(registry.accepting(Square).map((c) => c.id)).toEqual([
      "pointLabel",
      "rectLabel",
      "squareLabel",
    ]);
    expect(registry.accepting(Named).map((c) => c.id)).toEqual(["namedLabel"]);
  });

  it("rejects duplicate ids", () => {
    expect(() => registry.register(pointLabel)).toThrow(/already has/);
  });
});

describe("typed authoring", () => {
  it("narrows with T.is and T.assert", () => {
    const value: unknown = { x: 1, y: 2 };
    if (T.is(Point, value)) {
      const x: number = value.x;
      expect(x).toBe(1);
    }
    T.assert(Point, value);
    const y: number = value.y;
    expect(y).toBe(2);
  });

  it("derives template input types from the concept", () => {
    T.template({
      id: "bad",
      requires: Point,
      // @ts-expect-error — `z` is not part of Point
      run: (p) => p.z,
    });
    expect(true).toBe(true);
  });

  it("throws on conflicting composition unless a local field overrides", () => {
    const A = T.concept({ id: "A", fields: { v: T.string() } });
    const B = T.concept({ id: "B", fields: { v: T.number() } });
    expect(() => T.compose({ id: "AB", concepts: [A, B] })).toThrow(/conflicts between 'A'/);
    const AB = T.compose({ id: "AB", concepts: [A, B], fields: { v: T.boolean() } });
    expect(AB.fieldOrigins).toEqual({ v: "AB" });
  });

  it("warns (not errors) on near-miss keys for open concepts", () => {
    const Opt = T.concept({ id: "Opt", fields: { padding: T.optional(T.number()) } });
    const diagnostics = T.validate(Opt, { paddingX: 1 });
    expect(diagnostics.map((d) => [d.severity, d.code])).toEqual([
      ["warning", "SuspiciousConceptField"],
    ]);
    expect(T.is(Opt, { paddingX: 1 })).toBe(true);
  });

  it("does not suggest unrelated short names", () => {
    const XY = T.concept({ id: "XY", closed: true, fields: { x: T.number() } });
    const diagnostics = T.validate(XY, { x: 1, maxWidth: 3 });
    expect(diagnostics[0].fix).toEqual({ op: "remove", path: "maxWidth" });
  });

  it("brands keep coordinate spaces apart at compile time", () => {
    const PxPoint = T.concept({ id: "PxPoint", fields: { x: T.number({ brand: "px" }) } });
    const UiPoint = T.concept({ id: "UiPoint", fields: { x: T.number({ brand: "ui" }) } });
    const px = { x: 4 };
    T.assert(PxPoint, px);
    const takesUi = (_point: T.Infer<typeof UiPoint>) => undefined;
    // @ts-expect-error — px-branded number is not a ui-branded number
    takesUi(px);
    expect(T.is(UiPoint, px)).toBe(true); // brands are compile-time only
  });

  it("explains a concept for an LLM reader", () => {
    expect(T.explain(Square)).toMatchInlineSnapshot(`
      "Concept: Square
      Fields:
      - x: number(finite)  (from Point)
      - y: number(finite)  (from Point)
      - width: number(>=0)  (from Rect)
      - height: number(>=0)  (from Rect)
      - kind: literal("square")
      Example: {"x":0,"y":0,"width":0,"height":0,"kind":"square"}
      Rejects:
      - x: missing, wrongKind, NaN, infinite
      - y: missing, wrongKind, NaN, infinite
      - width: missing, wrongKind, NaN, belowMin
      - height: missing, wrongKind, NaN, belowMin
      - kind: missing, wrongLiteral"
    `);
  });
});
