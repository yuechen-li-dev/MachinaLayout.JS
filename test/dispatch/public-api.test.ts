import { describe, expect, it } from "vitest";
import {
  type DispatchKeyFromTable,
  type IncrementDispatchTable,
  incrementDispatchTableFromTable,
  type MachinaDispatchTables,
  MachinaDispatchError,
  type PrefixIncrementDispatchTable,
  prefixIncrementDispatchTableFromTable,
  type PrefixSetDispatchTable,
  prefixSetDispatchTableFromTable,
  type SetDispatchTable,
  setDispatchTableFromTable,
  type ToggleDispatchTable,
  toggleDispatchTableFromTable,
  defineDispatchTables,
  dispatchEvent,
  matchEventPrefix,
  resolveEventValue,
} from "../../src/dispatch";

describe("dispatch public api", () => {
  it("exports runtime members and accepts table types", () => {
    type _dispatchKeySmoke = DispatchKeyFromTable<
      {
        kind: "table";
        id: "x";
        rowCount: 1;
        columns: { event: readonly ["nav.home"] };
      },
      "event"
    >;
    void (0 as unknown as _dispatchKeySmoke);

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
    expect(typeof setDispatchTableFromTable).toBe("function");
    expect(typeof toggleDispatchTableFromTable).toBe("function");
    expect(typeof incrementDispatchTableFromTable).toBe("function");
    expect(typeof prefixSetDispatchTableFromTable).toBe("function");
    expect(typeof prefixIncrementDispatchTableFromTable).toBe("function");
    expect(new MachinaDispatchError("InvalidDispatchTable", "x").name).toBe("MachinaDispatchError");
    expect(toggle.fields[0]).toBe("on");
    expect(increment.fields[0]).toBe("n");
    expect(setSuffix.fields[0]).toBe("id");
    expect(incrementSuffix.fields[0]).toBe("n");
    expect(all.set).toBe(set);
  });
});
