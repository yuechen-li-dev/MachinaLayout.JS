import { Table } from "../table";
import type { ColumnarTable, TableDiagnostic } from "../table/types";
import { TableError, validateTable } from "../table/validate";
import { defineMachinaAtlas } from "./defineMachinaAtlas";
import type {
  MachinaAtlas,
  MachinaAtlasSection,
  MachinaAtlasSectionKind,
  MachinaAtlasSectionTableDescription,
} from "./types";

const machinaAtlasSectionKinds = [
  "app",
  "page",
  "screen",
  "view",
  "component",
  "layout",
  "behavior",
  "fixture",
  "data",
  "shared",
  "test",
  "other",
] as const satisfies readonly MachinaAtlasSectionKind[];

type ResolvedAtlasSectionColumns = {
  readonly key: string;
  readonly name: string;
  readonly kind: string;
  readonly route: string;
  readonly file: string;
  readonly fixture: string;
  readonly owns: string;
  readonly uses: string;
  readonly usedBy: string;
  readonly tags: string;
  readonly notes: string;
};

type OptionalAtlasStringDiagnosticCode =
  | "InvalidAtlasSectionRoute"
  | "InvalidAtlasSectionFile"
  | "InvalidAtlasSectionFixture"
  | "InvalidAtlasSectionNotes";

type AtlasArrayDiagnosticCode =
  | "InvalidAtlasSectionOwns"
  | "InvalidAtlasSectionUses"
  | "InvalidAtlasSectionUsedBy"
  | "InvalidAtlasSectionTags";

export type AtlasSectionsFromTableOptions = {
  readonly keyColumn?: string;
  readonly nameColumn?: string;
  readonly kindColumn?: string;
  readonly routeColumn?: string;
  readonly fileColumn?: string;
  readonly fixtureColumn?: string;
  readonly ownsColumn?: string;
  readonly usesColumn?: string;
  readonly usedByColumn?: string;
  readonly tagsColumn?: string;
  readonly notesColumn?: string;
};

export function resolveAtlasSectionColumns(
  options: AtlasSectionsFromTableOptions | undefined,
): ResolvedAtlasSectionColumns {
  return {
    key: options?.keyColumn ?? "key",
    name: options?.nameColumn ?? "name",
    kind: options?.kindColumn ?? "kind",
    route: options?.routeColumn ?? "route",
    file: options?.fileColumn ?? "file",
    fixture: options?.fixtureColumn ?? "fixture",
    owns: options?.ownsColumn ?? "owns",
    uses: options?.usesColumn ?? "uses",
    usedBy: options?.usedByColumn ?? "usedBy",
    tags: options?.tagsColumn ?? "tags",
    notes: options?.notesColumn ?? "notes",
  };
}

function createDiagnostic(
  table: ColumnarTable,
  diagnostic: Omit<TableDiagnostic, "severity" | "tableId" | "path">,
): TableDiagnostic {
  const { column, row } = diagnostic;
  return {
    severity: "error",
    tableId: table.id,
    path:
      row !== undefined && column !== undefined
        ? `${table.id}.${column}[${row}]`
        : column !== undefined
          ? `${table.id}.${column}`
          : row !== undefined
            ? `${table.id}[${row}]`
            : table.id,
    ...diagnostic,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateRequiredColumn(
  table: ColumnarTable,
  column: string,
  diagnostics: TableDiagnostic[],
): readonly unknown[] | undefined {
  if (Object.getOwnPropertyDescriptor(table.columns, column) === undefined) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "MissingAtlasSectionColumn",
        message: `Atlas section column "${column}" does not exist in table "${table.id}".`,
        column,
      }),
    );
    return undefined;
  }

  return table.columns[column];
}

function getOptionalColumn(table: ColumnarTable, column: string): readonly unknown[] | undefined {
  return Object.getOwnPropertyDescriptor(table.columns, column) !== undefined
    ? table.columns[column]
    : undefined;
}

function validateOptionalString(
  table: ColumnarTable,
  column: string,
  row: number,
  value: unknown,
  code: OptionalAtlasStringDiagnosticCode,
  message: string,
  diagnostics: TableDiagnostic[],
): void {
  if (value !== undefined && typeof value !== "string") {
    diagnostics.push(
      createDiagnostic(table, {
        code,
        message,
        column,
        row,
      }),
    );
  }
}

function validateStringArray(
  table: ColumnarTable,
  column: string,
  row: number,
  value: unknown,
  code: AtlasArrayDiagnosticCode,
  message: string,
  diagnostics: TableDiagnostic[],
): void {
  if (
    value !== undefined &&
    (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
  ) {
    diagnostics.push(
      createDiagnostic(table, {
        code,
        message,
        column,
        row,
      }),
    );
  }
}

function buildSection(
  row: number,
  columns: ResolvedAtlasSectionColumns,
  table: ColumnarTable,
): MachinaAtlasSection {
  const keyValues = table.columns[columns.key] ?? [];
  const nameValues = table.columns[columns.name] ?? [];
  const kindValues = table.columns[columns.kind] ?? [];
  const routeValues = table.columns[columns.route];
  const fileValues = table.columns[columns.file];
  const fixtureValues = table.columns[columns.fixture];
  const ownsValues = table.columns[columns.owns];
  const usesValues = table.columns[columns.uses];
  const usedByValues = table.columns[columns.usedBy];
  const tagsValues = table.columns[columns.tags];
  const notesValues = table.columns[columns.notes];

  return {
    key: keyValues[row] as string,
    name: nameValues[row] as string,
    kind: kindValues[row] as MachinaAtlasSectionKind,
    ...(routeValues?.[row] === undefined ? {} : { route: routeValues[row] as string }),
    ...(fileValues?.[row] === undefined ? {} : { file: fileValues[row] as string }),
    ...(fixtureValues?.[row] === undefined ? {} : { fixture: fixtureValues[row] as string }),
    owns: ((ownsValues?.[row] as readonly string[] | undefined) ?? []).slice(),
    uses: ((usesValues?.[row] as readonly string[] | undefined) ?? []).slice(),
    usedBy: ((usedByValues?.[row] as readonly string[] | undefined) ?? []).slice(),
    tags: ((tagsValues?.[row] as readonly string[] | undefined) ?? []).slice(),
    ...(notesValues?.[row] === undefined ? {} : { notes: notesValues[row] as string }),
  };
}

export function sectionTableSchema() {
  return Table.schema({
    key: Table.string(),
    name: Table.string(),
    kind: Table.enum(machinaAtlasSectionKinds),
    route: Table.optional(Table.string()),
    file: Table.optional(Table.string()),
    fixture: Table.optional(Table.string()),
    owns: Table.optional(Table.unknown()),
    uses: Table.optional(Table.unknown()),
    usedBy: Table.optional(Table.unknown()),
    tags: Table.optional(Table.unknown()),
    notes: Table.optional(Table.string()),
  });
}

export function validateAtlasSectionTable(
  table: ColumnarTable,
  options?: AtlasSectionsFromTableOptions,
): TableDiagnostic[] {
  const columns = resolveAtlasSectionColumns(options);
  const diagnostics = [...validateTable(table)];

  const keyValues = validateRequiredColumn(table, columns.key, diagnostics);
  const nameValues = validateRequiredColumn(table, columns.name, diagnostics);
  const kindValues = validateRequiredColumn(table, columns.kind, diagnostics);

  const routeValues = getOptionalColumn(table, columns.route);
  const fileValues = getOptionalColumn(table, columns.file);
  const fixtureValues = getOptionalColumn(table, columns.fixture);
  const ownsValues = getOptionalColumn(table, columns.owns);
  const usesValues = getOptionalColumn(table, columns.uses);
  const usedByValues = getOptionalColumn(table, columns.usedBy);
  const tagsValues = getOptionalColumn(table, columns.tags);
  const notesValues = getOptionalColumn(table, columns.notes);

  if (keyValues === undefined || nameValues === undefined || kindValues === undefined) {
    return diagnostics;
  }

  const seenKeys = new Map<string, number>();

  for (let row = 0; row < table.rowCount; row += 1) {
    const key = keyValues[row];
    const name = nameValues[row];
    const kind = kindValues[row];

    if (!isNonEmptyString(key)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidAtlasSectionKey",
          message: "Atlas section key must be a non-empty string.",
          column: columns.key,
          row,
        }),
      );
    } else {
      const firstRow = seenKeys.get(key);
      if (firstRow !== undefined) {
        diagnostics.push(
          createDiagnostic(table, {
            code: "DuplicateAtlasSectionKey",
            message: `Atlas section key ${JSON.stringify(key)} already appears at row ${firstRow}.`,
            column: columns.key,
            row,
          }),
        );
      } else {
        seenKeys.set(key, row);
      }
    }

    if (!isNonEmptyString(name)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidAtlasSectionName",
          message: "Atlas section name must be a non-empty string.",
          column: columns.name,
          row,
        }),
      );
    }

    if (
      !isNonEmptyString(kind) ||
      !machinaAtlasSectionKinds.some((candidate) => candidate === kind)
    ) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidAtlasSectionKind",
          message: `Atlas section kind must be one of ${machinaAtlasSectionKinds.join(", ")}.`,
          column: columns.kind,
          row,
        }),
      );
    }

    validateOptionalString(
      table,
      columns.route,
      row,
      routeValues?.[row],
      "InvalidAtlasSectionRoute",
      "Atlas section route must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.file,
      row,
      fileValues?.[row],
      "InvalidAtlasSectionFile",
      "Atlas section file must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.fixture,
      row,
      fixtureValues?.[row],
      "InvalidAtlasSectionFixture",
      "Atlas section fixture must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.notes,
      row,
      notesValues?.[row],
      "InvalidAtlasSectionNotes",
      "Atlas section notes must be a string when provided.",
      diagnostics,
    );

    validateStringArray(
      table,
      columns.owns,
      row,
      ownsValues?.[row],
      "InvalidAtlasSectionOwns",
      `Atlas section ${isNonEmptyString(key) ? JSON.stringify(key) : `at row ${row}`} owns value must be an array of strings.`,
      diagnostics,
    );
    validateStringArray(
      table,
      columns.uses,
      row,
      usesValues?.[row],
      "InvalidAtlasSectionUses",
      `Atlas section ${isNonEmptyString(key) ? JSON.stringify(key) : `at row ${row}`} uses value must be an array of strings.`,
      diagnostics,
    );
    validateStringArray(
      table,
      columns.usedBy,
      row,
      usedByValues?.[row],
      "InvalidAtlasSectionUsedBy",
      `Atlas section ${isNonEmptyString(key) ? JSON.stringify(key) : `at row ${row}`} usedBy value must be an array of strings.`,
      diagnostics,
    );
    validateStringArray(
      table,
      columns.tags,
      row,
      tagsValues?.[row],
      "InvalidAtlasSectionTags",
      `Atlas section ${isNonEmptyString(key) ? JSON.stringify(key) : `at row ${row}`} tags value must be an array of strings.`,
      diagnostics,
    );
  }

  return diagnostics;
}

export function sectionsFromTable(
  table: ColumnarTable,
  options?: AtlasSectionsFromTableOptions,
): readonly MachinaAtlasSection[] {
  const diagnostics = validateAtlasSectionTable(table, options);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  const columns = resolveAtlasSectionColumns(options);
  const sections: MachinaAtlasSection[] = [];
  for (let row = 0; row < table.rowCount; row += 1) {
    sections.push(buildSection(row, columns, table));
  }
  return sections;
}

export function defineMachinaAtlasFromTable(input: {
  readonly app: string;
  readonly sections: ColumnarTable;
  readonly options?: AtlasSectionsFromTableOptions;
  readonly tags?: readonly string[];
  readonly notes?: string;
  readonly metadata?: Record<string, unknown>;
}): MachinaAtlas {
  return defineMachinaAtlas({
    app: input.app,
    sections: sectionsFromTable(input.sections, input.options),
    tags: input.tags,
    notes: input.notes,
    metadata: input.metadata,
  });
}

export function defineAtlasFromTable(input: {
  readonly app: string;
  readonly sections: ColumnarTable;
  readonly options?: AtlasSectionsFromTableOptions;
  readonly tags?: readonly string[];
  readonly notes?: string;
  readonly metadata?: Record<string, unknown>;
}): MachinaAtlas {
  return defineMachinaAtlasFromTable(input);
}

export function describeAtlasSections(
  sections: readonly MachinaAtlasSection[],
  tableId = "",
): MachinaAtlasSectionTableDescription {
  const kinds = Array.from(
    new Set(
      sections
        .map((section) => section.kind)
        .filter((kind): kind is MachinaAtlasSectionKind => kind !== undefined),
    ),
  );
  const tags = new Set<string>();
  for (const section of sections) {
    for (const tag of section.tags ?? []) {
      tags.add(tag);
    }
  }
  return {
    kind: "atlasSectionTableDescription",
    tableId,
    sectionCount: sections.length,
    kinds,
    tagCount: tags.size,
  };
}

export const Atlas = {
  sectionTableSchema,
  sectionsFromTable,
  validateAtlasSectionTable,
  defineAtlasFromTable,
  defineMachinaAtlasFromTable,
  describeAtlasSections,
} as const;
