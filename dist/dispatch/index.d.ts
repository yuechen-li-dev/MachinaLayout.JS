type SetDispatchTable<TState> = {
    events: readonly string[];
    fields: readonly (keyof TState)[];
    values: readonly unknown[];
};
type ToggleDispatchTable<TState> = {
    events: readonly string[];
    fields: readonly (keyof TState)[];
};
type IncrementDispatchTable<TState> = {
    events: readonly string[];
    fields: readonly (keyof TState)[];
    by?: readonly number[];
};
type PrefixSetDispatchTable<TState> = {
    prefixes: readonly string[];
    fields: readonly (keyof TState)[];
    allowedSuffixes?: readonly (readonly string[] | undefined)[];
};
type PrefixIncrementDispatchTable<TState> = {
    prefixes: readonly string[];
    fields: readonly (keyof TState)[];
    by?: readonly number[];
    allowedSuffixes?: readonly (readonly string[] | undefined)[];
};
type MachinaDispatchTables<TState> = {
    set?: SetDispatchTable<TState>;
    toggle?: ToggleDispatchTable<TState>;
    increment?: IncrementDispatchTable<TState>;
    setSuffix?: PrefixSetDispatchTable<TState>;
    incrementSuffix?: PrefixIncrementDispatchTable<TState>;
};

declare function dispatchEvent<TState extends Record<string, unknown>>(state: TState, event: string, tables: MachinaDispatchTables<TState>): TState;

type MachinaDispatchErrorCode = "InvalidDispatchTable" | "InvalidDispatchField" | "InvalidDispatchValue" | "InvalidDispatchEvent";
declare class MachinaDispatchError extends Error {
    readonly code: MachinaDispatchErrorCode;
    constructor(code: MachinaDispatchErrorCode, message: string);
}

declare function defineDispatchTables<TState>(tables: MachinaDispatchTables<TState>): MachinaDispatchTables<TState>;
declare function resolveEventValue<TValue>(event: string, table: {
    events: readonly string[];
    values: readonly TValue[];
}): TValue | undefined;
declare function matchEventPrefix(event: string, prefix: string, allowedSuffixes?: readonly string[]): string | undefined;

export { type IncrementDispatchTable, MachinaDispatchError, type MachinaDispatchErrorCode, type MachinaDispatchTables, type PrefixIncrementDispatchTable, type PrefixSetDispatchTable, type SetDispatchTable, type ToggleDispatchTable, defineDispatchTables, dispatchEvent, matchEventPrefix, resolveEventValue };
