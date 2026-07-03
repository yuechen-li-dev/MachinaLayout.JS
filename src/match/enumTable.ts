import type { EnumKey, EnumValueMap } from "./types";

export function enumTable<TKey extends EnumKey, TValue>(
  table: EnumValueMap<TKey, TValue>,
): EnumValueMap<TKey, TValue> {
  return { ...table };
}
