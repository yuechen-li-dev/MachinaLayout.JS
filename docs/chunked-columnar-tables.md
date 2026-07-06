# Chunked columnar tables

M36c adds pure chunked columnar JSON table artifacts to `machinalayout/table`.

Chunked columnar tables are pure JSON-compatible storage records. M36c does not read files, write files, fetch URLs, or provide database transactions.

Core ideas:

- chunks are storage records
- tables are runtime records
- queries derive tables
- canonical chunk JSON stays columnar
- row-object JSON is an adapter shape, not chunk storage

## Record shapes

Chunks store explicit column slices:

```json
{
  "kind": "columnarTableChunk",
  "tableId": "orders",
  "chunkId": "orders-0000",
  "rowOffset": 0,
  "rowCount": 2,
  "columns": {
    "id": ["order-001", "order-002"],
    "status": ["paid", "new"],
    "totalCents": [1299, 4599]
  }
}
```

Canonical chunks do not store row objects:

```json
{
  "rows": [
    { "id": "order-001", "status": "paid" }
  ]
}
```

That row-object shape is intentionally invalid for canonical chunk records.

Manifests describe chunk layout without embedding all chunk data:

```json
{
  "kind": "columnarTableManifest",
  "tableId": "orders",
  "rowCount": 2000,
  "columnNames": ["id", "status", "totalCents"],
  "chunks": [
    {
      "chunkId": "orders-0000",
      "href": "orders-0000.json",
      "rowOffset": 0,
      "rowCount": 1000
    },
    {
      "chunkId": "orders-0001",
      "href": "orders-0001.json",
      "rowOffset": 1000,
      "rowCount": 1000
    }
  ]
}
```

`href` is metadata only in M36c. The package does not load it.

## Creating chunk artifacts

```ts
import { Table } from "machinalayout/table";

const chunked = Table.chunkedFromTable(orders, {
  chunkSize: 1000,
  hrefForChunk: (chunk) => `${chunk.chunkId}.json`,
});
```

`Table.chunksFromTable(table, { chunkSize })` creates deterministic chunk ids such as `orders-0000`, `orders-0001`, and so on. Empty tables produce zero chunks.

## JSON export

```ts
const manifestJson = Table.toManifestJson(chunked.manifest);
const chunkJson = Table.toChunkJson(chunked.chunks[0]);

JSON.stringify(manifestJson);
JSON.stringify(chunkJson);
```

These helpers return plain JSON-compatible records. They do not parse strings and they do not stringify for you.

## Restoring tables

```ts
const restored = Table.tableFromChunks(chunked.chunks, {
  manifest: chunked.manifest,
});
```

Restoration sorts by `rowOffset`, rejects overlaps, validates manifest agreement, and rebuilds a canonical `ColumnarTable`.

## Boundaries

M36c stays intentionally narrow:

- no filesystem loading
- no S3, GCS, R2, or local-file adapters
- no persistence API
- no indexes
- no transactions
- no query optimizer
- no SQL or parser
- no async chunk scans

Chunk records are inspectable storage artifacts, not a database engine.
