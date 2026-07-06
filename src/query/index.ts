export * from "./types";
export * from "./plan";
export * from "./builder";
export * from "./execute";
export * from "./validate";
export * from "./describe";
export * from "./iterate";

import { from } from "./builder";
import { describePlan, formatPlan } from "./describe";
import { execute } from "./execute";
import { formatIteratorSnapshot, iterate, toIterMachine } from "./iterate";
import { plan } from "./plan";
import { validate } from "./validate";

export const Q = {
  from,
  plan,
  execute,
  validate,
  describePlan,
  formatPlan,
  iterate,
  toIterMachine,
  formatIteratorSnapshot,
} as const;
