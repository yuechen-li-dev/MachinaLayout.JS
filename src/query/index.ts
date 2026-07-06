export * from "./types";
export * from "./plan";
export * from "./builder";
export * from "./execute";
export * from "./validate";
export * from "./describe";
export * from "./iterate";
export * from "./chunk-execute";

import { from } from "./builder";
import { describePlan, formatPlan } from "./describe";
import { execute } from "./execute";
import {
  classifyQueryOperation,
  executeOnChunkedTable,
  executeOnChunks,
  splitQueryPlanForChunks,
  validateChunkQuery,
} from "./chunk-execute";
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
  classifyOperation: classifyQueryOperation,
  splitQueryPlanForChunks,
  executeOnChunks,
  executeOnChunkedTable,
  validateChunkQuery,
} as const;
