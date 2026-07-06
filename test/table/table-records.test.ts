import { describe, expect, it } from "vitest";
import * as root from "../../src/index";
import {
  type ColumnarTable,
  type TableColumns,
  type TableDiagnostic,
  Table,
  TableError,
  formatTableDiagnostics,
  validateObjectRowsInput,
  validateRowTableInput,
} from "../../src/table";

const orders = Table.define({
  id: "orders",
  columns: {
    id: ["order-001", "order-002", "order-003"] as const,
    status: ["new", "paid", "cancelled"] as const,
    totalCents: [1299, 4599, 0] as const,
  },
});

type _columnKeySmoke = keyof typeof orders.columns;
const _typedColumn = Table.getColumn(orders, "status");
const _typedCell = Table.getCell(orders, 0, "totalCents");
type _columnTypeSmoke = typeof _typedColumn;
type _cellTypeSmoke = typeof _typedCell;
void _typedColumn;
void _typedCell;
void (0 as unknown as _columnKeySmoke);
void (0 as unknown as _columnTypeSmoke);
void (0 as unknown as _cellTypeSmoke);

// biome-ignore lint/correctness/noConstantCondition: compile-time type assertion block
if (false) {
  // @ts-expect-error invalid table column key should fail
  Table.getColumn(orders, "missing");
}

describe("table authoring", () => {
  it("Table.define creates columnar tables with derived rowCount", () => {
    expect(orders).toEqual({
      kind: "table",
      id: "orders",
      columns: {
        id: ["order-001", "order-002", "order-003"],
        status: ["new", "paid", "cancelled"],
        totalCents: [1299, 4599, 0],
      },
      rowCount: 3,
    });
  });

  it("returns a fresh object and does not reuse the input columns object", () => {
    const input = {
      id: "fresh",
      columns: {
        id: ["a", "b"] as const,
      },
    };

    const table = Table.define(input);

    expect(table).not.toBe(input);
    expect(table.columns).not.toBe(input.columns);
    expect(table.columns.id).not.toBe(input.columns.id);
  });

  it("allows empty tables", () => {
    expect(Table.define({ id: "empty", columns: {} })).toEqual({
      kind: "table",
      id: "empty",
      columns: {},
      rowCount: 0,
    });
  });

  it("throws TableError for mismatched column lengths", () => {
    expect(() =>
      Table.define({
        id: "broken",
        columns: {
          id: ["a", "b"],
          status: ["new"],
        },
      }),
    ).toThrow(TableError);
  });

  it("throws for invalid ids", () => {
    expect(() =>
      Table.define({
        id: " ",
        columns: {
          id: [],
        },
      }),
    ).toThrow(TableError);
  });

  it("throws for non-array column values", () => {
    expect(() =>
      Table.define({
        id: "broken",
        columns: {
          id: "not-an-array" as unknown as readonly unknown[],
        },
      }),
    ).toThrow(TableError);
  });
});

describe("table access helpers", () => {
  it("returns column names in object key order", () => {
    expect(Table.columnNames(orders)).toEqual(["id", "status", "totalCents"]);
  });

  it("returns columns", () => {
    expect(Table.getColumn(orders, "status")).toEqual(["new", "paid", "cancelled"]);
  });

  it("returns cells", () => {
    expect(Table.getCell(orders, 1, "status")).toBe("paid");
  });

  it("rejects bad row access", () => {
    expect(() => Table.getCell(orders, 99, "status")).toThrow(TableError);
  });

  it("rejects bad column access", () => {
    expect(() => Table.getCell(orders, 0, "missing" as never)).toThrow(TableError);
  });

  it("returns object rows", () => {
    expect(Table.getRow(orders, 2)).toEqual({
      id: "order-003",
      status: "cancelled",
      totalCents: 0,
    });
  });

  it("returns rowCount", () => {
    expect(Table.rowCount(orders)).toBe(3);
  });
});

describe("table conversions", () => {
  it("converts columnar tables to row arrays", () => {
    expect(Table.toRows(orders)).toEqual([
      ["order-001", "new", 1299],
      ["order-002", "paid", 4599],
      ["order-003", "cancelled", 0],
    ]);
  });

  it("converts columnar tables to object rows", () => {
    expect(Table.toObjects(orders)).toEqual([
      { id: "order-001", status: "new", totalCents: 1299 },
      { id: "order-002", status: "paid", totalCents: 4599 },
      { id: "order-003", status: "cancelled", totalCents: 0 },
    ]);
  });

  it("builds canonical tables from row arrays", () => {
    expect(
      Table.fromRows({
        id: "orders",
        columns: ["id", "status", "totalCents"] as const,
        rows: [
          ["order-001", "new", 1299],
          ["order-002", "paid", 4599],
        ],
      }),
    ).toEqual({
      kind: "table",
      id: "orders",
      columns: {
        id: ["order-001", "order-002"],
        status: ["new", "paid"],
        totalCents: [1299, 4599],
      },
      rowCount: 2,
    });
  });

  it("rejects duplicate row-table columns", () => {
    expect(() =>
      Table.fromRows({
        id: "orders",
        columns: ["id", "id"] as const,
        rows: [["a", "b"]],
      }),
    ).toThrow(TableError);
  });

  it("rejects invalid row width", () => {
    expect(() =>
      Table.fromRows({
        id: "orders",
        columns: ["id", "status"] as const,
        rows: [["a"]],
      }),
    ).toThrow(TableError);
  });

  it("derives object-table columns from the first row", () => {
    expect(
      Table.fromObjects({
        id: "orders",
        rows: [
          { id: "order-001", status: "new" },
          { id: "order-002", status: "paid" },
        ] as const,
      }),
    ).toEqual({
      kind: "table",
      id: "orders",
      columns: {
        id: ["order-001", "order-002"],
        status: ["new", "paid"],
      },
      rowCount: 2,
    });
  });

  it("respects provided object columns order", () => {
    expect(
      Table.columnNames(
        Table.fromObjects({
          id: "orders",
          columns: ["status", "id"],
          rows: [
            { id: "order-001", status: "new" },
            { id: "order-002", status: "paid" },
          ],
        }),
      ),
    ).toEqual(["status", "id"]);
  });

  it("rejects missing object columns", () => {
    expect(() =>
      Table.fromObjects({
        id: "orders",
        rows: [{ id: "order-001" }, { id: "order-002", status: "paid" }],
      }),
    ).toThrow(TableError);
  });

  it("rejects extra object columns when columns are provided", () => {
    expect(() =>
      Table.fromObjects({
        id: "orders",
        columns: ["id", "status"],
        rows: [{ id: "order-001", status: "new", totalCents: 1299 }],
      }),
    ).toThrow(TableError);
  });

  it("roundtrips columnar -> objects -> columnar structurally", () => {
    const roundtripped = Table.fromObjects({
      id: orders.id,
      columns: Table.columnNames(orders),
      rows: Table.toObjects(orders),
    });

    expect(roundtripped).toEqual(orders);
  });
});

describe("table diagnostics", () => {
  it("returns no diagnostics for valid tables", () => {
    expect(Table.validate(orders)).toEqual([]);
  });

  it("reports column length mismatches", () => {
    const diagnostics = Table.validate({
      kind: "table",
      id: "orders",
      columns: {
        id: ["order-001", "order-002"],
        status: ["new"],
      },
      rowCount: 2,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["ColumnLengthMismatch"]);
    expect(diagnostics[0]?.path).toBe("orders.status");
  });

  it("formats diagnostics readably", () => {
    const diagnostics: readonly TableDiagnostic[] = [
      {
        severity: "error",
        code: "ColumnLengthMismatch",
        message: 'Column "status" has length 2 but expected 3.',
        tableId: "orders",
        column: "status",
        path: "orders.status",
      },
    ];

    expect(formatTableDiagnostics(diagnostics)).toBe(
      'error ColumnLengthMismatch at orders.status\n  Column "status" has length 2 but expected 3.',
    );
  });

  it("TableError includes diagnostics", () => {
    try {
      Table.fromRows({
        id: "orders",
        columns: ["id", "status"] as const,
        rows: [["order-001"]],
      });
      expect.unreachable("expected TableError");
    } catch (error) {
      expect(error).toBeInstanceOf(TableError);
      const tableError = error as TableError;
      expect(tableError.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        "InvalidRowWidth",
      ]);
    }
  });

  it("validates row-table inputs directly", () => {
    expect(
      validateRowTableInput({
        id: "orders",
        columns: ["id", "id"],
        rows: [["order-001", "order-002"]],
      }).map((diagnostic) => diagnostic.code),
    ).toEqual(["DuplicateColumnName"]);
  });

  it("validates object-row inputs directly", () => {
    expect(
      validateObjectRowsInput({
        id: "orders",
        columns: ["id", "status"],
        rows: [{ id: "order-001" }],
      }).map((diagnostic) => diagnostic.code),
    ).toEqual(["MissingObjectColumn"]);
  });
});

describe("table exports", () => {
  it("exports helpers only from the table subpath", async () => {
    const table = await import("../../src/table");

    expect(table.Table.define).toBeTypeOf("function");
    expect(table.Table.defineWithSchema).toBeTypeOf("function");
    expect(table.Table.withSchema).toBeTypeOf("function");
    expect(table.Table.fromRows).toBeTypeOf("function");
    expect(table.Table.fromObjects).toBeTypeOf("function");
    expect(table.Table.fromJsonObjects).toBeTypeOf("function");
    expect(table.Table.fromColumnarJson).toBeTypeOf("function");
    expect(table.Table.toRows).toBeTypeOf("function");
    expect(table.Table.toJsonRows).toBeTypeOf("function");
    expect(table.Table.toObjects).toBeTypeOf("function");
    expect(table.Table.toJsonObjects).toBeTypeOf("function");
    expect(table.Table.toColumnarJson).toBeTypeOf("function");
    expect(table.Table.toMarkdown).toBeTypeOf("function");
    expect(table.Table.toCsv).toBeTypeOf("function");
    expect(table.Table.describe).toBeTypeOf("function");
    expect(table.Table.describeKeyed).toBeTypeOf("function");
    expect(table.Table.preview).toBeTypeOf("function");
    expect(table.Table.getCell).toBeTypeOf("function");
    expect(table.Table.keyBy).toBeTypeOf("function");
    expect(table.Table.lookup).toBeTypeOf("function");
    expect(table.Table.requireLookup).toBeTypeOf("function");
    expect(table.Table.hasKey).toBeTypeOf("function");
    expect(table.Table.keys).toBeTypeOf("function");
    expect(table.Table.string).toBeTypeOf("function");
    expect(table.Table.number).toBeTypeOf("function");
    expect(table.Table.boolean).toBeTypeOf("function");
    expect(table.Table.enum).toBeTypeOf("function");
    expect(table.TableError).toBeTypeOf("function");
    expect("Table" in root).toBe(false);
  });

  it("exports table types and namespace shape", () => {
    const table: ColumnarTable<TableColumns> = orders;
    expect(table.kind).toBe("table");
    expect(typeof Table.define).toBe("function");
    expect(typeof Table.validate).toBe("function");
    expect(typeof Table.keyBy).toBe("function");
  });
});
