import { describe, expect, it } from "vitest";
import { type ColumnarTableJson, type TableDescription, Table, TableError } from "../../src/table";

const orders = Table.define({
  id: "orders",
  columns: {
    id: ["order-001", "order-002", "order-003"] as const,
    status: ["new", "paid", "cancelled"] as const,
    totalCents: [1299, 4599, 0] as const,
  },
});

const ordersWithSchema = Table.defineWithSchema({
  id: "orders",
  schema: Table.schema({
    id: Table.string(),
    status: Table.enum(["new", "paid", "cancelled"] as const),
    totalCents: Table.number(),
  }),
  columns: {
    id: ["order-001", "order-002"] as const,
    status: ["new", "paid"] as const,
    totalCents: [1299, 4599] as const,
  },
});

describe("table columnar json", () => {
  it("exports canonical columnar json with kind, id, rowCount, and columns", () => {
    expect(Table.toColumnarJson(orders)).toEqual({
      kind: "columnarTable",
      id: "orders",
      rowCount: 3,
      columns: {
        id: ["order-001", "order-002", "order-003"],
        status: ["new", "paid", "cancelled"],
        totalCents: [1299, 4599, 0],
      },
    } satisfies ColumnarTableJson);
  });

  it("keeps canonical json columnar instead of exporting row objects", () => {
    const json = Table.toColumnarJson(orders) as Record<string, unknown>;

    expect(json).not.toHaveProperty("rows");
    expect(Object.values(json.columns as Record<string, unknown>)).not.toContainEqual([
      { id: "order-001", status: "new", totalCents: 1299 },
    ]);
  });

  it("roundtrips canonical columnar json back into a columnar table", () => {
    expect(Table.fromColumnarJson(Table.toColumnarJson(orders))).toEqual(orders);
  });

  it("includes schema data when available", () => {
    expect(Table.toColumnarJson(ordersWithSchema).schema).toEqual(ordersWithSchema.schema);
  });

  it("roundtrips schema tables through columnar json", () => {
    const restored = Table.fromColumnarJson(Table.toColumnarJson(ordersWithSchema));

    expect(restored).toEqual(ordersWithSchema);
  });

  it("rejects invalid json kind", () => {
    expect(() =>
      Table.fromColumnarJson({
        kind: "table",
        id: "orders",
        rowCount: 1,
        columns: {
          id: ["order-001"],
        },
      } as unknown as ColumnarTableJson),
    ).toThrowError(/InvalidColumnarJsonKind/);
  });

  it("rejects invalid rowCount", () => {
    expect(() =>
      Table.fromColumnarJson({
        kind: "columnarTable",
        id: "orders",
        rowCount: 2,
        columns: {
          id: ["order-001"],
        },
      }),
    ).toThrowError(/InvalidColumnarJsonRowCount/);
  });

  it("rejects non-array column values", () => {
    expect(() =>
      Table.fromColumnarJson({
        kind: "columnarTable",
        id: "orders",
        rowCount: 1,
        columns: {
          id: "order-001" as unknown as readonly unknown[],
        },
      }),
    ).toThrowError(/InvalidColumnValues/);
  });

  it("rejects invalid schema payloads", () => {
    expect(() =>
      Table.fromColumnarJson({
        kind: "columnarTable",
        id: "orders",
        rowCount: 1,
        columns: {
          id: ["order-001"],
        },
        schema: {
          kind: "tableSchema",
          columns: {
            id: {
              kind: "enum",
              values: [],
            },
          },
        },
      }),
    ).toThrowError(TableError);
  });
});

describe("table json object adapters", () => {
  it("exports consumer-friendly json objects separately from canonical columnar json", () => {
    expect(Table.toJsonObjects(orders)).toEqual([
      { id: "order-001", status: "new", totalCents: 1299 },
      { id: "order-002", status: "paid", totalCents: 4599 },
      { id: "order-003", status: "cancelled", totalCents: 0 },
    ]);
    expect(Table.toJsonObjects(orders)).not.toEqual(Table.toColumnarJson(orders));
  });

  it("aliases object and row adapters when requested explicitly", () => {
    expect(
      Table.fromJsonObjects({
        id: "orders",
        rows: Table.toJsonObjects(orders),
      }),
    ).toEqual(orders);
    expect(Table.toJsonRows(orders)).toEqual(Table.toRows(orders));
  });
});

describe("table markdown and csv rendering", () => {
  it("renders markdown headers, separators, and rows", () => {
    expect(Table.toMarkdown(orders)).toBe(
      [
        "| id | status | totalCents |",
        "| --- | --- | --- |",
        "| order-001 | new | 1299 |",
        "| order-002 | paid | 4599 |",
        "| order-003 | cancelled | 0 |",
      ].join("\n"),
    );
  });

  it("escapes markdown pipe characters and empties nullish cells", () => {
    const table = Table.define({
      id: "notes",
      columns: {
        id: ["n1", "n2"],
        note: ["left|right", null],
      },
    });

    expect(Table.toMarkdown(table)).toBe(
      ["| id | note |", "| --- | --- |", "| n1 | left\\|right |", "| n2 |  |"].join("\n"),
    );
  });

  it("stringifies object and array cells in markdown", () => {
    const table = Table.define({
      id: "meta",
      columns: {
        value: [{ ok: true }, ["a", "b"]],
      },
    });

    expect(Table.toMarkdown(table)).toContain('{"ok":true}');
    expect(Table.toMarkdown(table)).toContain('["a","b"]');
  });

  it("supports markdown truncation and row indexes", () => {
    expect(Table.toMarkdown(orders, { maxRows: 2, includeRowIndex: true })).toBe(
      [
        "| # | id | status | totalCents |",
        "| --- | --- | --- | --- |",
        "| 0 | order-001 | new | 1299 |",
        "| 1 | order-002 | paid | 4599 |",
        "| ... | ... | ... | ... |",
      ].join("\n"),
    );
  });

  it("renders csv headers and rows with escaping", () => {
    const table = Table.define({
      id: "csv",
      columns: {
        id: ["a", "b", "c"],
        note: ["plain", "has,comma", 'say "hi"\nnext'],
      },
    });

    expect(Table.toCsv(table)).toBe(
      ["id,note", "a,plain", 'b,"has,comma"', 'c,"say ""hi""\nnext"'].join("\n"),
    );
    expect(Table.toCsv(table, { includeHeader: false })).toBe(
      ["a,plain", 'b,"has,comma"', 'c,"say ""hi""\nnext"'].join("\n"),
    );
  });
});

describe("table describe and preview", () => {
  it("describes table shape and schema presence", () => {
    expect(Table.describe(ordersWithSchema)).toEqual({
      kind: "tableDescription",
      id: "orders",
      rowCount: 2,
      columnCount: 3,
      columns: ["id", "status", "totalCents"],
      hasSchema: true,
    } satisfies TableDescription);
  });

  it("returns preview description and markdown with default truncation", () => {
    const preview = Table.preview(orders, { maxRows: 2 });

    expect(preview.kind).toBe("tablePreview");
    expect(preview.description).toEqual(Table.describe(orders));
    expect(preview.markdown).toContain("| id | status | totalCents |");
    expect(preview.markdown).toContain("| ... | ... | ... |");
  });
});
