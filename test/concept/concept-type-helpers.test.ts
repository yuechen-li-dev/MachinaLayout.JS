import { describe, expect, it } from "vitest";
import { T } from "../../src/concept";
import type {
  All,
  And,
  Assert,
  ConceptType,
  Equal,
  Extends,
  HasField,
  HasId,
  HasKind,
  OptionalField,
  Satisfies,
} from "../../src/concept";

type Positioned = T.All<[T.HasField<"x", number>, T.HasField<"y", number>]>;
type Sized = All<[HasField<"width", number>, HasField<"height", number>]>;
type RectLike = T.All<[Positioned, Sized]>;

type _hasFieldWorks = Assert<Equal<HasField<"id", string>, { readonly id: string }>>;
type _optionalFieldWorks = Assert<Equal<OptionalField<"name", string>, { readonly name?: string }>>;
type _hasIdWorks = Assert<Equal<HasId, { readonly id: string }>>;
type _hasKindWorks = Assert<Equal<HasKind<"image">, { readonly kind: "image" }>>;
type _andWorks = Assert<
  Extends<
    And<{ readonly x: number }, { readonly y: number }>,
    { readonly x: number; readonly y: number }
  >
>;
type _andWorksReverse = Assert<
  Extends<
    { readonly x: number; readonly y: number },
    And<{ readonly x: number }, { readonly y: number }>
  >
>;
type _allWorks = Assert<
  Extends<
    All<[{ readonly x: number }, { readonly y: number }, { readonly z: number }]>,
    { readonly x: number; readonly y: number; readonly z: number }
  >
>;
type _allWorksReverse = Assert<
  Extends<
    { readonly x: number; readonly y: number; readonly z: number },
    All<[{ readonly x: number }, { readonly y: number }, { readonly z: number }]>
  >
>;
type _conceptTypeWorks = Assert<
  Equal<
    ConceptType<{ x: number; y: number; width: number; height: number }>,
    { x: number; y: number; width: number; height: number }
  >
>;
type _extendsWorks = Assert<Equal<Extends<{ readonly id: string }, HasId>, true>>;
type _equalWorks = Assert<Equal<Equal<HasKind<"image">, { readonly kind: "image" }>, true>>;
type _assertWorks = Assert<true>;
type _satisfiesWorks = Assert<
  Equal<
    Satisfies<{ readonly x: number; readonly y: number }, Positioned>,
    { readonly x: number; readonly y: number }
  >
>;

function centerOf<TValue extends RectLike>(rect: TValue) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

const PositionedConcept = T.concept({
  id: "Positioned",
  fields: {
    x: T.number(),
    y: T.number(),
  },
});

const SizedConcept = T.concept({
  id: "Sized",
  fields: {
    width: T.number(),
    height: T.number(),
  },
});

describe("concept type helpers", () => {
  it("support compile-time shape composition and constrained generics", () => {
    const center = centerOf({
      x: 0,
      y: 0,
      width: 10,
      height: 20,
    });

    const x: number = center.x;
    const y: number = center.y;
    void x;
    void y;

    expect(center).toEqual({ x: 5, y: 10 });
  });

  it("pair cleanly with runtime concepts by naming convention", () => {
    type RuntimePairedRect = T.All<[Positioned, Sized, T.HasId, T.HasKind<"rect">]>;

    const RectLikeConcept = T.compose({
      id: "RectLike",
      concepts: [PositionedConcept, SizedConcept],
      fields: {
        id: T.string(),
        kind: T.literal("rect"),
      },
    });

    const rect: RuntimePairedRect = {
      id: "rect-1",
      kind: "rect",
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    };

    expect(T.validate(RectLikeConcept, rect)).toEqual([]);
  });

  it("preserve optional fields and concept aliases", () => {
    type Named = T.OptionalField<"name", string>;
    type NamedValue = T.ConceptType<{ name?: string }>;

    const named: Named = {};
    const alias: NamedValue = { name: "panel" };

    expect(named).toEqual({});
    expect(alias).toEqual({ name: "panel" });
  });
});

centerOf({
  x: 0,
  y: 0,
  width: 10,
  height: 20,
});

// @ts-expect-error missing height
centerOf({ x: 0, y: 0, width: 10 });

const imageValue: HasKind<"image"> = { kind: "image" };
void imageValue;

// @ts-expect-error wrong kind literal
const wrongKindValue: HasKind<"image"> = { kind: "video" };
void wrongKindValue;
