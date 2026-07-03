import { describe, expect, it } from "vitest";
import { root, screen } from "../../src/machina";

const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
    throw new Error("expected throw");
  } catch (error) {
    expect((error as { code?: string }).code).toBe(code);
  }
};

describe("machina screen", () => {
  it("returns metadata and preserves layout without executing it", () => {
    let calls = 0;
    const layout = () => {
      calls += 1;
      return root("r").rows();
    };
    const definition = {
      route: "/setup",
      fixture: "provider-setup",
      tags: ["setup"],
      viewports: ["desktop"],
      layout,
    };
    const result = screen("provider-setup", definition);
    expect(result).toMatchObject({
      key: "provider-setup",
      route: "/setup",
      fixture: "provider-setup",
      tags: ["setup"],
      viewports: ["desktop"],
    });
    expect(result.layout).toBe(layout);
    expect(calls).toBe(0);
    expect(result.layout?.({ key: "desktop", width: 1, height: 1 })[0].frame).toEqual({
      kind: "root",
    });
    expect(result.tags).not.toBe(definition.tags);
  });

  it("validates screen definitions", () => {
    expectCode(() => screen("", { route: "/" }), "InvalidScreen");
    expectCode(() => screen("a", { route: "" }), "InvalidScreen");
    expectCode(() => screen("a", { route: "/", tags: [1] as any }), "InvalidScreen");
    expectCode(() => screen("a", { route: "/", viewports: [1] as any }), "InvalidScreen");
  });
});
