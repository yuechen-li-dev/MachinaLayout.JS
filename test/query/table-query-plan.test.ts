import { describe, expect, it } from "vitest";
import { Q, TableQueryError, type TableQueryBuilder } from "../../src/query";
import { Table, type ColumnarTable } from "../../src/table";

const orders = Table.define({
  id: "orders",
  columns: {
    id: ["order-001", "order-002", "order-003", "order-004"] as const,
    customerId: ["cust-a", "cust-b", "cust-a", "cust-c"] as const,
    status: ["new", "paid", "paid", "cancelled"] as const,
    totalCents: [1299, 4599, 2599, 0] as const,
    active: [true, true, false, false] as const,
  },
});

const schemaOrders = Table.defineWithSchema({
  id: "schemaOrders",
  schema: Table.schema({
    id: Table.string(),
    customerId: Table.string(),
    status: Table.enum(["new", "paid", "cancelled"] as const),
    totalCents: Table.number(),
    active: Table.boolean(),
  }),
  columns: {
    id: ["order-001", "order-002", "order-003", "order-004"] as const,
    customerId: ["cust-a", "cust-b", "cust-a", "cust-c"] as const,
    status: ["new", "paid", "paid", "cancelled"] as const,
    totalCents: [1299, 4599, 2599, 0] as const,
    active: [true, true, false, false] as const,
  },
});

function diagnosticCodes(plan: ReturnType<typeof Q.from>["plan"]): readonly string[] {
  return Q.validate(plan).map((diagnostic) => diagnostic.code);
}

describe("table query plans", () => {
  it("Q.from creates immutable builders and appends operations", () => {
    const base = Q.from(orders);
    const selected = base.select(["id"] as const);
    const filtered = selected.where((row) => row.id === "order-001");

    expect(base.kind).toBe("tableQueryBuilder");
    expect(base.plan.id).toBe("orders.query");
    expect(base.plan.operations).toEqual([]);
    expect(selected.plan.operations).toEqual([{ kind: "select", columns: ["id"] }]);
    expect(filtered.plan.operations.map((operation) => operation.kind)).toEqual([
      "select",
      "where",
    ]);
  });

  it("toPlan returns an explicit fresh plan record", () => {
    const builder = Q.from(orders, { id: "orders.paid.query" }).take(2);
    const first = builder.toPlan();
    const second = builder.toPlan();

    expect(first).toEqual({
      kind: "tableQueryPlan",
      id: "orders.paid.query",
      source: orders,
      operations: [{ kind: "take", count: 2 }],
    });
    expect(first).not.toBe(second);
    expect(first.operations).not.toBe(second.operations);
  });

  it("Q.plan creates function-first plans without executing", () => {
    const predicate = ({ getCell }: { readonly getCell: (column: string) => unknown }) =>
      getCell("status") === "paid";
    const queryPlan = Q.plan({
      id: "paid.query",
      source: orders,
      operations: [
        { kind: "filterRows", predicate },
        { kind: "select", columns: ["id", "totalCents"] as const },
      ],
    });

    expect(queryPlan.kind).toBe("tableQueryPlan");
    expect(queryPlan.operations).toHaveLength(2);
    expect(Table.toObjects(orders)).toHaveLength(4);
  });

  it("formats and describes plans readably", () => {
    const queryPlan = Q.from(orders)
      .where((row) => row.status === "paid")
      .select(["id", "customerId", "totalCents"] as const)
      .sortBy("totalCents", "desc")
      .take(100)
      .toPlan();

    expect(Q.formatPlan(queryPlan)).toBe(
      [
        "query orders.query from orders",
        "  0 where(row)",
        "  1 select(id, customerId, totalCents)",
        "  2 sortBy(totalCents desc)",
        "  3 take(100)",
      ].join("\n"),
    );
    expect(Q.describePlan(queryPlan)).toEqual({
      kind: "tableQueryPlanDescription",
      id: "orders.query",
      sourceTableId: "orders",
      operationCount: 4,
      operations: [
        { index: 0, kind: "where", summary: "where(row)" },
        { index: 1, kind: "select", summary: "select(id, customerId, totalCents)" },
        { index: 2, kind: "sortBy", summary: "sortBy(totalCents desc)" },
        { index: 3, kind: "take", summary: "take(100)" },
      ],
    });
  });

  it("executes where predicates over row objects", () => {
    const paid = Q.from(orders)
      .where((row) => row.status === "paid")
      .toTable();

    expect(Table.toObjects(paid)).toEqual([
      {
        id: "order-002",
        customerId: "cust-b",
        status: "paid",
        totalCents: 4599,
        active: true,
      },
      {
        id: "order-003",
        customerId: "cust-a",
        status: "paid",
        totalCents: 2599,
        active: false,
      },
    ]);
  });

  it("executes filterRows predicates with getCell", () => {
    const paid = Q.from(orders)
      .filterRows(({ getCell }) => getCell("status") === "paid" && getCell("active") === true)
      .toTable();

    expect(Table.toObjects(paid)).toEqual([
      {
        id: "order-002",
        customerId: "cust-b",
        status: "paid",
        totalCents: 4599,
        active: true,
      },
    ]);
  });

  it("executes select, sortBy, take, drop, and renameColumns", () => {
    const table = Q.from(orders)
      .select(["id", "totalCents", "status"] as const)
      .sortBy("totalCents", "desc")
      .drop(1)
      .take(2)
      .renameColumns({ totalCents: "total" })
      .toTable({ id: "summary" });

    expect(table.id).toBe("summary");
    expect(Table.columnNames(table)).toEqual(["id", "total", "status"]);
    expect(Table.toObjects(table)).toEqual([
      { id: "order-003", total: 2599, status: "paid" },
      { id: "order-001", total: 1299, status: "new" },
    ]);
    expect(Table.validate(table)).toEqual([]);
  });

  it("executes composed queries in order and does not mutate the source", () => {
    const before = Table.toObjects(orders);
    const paid = Q.from(orders)
      .where((row) => row.status === "paid")
      .select(["id", "totalCents"] as const)
      .sortBy("totalCents", "asc")
      .toTable();

    expect(Table.toObjects(paid)).toEqual([
      { id: "order-003", totalCents: 2599 },
      { id: "order-002", totalCents: 4599 },
    ]);
    expect(Table.toObjects(orders)).toEqual(before);
  });

  it("keeps output canonical and follows Table helper schema behavior", () => {
    const selected = Q.from(schemaOrders)
      .filterRows(({ getCell }) => getCell("status") === "paid")
      .select(["id", "status"] as const)
      .toTable();

    expect(selected.kind).toBe("table");
    expect("schema" in selected).toBe(true);
    expect(Table.toColumnarJson(selected)).toEqual({
      kind: "columnarTable",
      id: "schemaOrders.filter.select",
      rowCount: 2,
      columns: {
        id: ["order-002", "order-003"],
        status: ["paid", "paid"],
      },
      schema: {
        kind: "tableSchema",
        columns: {
          id: { kind: "string" },
          status: { kind: "enum", values: ["new", "paid", "cancelled"] },
        },
      },
    });
  });

  it("builder generic source table type remains intact", () => {
    const builder = Q.from(schemaOrders).where((row) => row.status === "paid");
    const typed: TableQueryBuilder<typeof schemaOrders> = builder;

    expect(typed.plan.source).toBe(schemaOrders);
  });

  it("validates invalid plan id and invalid source", () => {
    const invalidPlan = {
      kind: "tableQueryPlan",
      id: "",
      source: { kind: "table", id: "", columns: { id: ["a"], bad: [] }, rowCount: 1 },
      operations: [],
    };

    const diagnostics = Q.validate(invalidPlan as never);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "InvalidQueryPlanId",
      "InvalidQuerySource",
    ]);
  });

  it("validates predicates", () => {
    const wherePlan = Q.plan({
      source: orders,
      operations: [{ kind: "where", predicate: "nope" } as never],
    });
    const filterRowsPlan = Q.plan({
      source: orders,
      operations: [{ kind: "filterRows", predicate: undefined } as never],
    });

    expect(diagnosticCodes(wherePlan)).toContain("InvalidQueryPredicate");
    expect(diagnosticCodes(filterRowsPlan)).toContain("InvalidQueryPredicate");
  });

  it("validates select columns", () => {
    expect(
      diagnosticCodes(
        Q.plan({
          source: orders,
          operations: [{ kind: "select", columns: [] }],
        }),
      ),
    ).toContain("InvalidQuerySelectColumns");
    expect(
      diagnosticCodes(
        Q.from(orders)
          .select(["id", "missing"] as const)
          .toPlan(),
      ),
    ).toContain("MissingQuerySelectColumn");
    expect(
      diagnosticCodes(
        Q.from(orders)
          .select(["id", "id"] as const)
          .toPlan(),
      ),
    ).toContain("DuplicateQuerySelectColumn");
  });

  it("validates sort columns and directions", () => {
    const missing = Q.from(orders).sortBy("missing").toPlan();
    const invalidDirection = Q.plan({
      source: orders,
      operations: [{ kind: "sortBy", column: "id", direction: "sideways" } as never],
    });

    expect(diagnosticCodes(missing)).toContain("MissingQuerySortColumn");
    expect(diagnosticCodes(invalidDirection)).toContain("InvalidQuerySortDirection");
  });

  it("validates take/drop counts", () => {
    expect(diagnosticCodes(Q.from(orders).take(-1).toPlan())).toContain("InvalidQuerySliceCount");
    expect(diagnosticCodes(Q.from(orders).drop(1.5).toPlan())).toContain("InvalidQuerySliceCount");
  });

  it("validates rename plans", () => {
    expect(diagnosticCodes(Q.from(orders).renameColumns({ missing: "x" }).toPlan())).toContain(
      "MissingQueryRenameColumn",
    );
    expect(diagnosticCodes(Q.from(orders).renameColumns({ status: "" }).toPlan())).toContain(
      "InvalidQueryRenameTarget",
    );
    expect(diagnosticCodes(Q.from(orders).renameColumns({ status: "id" }).toPlan())).toContain(
      "DuplicateQueryRenameTarget",
    );
  });

  it("tracks columns after select and rename", () => {
    const afterSelect = Q.from(orders)
      .select(["id"] as const)
      .sortBy("totalCents")
      .toPlan();
    const afterRename = Q.from(orders)
      .renameColumns({ totalCents: "total" })
      .sortBy("totalCents")
      .toPlan();
    const renamedTarget = Q.from(orders)
      .renameColumns({ totalCents: "total" })
      .sortBy("total")
      .toPlan();

    expect(Q.validate(afterSelect)[0]).toMatchObject({
      code: "MissingQuerySortColumn",
      operationIndex: 1,
      operationKind: "sortBy",
      column: "totalCents",
      path: "orders.query.operations[1].column",
    });
    expect(diagnosticCodes(afterRename)).toContain("MissingQuerySortColumn");
    expect(Q.validate(renamedTarget)).toEqual([]);
  });

  it("throws TableQueryError on invalid execution plans", () => {
    const bad = Q.from(orders)
      .select(["id"] as const)
      .sortBy("totalCents")
      .toPlan();

    expect(() => Q.execute(bad)).toThrow(TableQueryError);
    try {
      Q.execute(bad);
      expect.unreachable("expected query execution to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TableQueryError);
      expect((error as TableQueryError).diagnostics[0]).toMatchObject({
        code: "MissingQuerySortColumn",
        operationIndex: 1,
        path: "orders.query.operations[1].column",
      });
    }
  });

  it("exports query helpers from the query subpath only", async () => {
    const query = await import("../../src/query");
    const root = await import("../../src");

    expect(query.Q.from).toBe(Q.from);
    expect(query.from).toBeTypeOf("function");
    expect(query.plan).toBeTypeOf("function");
    expect(query.execute).toBeTypeOf("function");
    expect(query.validate).toBeTypeOf("function");
    expect(query.describePlan).toBeTypeOf("function");
    expect(query.formatPlan).toBeTypeOf("function");
    expect(query.classifyQueryOperation).toBeTypeOf("function");
    expect(query.splitQueryPlanForChunks).toBeTypeOf("function");
    expect(query.executeOnChunks).toBeTypeOf("function");
    expect(query.executeOnChunkedTable).toBeTypeOf("function");
    expect(query.validateChunkQuery).toBeTypeOf("function");
    expect(query.TableQueryError).toBe(TableQueryError);
    expect("Q" in root).toBe(false);
  });

  it("accepts broadly typed ColumnarTable plans", () => {
    const source: ColumnarTable = orders;
    const table = Q.from(source).take(1).toTable();

    expect(table.rowCount).toBe(1);
  });
});
