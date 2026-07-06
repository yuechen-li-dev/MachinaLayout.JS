import { describe, expect, it } from "vitest";
import { I } from "../../src/iter";
import { Q, TableQueryError } from "../../src/query";
import { Table } from "../../src/table";

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

function clock() {
  let at = 0;
  return () => {
    at += 1;
    return at;
  };
}

describe("table query iterator runner", () => {
  it("creates a runner with an idle snapshot and created trace", () => {
    const plan = Q.from(orders).take(2).toPlan();
    const runner = Q.iterate(plan, { now: clock() });

    expect(runner.kind).toBe("tableQueryIteratorRunner");
    expect(runner.plan).toBe(plan);
    expect(runner.snapshot()).toEqual({
      kind: "tableQueryIteratorSnapshot",
      board: {
        kind: "tableQueryIteratorBoard",
        planId: "orders.query",
        sourceTableId: "orders",
        status: "idle",
        operationCount: 1,
        currentOperationIndex: 0,
        currentOperationKind: undefined,
        sourceRowCount: 4,
        inputRowCount: 4,
        outputRowCount: 4,
        acceptedRowCount: 0,
        rejectedRowCount: 0,
        emittedRowCount: 0,
        stepCount: 0,
        trace: [
          {
            kind: "created",
            planId: "orders.query",
            at: 1,
            message: "Query iterator created.",
          },
        ],
      },
    });
  });

  it("executes one operation per next and returns yield before the final operation", () => {
    const plan = Q.from(orders)
      .filterRows(({ getCell }) => getCell("status") === "paid")
      .select(["id", "totalCents"] as const)
      .sortBy("totalCents", "desc")
      .take(1)
      .toPlan();
    const runner = Q.iterate(plan, { now: clock() });

    const first = runner.next();
    expect(first.kind).toBe("yield");
    if (first.kind !== "yield") {
      expect.unreachable("expected first step to yield");
    }
    expect(first.board.status).toBe("running");
    expect(first.board.currentOperationIndex).toBe(0);
    expect(first.board.currentOperationKind).toBe("filterRows");
    expect(first.board.outputRowCount).toBe(2);
    expect(Table.toObjects(first.table)).toEqual([
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

    const second = runner.next();
    expect(second.kind).toBe("yield");
    if (second.kind !== "yield") {
      expect.unreachable("expected second step to yield");
    }
    expect(second.board.currentOperationIndex).toBe(1);
    expect(second.board.currentOperationKind).toBe("select");
    expect(Table.columnNames(second.table)).toEqual(["id", "totalCents"]);

    const third = runner.next();
    expect(third.kind).toBe("yield");
    if (third.kind !== "yield") {
      expect.unreachable("expected third step to yield");
    }
    expect(third.board.currentOperationIndex).toBe(2);
    expect(Table.toObjects(third.table)).toEqual([
      { id: "order-002", totalCents: 4599 },
      { id: "order-003", totalCents: 2599 },
    ]);

    const final = runner.next();
    expect(final.kind).toBe("done");
    if (final.kind !== "done") {
      expect.unreachable("expected final step to finish");
    }
    expect(final.board.status).toBe("done");
    expect(final.board.currentOperationIndex).toBe(4);
    expect(final.board.currentOperationKind).toBeUndefined();
    expect(Table.toObjects(final.table)).toEqual([{ id: "order-002", totalCents: 4599 }]);
    expect(runner.next()).toBe(final);
  });

  it("collect returns ok and matches eager execution without mutating the source", () => {
    const before = Table.toObjects(orders);
    const plan = Q.from(orders)
      .where((row) => row.status === "paid")
      .select(["id", "totalCents"] as const)
      .sortBy("totalCents", "asc")
      .drop(0)
      .take(2)
      .renameColumns({ totalCents: "total" })
      .toPlan();

    const result = Q.iterate(plan).collect();
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      expect.unreachable("expected collect to succeed");
    }
    expect(Table.toObjects(result.table)).toEqual(Table.toObjects(Q.execute(plan)));
    expect(Table.toObjects(result.table)).toEqual([
      { id: "order-003", total: 2599 },
      { id: "order-002", total: 4599 },
    ]);
    expect(Table.toObjects(orders)).toEqual(before);
  });

  it("handles all supported operations in order", () => {
    const plan = Q.from(orders)
      .where((row) => row.active)
      .filterRows(({ getCell }) => Number(getCell("totalCents")) > 1000)
      .select(["id", "customerId", "totalCents"] as const)
      .sortBy("totalCents", "desc")
      .drop(0)
      .take(1)
      .renameColumns({ customerId: "customer" })
      .toPlan();

    const result = Q.iterate(plan).collect();
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      expect.unreachable("expected collect to succeed");
    }
    expect(Table.toObjects(result.table)).toEqual([
      { id: "order-002", customer: "cust-b", totalCents: 4599 },
    ]);
  });

  it("tracks board counts and trace events", () => {
    const plan = Q.from(orders)
      .filterRows(({ getCell }) => getCell("status") === "paid")
      .take(1)
      .toPlan();
    const result = Q.iterate(plan, { now: clock() }).collect();

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      expect.unreachable("expected collect to succeed");
    }
    expect(result.board).toMatchObject({
      planId: "orders.query",
      sourceTableId: "orders",
      status: "done",
      operationCount: 2,
      sourceRowCount: 4,
      inputRowCount: 2,
      outputRowCount: 1,
      acceptedRowCount: 2,
      rejectedRowCount: 2,
      emittedRowCount: 1,
      stepCount: 2,
    });
    expect(result.board.trace.map((event) => event.kind)).toEqual([
      "created",
      "started",
      "operationStarted",
      "rowAccepted",
      "rowRejected",
      "operationFinished",
      "operationStarted",
      "operationFinished",
      "finished",
    ]);
  });

  it("throws TableQueryError when iterate receives an invalid plan", () => {
    const bad = Q.from(orders)
      .select(["id"] as const)
      .sortBy("totalCents")
      .toPlan();

    expect(() => Q.iterate(bad)).toThrow(TableQueryError);
  });

  it("returns fail and err results when a predicate throws", () => {
    const plan = Q.from(orders)
      .filterRows(() => {
        throw new Error("predicate exploded");
      })
      .take(1)
      .toPlan();

    const runner = Q.iterate(plan);
    const step = runner.next();
    expect(step.kind).toBe("fail");
    if (step.kind !== "fail") {
      expect.unreachable("expected next to fail");
    }
    expect(step.board.status).toBe("failed");
    expect(step.error).toBeInstanceOf(Error);
    expect(step.board.trace.map((event) => event.kind)).toContain("failed");

    const collected = Q.iterate(plan).collect();
    expect(collected.kind).toBe("err");
    if (collected.kind !== "err") {
      expect.unreachable("expected collect to return err");
    }
    expect(collected.board.status).toBe("failed");
    expect(collected.error).toBeInstanceOf(Error);
  });

  it("collect returns err when maxSteps is exceeded", () => {
    const plan = Q.from(orders).take(1).drop(0).toPlan();
    const result = Q.iterate(plan).collect({ maxSteps: 1 });

    expect(result.kind).toBe("err");
    if (result.kind !== "err") {
      expect.unreachable("expected maxSteps to fail");
    }
    expect(result.board.status).toBe("failed");
    expect(result.error).toBeInstanceOf(TableQueryError);
    expect((result.error as TableQueryError).diagnostics[0]?.code).toBe(
      "QueryIteratorMaxStepsExceeded",
    );
  });

  it("formats iterator snapshots readably", () => {
    const runner = Q.iterate(Q.from(orders).take(1).toPlan());
    runner.next();

    expect(Q.formatIteratorSnapshot(runner.snapshot())).toContain("query orders.query done");
    expect(Q.formatIteratorSnapshot(runner.snapshot())).toContain("steps: 1");
  });

  it("bridges query plans to existing iter machines", () => {
    const plan = Q.from(orders)
      .filterRows(({ getCell }) => getCell("status") === "paid")
      .select(["id"] as const)
      .toPlan();
    const machine = Q.toIterMachine(plan);
    const controller = I.createController(machine);
    const result = I.collect(controller);

    expect(machine.kind).toBe("iterMachine");
    expect(result.kind).toBe("done");
    if (result.kind !== "done") {
      expect.unreachable("expected iter machine to finish");
    }
    expect(Table.toObjects(result.value)).toEqual(Table.toObjects(Q.execute(plan)));
  });

  it("exports query iterator helpers from the query subpath only", async () => {
    const query = await import("../../src/query");
    const root = await import("../../src");

    expect(query.Q.iterate).toBe(Q.iterate);
    expect(query.iterate).toBeTypeOf("function");
    expect(query.toIterMachine).toBeTypeOf("function");
    expect(query.formatIteratorSnapshot).toBeTypeOf("function");
    expect("Q" in root).toBe(false);
  });
});
