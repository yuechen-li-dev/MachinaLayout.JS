export type MachinaDispatchErrorCode = "InvalidDispatchTable" | "InvalidDispatchField" | "InvalidDispatchValue" | "InvalidDispatchEvent";
export declare class MachinaDispatchError extends Error { readonly code: MachinaDispatchErrorCode; constructor(code: MachinaDispatchErrorCode, message: string); }
export type SetDispatchTable<TState> = { events: readonly string[]; fields: readonly (keyof TState)[]; values: readonly unknown[]; };
export type ToggleDispatchTable<TState> = { events: readonly string[]; fields: readonly (keyof TState)[]; };
export type IncrementDispatchTable<TState> = { events: readonly string[]; fields: readonly (keyof TState)[]; by?: readonly number[]; };
export type PrefixSetDispatchTable<TState> = { prefixes: readonly string[]; fields: readonly (keyof TState)[]; allowedSuffixes?: readonly (readonly string[] | undefined)[]; };
export type PrefixIncrementDispatchTable<TState> = { prefixes: readonly string[]; fields: readonly (keyof TState)[]; by?: readonly number[]; allowedSuffixes?: readonly (readonly string[] | undefined)[]; };
export type MachinaDispatchTables<TState> = { set?: SetDispatchTable<TState>; toggle?: ToggleDispatchTable<TState>; increment?: IncrementDispatchTable<TState>; setSuffix?: PrefixSetDispatchTable<TState>; incrementSuffix?: PrefixIncrementDispatchTable<TState>; };
export declare function defineDispatchTables<TState>(tables: MachinaDispatchTables<TState>): MachinaDispatchTables<TState>;
export declare function resolveEventValue<TValue>(event: string, table: { events: readonly string[]; values: readonly TValue[]; }): TValue | undefined;
export declare function matchEventPrefix(event: string, prefix: string, allowedSuffixes?: readonly string[]): string | undefined;
export declare function dispatchEvent<TState extends Record<string, unknown>>(state: TState, event: string, tables: MachinaDispatchTables<TState>): TState;
