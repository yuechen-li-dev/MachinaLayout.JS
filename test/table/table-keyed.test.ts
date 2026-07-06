import { describe, expect, it } from "vitest";
import type { Assert, Equal } from "../../src/concept";
import {
  type KeyedTableDescription,
  type TableKeyValue,
  type TableRow,
  Table,
  TableError,
} from "../../src/table";

const orders = Table.define({
  id: "orders",
  columns: {
    id: ["order-001", "order-002", "order-003"] as const,
    status: ["new", "paid", "cancelled"] as const,
    totalCents: [1299, 4599, 0] as const,
  },
});

const orderSchema = Table.schema({
  id: Table.string(),
  status: Table.enum(["new", "paid"] as const),
  totalCents: Table.number(),
});

const schemaOrders = Table.defineWithSchema({
  id: "schemaOrders",
  schema: orderSchema,
  columns: {
    id: ["order-001", "order-002"] as const,
    status: ["new", "paid"] as const,
    totalCents: [1299, 4599] as const,
  },
});

const keyedOrders = Table.keyBy(orders, "id");
const schemaLookup = Table.requireLookup(Table.keyBy(schemaOrders, "id"), "order-001");
type _tableKeyValueSmoke = Assert<Equal<TableKeyValue, string | number>>;
type _rowTypeSmoke = Assert<
  Equal<
    TableRow<typeof schemaOrders>,
    {
      readonly id: string;
      readonly status: "new" | "paid";
      readonly totalCents: number;
    }
  >
>;
const typedSchemaLookup: {
  readonly id: string;
  readonly status: "new" | "paid";
  readonly totalCents: number;
} = schemaLookup;
void keyedOrders;
void typedSchemaLookup;

describe("table keyed helpers", () => {
  it("Table.keyBy creates a keyed artifact", () => {
    const keyed = Table.keyBy(orders, "id");

    expect(keyed.kind).toBe("keyedTable");
    expect(keyed.table).toBe(orders);
    expect(keyed.keyColumn).toBe("id");
    expect(keyed.keyCount).toBe(3);
    expect(keyed.rowByKey.get("order-001")).toBe(0);
    expect(keyed.rowByKey.get("order-003")).toBe(2);
  });

  it("requires the key column to exist", () => {
    expect(() => Table.keyBy(orders, "missing" as never)).toThrowError(/MissingTableKeyColumn/);
  });

  it("throws TableError for duplicate keys", () => {
    expect(() =>
      Table.keyBy(
        Table.define({
          id: "orders",
          columns: {
            id: ["order-001", "order-002", "order-001"],
            status: ["new", "paid", "cancelled"],
          },
        }),
        "id",
      ),
    ).toThrow(TableError);
  });

  it("reports duplicate key diagnostics with table id, column, row, and path", () => {
    const diagnostics = Table.validateKey(
      Table.define({
        id: "orders",
        columns: {
          id: ["order-001", "order-002", "order-001"],
          status: ["new", "paid", "cancelled"],
        },
      }),
      "id",
    );

    expect(diagnostics).toContainEqual({
      severity: "error",
      code: "DuplicateTableKey",
      message: 'Key "order-001" already appears at row 0.',
      tableId: "orders",
      column: "id",
      row: 2,
      path: "orders.id[2]",
    });
  });

  it("throws for non-string and non-number key cells", () => {
    expect(() =>
      Table.keyBy(
        Table.define({
          id: "orders",
          columns: {
            id: ["order-001", { bad: true }] as unknown as readonly string[],
            status: ["new", "paid"],
          },
        }),
        "id",
      ),
    ).toThrowError(/InvalidTableKeyCell/);
  });

  it("Table.lookup returns a row for an existing key", () => {
    expect(Table.lookup(Table.keyBy(orders, "id"), "order-002")).toEqual({
      id: "order-002",
      status: "paid",
      totalCents: 4599,
    });
  });

  it("Table.lookup returns undefined for a missing key", () => {
    expect(Table.lookup(Table.keyBy(orders, "id"), "order-999")).toBeUndefined();
  });

  it("Table.requireLookup returns a row for an existing key", () => {
    expect(Table.requireLookup(Table.keyBy(orders, "id"), "order-001")).toEqual({
      id: "order-001",
      status: "new",
      totalCents: 1299,
    });
  });

  it("Table.requireLookup throws for a missing key", () => {
    expect(() => Table.requireLookup(Table.keyBy(orders, "id"), "order-999")).toThrowError(
      /MissingTableKey/,
    );
  });

  it("Table.hasKey reports whether a key exists", () => {
    const keyed = Table.keyBy(orders, "id");

    expect(Table.hasKey(keyed, "order-001")).toBe(true);
    expect(Table.hasKey(keyed, "order-999")).toBe(false);
  });

  it("Table.keys returns keys in table row order", () => {
    expect(Table.keys(Table.keyBy(orders, "id"))).toEqual(["order-001", "order-002", "order-003"]);
  });

  it("Table.validateKey returns no diagnostics for a valid key column", () => {
    expect(Table.validateKey(orders, "id")).toEqual([]);
  });

  it("Table.validateKey reports duplicate keys", () => {
    expect(
      Table.validateKey(
        Table.define({
          id: "orders",
          columns: {
            id: ["order-001", "order-001"],
            status: ["new", "paid"],
          },
        }),
        "id",
      ).map((diagnostic) => diagnostic.code),
    ).toEqual(["DuplicateTableKey"]);
  });

  it("Table.describeKeyed reports key metadata", () => {
    expect(Table.describeKeyed(Table.keyBy(orders, "id"))).toEqual({
      kind: "keyedTableDescription",
      tableId: "orders",
      keyColumn: "id",
      keyCount: 3,
      rowCount: 3,
    } satisfies KeyedTableDescription);
  });

  it("works with schema tables and preserves typed row access", () => {
    expect(Table.lookup(Table.keyBy(schemaOrders, "id"), "order-002")).toEqual({
      id: "order-002",
      status: "paid",
      totalCents: 4599,
    });
  });

  it("surfaces missing-key diagnostics with table and column context", () => {
    try {
      Table.requireLookup(Table.keyBy(orders, "id"), "order-999");
      expect.unreachable("expected missing key");
    } catch (error) {
      expect(error).toBeInstanceOf(TableError);
      expect((error as TableError).diagnostics).toContainEqual({
        severity: "error",
        code: "MissingTableKey",
        message: 'Key "order-999" does not exist in table "orders" for column "id".',
        tableId: "orders",
        column: "id",
        path: "orders.id",
      });
    }
  });
});
