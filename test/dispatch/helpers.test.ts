import { describe, expect, it } from "vitest";
import { MachinaDispatchError, matchEventPrefix, resolveEventValue } from "../../src/dispatch";

describe("dispatch helpers", () => {
  it("resolveEventValue matches exact event", () => {
    expect(resolveEventValue("a", { events: ["a", "b"], values: [1, 2] })).toBe(1);
    expect(resolveEventValue("x", { events: ["a"], values: [1] })).toBeUndefined();
  });

  it("resolveEventValue validates shape", () => {
    expect(() => resolveEventValue("a", { events: ["a", "b"], values: [1] })).toThrowError(MachinaDispatchError);
  });

  it("matchEventPrefix behavior", () => {
    expect(matchEventPrefix("product.inspect.p2", "product.inspect.", ["p1", "p2"])).toBe("p2");
    expect(matchEventPrefix("a", "b")).toBeUndefined();
    expect(matchEventPrefix("product.inspect.bad", "product.inspect.", ["p1"])).toBeUndefined();
  });

  it("matchEventPrefix invalid event input", () => {
    expect(() => matchEventPrefix(123 as unknown as string, "x")).toThrowError(MachinaDispatchError);
  });
});
