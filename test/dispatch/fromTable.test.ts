import { describe, expect, it } from "vitest";
import { Table, TableError } from "../../src/table";
import {
  type DispatchKeyFromTable,
  incrementDispatchTableFromTable,
  prefixSetDispatchTableFromTable,
  setDispatchTableFromTable,
  toggleDispatchTableFromTable,
} from "../../src/dispatch";
import { dispatchEvent, defineDispatchTables } from "../../src/dispatch";

describe("dispatch table authoring from machina tables", () => {
  it("builds a set dispatch table from a columnar table", () => {
    const authored = Table.define({
      id: "routeActions",
      columns: {
        value: ["home", "settings"] as const,
        field: ["route", "route"] as const,
        event: ["nav.home", "nav.settings"] as const,
      },
    });

    const set = setDispatchTableFromTable(authored, {
      event: "event",
      field: "field",
      value: "value",
    });
    const tables = defineDispatchTables({ set });

    expect(tables.set).toEqual({
      events: ["nav.home", "nav.settings"],
      fields: ["route", "route"],
      values: ["home", "settings"],
    });
    expect(dispatchEvent({ route: "home" }, "nav.settings", tables)).toEqual({
      route: "settings",
    });
  });

  it("builds a set dispatch table from a schema table and preserves enum key inference", () => {
    const authored = Table.defineWithSchema({
      id: "routeActions",
      schema: Table.schema({
        field: Table.literal("route"),
        event: Table.enum(["nav.home", "nav.settings"] as const),
        value: Table.enum(["home", "settings"] as const),
      }),
      columns: {
        field: ["route", "route"],
        event: ["nav.home", "nav.settings"],
        value: ["home", "settings"],
      },
    });

    type EventKey = DispatchKeyFromTable<typeof authored, "event">;
    const eventKey: EventKey = "nav.home";
    void eventKey;
    // biome-ignore lint/correctness/noConstantCondition: compile-time type assertion block
    if (false) {
      // @ts-expect-error schema enum key inference should stay narrow
      const invalidEventKey: EventKey = "nav.other";
      void invalidEventKey;
    }

    const set = setDispatchTableFromTable(authored, {
      event: "event",
      field: "field",
      value: "value",
    });

    expect(dispatchEvent({ route: "home" }, "nav.settings", { set }).route).toBe("settings");
  });

  it("builds prefix dispatch tables and uses existing dispatch invocation", () => {
    const authored = Table.define({
      id: "productInspect",
      columns: {
        prefix: ["product.inspect."] as const,
        field: ["selectedProduct"] as const,
        allowed: [["p1", "p2"]] as const,
      },
    });

    const setSuffix = prefixSetDispatchTableFromTable(authored, {
      prefix: "prefix",
      field: "field",
      allowedSuffixes: "allowed",
    });

    expect(
      dispatchEvent(
        { selectedProduct: "p1" },
        "product.inspect.p2",
        defineDispatchTables({ setSuffix }),
      ).selectedProduct,
    ).toBe("p2");
  });

  it("table column order does not affect dispatch conversion", () => {
    const authored = Table.define({
      id: "counterDispatch",
      columns: {
        by: [2] as const,
        event: ["counter.increment"] as const,
        field: ["count"] as const,
      },
    });

    const increment = incrementDispatchTableFromTable(authored, {
      event: "event",
      field: "field",
      by: "by",
    });

    expect(dispatchEvent({ count: 1 }, "counter.increment", { increment }).count).toBe(3);
  });

  it("rejects a missing key column", () => {
    const authored = Table.define({
      id: "routeActions",
      columns: {
        field: ["route"],
        value: ["home"],
      },
    });

    expect(() =>
      setDispatchTableFromTable(authored, {
        event: "event",
        field: "field",
        value: "value",
      }),
    ).toThrowError(TableError);

    try {
      setDispatchTableFromTable(authored, {
        event: "event",
        field: "field",
        value: "value",
      });
      expect.unreachable("expected TableError");
    } catch (error) {
      const tableError = error as TableError;
      expect(tableError.diagnostics).toEqual([
        expect.objectContaining({
          code: "MissingDispatchKeyColumn",
          tableId: "routeActions",
          column: "event",
          path: "routeActions.event",
        }),
      ]);
    }
  });

  it("rejects a missing handler column", () => {
    const authored = Table.define({
      id: "routeActions",
      columns: {
        event: ["nav.home"],
        value: ["home"],
      },
    });

    try {
      setDispatchTableFromTable(authored, {
        event: "event",
        field: "field",
        value: "value",
      });
      expect.unreachable("expected TableError");
    } catch (error) {
      const tableError = error as TableError;
      expect(tableError.diagnostics).toEqual([
        expect.objectContaining({
          code: "MissingDispatchHandlerColumn",
          tableId: "routeActions",
          column: "field",
          path: "routeActions.field",
        }),
      ]);
    }
  });

  it("rejects an invalid key cell", () => {
    const authored = Table.define({
      id: "routeActions",
      columns: {
        event: ["nav.home", 7],
        field: ["route", "route"],
        value: ["home", "settings"],
      },
    });

    try {
      setDispatchTableFromTable(authored, {
        event: "event",
        field: "field",
        value: "value",
      });
      expect.unreachable("expected TableError");
    } catch (error) {
      const tableError = error as TableError;
      expect(tableError.diagnostics).toEqual([
        expect.objectContaining({
          code: "InvalidDispatchKey",
          tableId: "routeActions",
          column: "event",
          row: 1,
          path: "routeActions.event[1]",
        }),
      ]);
    }
  });

  it("rejects an invalid handler cell", () => {
    const authored = Table.define({
      id: "toggleActions",
      columns: {
        event: ["filter.new"],
        field: [null],
      },
    });

    try {
      toggleDispatchTableFromTable(authored, {
        event: "event",
        field: "field",
      });
      expect.unreachable("expected TableError");
    } catch (error) {
      const tableError = error as TableError;
      expect(tableError.diagnostics).toEqual([
        expect.objectContaining({
          code: "InvalidDispatchHandler",
          tableId: "toggleActions",
          column: "field",
          row: 0,
          path: "toggleActions.field[0]",
        }),
      ]);
    }
  });

  it("rejects duplicate keys with cell-oriented diagnostics", () => {
    const authored = Table.define({
      id: "routeActions",
      columns: {
        event: ["nav.home", "nav.settings", "nav.settings"],
        field: ["route", "route", "route"],
        value: ["home", "settings", "settings"],
      },
    });

    try {
      setDispatchTableFromTable(authored, {
        event: "event",
        field: "field",
        value: "value",
      });
      expect.unreachable("expected TableError");
    } catch (error) {
      const tableError = error as TableError;
      expect(tableError.diagnostics).toEqual([
        expect.objectContaining({
          code: "DuplicateDispatchKey",
          tableId: "routeActions",
          column: "event",
          row: 2,
          path: "routeActions.event[2]",
          message: 'Dispatch key "nav.settings" already appears at row 1.',
        }),
      ]);
    }
  });
});
