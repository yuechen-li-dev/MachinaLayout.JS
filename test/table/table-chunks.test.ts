import { describe, expect, it } from "vitest";
import {
  type ColumnarTableChunk,
  type ColumnarTableManifest,
  type ColumnarTableManifestDescription,
  Table,
  TableError,
} from "../../src/table";

const orders = Table.defineWithSchema({
  id: "orders",
  schema: Table.schema({
    id: Table.string(),
    status: Table.enum(["new", "paid", "cancelled"] as const),
    totalCents: Table.number(),
  }),
  columns: {
    id: ["order-001", "order-002", "order-003", "order-004", "order-005"] as const,
    status: ["new", "paid", "cancelled", "paid", "new"] as const,
    totalCents: [1299, 4599, 0, 999, 1499] as const,
  },
});

describe("table chunk creation", () => {
  it("splits a table into deterministic columnar chunks", () => {
    const chunks = Table.chunksFromTable(orders, { chunkSize: 2 });

    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => chunk.chunkId)).toEqual([
      "orders-0000",
      "orders-0001",
      "orders-0002",
    ]);
    expect(chunks.map((chunk) => chunk.rowOffset)).toEqual([0, 2, 4]);
    expect(chunks.map((chunk) => chunk.rowCount)).toEqual([2, 2, 1]);
    expect(chunks[2]?.columns.id).toEqual(["order-005"]);
    expect(chunks[0]).not.toHaveProperty("rows");
    expect(chunks[0]?.columns).toEqual({
      id: ["order-001", "order-002"],
      status: ["new", "paid"],
      totalCents: [1299, 4599],
    });
  });

  it("returns zero chunks for an empty table", () => {
    const empty = Table.define({
      id: "emptyOrders",
      columns: {
        id: [] as const,
        status: [] as const,
      },
    });

    expect(Table.chunksFromTable(empty, { chunkSize: 1000 })).toEqual([]);
  });

  it("supports custom chunk id prefixes and omits schema when requested", () => {
    const chunks = Table.chunksFromTable(orders, {
      chunkSize: 3,
      chunkIdPrefix: "orders-slice",
      includeSchema: false,
    });

    expect(chunks.map((chunk) => chunk.chunkId)).toEqual([
      "orders-slice-0000",
      "orders-slice-0001",
    ]);
    expect(chunks.every((chunk) => chunk.schema === undefined)).toBe(true);
  });

  it("throws for invalid chunk size", () => {
    expect(() => Table.chunksFromTable(orders, { chunkSize: 0 })).toThrow(TableError);
  });
});

describe("table chunk manifests", () => {
  it("creates a manifest from chunks with ordered columns and optional hrefs", () => {
    const chunks = Table.chunksFromTable(orders, { chunkSize: 2 });
    const manifest = Table.manifestFromChunks("orders", chunks, {
      hrefForChunk: (chunk) => `${chunk.chunkId}.json`,
    });

    expect(manifest).toEqual({
      kind: "columnarTableManifest",
      tableId: "orders",
      rowCount: 5,
      columnNames: ["id", "status", "totalCents"],
      chunks: [
        {
          chunkId: "orders-0000",
          href: "orders-0000.json",
          rowOffset: 0,
          rowCount: 2,
        },
        {
          chunkId: "orders-0001",
          href: "orders-0001.json",
          rowOffset: 2,
          rowCount: 2,
        },
        {
          chunkId: "orders-0002",
          href: "orders-0002.json",
          rowOffset: 4,
          rowCount: 1,
        },
      ],
      schema: orders.schema,
    } satisfies ColumnarTableManifest);
  });

  it("supports valid empty manifests for empty chunks", () => {
    const manifest = Table.manifestFromChunks("emptyOrders", []);

    expect(manifest).toEqual({
      kind: "columnarTableManifest",
      tableId: "emptyOrders",
      rowCount: 0,
      columnNames: [],
      chunks: [],
    });
    expect(Table.validateManifest(manifest)).toEqual([]);
  });

  it("returns chunked tables with manifest and chunks", () => {
    const chunked = Table.chunkedFromTable(orders, {
      chunkSize: 2,
      hrefForChunk: (chunk) => `${chunk.chunkId}.json`,
    });

    expect(chunked.kind).toBe("chunkedColumnarTable");
    expect(chunked.manifest.columnNames).toEqual(["id", "status", "totalCents"]);
    expect(chunked.manifest.schema).toEqual(orders.schema);
    expect(chunked.chunks).toHaveLength(3);
  });
});

describe("table restoration from chunks", () => {
  it("restores the original table from chunks", () => {
    const chunks = Table.chunksFromTable(orders, { chunkSize: 2 });

    expect(
      Table.tableFromChunks(chunks, { manifest: Table.manifestFromChunks("orders", chunks) }),
    ).toEqual(orders);
  });

  it("sorts chunks by rowOffset before restoring", () => {
    const chunks = Table.chunksFromTable(orders, { chunkSize: 2 });

    expect(Table.tableFromChunks([chunks[2]!, chunks[0]!, chunks[1]!])).toEqual(orders);
  });

  it("rejects overlapping chunks", () => {
    const chunkA = Table.chunkFromTable(orders, {
      chunkId: "orders-0000",
      rowOffset: 0,
      rowCount: 3,
    });
    const chunkB = Table.chunkFromTable(orders, {
      chunkId: "orders-0001",
      rowOffset: 2,
      rowCount: 2,
    });

    expect(() => Table.tableFromChunks([chunkA, chunkB])).toThrowError(/OverlappingManifestChunks/);
  });

  it("rejects gaps when a manifest is provided", () => {
    const chunks = [
      Table.chunkFromTable(orders, { chunkId: "orders-0000", rowOffset: 0, rowCount: 2 }),
      Table.chunkFromTable(orders, { chunkId: "orders-0001", rowOffset: 3, rowCount: 2 }),
    ] as const;
    const manifest = {
      kind: "columnarTableManifest",
      tableId: "orders",
      rowCount: 4,
      columnNames: ["id", "status", "totalCents"],
      chunks: [
        { chunkId: "orders-0000", rowOffset: 0, rowCount: 2 },
        { chunkId: "orders-0001", rowOffset: 3, rowCount: 2 },
      ],
    } as const satisfies ColumnarTableManifest;

    expect(() => Table.tableFromChunks(chunks, { manifest })).toThrowError(
      /NonContiguousManifestChunks/,
    );
  });

  it("rejects inconsistent columns", () => {
    const chunks = Table.chunksFromTable(orders, { chunkSize: 2 });
    const mismatched: ColumnarTableChunk = {
      ...chunks[1]!,
      columns: {
        id: ["order-003", "order-004"],
        totalCents: [0, 999],
      },
    };

    expect(() => Table.tableFromChunks([chunks[0]!, mismatched, chunks[2]!])).toThrowError(
      /ManifestChunkColumnMismatch/,
    );
  });

  it("rejects manifest mismatches", () => {
    const chunks = Table.chunksFromTable(orders, { chunkSize: 2 });
    const manifest = {
      ...Table.manifestFromChunks("orders", chunks),
      chunks: [
        { chunkId: "orders-0000", rowOffset: 0, rowCount: 2 },
        { chunkId: "orders-0001", rowOffset: 2, rowCount: 1 },
        { chunkId: "orders-0002", rowOffset: 4, rowCount: 1 },
      ],
    } satisfies ColumnarTableManifest;

    expect(() => Table.tableFromChunks(chunks, { manifest })).toThrowError(
      /ManifestChunkRowCountMismatch/,
    );
  });

  it("does not mutate source tables or chunk inputs", () => {
    const sourceSnapshot = Table.toColumnarJson(orders);
    const chunks = Table.chunksFromTable(orders, { chunkSize: 2 });
    const chunkSnapshot = chunks.map((chunk) => Table.toChunkJson(chunk));

    Table.tableFromChunks(chunks, { manifest: Table.manifestFromChunks("orders", chunks) });

    expect(Table.toColumnarJson(orders)).toEqual(sourceSnapshot);
    expect(chunks.map((chunk) => Table.toChunkJson(chunk))).toEqual(chunkSnapshot);
  });
});

describe("table chunk json helpers", () => {
  it("preserves canonical columnar chunk json", () => {
    const chunk = Table.chunksFromTable(orders, { chunkSize: 2 })[0]!;
    const json = Table.toChunkJson(chunk);

    expect(json.columns).toEqual({
      id: ["order-001", "order-002"],
      status: ["new", "paid"],
      totalCents: [1299, 4599],
    });
    expect(json).not.toHaveProperty("rows");
  });

  it("accepts valid chunk json objects", () => {
    const chunk = Table.chunksFromTable(orders, { chunkSize: 2 })[0]!;

    expect(Table.fromChunkJson(Table.toChunkJson(chunk))).toEqual(chunk);
  });

  it("rejects chunk json rows fields", () => {
    expect(() =>
      Table.fromChunkJson({
        kind: "columnarTableChunk",
        tableId: "orders",
        chunkId: "orders-0000",
        rowOffset: 0,
        rowCount: 1,
        rows: [{ id: "order-001" }],
        columns: {
          id: ["order-001"],
        },
      }),
    ).toThrowError(/InvalidChunkRowsField/);
  });

  it("returns manifest json and restores it", () => {
    const manifest = Table.chunkedFromTable(orders, { chunkSize: 2 }).manifest;

    expect(Table.fromManifestJson(Table.toManifestJson(manifest))).toEqual(manifest);
  });

  it("rejects invalid chunk and manifest kinds", () => {
    expect(() =>
      Table.fromChunkJson({
        kind: "notAChunk",
        tableId: "orders",
        chunkId: "orders-0000",
        rowOffset: 0,
        rowCount: 1,
        columns: { id: ["order-001"] },
      }),
    ).toThrowError(/InvalidChunkKind/);

    expect(() =>
      Table.fromManifestJson({
        kind: "notAManifest",
        tableId: "orders",
        rowCount: 1,
        columnNames: ["id"],
        chunks: [{ chunkId: "orders-0000", rowOffset: 0, rowCount: 1 }],
      }),
    ).toThrowError(/InvalidManifestKind/);
  });
});

describe("table chunk validation", () => {
  it("reports invalid column lengths", () => {
    const diagnostics = Table.validateChunk({
      kind: "columnarTableChunk",
      tableId: "orders",
      chunkId: "orders-0000",
      rowOffset: 0,
      rowCount: 2,
      columns: {
        id: ["order-001"],
      },
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("InvalidChunkColumnLength");
  });

  it("reports duplicate manifest column names", () => {
    const diagnostics = Table.validateManifest({
      kind: "columnarTableManifest",
      tableId: "orders",
      rowCount: 1,
      columnNames: ["id", "id"],
      chunks: [{ chunkId: "orders-0000", rowOffset: 0, rowCount: 1 }],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "DuplicateManifestColumnName",
    );
  });

  it("reports non-contiguous manifest chunks", () => {
    const diagnostics = Table.validateManifest({
      kind: "columnarTableManifest",
      tableId: "orders",
      rowCount: 2,
      columnNames: ["id"],
      chunks: [
        { chunkId: "orders-0000", rowOffset: 0, rowCount: 1 },
        { chunkId: "orders-0001", rowOffset: 2, rowCount: 1 },
      ],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "NonContiguousManifestChunks",
    );
  });

  it("reports missing and extra chunks against a manifest", () => {
    const chunks = Table.chunksFromTable(orders, { chunkSize: 2 });
    const manifest = Table.manifestFromChunks("orders", chunks);

    const missing = Table.validateChunksAgainstManifest(manifest, [chunks[0]!, chunks[1]!]);
    expect(missing.map((diagnostic) => diagnostic.code)).toContain("MissingManifestChunk");

    const extraChunk: ColumnarTableChunk = {
      kind: "columnarTableChunk",
      tableId: "orders",
      chunkId: "orders-extra",
      rowOffset: 5,
      rowCount: 0,
      columns: {
        id: [],
        status: [],
        totalCents: [],
      },
    };
    const extra = Table.validateChunksAgainstManifest(manifest, [...chunks, extraChunk]);
    expect(extra.map((diagnostic) => diagnostic.code)).toContain("ExtraManifestChunk");
  });

  it("includes useful diagnostic paths", () => {
    const diagnostics = Table.validateChunk({
      kind: "columnarTableChunk",
      tableId: "orders",
      chunkId: "orders-0000",
      rowOffset: 0,
      rowCount: 2,
      columns: {
        status: ["new"],
      },
    });

    expect(diagnostics[0]?.path).toBe("orders.orders-0000.columns.status");
  });
});

describe("table chunk description helpers", () => {
  it("describes chunks, manifests, chunked tables, and previews", () => {
    const chunked = Table.chunkedFromTable(orders, { chunkSize: 2 });
    const chunkDescription = Table.describeChunk(chunked.chunks[0]!);
    const manifestDescription = Table.describeManifest(chunked.manifest);
    const chunkedDescription = Table.describeChunkedTable(chunked);
    const preview = Table.previewChunk(chunked.chunks[0]!, { maxRows: 1 });

    expect(chunkDescription).toEqual({
      kind: "columnarTableChunkDescription",
      tableId: "orders",
      chunkId: "orders-0000",
      rowOffset: 0,
      rowCount: 2,
      columnCount: 3,
      columns: ["id", "status", "totalCents"],
    });

    expect(manifestDescription).toEqual({
      kind: "columnarTableManifestDescription",
      tableId: "orders",
      rowCount: 5,
      chunkCount: 3,
      columnCount: 3,
      columns: ["id", "status", "totalCents"],
    } satisfies ColumnarTableManifestDescription);

    expect(chunkedDescription).toEqual(manifestDescription);
    expect(preview.description.id).toBe("orders");
    expect(preview.markdown).toContain("| id | status | totalCents |");
  });
});
