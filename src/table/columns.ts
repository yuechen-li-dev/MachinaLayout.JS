/** Options that rename table columns: `{ labelColumn?: "title" }`. */
export type ColumnNameOptions<TKey extends string> = {
  readonly [K in TKey as `${K}Column`]?: string | undefined;
};

/**
 * Resolve conventional column-name options: key `label` reads the
 * `labelColumn` option and defaults to `"label"`.
 *
 * `resolveColumnNames(options, ["concept", "type", "label"] as const)`
 * → `{ concept: string; type: string; label: string }`
 */
export function resolveColumnNames<const TKey extends string>(
  options: NoInfer<ColumnNameOptions<TKey>> | undefined,
  keys: readonly TKey[],
): { readonly [K in TKey]: string } {
  const source = options as Record<string, string | undefined> | undefined;
  return Object.fromEntries(keys.map((key) => [key, source?.[`${key}Column`] ?? key])) as {
    readonly [K in TKey]: string;
  };
}

/** The resolved names for a set of column keys: `{ readonly label: string; … }`. */
export type ColumnNames<TKey extends string> = { readonly [K in TKey]: string };
