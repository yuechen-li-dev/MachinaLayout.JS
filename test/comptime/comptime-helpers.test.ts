import { describe, expect, it } from "vitest";
import * as root from "../../src/index";
import { CT } from "../../src/comptime";
import type {
  And,
  Assert,
  DiscriminantValues,
  Equal,
  Extends,
  IsNonEmptyTuple,
  KebabCase,
  KeysOf,
  KindValues,
  NonEmptyTuple,
  Not,
  Or,
  TupleValues,
  ValueOf,
} from "../../src/comptime";

type StaticNode = { kind: "frame"; id: string } | { kind: "text"; value: string };
type TypedUnion = { type: "start"; payload: 1 } | { type: "stop"; payload: 2 };
const modes = CT.tuple("desktop", "tablet", "phone");

type _assertWorks = Assert<Equal<"a", "a">>;
type _extendsWorks = Assert<Extends<{ id: string }, { id: string }>>;
type _notWorks = Assert<Equal<Not<true>, false>>;
type _andTrueWorks = Assert<Equal<And<[true, true]>, true>>;
type _andFalseWorks = Assert<Equal<And<[true, false]>, false>>;
type _orWorks = Assert<Equal<Or<[false, true]>, true>>;
type _valueOfWorks = Assert<Equal<ValueOf<{ a: 1; b: 2 }>, 1 | 2>>;
type _keysOfWorks = Assert<Equal<KeysOf<{ a: 1; b: 2 }>, "a" | "b">>;
type _tupleValuesWorks = Assert<Equal<TupleValues<typeof modes>, "desktop" | "tablet" | "phone">>;
type _discriminantValuesWorks = Assert<
  Equal<DiscriminantValues<TypedUnion, "type">, "start" | "stop">
>;
type _kindValuesWorks = Assert<Equal<KindValues<StaticNode>, "frame" | "text">>;
type _kebabCamelWorks = Assert<Equal<KebabCase<"buttonPrimary">, "button-primary">>;
type _kebabPascalWorks = Assert<Equal<KebabCase<"ButtonPrimary">, "button-primary">>;
type _kebabSingleWorks = Assert<Equal<KebabCase<"button">, "button">>;
type _nonEmptyTupleWorks = Assert<Equal<NonEmptyTuple<[1]>, [1]>>;
type _nonEmptyTupleEmptyWorks = Assert<Equal<NonEmptyTuple<[]>, never>>;
type _isNonEmptyTupleWorks = Assert<Equal<IsNonEmptyTuple<[1]>, true>>;

// @ts-expect-error Assert rejects false compile-time facts
type _assertRejectsFalse = Assert<Equal<"a", "b">>;

describe("compile-time literal helpers", () => {
  it("CT.tuple preserves tuple values at runtime", () => {
    expect(CT.tuple("a", "b")).toEqual(["a", "b"]);
  });

  it("CT.object returns the same object shape", () => {
    expect(CT.object({ kind: "x" })).toEqual({ kind: "x" });
  });

  it("CT.keys returns only string keys", () => {
    expect(CT.keys({ a: 1, b: 2 })).toEqual(["a", "b"]);
  });

  it("exports CT only from the comptime subpath", () => {
    expect(CT.tuple).toBeTypeOf("function");
    expect(CT.object).toBeTypeOf("function");
    expect(CT.keys).toBeTypeOf("function");
    expect("CT" in root).toBe(false);
  });
});
