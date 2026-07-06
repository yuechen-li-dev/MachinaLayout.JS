import { describe, expect, it } from "vitest";
import type { Assert, Equal, Extends } from "../../src/concept";
import {
  type SchemaColumnarTable,
  type TableSchemaColumns,
  type TableSchemaRow,
  Table,
  TableError,
  enumColumn,
  formatTableDiagnostics,
} from "../../src/table";

const roleValues = ["admin", "member"] as const;

const userSchema = Table.schema({
  id: Table.string(),
  age: Table.number(),
  role: Table.enum(roleValues),
  active: Table.boolean(),
  note: Table.optional(Table.string()),
  exact: Table.literal("retail"),
  meta: Table.unknown(),
});

type UserRow = {
  readonly id: string;
  readonly age: number;
  readonly role: "admin" | "member";
  readonly active: boolean;
  readonly note: string | undefined;
  readonly exact: "retail";
  readonly meta: unknown;
};

type _schemaRowWorks = Assert<Equal<TableSchemaRow<typeof userSchema>, UserRow>>;
type _schemaColumnsWork = Assert<
  Extends<
    TableSchemaColumns<typeof userSchema>,
    {
      readonly id: readonly string[];
      readonly age: readonly number[];
      readonly role: readonly ("admin" | "member")[];
      readonly active: readonly boolean[];
      readonly note: readonly (string | undefined)[];
      readonly exact: readonly "retail"[];
      readonly meta: readonly unknown[];
    }
  >
>;

const users = Table.defineWithSchema({
  id: "users",
  schema: userSchema,
  columns: {
    id: ["u1", "u2"],
    age: [42, 31],
    role: ["admin", "member"],
    active: [true, false],
    note: [undefined, "vip"],
    exact: ["retail", "retail"],
    meta: [{ plan: "gold" }, ["anything"]],
  },
});

const typedObjects: readonly UserRow[] = Table.toObjects(users);
const typedRow: UserRow = Table.getRow(users, 0);
const typedCell: "admin" | "member" = Table.getCell(users, 1, "role");
void typedObjects;
void typedRow;
void typedCell;

// biome-ignore lint/correctness/noConstantCondition: compile-time type assertion block
if (false) {
  Table.defineWithSchema({
    id: "bad-users",
    schema: userSchema,
    columns: {
      id: ["u1"],
      // @ts-expect-error age must be number
      age: ["nope"],
      role: ["admin"],
      active: [true],
      note: [undefined],
      exact: ["retail"],
      meta: [null],
    },
  });
}

describe("table schema helpers", () => {
  it("create narrow primitive schemas", () => {
    expect(Table.string()).toEqual({ kind: "string" });
    expect(Table.number()).toEqual({ kind: "number" });
    expect(Table.boolean()).toEqual({ kind: "boolean" });
    expect(Table.literal(true)).toEqual({ kind: "literal", value: true });
    expect(Table.unknown()).toEqual({ kind: "unknown" });
  });

  it("create enum schemas via namespace and named export", () => {
    expect(Table.enum(roleValues)).toEqual({
      kind: "enum",
      values: ["admin", "member"],
    });
    expect(enumColumn([1, 2] as const)).toEqual({
      kind: "enum",
      values: [1, 2],
    });
  });

  it("marks optional schemas without mutating the original", () => {
    const base = Table.string();
    const optional = Table.optional(base);

    expect(base).toEqual({ kind: "string" });
    expect(optional).toEqual({ kind: "string", optional: true });
    expect(optional).not.toBe(base);
  });

  it("creates fresh validated table schemas", () => {
    const source = {
      id: Table.string(),
      role: Table.enum(roleValues),
    };

    const created = Table.schema(source);

    expect(created).toEqual({
      kind: "tableSchema",
      columns: {
        id: { kind: "string" },
        role: { kind: "enum", values: ["admin", "member"] },
      },
    });
    expect(created).not.toBe(source);
    expect(created.columns).not.toBe(source);
    expect(created.columns.role).not.toBe(source.role);
  });

  it("rejects invalid schemas and empty enums", () => {
    expect(() =>
      Table.schema({
        "": Table.string(),
      }),
    ).toThrow(TableError);

    expect(() =>
      Table.schema({
        role: Table.enum([] as const),
      }),
    ).toThrow(TableError);
  });
});

describe("defineWithSchema and withSchema", () => {
  it("creates schema tables while keeping columns canonical", () => {
    expect(users).toEqual({
      kind: "table",
      id: "users",
      columns: {
        id: ["u1", "u2"],
        age: [42, 31],
        role: ["admin", "member"],
        active: [true, false],
        note: [undefined, "vip"],
        exact: ["retail", "retail"],
        meta: [{ plan: "gold" }, ["anything"]],
      },
      rowCount: 2,
      schema: userSchema,
    });
  });

  it("accepts unknown cells and optional undefined values", () => {
    expect(Table.getCell(users, 0, "meta")).toEqual({ plan: "gold" });
    expect(Table.getCell(users, 0, "note")).toBeUndefined();
  });

  it("rejects missing schema columns", () => {
    expect(() =>
      Table.defineWithSchema({
        id: "users",
        schema: userSchema,
        columns: {
          id: ["u1"],
          age: [42],
          role: ["admin"],
          active: [true],
          note: [undefined],
          exact: ["retail"],
        } as unknown as TableSchemaColumns<typeof userSchema>,
      }),
    ).toThrow(/MissingSchemaColumn/);
  });

  it("rejects extra columns", () => {
    expect(() =>
      Table.defineWithSchema({
        id: "users",
        schema: Table.schema({
          id: Table.string(),
        }),
        columns: {
          id: ["u1"],
          extra: ["oops"],
        } as unknown as TableSchemaColumns<
          ReturnType<typeof Table.schema<{ readonly id: ReturnType<typeof Table.string> }>>
        >,
      }),
    ).toThrow(TableError);
  });

  it("rejects wrong primitive cell types with table-column-row diagnostics", () => {
    expect(() =>
      Table.defineWithSchema({
        id: "orders",
        schema: Table.schema({
          totalCents: Table.number(),
        }),
        columns: {
          totalCents: [1299, "4599"] as unknown as readonly number[],
        },
      }),
    ).toThrowError(
      'error InvalidTableCell at orders.totalCents[1]\n  Column "totalCents" expected number but received string.',
    );
  });

  it("rejects invalid enum values", () => {
    expect(() =>
      Table.defineWithSchema({
        id: "users",
        schema: Table.schema({
          role: Table.enum(roleValues),
        }),
        columns: {
          role: ["guest"] as unknown as readonly ("admin" | "member")[],
        },
      }),
    ).toThrowError(/InvalidTableEnumValue at users.role\[0\]/);
  });

  it("rejects invalid literal values", () => {
    expect(() =>
      Table.defineWithSchema({
        id: "users",
        schema: Table.schema({
          exact: Table.literal("retail"),
        }),
        columns: {
          exact: ["wholesale"] as unknown as readonly "retail"[],
        },
      }),
    ).toThrowError(/InvalidTableLiteralValue at users.exact\[0\]/);
  });

  it("rejects undefined in required columns", () => {
    expect(() =>
      Table.defineWithSchema({
        id: "users",
        schema: Table.schema({
          age: Table.number(),
        }),
        columns: {
          age: [undefined] as unknown as readonly number[],
        },
      }),
    ).toThrowError(/expected number but received undefined/);
  });

  it("attaches schemas to existing columnar tables", () => {
    const table = Table.withSchema(
      Table.fromObjects({
        id: "users",
        rows: [
          { id: "u1", age: 42, role: "admin" },
          { id: "u2", age: 31, role: "member" },
        ],
      }),
      Table.schema({
        id: Table.string(),
        age: Table.number(),
        role: Table.enum(roleValues),
      }),
    );

    const typedTable: SchemaColumnarTable<
      ReturnType<
        typeof Table.schema<{
          readonly id: ReturnType<typeof Table.string>;
          readonly age: ReturnType<typeof Table.number>;
          readonly role: ReturnType<typeof Table.enum>;
        }>
      >
    > = table;
    void typedTable;

    expect(table.schema.kind).toBe("tableSchema");
    expect(Table.toObjects(table)).toEqual([
      { id: "u1", age: 42, role: "admin" },
      { id: "u2", age: 31, role: "member" },
    ]);
  });

  it("rejects invalid existing tables in withSchema", () => {
    expect(() =>
      Table.withSchema(
        Table.define({
          id: "users",
          columns: {
            id: ["u1"],
            age: ["42"],
          },
        }),
        Table.schema({
          id: Table.string(),
          age: Table.number(),
        }),
      ),
    ).toThrowError(/InvalidTableCell at users.age\[0\]/);
  });
});

describe("schema diagnostics", () => {
  it("returns schema diagnostics from Table.validate", () => {
    const diagnostics = Table.validate({
      kind: "table",
      id: "users",
      schema: userSchema,
      columns: {
        id: ["u1"],
        age: ["bad"],
        role: ["guest"],
        active: [true],
        note: [undefined],
        exact: ["retail"],
        meta: [{}],
      },
      rowCount: 1,
    } as const);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "InvalidTableCell",
      "InvalidTableEnumValue",
    ]);
    expect(diagnostics[0]?.path).toBe("users.age[0]");
    expect(diagnostics[1]?.path).toBe("users.role[0]");
  });

  it("formats schema diagnostics with cell-oriented paths", () => {
    const formatted = formatTableDiagnostics([
      {
        severity: "error",
        code: "InvalidTableCell",
        message: 'Column "totalCents" expected number but received string.',
        tableId: "orders",
        column: "totalCents",
        row: 2,
        path: "orders.totalCents[2]",
      },
    ]);

    expect(formatted).toBe(
      'error InvalidTableCell at orders.totalCents[2]\n  Column "totalCents" expected number but received string.',
    );
  });

  it("preserves diagnostics on TableError", () => {
    try {
      Table.defineWithSchema({
        id: "users",
        schema: Table.schema({
          role: Table.enum(roleValues),
        }),
        columns: {
          role: ["guest"] as unknown as readonly ("admin" | "member")[],
        },
      });
      expect.unreachable("expected TableError");
    } catch (error) {
      expect(error).toBeInstanceOf(TableError);
      expect((error as TableError).diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        "InvalidTableEnumValue",
      ]);
    }
  });

  it("warns about duplicate enum values when validating schemas", () => {
    const diagnostics = Table.validate({
      kind: "table",
      id: "dupes",
      schema: {
        kind: "tableSchema",
        columns: {
          role: {
            kind: "enum",
            values: ["admin", "admin"],
          },
        },
      },
      columns: {
        role: ["admin"],
      },
      rowCount: 1,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("DuplicateTableEnumValue");
    expect(
      diagnostics.find((diagnostic) => diagnostic.code === "DuplicateTableEnumValue")?.severity,
    ).toBe("warning");
  });
});
