// src/dispatch/errors.ts
var MachinaDispatchError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "MachinaDispatchError";
    this.code = code;
  }
};

// src/dispatch/helpers.ts
var isStringArray = (value) => Array.isArray(value) && value.every((entry) => typeof entry === "string");
var validateLengths = (name, ...columns) => {
  const expected = columns[0]?.length ?? 0;
  if (!columns.every((column) => Array.isArray(column) && column.length === expected)) {
    throw new MachinaDispatchError("InvalidDispatchTable", `${name} column lengths must match`);
  }
};
var validateAllowedSuffixes = (allowedSuffixes, expectedLength, tableName) => {
  if (allowedSuffixes === void 0) return;
  if (!Array.isArray(allowedSuffixes) || allowedSuffixes.length !== expectedLength) {
    throw new MachinaDispatchError(
      "InvalidDispatchTable",
      `${tableName}.allowedSuffixes length mismatch`
    );
  }
  for (const row of allowedSuffixes) {
    if (row !== void 0 && !isStringArray(row)) {
      throw new MachinaDispatchError(
        "InvalidDispatchTable",
        `${tableName}.allowedSuffixes must be string arrays`
      );
    }
  }
};
var validateBy = (by, expectedLength, tableName) => {
  if (by === void 0) return;
  if (!Array.isArray(by) || by.length !== expectedLength) {
    throw new MachinaDispatchError("InvalidDispatchTable", `${tableName}.by length mismatch`);
  }
  for (const value of by) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new MachinaDispatchError(
        "InvalidDispatchTable",
        `${tableName}.by must contain finite numbers`
      );
    }
  }
};
var validateSetTable = (table) => {
  validateLengths("set", table.events, table.fields, table.values);
  if (!isStringArray(table.events))
    throw new MachinaDispatchError("InvalidDispatchTable", "set.events must be strings");
};
var validateToggleTable = (table) => {
  validateLengths("toggle", table.events, table.fields);
  if (!isStringArray(table.events))
    throw new MachinaDispatchError("InvalidDispatchTable", "toggle.events must be strings");
};
var validateIncrementTable = (table) => {
  validateLengths("increment", table.events, table.fields);
  if (!isStringArray(table.events))
    throw new MachinaDispatchError("InvalidDispatchTable", "increment.events must be strings");
  validateBy(table.by, table.events.length, "increment");
};
var validatePrefixSetTable = (table) => {
  validateLengths("setSuffix", table.prefixes, table.fields);
  if (!isStringArray(table.prefixes))
    throw new MachinaDispatchError("InvalidDispatchTable", "setSuffix.prefixes must be strings");
  validateAllowedSuffixes(table.allowedSuffixes, table.prefixes.length, "setSuffix");
};
var validatePrefixIncrementTable = (table) => {
  validateLengths("incrementSuffix", table.prefixes, table.fields);
  if (!isStringArray(table.prefixes))
    throw new MachinaDispatchError(
      "InvalidDispatchTable",
      "incrementSuffix.prefixes must be strings"
    );
  validateBy(table.by, table.prefixes.length, "incrementSuffix");
  validateAllowedSuffixes(table.allowedSuffixes, table.prefixes.length, "incrementSuffix");
};
function defineDispatchTables(tables) {
  if (tables.set) validateSetTable(tables.set);
  if (tables.toggle) validateToggleTable(tables.toggle);
  if (tables.increment) validateIncrementTable(tables.increment);
  if (tables.setSuffix) validatePrefixSetTable(tables.setSuffix);
  if (tables.incrementSuffix) validatePrefixIncrementTable(tables.incrementSuffix);
  return tables;
}
function resolveEventValue(event, table) {
  validateLengths("resolveEventValue", table.events, table.values);
  if (!isStringArray(table.events))
    throw new MachinaDispatchError("InvalidDispatchTable", "events must be strings");
  for (let i = 0; i < table.events.length; i += 1) {
    if (table.events[i] === event) return table.values[i];
  }
  return void 0;
}
function matchEventPrefix(event, prefix, allowedSuffixes) {
  if (typeof event !== "string" || typeof prefix !== "string") {
    throw new MachinaDispatchError("InvalidDispatchEvent", "event and prefix must be strings");
  }
  if (allowedSuffixes !== void 0 && !isStringArray(allowedSuffixes)) {
    throw new MachinaDispatchError(
      "InvalidDispatchTable",
      "allowedSuffixes must be a string array"
    );
  }
  if (!event.startsWith(prefix)) return void 0;
  const suffix = event.slice(prefix.length);
  if (allowedSuffixes && !allowedSuffixes.includes(suffix)) return void 0;
  return suffix;
}

// src/dispatch/dispatchEvent.ts
var hasOwn = (state, field) => Object.hasOwn(state, field);
function dispatchEvent(state, event, tables) {
  if (typeof event !== "string") {
    throw new MachinaDispatchError("InvalidDispatchEvent", "event must be a string");
  }
  const base = state;
  if (tables.set) {
    validateSetTable(tables.set);
    for (let i = 0; i < tables.set.events.length; i += 1) {
      if (tables.set.events[i] !== event) continue;
      const field = tables.set.fields[i];
      if (!hasOwn(base, field))
        throw new MachinaDispatchError("InvalidDispatchField", `missing field: ${String(field)}`);
      const nextValue = tables.set.values[i];
      if (Object.is(base[field], nextValue)) return state;
      return { ...state, [field]: nextValue };
    }
  }
  if (tables.toggle) {
    validateToggleTable(tables.toggle);
    for (let i = 0; i < tables.toggle.events.length; i += 1) {
      if (tables.toggle.events[i] !== event) continue;
      const field = tables.toggle.fields[i];
      if (!hasOwn(base, field))
        throw new MachinaDispatchError("InvalidDispatchField", `missing field: ${String(field)}`);
      const current = base[field];
      if (typeof current !== "boolean")
        throw new MachinaDispatchError(
          "InvalidDispatchValue",
          `field must be boolean: ${String(field)}`
        );
      return { ...state, [field]: !current };
    }
  }
  if (tables.increment) {
    validateIncrementTable(tables.increment);
    for (let i = 0; i < tables.increment.events.length; i += 1) {
      if (tables.increment.events[i] !== event) continue;
      const field = tables.increment.fields[i];
      if (!hasOwn(base, field))
        throw new MachinaDispatchError("InvalidDispatchField", `missing field: ${String(field)}`);
      const current = base[field];
      if (typeof current !== "number")
        throw new MachinaDispatchError(
          "InvalidDispatchValue",
          `field must be number: ${String(field)}`
        );
      const delta = tables.increment.by?.[i] ?? 1;
      if (!Number.isFinite(delta))
        throw new MachinaDispatchError("InvalidDispatchValue", "increment delta must be finite");
      return { ...state, [field]: current + delta };
    }
  }
  if (tables.setSuffix) {
    validatePrefixSetTable(tables.setSuffix);
    for (let i = 0; i < tables.setSuffix.prefixes.length; i += 1) {
      const suffix = matchEventPrefix(
        event,
        tables.setSuffix.prefixes[i],
        tables.setSuffix.allowedSuffixes?.[i]
      );
      if (suffix === void 0) continue;
      const field = tables.setSuffix.fields[i];
      if (!hasOwn(base, field))
        throw new MachinaDispatchError("InvalidDispatchField", `missing field: ${String(field)}`);
      if (Object.is(base[field], suffix)) return state;
      return { ...state, [field]: suffix };
    }
  }
  if (tables.incrementSuffix) {
    validatePrefixIncrementTable(tables.incrementSuffix);
    for (let i = 0; i < tables.incrementSuffix.prefixes.length; i += 1) {
      const suffix = matchEventPrefix(
        event,
        tables.incrementSuffix.prefixes[i],
        tables.incrementSuffix.allowedSuffixes?.[i]
      );
      if (suffix === void 0) continue;
      const field = tables.incrementSuffix.fields[i];
      if (!hasOwn(base, field))
        throw new MachinaDispatchError("InvalidDispatchField", `missing field: ${String(field)}`);
      const current = base[field];
      if (typeof current !== "number")
        throw new MachinaDispatchError(
          "InvalidDispatchValue",
          `field must be number: ${String(field)}`
        );
      const delta = tables.incrementSuffix.by?.[i] ?? 1;
      if (!Number.isFinite(delta))
        throw new MachinaDispatchError("InvalidDispatchValue", "increment delta must be finite");
      return { ...state, [field]: current + delta };
    }
  }
  return state;
}
export {
  MachinaDispatchError,
  defineDispatchTables,
  dispatchEvent,
  matchEventPrefix,
  resolveEventValue
};
