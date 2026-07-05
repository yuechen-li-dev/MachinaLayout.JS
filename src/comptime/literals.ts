export function tuple<const TValues extends readonly unknown[]>(...values: TValues): TValues {
  return values;
}

export function object<const TObject extends Record<PropertyKey, unknown>>(
  value: TObject,
): TObject {
  return value;
}

export function keys<const TObject extends Record<PropertyKey, unknown>>(
  value: TObject,
): Array<Extract<keyof TObject, string>> {
  return Object.keys(value) as Array<Extract<keyof TObject, string>>;
}

export const CT = {
  tuple,
  object,
  keys,
} as const;
