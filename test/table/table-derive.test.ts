import { describe, expect, it } from "vitest";
import { Table, TableError } from "../../src/table";

const orders = Table.define({
  id: "orders",
  columns: {
    id: ["order-001", "order-002", "order-003", "order-004"] as const,
    status: ["new", "paid", "paid", "cancelled"] as const,
    totalCents: [1299, 4599, 4599, 0] as const,
    active: [true, true, false, false] as const,
  },
});

const schemaOrders = Table.defineWithSchema({
  id: "schemaOrders",
  schema: Table.schema({
    id: Table.string(),
    status: Table.enum(["new", "paid", "cancelled"] as const),
    totalCents: Table.number(),
    active: Table.boolean(),
  }),
  columns: {
    id: ["order-001", "order-002", "order-003", "order-004"] as const,
    status: ["new", "paid", "paid", "cancelled"] as const,
    totalCents: [1299, 4599, 4599, 0] as const,
    active: [true, true, false, false] as const,
  },
});

describe("table derive helpers", () => {
  it("Table.select projects requested columns in requested order", () => {
    const selected = Table.select(orders, ["status", "id"] as const);

    expect(Table.columnNames(selected)).toEqual(["status", "id"]);
    expect(selected.rowCount).toBe(orders.rowCount);
    expect(selected.columns).toEqual({
      status: ["new", "paid", "paid", "cancelled"],
      id: ["order-001", "order-002", "order-003", "order-004"],
    });
    expect(Table.validate(selected)).toEqual([]);
  });

  it("Table.select preserves selected schema columns", () => {
    const selected = Table.select(schemaOrders, ["id", "status"] as const);

    expect("schema" in selected).toBe(true);
    if (!("schema" in selected)) {
      expect.unreachable("expected schema on selected table");
    }

    expect(
      Object.keys(
        (selected as { readonly schema: { readonly columns: Record<string, unknown> } }).schema
          .columns,
      ),
    ).toEqual(["id", "status"]);
    expect(Table.validate(selected)).toEqual([]);
  });

  it("Table.select rejects missing and duplicate columns", () => {
    expect(() => Table.select(orders, ["id", "missing"] as const)).toThrowError(
      /MissingSelectedColumn at orders\.missing/,
    );
    expect(() => Table.select(orders, ["id", "id"] as const)).toThrowError(
      /DuplicateSelectedColumn at orders\.id/,
    );
  });

  it("Table.filter filters by row object while preserving row order and columns", () => {
    const filtered = Table.filter(orders, (row) => row.status === "paid");

    expect(filtered.id).toBe("orders.filter");
    expect(Table.toObjects(filtered)).toEqual([
      { id: "order-002", status: "paid", totalCents: 4599, active: true },
      { id: "order-003", status: "paid", totalCents: 4599, active: false },
    ]);
    expect(Table.columnNames(filtered)).toEqual(["id", "status", "totalCents", "active"]);
    expect(Table.validate(filtered)).toEqual([]);
  });

  it("Table.filterRows filters with columnar getCell access and preserves schema", () => {
    const filtered = Table.filterRows(
      schemaOrders,
      ({ getCell }) => getCell("status") === "paid" && getCell("active") === true,
    );

    expect(Table.toObjects(filtered)).toEqual([
      { id: "order-002", status: "paid", totalCents: 4599, active: true },
    ]);
    expect("schema" in filtered).toBe(true);
    expect(Table.validate(filtered)).toEqual([]);
  });

  it("wraps non-table predicate failures with row diagnostics", () => {
    expect(() =>
      Table.filter(orders, (_row, context) => {
        if (context.row === 2) {
          throw new Error("boom");
        }

        return true;
      }),
    ).toThrowError(
      "error TableFilterPredicateError at orders[2]\n  Filter predicate threw while evaluating row 2.",
    );
  });

  it("allows table access errors to propagate from filterRows", () => {
    expect(() => Table.filterRows(orders, ({ getCell }) => getCell("missing") === "paid")).toThrow(
      TableError,
    );
  });

  it("sorts ascending strings and descending numbers without mutating the input", () => {
    const byStatus = Table.sortBy(orders, "status");
    const byTotalDesc = Table.sortBy(orders, "totalCents", "desc");

    expect(Table.getColumn(byStatus, "status")).toEqual(["cancelled", "new", "paid", "paid"]);
    expect(Table.toObjects(byTotalDesc)).toEqual([
      { id: "order-002", status: "paid", totalCents: 4599, active: true },
      { id: "order-003", status: "paid", totalCents: 4599, active: false },
      { id: "order-001", status: "new", totalCents: 1299, active: true },
      { id: "order-004", status: "cancelled", totalCents: 0, active: false },
    ]);
    expect(Table.toObjects(orders)).toEqual([
      { id: "order-001", status: "new", totalCents: 1299, active: true },
      { id: "order-002", status: "paid", totalCents: 4599, active: true },
      { id: "order-003", status: "paid", totalCents: 4599, active: false },
      { id: "order-004", status: "cancelled", totalCents: 0, active: false },
    ]);
    expect(Table.validate(byStatus)).toEqual([]);
    expect(Table.validate(byTotalDesc)).toEqual([]);
  });

  it("uses ascending sort by default, remains stable for equal values, and moves rows together", () => {
    const sorted = Table.sortBy(orders, "totalCents");

    expect(Table.getColumn(sorted, "totalCents")).toEqual([0, 1299, 4599, 4599]);
    expect(Table.getColumn(sorted, "id")).toEqual([
      "order-004",
      "order-001",
      "order-002",
      "order-003",
    ]);
    expect(Table.getColumn(sorted, "active")).toEqual([false, true, true, false]);
  });

  it("sorts nullish and mixed-type values deterministically", () => {
    const mixed = Table.define({
      id: "mixed",
      columns: {
        id: ["a", "b", "c", "d", "e", "f", "g"] as const,
        value: [undefined, null, 2, "2", false, true, { order: 1 }] as const,
      },
    });

    expect(Table.getColumn(Table.sortBy(mixed, "value"), "id")).toEqual([
      "e",
      "f",
      "c",
      "d",
      "g",
      "a",
      "b",
    ]);
    expect(Table.getColumn(Table.sortBy(mixed, "value", "desc"), "id")).toEqual([
      "a",
      "b",
      "g",
      "d",
      "c",
      "f",
      "e",
    ]);
  });

  it("rejects missing sort columns", () => {
    expect(() => Table.sortBy(orders, "missing")).toThrowError(
      /MissingSortColumn at orders\.missing/,
    );
  });

  it("Table.take and Table.drop slice rows canonically and preserve schema", () => {
    const taken = Table.take(schemaOrders, 2);
    const dropped = Table.drop(schemaOrders, 2);

    expect(Table.toObjects(taken)).toEqual([
      { id: "order-001", status: "new", totalCents: 1299, active: true },
      { id: "order-002", status: "paid", totalCents: 4599, active: true },
    ]);
    expect(Table.toObjects(dropped)).toEqual([
      { id: "order-003", status: "paid", totalCents: 4599, active: false },
      { id: "order-004", status: "cancelled", totalCents: 0, active: false },
    ]);
    expect("schema" in taken).toBe(true);
    expect("schema" in dropped).toBe(true);
    expect(Table.validate(taken)).toEqual([]);
    expect(Table.validate(dropped)).toEqual([]);
  });

  it("clamps take/drop counts and supports zero-row outputs", () => {
    expect(Table.take(orders, 99).rowCount).toBe(orders.rowCount);
    expect(Table.drop(orders, 99).rowCount).toBe(0);
    expect(Table.take(orders, 0)).toEqual({
      kind: "table",
      id: "orders.take",
      columns: {
        id: [],
        status: [],
        totalCents: [],
        active: [],
      },
      rowCount: 0,
    });
    expect(Table.drop(orders, 0)).toEqual({
      kind: "table",
      id: "orders.drop",
      columns: {
        id: ["order-001", "order-002", "order-003", "order-004"],
        status: ["new", "paid", "paid", "cancelled"],
        totalCents: [1299, 4599, 4599, 0],
        active: [true, true, false, false],
      },
      rowCount: 4,
    });
  });

  it("rejects invalid slice counts", () => {
    expect(() => Table.take(orders, -1)).toThrowError(/InvalidTableSliceCount at orders/);
    expect(() => Table.drop(orders, 1.5)).toThrowError(/InvalidTableSliceCount at orders/);
  });

  it("Table.renameColumns renames without changing column order and preserves schema", () => {
    const renamed = Table.renameColumns(schemaOrders, {
      totalCents: "total",
      active: "isActive",
    });

    expect(Table.columnNames(renamed)).toEqual(["id", "status", "total", "isActive"]);
    expect(Table.toObjects(renamed)).toEqual([
      { id: "order-001", status: "new", total: 1299, isActive: true },
      { id: "order-002", status: "paid", total: 4599, isActive: true },
      { id: "order-003", status: "paid", total: 4599, isActive: false },
      { id: "order-004", status: "cancelled", total: 0, isActive: false },
    ]);
    if (!("schema" in renamed)) {
      expect.unreachable("expected schema on renamed table");
    }

    expect(
      Object.keys(
        (renamed as { readonly schema: { readonly columns: Record<string, unknown> } }).schema
          .columns,
      ),
    ).toEqual(["id", "status", "total", "isActive"]);
    expect(Table.validate(renamed)).toEqual([]);
  });

  it("Table.renameColumns rejects bad rename plans", () => {
    expect(() => Table.renameColumns(orders, { missing: "x" })).toThrowError(
      /MissingRenameColumn at orders\.missing/,
    );
    expect(() => Table.renameColumns(orders, { status: " " })).toThrowError(
      /InvalidRenameColumnName at orders\.status/,
    );
    expect(() => Table.renameColumns(orders, { status: "id" })).toThrowError(
      /DuplicateRenameColumn at orders\.id/,
    );
  });

  it("supports explicit derived ids", () => {
    expect(Table.select(orders, ["id"] as const, { id: "picked" }).id).toBe("picked");
    expect(Table.filterRows(orders, () => true, { id: "kept" }).id).toBe("kept");
    expect(Table.sortBy(orders, "id", "asc", { id: "sorted" }).id).toBe("sorted");
    expect(Table.take(orders, 1, { id: "top-1" }).id).toBe("top-1");
    expect(Table.drop(orders, 1, { id: "rest" }).id).toBe("rest");
    expect(Table.renameColumns(orders, { totalCents: "total" }, { id: "renamed" }).id).toBe(
      "renamed",
    );
  });
});
