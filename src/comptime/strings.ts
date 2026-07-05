type KebabCaseInner<
  TValue extends string,
  TIsFirst extends boolean,
> = TValue extends `${infer THead}${infer TTail}`
  ? THead extends Lowercase<THead>
    ? `${Lowercase<THead>}${KebabCaseInner<TTail, false>}`
    : `${TIsFirst extends true ? "" : "-"}${Lowercase<THead>}${KebabCaseInner<TTail, false>}`
  : "";

export type KebabCase<TValue extends string> = KebabCaseInner<TValue, true>;
