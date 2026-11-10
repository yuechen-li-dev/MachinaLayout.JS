import { describe, expect, it } from "vitest";
import type { Assert, Equal } from "../../src/comptime";
import { T } from "../../src/concept";
import { V } from "../../src/variants";

const Shape = V.variants("Shape", {
  circle: { r: T.number({ min: 0 }) },
  rect: { w: T.number(), h: T.number(), label: T.optional(T.string()) },
  empty: {},
});
type Shape = V.Infer<typeof Shape>;

type _union = Assert<
  Equal<
    Shape,
    | { kind: "circle"; r: number }
    | { kind: "rect"; w: number; h: number; label?: string }
    | { kind: "empty" }
  >
>;
type _one = Assert<Equal<V.Of<typeof Shape, "circle">, { kind: "circle"; r: number }>>;

const area = (shape: Shape) =>
  Shape.match(shape, {
    circle: ({ r }) => Math.PI * r * r,
    rect: ({ w, h }) => w * h,
    empty: () => 0,
  });

describe("V.variants", () => {
  it("constructs, guards, and matches", () => {
    const c = Shape.make.circle({ r: 1 });
    expect(c).toEqual({ kind: "circle", r: 1 });
    expect(Object.keys(Shape.make.rect({ w: 2, h: 3 }))).toEqual(["kind", "w", "h"]);
    expect(Shape.make.empty()).toEqual({ kind: "empty" });
    expect(area(Shape.make.rect({ w: 2, h: 3 }))).toBe(6);
    const shapes: Shape[] = [c, Shape.make.empty()];
    const circles = shapes.filter(Shape.is.circle);
    const r: number = circles[0]!.r;
    expect(r).toBe(1);
  });

  it("is exhaustive at compile time and supports a default arm", () => {
    expect(() =>
      // @ts-expect-error — missing `empty`
      Shape.match(Shape.make.empty(), { circle: () => 1, rect: () => 2 }),
    ).toThrow(/No handler for discriminant kind=empty/);
    expect(Shape.match(Shape.make.empty(), { circle: () => "c", _: () => "other" })).toBe("other");
  });

  it("rejects wrong payloads at compile time", () => {
    // @ts-expect-error — r must be a number
    Shape.make.circle({ r: "1" });
    // @ts-expect-error — rect payload is required
    Shape.make.rect();
    expect(true).toBe(true);
  });

  it("validates untrusted input with discriminant routing and fixes", () => {
    expect(Shape.validate({ kind: "rect", w: 1, h: 2 })).toEqual([]);
    expect(Shape.validate({ kind: "circl", r: 1 }).map((d) => d.message)).toEqual([
      '"circl" is not one of "circle" | "rect" | "empty"; did you mean "circle"?',
    ]);
    expect(Shape.validate({ kind: "circle", r: -1 }).map((d) => `${d.path}: ${d.message}`)).toEqual(
      ["r: -1 is below min 0"],
    );
    const raw: unknown = JSON.parse('{"kind":"circle","r":2}');
    expect(Shape.accepts(raw) && area(raw)).toBeCloseTo(4 * Math.PI);
    expect(() => Shape.parse({ kind: "rect", w: 1 })).toThrow(/h missing required number/);
  });

  it("composes into other concepts", () => {
    const Scene = T.concept({ id: "Scene", fields: { shapes: T.array(Shape.constraint) } });
    type Scene = T.Infer<typeof Scene>;
    const scene: Scene = { shapes: [Shape.make.circle({ r: 1 })] };
    expect(T.validate(Scene, scene)).toEqual([]);
    expect(T.validate(Scene, { shapes: [{ kind: "rect", w: 1 }] })[0]?.path).toBe("shapes[0].h");
  });

  it("refuses a payload field named like the discriminant", () => {
    expect(() => V.variants("Bad", { a: { kind: T.string() } })).toThrow(/discriminant/);
  });

  it("supports a custom discriminant key", () => {
    const Event = V.variants("Event", { open: { id: T.string() }, close: {} }, { key: "type" });
    type Event = V.Infer<typeof Event>;
    const e: Event = Event.make.open({ id: "x" });
    expect(e).toEqual({ type: "open", id: "x" });
    expect(Event.match(e, { open: ({ id }) => id, close: () => "" })).toBe("x");
  });
});

describe("V.variants as a nested field", () => {
  it("keeps the exact union type when used inside another concept", () => {
    const Holder = T.concept({ id: "Holder", fields: { shape: Shape.constraint } });
    type _nested = Assert<Equal<T.Infer<typeof Holder>, { shape: Shape }>>;
    expect(T.validate(Holder, { shape: Shape.make.empty() })).toEqual([]);
  });
});
