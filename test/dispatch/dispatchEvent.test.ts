import { describe, expect, it } from "vitest";
import { MachinaDispatchError, defineDispatchTables, dispatchEvent } from "../../src/dispatch";

describe("dispatchEvent", () => {
  it("set dispatch and identity semantics", () => {
    const tables = defineDispatchTables({
      set: { events: ["nav.settings"], fields: ["route"], values: ["settings"] },
    });
    const state = { route: "home" };
    const next = dispatchEvent(state, "nav.settings", tables);
    expect(next.route).toBe("settings");
    expect(next).not.toBe(state);
    expect(dispatchEvent(next, "nav.settings", tables)).toBe(next);
  });

  it("toggle/increment/increment default", () => {
    expect(
      dispatchEvent({ newOnly: false }, "filter.new", {
        toggle: { events: ["filter.new"], fields: ["newOnly"] },
      }).newOnly,
    ).toBe(true);
    expect(
      dispatchEvent({ cartCount: 1 }, "cart.add", {
        increment: { events: ["cart.add"], fields: ["cartCount"], by: [2] },
      }).cartCount,
    ).toBe(3);
    expect(
      dispatchEvent({ cartCount: 1 }, "cart.add", {
        increment: { events: ["cart.add"], fields: ["cartCount"] },
      }).cartCount,
    ).toBe(2);
  });

  it("suffix operations", () => {
    const setState = { selectedProduct: "p1" };
    const setTables = {
      setSuffix: {
        prefixes: ["product.inspect."],
        fields: ["selectedProduct"],
        allowedSuffixes: [["p1", "p2"]],
      },
    } as const;
    expect(dispatchEvent(setState, "product.inspect.p2", setTables).selectedProduct).toBe("p2");
    expect(dispatchEvent(setState, "product.inspect.bad", setTables)).toBe(setState);
    expect(
      dispatchEvent({ cartCount: 0 }, "cart.add.p1", {
        incrementSuffix: {
          prefixes: ["cart.add."],
          fields: ["cartCount"],
          allowedSuffixes: [["p1"]],
        },
      }).cartCount,
    ).toBe(1);
  });

  it("matching order and row order", () => {
    expect(
      dispatchEvent({ route: "home", toggled: false }, "e", {
        set: { events: ["e"], fields: ["route"], values: ["settings"] },
        toggle: { events: ["e"], fields: ["toggled"] },
      }).route,
    ).toBe("settings");
    expect(
      dispatchEvent({ route: "home" }, "e", {
        set: { events: ["e", "e"], fields: ["route", "route"], values: ["first", "second"] },
      }).route,
    ).toBe("first");
  });

  it("immutability and no match", () => {
    const child = { deep: true };
    const state = { route: "home", child };
    const next = dispatchEvent(state, "nav.settings", {
      set: { events: ["nav.settings"], fields: ["route"], values: ["settings"] },
    });
    expect(
      dispatchEvent(state, "unknown", {
        set: { events: ["nav.settings"], fields: ["route"], values: ["settings"] },
      }),
    ).toBe(state);
    expect(next).not.toBe(state);
    expect(next.child).toBe(child);
  });

  it("validates and throws stable codes", () => {
    expect(() =>
      defineDispatchTables({ set: { events: ["a", "b"], fields: ["x"], values: [1, 2] } }),
    ).toThrowError(MachinaDispatchError);
    expect(() =>
      dispatchEvent({ x: "a" }, "e", { toggle: { events: ["e"], fields: ["x"] } }),
    ).toThrowError(expect.objectContaining({ code: "InvalidDispatchValue" }));
    expect(() =>
      dispatchEvent({ x: "a" }, "e", { increment: { events: ["e"], fields: ["x"] } }),
    ).toThrowError(expect.objectContaining({ code: "InvalidDispatchValue" }));
    expect(() =>
      defineDispatchTables({ increment: { events: ["e"], fields: ["n"], by: [Number.NaN] } }),
    ).toThrowError(expect.objectContaining({ code: "InvalidDispatchTable" }));
    expect(() =>
      dispatchEvent({} as { x: number }, "e", { increment: { events: ["e"], fields: ["x"] } }),
    ).toThrowError(expect.objectContaining({ code: "InvalidDispatchField" }));
    expect(() =>
      dispatchEvent({ x: 1 }, 123 as unknown as string, {
        increment: { events: ["e"], fields: ["x"] },
      }),
    ).toThrowError(expect.objectContaining({ code: "InvalidDispatchEvent" }));
  });

  it("does not mutate tables and supports routing/react/vue style assignment", () => {
    const tables = defineDispatchTables({
      set: {
        events: ["nav.home", "nav.settings"],
        fields: ["route", "route"],
        values: ["home", "settings"],
      },
    });
    const before = JSON.stringify(tables);
    expect(dispatchEvent({ route: "home" }, "nav.settings", tables).route).toBe("settings");
    expect(JSON.stringify(tables)).toBe(before);

    let state = { route: "home" as "home" | "settings" };
    state = dispatchEvent(state, "nav.settings", tables);
    expect(state.route).toBe("settings");

    const refLike = { value: { route: "home" as "home" | "settings" } };
    refLike.value = dispatchEvent(refLike.value, "nav.settings", tables);
    expect(refLike.value.route).toBe("settings");
  });
});
