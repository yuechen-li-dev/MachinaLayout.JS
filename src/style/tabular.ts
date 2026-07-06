import { Table } from "../table";
import type { ColumnarTable, TableDiagnostic, TableSchema } from "../table/types";
import { TableError, validateTable } from "../table/validate";
import type {
  MachinaStyleSheet,
  StyleRuleRecord,
  StyleRuleTableDescription,
  StyleRulesFromTableOptions,
  StyleSheetFromTablesOptions,
  StyleTokenRecord,
  StyleTokenTableDescription,
  StyleTokensFromTableOptions,
} from "./types";

const DEFAULT_STYLE_THEME_COLUMNS = ["light", "dark"] as const;

type ResolvedStyleTokenColumns = {
  readonly token: string;
  readonly themeColumns: readonly string[];
  readonly description: string;
};

type ResolvedStyleRuleColumns = {
  readonly selector: string;
  readonly property: string;
  readonly value: string;
  readonly state: string;
  readonly breakpoint: string;
  readonly description: string;
};

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

function resolveTokenColumns(
  options: StyleTokensFromTableOptions | undefined,
): ResolvedStyleTokenColumns {
  return {
    token: options?.tokenColumn ?? "token",
    themeColumns: options?.themeColumns ?? DEFAULT_STYLE_THEME_COLUMNS,
    description: options?.descriptionColumn ?? "description",
  };
}

function resolveRuleColumns(
  options: StyleRulesFromTableOptions | undefined,
): ResolvedStyleRuleColumns {
  return {
    selector: options?.selectorColumn ?? "selector",
    property: options?.propertyColumn ?? "property",
    value: options?.valueColumn ?? "value",
    state: options?.stateColumn ?? "state",
    breakpoint: options?.breakpointColumn ?? "breakpoint",
    description: options?.descriptionColumn ?? "description",
  };
}

function validateRequiredColumn(
  table: ColumnarTable,
  column: string,
  missingCode: "MissingStyleTokenColumn" | "MissingStyleThemeColumn" | "MissingStyleRuleColumn",
  label: string,
  diagnostics: TableDiagnostic[],
): readonly unknown[] | undefined {
  if (Object.getOwnPropertyDescriptor(table.columns, column) === undefined) {
    diagnostics.push(
      createDiagnostic(table, {
        code: missingCode,
        message: `${label} column "${column}" does not exist in table "${table.id}".`,
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
  code:
    | "InvalidStyleTokenDescription"
    | "InvalidStyleState"
    | "InvalidStyleBreakpoint"
    | "InvalidStyleRuleDescription",
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

function uniqueThemes(tokens: readonly StyleTokenRecord[]): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const token of tokens) {
    for (const theme of Object.keys(token.values)) {
      if (seen.has(theme)) {
        continue;
      }
      seen.add(theme);
      ordered.push(theme);
    }
  }
  return ordered;
}

export function tokenTableSchema<
  const TThemes extends readonly string[] = typeof DEFAULT_STYLE_THEME_COLUMNS,
>(themes: TThemes = DEFAULT_STYLE_THEME_COLUMNS as unknown as TThemes): TableSchema {
  const columns: Record<
    string,
    ReturnType<typeof Table.string> | ReturnType<typeof Table.optional>
  > = {
    token: Table.string(),
    description: Table.optional(Table.string()),
  };

  for (const theme of themes) {
    columns[theme] = Table.string();
  }

  return Table.schema(columns);
}

export function ruleTableSchema(): TableSchema {
  return Table.schema({
    selector: Table.string(),
    property: Table.string(),
    value: Table.string(),
    state: Table.optional(Table.string()),
    breakpoint: Table.optional(Table.string()),
    description: Table.optional(Table.string()),
  });
}

export function validateStyleTokenTable(
  table: ColumnarTable,
  options?: StyleTokensFromTableOptions,
): TableDiagnostic[] {
  const columns = resolveTokenColumns(options);
  const diagnostics = [...validateTable(table)];

  const tokenValues = validateRequiredColumn(
    table,
    columns.token,
    "MissingStyleTokenColumn",
    "Style token",
    diagnostics,
  );
  const themeValues = new Map<string, readonly unknown[]>();
  for (const themeColumn of columns.themeColumns) {
    const values = validateRequiredColumn(
      table,
      themeColumn,
      "MissingStyleThemeColumn",
      "Style theme",
      diagnostics,
    );
    if (values !== undefined) {
      themeValues.set(themeColumn, values);
    }
  }
  const descriptionValues = getOptionalColumn(table, columns.description);

  if (tokenValues === undefined || themeValues.size !== columns.themeColumns.length) {
    return diagnostics;
  }

  const seenTokens = new Map<string, number>();

  for (let row = 0; row < table.rowCount; row += 1) {
    const token = tokenValues[row];
    if (!isNonEmptyString(token)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidStyleTokenName",
          message: "Style token name must be a non-empty string.",
          column: columns.token,
          row,
        }),
      );
    } else {
      const firstRow = seenTokens.get(token);
      if (firstRow !== undefined) {
        diagnostics.push(
          createDiagnostic(table, {
            code: "DuplicateStyleToken",
            message: `Style token ${JSON.stringify(token)} already appears at row ${firstRow}.`,
            column: columns.token,
            row,
          }),
        );
      } else {
        seenTokens.set(token, row);
      }
    }

    for (const themeColumn of columns.themeColumns) {
      const value = themeValues.get(themeColumn)?.[row];
      if (!isNonEmptyString(value)) {
        diagnostics.push(
          createDiagnostic(table, {
            code: "InvalidStyleTokenValue",
            message: `Style token value for theme "${themeColumn}" must be a non-empty string.`,
            column: themeColumn,
            row,
          }),
        );
      }
    }

    validateOptionalString(
      table,
      columns.description,
      row,
      descriptionValues?.[row],
      "InvalidStyleTokenDescription",
      "Style token description must be a string when provided.",
      diagnostics,
    );
  }

  return diagnostics;
}

export function tokensFromTable(
  table: ColumnarTable,
  options?: StyleTokensFromTableOptions,
): readonly StyleTokenRecord[] {
  const diagnostics = validateStyleTokenTable(table, options);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  const columns = resolveTokenColumns(options);
  const tokenValues = table.columns[columns.token] ?? [];
  const descriptionValues = table.columns[columns.description];

  const tokens: StyleTokenRecord[] = [];
  for (let row = 0; row < table.rowCount; row += 1) {
    const values = Object.fromEntries(
      columns.themeColumns.map((themeColumn) => [
        themeColumn,
        table.columns[themeColumn]![row] as string,
      ]),
    );
    tokens.push({
      kind: "styleToken",
      token: tokenValues[row] as string,
      values,
      ...(descriptionValues?.[row] === undefined
        ? {}
        : { description: descriptionValues[row] as string }),
    });
  }

  return tokens;
}

export function validateStyleRuleTable(
  table: ColumnarTable,
  options?: StyleRulesFromTableOptions,
): TableDiagnostic[] {
  const columns = resolveRuleColumns(options);
  const diagnostics = [...validateTable(table)];

  const selectorValues = validateRequiredColumn(
    table,
    columns.selector,
    "MissingStyleRuleColumn",
    "Style rule",
    diagnostics,
  );
  const propertyValues = validateRequiredColumn(
    table,
    columns.property,
    "MissingStyleRuleColumn",
    "Style rule",
    diagnostics,
  );
  const valueValues = validateRequiredColumn(
    table,
    columns.value,
    "MissingStyleRuleColumn",
    "Style rule",
    diagnostics,
  );

  const stateValues = getOptionalColumn(table, columns.state);
  const breakpointValues = getOptionalColumn(table, columns.breakpoint);
  const descriptionValues = getOptionalColumn(table, columns.description);

  if (selectorValues === undefined || propertyValues === undefined || valueValues === undefined) {
    return diagnostics;
  }

  for (let row = 0; row < table.rowCount; row += 1) {
    if (!isNonEmptyString(selectorValues[row])) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidStyleSelector",
          message: "Style selector must be a non-empty string.",
          column: columns.selector,
          row,
        }),
      );
    }

    if (!isNonEmptyString(propertyValues[row])) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidStyleProperty",
          message: "Style property must be a non-empty string.",
          column: columns.property,
          row,
        }),
      );
    }

    if (!isNonEmptyString(valueValues[row])) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidStyleValue",
          message: "Style value must be a non-empty string.",
          column: columns.value,
          row,
        }),
      );
    }

    validateOptionalString(
      table,
      columns.state,
      row,
      stateValues?.[row],
      "InvalidStyleState",
      "Style state must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.breakpoint,
      row,
      breakpointValues?.[row],
      "InvalidStyleBreakpoint",
      "Style breakpoint must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.description,
      row,
      descriptionValues?.[row],
      "InvalidStyleRuleDescription",
      "Style rule description must be a string when provided.",
      diagnostics,
    );
  }

  return diagnostics;
}

export function rulesFromTable(
  table: ColumnarTable,
  options?: StyleRulesFromTableOptions,
): readonly StyleRuleRecord[] {
  const diagnostics = validateStyleRuleTable(table, options);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  const columns = resolveRuleColumns(options);
  const selectorValues = table.columns[columns.selector] ?? [];
  const propertyValues = table.columns[columns.property] ?? [];
  const valueValues = table.columns[columns.value] ?? [];
  const stateValues = table.columns[columns.state];
  const breakpointValues = table.columns[columns.breakpoint];
  const descriptionValues = table.columns[columns.description];

  const rules: StyleRuleRecord[] = [];
  for (let row = 0; row < table.rowCount; row += 1) {
    rules.push({
      kind: "styleRule",
      selector: selectorValues[row] as string,
      property: propertyValues[row] as string,
      value: valueValues[row] as string,
      ...(stateValues?.[row] === undefined ? {} : { state: stateValues[row] as string }),
      ...(breakpointValues?.[row] === undefined
        ? {}
        : { breakpoint: breakpointValues[row] as string }),
      ...(descriptionValues?.[row] === undefined
        ? {}
        : { description: descriptionValues[row] as string }),
    });
  }

  return rules;
}

export function describeStyleTokens(
  tokens: readonly StyleTokenRecord[],
  tableId = "",
): StyleTokenTableDescription {
  return {
    kind: "styleTokenTableDescription",
    tableId,
    tokenCount: tokens.length,
    themes: uniqueThemes(tokens),
  };
}

export function describeStyleRules(
  rules: readonly StyleRuleRecord[],
  tableId = "",
): StyleRuleTableDescription {
  return {
    kind: "styleRuleTableDescription",
    tableId,
    ruleCount: rules.length,
    selectorCount: new Set(rules.map((rule) => rule.selector)).size,
    propertyCount: new Set(rules.map((rule) => rule.property)).size,
  };
}

export function sheetFromTables(input: StyleSheetFromTablesOptions): MachinaStyleSheet {
  const tokenRecords = input.tokens ? tokensFromTable(input.tokens, input.tokenOptions) : undefined;
  const ruleRecords = input.rules ? rulesFromTable(input.rules, input.ruleOptions) : undefined;
  const themes = tokenRecords ? uniqueThemes(tokenRecords) : [];

  return {
    classes: {},
    ...(tokenRecords === undefined && ruleRecords === undefined
      ? {}
      : {
          tabular: {
            ...(tokenRecords === undefined ? {} : { tokenRecords }),
            ...(ruleRecords === undefined ? {} : { ruleRecords }),
            ...(themes.length === 0 ? {} : { defaultTheme: themes[0] }),
          },
        }),
  };
}
