import { describe, expect, it } from "vitest";
import {
  type IncrementDispatchTable,
  type MachinaDispatchTables,
  MachinaDispatchError,
  type PrefixIncrementDispatchTable,
  type PrefixSetDispatchTable,
  type SetDispatchTable,
  type ToggleDispatchTable,
  defineDispatchTables,
  dispatchEvent,
  matchEventPrefix,
  resolveEventValue,
} from "../../src/dispatch";

describe("dispatch public api", () => {
  it("exports runtime members and accepts table types", () => {
    const set: SetDispatchTable<{ route: string }> = {
      events: ["e"],
      fields: ["route"],
      values: ["home"],
    };
    const toggle: ToggleDispatchTable<{ on: boolean }> = { events: ["e"], fields: ["on"] };
    const increment: IncrementDispatchTable<{ n: number }> = { events: ["e"], fields: ["n"] };
    const setSuffix: PrefixSetDispatchTable<{ id: string }> = { prefixes: ["p."], fields: ["id"] };
    const incrementSuffix: PrefixIncrementDispatchTable<{ n: number }> = {
      prefixes: ["p."],
      fields: ["n"],
    };
    const all: MachinaDispatchTables<{ route: string }> = { set };
    expect(typeof defineDispatchTables).toBe("function");
    expect(typeof dispatchEvent).toBe("function");
    expect(typeof resolveEventValue).toBe("function");
    expect(typeof matchEventPrefix).toBe("function");
    expect(new MachinaDispatchError("InvalidDispatchTable", "x").name).toBe("MachinaDispatchError");
    expect(toggle.fields[0]).toBe("on");
    expect(increment.fields[0]).toBe("n");
    expect(setSuffix.fields[0]).toBe("id");
    expect(incrementSuffix.fields[0]).toBe("n");
    expect(all.set).toBe(set);
  });
});
