import { describe, expect, it } from "vitest";
import { defineLayers, onLayer } from "../../src/machina";

const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
    throw new Error("expected throw");
  } catch (error) {
    expect((error as { code?: string }).code).toBe(code);
  }
};

describe("machina layers", () => {
  it("returns layer names and fresh maps", () => {
    expect(onLayer("overlay")).toBe("overlay");
    expectCode(() => onLayer(""), "InvalidLayer");
    const input = { base: { z: 0 }, overlay: { z: 10 } };
    const layers = defineLayers(input);
    expect(layers).toEqual(input);
    expect(layers).not.toBe(input);
    expect(layers.base).not.toBe(input.base);
  });

  it("validates layer maps", () => {
    expectCode(() => defineLayers(null as any), "InvalidLayer");
    expectCode(() => defineLayers({ bad: { z: Number.NaN } }), "InvalidLayer");
  });
});
