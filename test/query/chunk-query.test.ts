import { describe, expect, it } from "vitest";
import {
  Q,
  classifyQueryOperation,
  executeOnChunkedTable,
  executeOnChunks,
  splitQueryPlanForChunks,
} from "../../src/query";
import { Table, TableError } from "../../src/table";

const orders = Table.defineWithSchema({
  id: "orders",
  schema: Table.schema({
    id: Table.string(),
    status: Table.enum(["new", "paid", "cancelled"] as const),
    totalCents: Table.number(),
    region: Table.string(),
  }),
  columns: {
    id: ["order-001", "order-002", "order-003", "order-004", "order-005", "order-006"] as const,
    status: ["new", "paid", "paid", "cancelled", "paid", "new"] as const,
    totalCents: [1299, 4599, 2599, 0, 5099, 800] as const,
    region: ["west", "east", "west", "south", "north", "east"] as const,
  },
});

function clock() {
  let at = 0;
  return () => {
    at += 1;
    return at;
  };
}

describe("chunk query planning", () => {
  it("classifies query operations into chunk-local and global scopes", () => {
    expect(classifyQueryOperation({ kind: "where", predicate: () => true })).toBe("chunkLocal");
    expect(classifyQueryOperation({ kind: "filterRows", predicate: () => true })).toBe(
      "chunkLocal",
    );
    expect(classifyQueryOperation({ kind: "select", columns: ["id"] })).toBe("chunkLocal");
    expect(classifyQueryOperation({ kind: "renameColumns", rename: { id: "orderId" } })).toBe(
      "chunkLocal",
    );
    expect(classifyQueryOperation({ kind: "sortBy", column: "id", direction: "asc" })).toBe(
      "global",
    );
    expect(classifyQueryOperation({ kind: "take", count: 1 })).toBe("global");
    expect(classifyQueryOperation({ kind: "drop", count: 1 })).toBe("global");
  });

  it("splits plans into a chunk-local prefix and global suffix", () => {
    const plan = Q.from(orders)
      .filterRows(({ getCell }) => getCell("status") === "paid")
      .select(["id", "totalCents"] as const)
      .sortBy("totalCents", "desc")
      .take(2)
      .toPlan();

    expect(splitQueryPlanForChunks(plan)).toEqual({
      kind: "splitTableQueryPlan",
      plan,
      chunkLocalOperations: [plan.operations[0]!, plan.operations[1]!],
      globalOperations: [plan.operations[2]!, plan.operations[3]!],
      firstGlobalOperationIndex: 2,
    });
  });

  it("keeps later operations global once the first global operation appears", () => {
    const plan = Q.from(orders)
      .sortBy("totalCents", "desc")
      .select(["id", "totalCents"] as const)
      .renameColumns({ totalCents: "total" })
      .toPlan();

    const split = splitQueryPlanForChunks(plan);
    expect(split.chunkLocalOperations).toEqual([]);
    expect(split.globalOperations).toEqual(plan.operations);
    expect(split.firstGlobalOperationIndex).toBe(0);
  });
});

describe("chunk query execution", () => {
  it("executes all-local chunk queries and matches eager execution", async () => {
    const chunks = Table.chunksFromTable(orders, { chunkSize: 2 });
    const plan = Q.from(orders)
      .filterRows(({ getCell }) => getCell("status") === "paid")
      .select(["id", "totalCents"] as const)
      .renameColumns({ totalCents: "total" })
      .toPlan();

    const result = await executeOnChunks(plan, chunks, {
      concurrency: 2,
      id: "paidLocal",
      now: clock(),
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      expect.unreachable("expected chunk query to succeed");
    }
    expect(Table.toObjects(result.table)).toEqual(Table.toObjects(Q.execute(plan)));
    expect(Table.toObjects(result.table)).toEqual([
      { id: "order-002", total: 4599 },
      { id: "order-003", total: 2599 },
      { id: "order-005", total: 5099 },
    ]);
    expect(result.board).toMatchObject({
      id: "paidLocal",
      status: "succeeded",
      chunkCount: 3,
      chunkLocalOperationCount: 3,
      globalOperationCount: 0,
      scannedChunkCount: 3,
      failedChunkCount: 0,
      mergedRowCount: 3,
      outputRowCount: 3,
    });
    expect(result.board.trace.map((event) => event.kind)).toEqual([
      "created",
      "started",
      "splitPlan",
      "chunkScanStarted",
      "chunkScanSucceeded",
      "chunkScanStarted",
      "chunkScanSucceeded",
      "chunkScanStarted",
      "chunkScanSucceeded",
      "mergeStarted",
      "mergeFinished",
      "succeeded",
    ]);
    expect(result.board.batchBoard?.concurrency).toBe(2);
  });

  it("executes all-global chunk queries after merge", async () => {
    const plan = Q.from(orders).sortBy("totalCents", "desc").take(2).toPlan();
    const result = await Q.executeOnChunkedTable(
      plan,
      Table.chunkedFromTable(orders, { chunkSize: 2 }),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      expect.unreachable("expected chunk query to succeed");
    }
    expect(Table.toObjects(result.table)).toEqual(Table.toObjects(Q.execute(plan)));
    expect(Table.toObjects(result.table)).toEqual([
      { id: "order-005", status: "paid", totalCents: 5099, region: "north" },
      { id: "order-002", status: "paid", totalCents: 4599, region: "east" },
    ]);
  });

  it("executes mixed local/global chunk queries and preserves semantics", async () => {
    const plan = Q.from(orders)
      .filterRows(({ getCell }) => getCell("status") === "paid")
      .select(["id", "totalCents", "region"] as const)
      .sortBy("totalCents", "desc")
      .drop(1)
      .take(1)
      .toPlan();

    const result = await executeOnChunks(plan, Table.chunksFromTable(orders, { chunkSize: 2 }));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      expect.unreachable("expected chunk query to succeed");
    }
    expect(Table.toObjects(result.table)).toEqual(Table.toObjects(Q.execute(plan)));
    expect(Table.toObjects(result.table)).toEqual([
      { id: "order-002", totalCents: 4599, region: "east" },
    ]);
  });

  it("preserves row order across chunks before global sort and handles zero-row chunks", async () => {
    const chunks = Table.chunksFromTable(orders, { chunkSize: 2 });
    const zeroRowChunk = {
      ...chunks[1]!,
      chunkId: "orders-zero",
      rowOffset: 2,
      rowCount: 0,
      columns: {
        id: [],
        status: [],
        totalCents: [],
        region: [],
      },
    } as const;
    const replacementChunk = Table.chunkFromTable(orders, {
      chunkId: "orders-0001b",
      rowOffset: 2,
      rowCount: 2,
    });
    const shiftedFinal = Table.chunkFromTable(orders, {
      chunkId: "orders-0002b",
      rowOffset: 4,
      rowCount: 2,
    });
    const plan = Q.from(orders)
      .filterRows(({ getCell }) => getCell("status") !== "cancelled")
      .select(["id", "status"] as const)
      .toPlan();

    const result = await executeOnChunks(plan, [
      chunks[0]!,
      zeroRowChunk,
      replacementChunk,
      shiftedFinal,
    ]);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      expect.unreachable("expected chunk query to succeed");
    }
    expect(Table.toObjects(result.table)).toEqual([
      { id: "order-001", status: "new" },
      { id: "order-002", status: "paid" },
      { id: "order-003", status: "paid" },
      { id: "order-005", status: "paid" },
      { id: "order-006", status: "new" },
    ]);
  });

  it("handles empty chunked tables by deriving from the source shape", async () => {
    const empty = Table.define({
      id: "emptyOrders",
      columns: {
        id: [] as const,
        status: [] as const,
        totalCents: [] as const,
      },
    });
    const chunked = Table.chunkedFromTable(empty, { chunkSize: 2 });
    const plan = Q.from(empty)
      .select(["id", "totalCents"] as const)
      .take(5)
      .toPlan();

    const result = await executeOnChunkedTable(plan, chunked);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      expect.unreachable("expected empty chunk query to succeed");
    }
    expect(Table.columnNames(result.table)).toEqual(["id", "totalCents"]);
    expect(result.table.rowCount).toBe(0);
  });
});

describe("chunk query failures", () => {
  it("returns err for invalid query plans", async () => {
    const badPlan = Q.from(orders)
      .select(["id"] as const)
      .sortBy("totalCents")
      .toPlan();
    const result = await executeOnChunks(badPlan, Table.chunksFromTable(orders, { chunkSize: 2 }));

    expect(result.kind).toBe("err");
    if (result.kind !== "err") {
      expect.unreachable("expected invalid plan to fail");
    }
    expect(result.error).toBeInstanceOf(Error);
    expect(result.board.status).toBe("failed");
    expect(result.board.outputRowCount).toBe(0);
  });

  it("returns err for invalid chunks and manifest mismatches", async () => {
    const chunks = Table.chunksFromTable(orders, { chunkSize: 2 });
    const invalidChunk = {
      ...chunks[0]!,
      columns: {
        id: ["order-001"],
        status: ["new", "paid"],
        totalCents: [1299, 4599],
        region: ["west", "east"],
      },
    };

    const invalidChunkResult = await executeOnChunks(Q.from(orders).take(1).toPlan(), [
      invalidChunk,
    ]);
    expect(invalidChunkResult.kind).toBe("err");
    if (invalidChunkResult.kind !== "err") {
      expect.unreachable("expected invalid chunk query to fail");
    }
    expect(invalidChunkResult.error).toBeInstanceOf(TableError);

    const chunked = Table.chunkedFromTable(orders, { chunkSize: 2 });
    const mismatchedManifest = {
      ...chunked,
      manifest: {
        ...chunked.manifest,
        chunks: chunked.manifest.chunks.map((chunk, index) =>
          index === 1 ? { ...chunk, rowCount: chunk.rowCount + 1 } : chunk,
        ),
      },
    };
    const manifestResult = await executeOnChunkedTable(
      Q.from(orders).take(1).toPlan(),
      mismatchedManifest,
    );
    expect(manifestResult.kind).toBe("err");
    if (manifestResult.kind !== "err") {
      expect.unreachable("expected manifest mismatch to fail");
    }
    expect(manifestResult.error).toBeInstanceOf(TableError);
  });

  it("returns err when a predicate throws inside a chunk and does not return partial output", async () => {
    const plan = Q.from(orders)
      .filterRows(({ getCell }) => {
        if (getCell("id") === "order-003") {
          throw new Error("predicate exploded");
        }
        return true;
      })
      .toPlan();

    const result = await executeOnChunks(plan, Table.chunksFromTable(orders, { chunkSize: 2 }), {
      now: clock(),
    });

    expect(result.kind).toBe("err");
    if (result.kind !== "err") {
      expect.unreachable("expected throwing predicate to fail");
    }
    expect(result.board.status).toBe("failed");
    expect(result.board.failedChunkCount).toBe(1);
    expect(result.board.outputRowCount).toBe(0);
    expect(result.board.trace.map((event) => event.kind)).toContain("chunkScanFailed");
    expect(result.board.trace.at(-1)?.kind).toBe("failed");
  });

  it("returns err for incompatible chunk-local output shapes", async () => {
    const chunks = Table.chunksFromTable(orders, { chunkSize: 2 });
    const incompatible = {
      ...chunks[2]!,
      columns: {
        id: ["order-005", "order-006"],
        status: ["paid", "new"],
        totalCents: [5099, 800],
      },
    };

    const result = await executeOnChunks(
      Q.from(orders)
        .select(["id", "status"] as const)
        .toPlan(),
      [chunks[0]!, chunks[1]!, incompatible],
    );

    expect(result.kind).toBe("err");
    if (result.kind !== "err") {
      expect.unreachable("expected incompatible chunk columns to fail");
    }
    expect(result.board.status).toBe("failed");
  });
});
