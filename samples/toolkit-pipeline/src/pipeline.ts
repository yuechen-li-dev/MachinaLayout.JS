import { A, type AsyncTaskResult, type AsyncTaskRunSnapshot } from "machinalayout/async";
import { B, formatBatchTaskDescription, formatBatchTrace } from "machinalayout/batch";
import { C, formatCaptureTaskDescription } from "machinalayout/capture";
import { T } from "machinalayout/concept";
import { D, type DiagnosticResult, type FormatDiagnosticsOptions } from "machinalayout/diagnostics";
import { I, formatIterMachineDescription, formatIterTrace } from "machinalayout/iter";
import { matchKind } from "machinalayout/match";
import {
  conceptDescriptions,
  findConceptDiagnostics,
  summarizeOrder,
  templateDescriptions,
  type ValidOrder,
} from "./concepts.js";
import {
  orderStatuses,
  pipelineRoutes,
  rawOrders,
  routeKeys,
  type OrderCurrency,
  type PipelineEvent,
  type RawOrderRecord,
} from "./data.js";

type EnrichmentError = {
  kind: "persistence";
  message: string;
};

type EnrichedOrder = ValidOrder & {
  region: string;
  route: string;
  risk: "normal" | "review";
  persistedAt: string;
};

type EnrichmentBatchOutput = {
  order: ValidOrder;
  run: AsyncTaskRunSnapshot<ValidOrder, EnrichedOrder, EnrichmentError>;
};

type ReportRow = {
  orderId: string;
  status: "accepted" | "rejected" | "timedOut" | "failed";
  primaryAmount: string;
  secondaryAmount: string;
  detail: string;
};

export type PipelineReport = {
  sampleName: "toolkit-pipeline";
  processedCount: number;
  validCount: number;
  invalidCount: number;
  routeKeys: readonly string[];
  iterator: {
    status: string;
    yieldCount: number;
    traceCount: number;
    description: string;
    trace: string;
    snapshotState: readonly string[];
  };
  asyncCounts: {
    ok: number;
    err: number;
    cancelled: number;
    timeout: number;
  };
  batch: {
    status: string;
    resultKind: "ok" | "err" | "cancelled";
    inputCount: number;
    concurrency: number;
    completedCount: number;
    traceCount: number;
    description: string;
    trace: string;
    failedIndex?: number;
  };
  eventCounts: Record<PipelineEvent["kind"], number>;
  captureDescriptions: readonly {
    id: string;
    description: string;
    envKeys: readonly string[];
    diagnostics: readonly string[];
  }[];
  conceptDescriptions: readonly string[];
  templateDescriptions: readonly string[];
  invalidOrders: readonly {
    id: string;
    diagnostics: readonly string[];
    groupedDiagnostics: Record<string, readonly string[]>;
    sharedDiagnostics: readonly import("machinalayout/diagnostics").MachinaDiagnostic[];
    diagnosticsText: string;
  }[];
  asyncBoards: readonly {
    orderId: string;
    status: string;
    statePath: readonly string[];
    traceKinds: readonly string[];
  }[];
  rows: readonly ReportRow[];
  events: readonly PipelineEvent[];
};

function createClock(startAt: number): () => number {
  let tick = startAt;
  return () => {
    const current = tick;
    tick += 1;
    return current;
  };
}

function toOrderPath(index: number, path?: string): string {
  return path ? `orders[${index}].${path}` : `orders[${index}]`;
}

function validateOrderPolicy(
  order: RawOrderRecord,
  index: number,
): readonly import("machinalayout/diagnostics").MachinaDiagnostic[] {
  const diagnostics: import("machinalayout/diagnostics").MachinaDiagnostic[] = [];

  if (order.totalCents < 0) {
    diagnostics.push(
      D.error({
        source: "toolkit-pipeline",
        path: toOrderPath(index, "totalCents"),
        code: "ORDER_NEGATIVE_TOTAL",
        message: "Order total must be non-negative.",
        details: [`value: ${order.totalCents}`],
      }),
    );
  }

  if (!orderStatuses.includes(order.status as (typeof orderStatuses)[number])) {
    diagnostics.push(
      D.error({
        source: "toolkit-pipeline",
        path: toOrderPath(index, "status"),
        code: "ORDER_UNSUPPORTED_STATUS",
        message: `Order status '${order.status}' is not part of the allowed status tuple.`,
        details: [`value: ${order.status}`],
      }),
    );
  }

  if (order.items <= 0) {
    diagnostics.push(
      D.error({
        source: "toolkit-pipeline",
        path: toOrderPath(index, "items"),
        code: "ORDER_INVALID_ITEM_COUNT",
        message: "Orders must contain at least one item.",
        details: [`value: ${order.items}`],
      }),
    );
  }

  return diagnostics;
}

const formatMoney = C.task({
  id: "formatMoney",
  description: "Format order totals for the primary report locale.",
  env: {
    locale: "en-US",
    currency: "USD" as OrderCurrency,
  },
  run: (env, cents: number) =>
    new Intl.NumberFormat(env.locale, {
      style: "currency",
      currency: env.currency,
    }).format(cents / 100),
});

const formatMoneyFr = C.rebind(formatMoney, {
  id: "formatMoneyFr",
  description: "Format order totals for the French report locale.",
  envPatch: {
    locale: "fr-FR",
  },
});

const formatDiagnostics = C.task({
  id: "formatDiagnostics",
  description: "Render concept and policy diagnostics into a stable text summary.",
  env: {
    includeSeverity: true,
    includeSource: true,
    includePath: true,
  },
  run: (
    env: FormatDiagnosticsOptions,
    diagnostics: readonly import("machinalayout/diagnostics").MachinaDiagnostic[],
  ) => D.format(diagnostics, env),
});

const formatReportRow = C.task({
  id: "formatReportRow",
  description: "Shape deterministic report rows from pipeline outcomes.",
  env: {
    primary: formatMoney,
    secondary: formatMoneyFr,
    diagnostics: formatDiagnostics,
  },
  run: (
    env,
    input: {
      orderId: string;
      status: ReportRow["status"];
      totalCents: number;
      detailDiagnostics?: readonly {
        severity: "error" | "warning" | "info";
        code: string;
        message: string;
        path?: string;
        source?: string;
        details?: readonly string[];
      }[];
      detailText?: string;
    },
  ): ReportRow => ({
    orderId: input.orderId,
    status: input.status,
    primaryAmount: C.run(env.primary, input.totalCents),
    secondaryAmount: C.run(env.secondary, input.totalCents),
    detail: input.detailText ?? C.run(env.diagnostics, input.detailDiagnostics ?? []),
  }),
});

const orderIterator = I.machine<
  { orders: readonly RawOrderRecord[] },
  { index: number },
  RawOrderRecord,
  { count: number }
>({
  id: "orderBatchIterator",
  description: "Walk the raw order batch with an explicit cursor.",
  env: {
    orders: rawOrders,
  },
  initial: {
    index: 0,
  },
  step: (env, cursor, ctx) => {
    if (cursor.index >= env.orders.length) {
      ctx.trace({
        kind: "done",
        machineId: "ignored",
        iteration: ctx.iteration,
        cursor,
        returnValue: { count: env.orders.length },
        message: "Finished the raw order batch.",
      });

      return I.done({
        count: env.orders.length,
      });
    }

    const order = env.orders[cursor.index];
    ctx.trace({
      kind: "started",
      machineId: "ignored",
      iteration: ctx.iteration,
      cursor,
      message: `Preparing ${order.id}.`,
    });

    return I.yield(order, {
      index: cursor.index + 1,
    });
  },
});

const enrichOrder = A.task({
  id: "enrichOrder",
  description: "Deterministically enrich valid orders with fake persistence metadata.",
  env: {
    region: "test-west",
    route: pipelineRoutes.export,
    timeoutOrderIds: ["order-002"] as readonly string[],
    persistedAt: "2026-07-05T12:00:00.000Z",
  },
  run: async (
    env,
    order: ValidOrder,
    ctx,
  ): Promise<AsyncTaskResult<EnrichedOrder, EnrichmentError>> => {
    ctx.trace({
      kind: "domain",
      taskId: "ignored",
      runId: ctx.runId,
      at: ctx.startedAt + 1,
      message: `prepared fake persistence payload for ${order.id}`,
    });

    if (ctx.signal.aborted) {
      return A.cancelled("aborted before enrichment");
    }

    await Promise.resolve();

    if (env.timeoutOrderIds.includes(order.id)) {
      return A.timeout(15);
    }

    return A.ok({
      ...order,
      region: env.region,
      route: env.route,
      risk: order.totalCents > 3000 ? "review" : "normal",
      persistedAt: env.persistedAt,
    });
  },
});

const enrichValidOrders = B.task<ValidOrder, EnrichmentBatchOutput>({
  id: "enrichValidOrders",
  description: "Enrich valid orders concurrently while preserving input order.",
  inputs: [] as readonly ValidOrder[],
  concurrency: 2,
  map: async (order: ValidOrder, ctx) => {
    ctx.trace({
      kind: "itemStarted",
      batchId: "ignored",
      at: 2_000 + ctx.index,
      index: ctx.index,
      message: `running async enrichment for ${order.id}`,
    });

    const clock = createClock(1_000 + ctx.index * 100);
    const run = await A.runSnapshot(enrichOrder, order, {
      now: clock,
    });

    return B.ok({
      order,
      run,
    });
  },
});

function describeCaptureTasks() {
  const describeTask = <TEnv, TInput, TOutput>(
    task: import("machinalayout/capture").CaptureTask<TEnv, TInput, TOutput>,
  ) => {
    const description = C.describe(task);
    return {
      id: task.id,
      description: formatCaptureTaskDescription(description),
      envKeys: description.envKeys,
      diagnostics: C.validate(task).map((diagnostic) => diagnostic.code),
    };
  };

  return [
    describeTask(formatMoney),
    describeTask(formatMoneyFr),
    describeTask(formatDiagnostics),
    describeTask(formatReportRow),
  ];
}

function findOrderDiagnostics(
  order: RawOrderRecord,
  index: number,
): import("machinalayout/diagnostics").MachinaDiagnostic[] {
  const conceptDiagnostics = D.from(findConceptDiagnostics(order), {
    source: "concept",
  }).map((diagnostic) => ({
    ...diagnostic,
    path: toOrderPath(index, diagnostic.path),
  }));
  const policyDiagnostics = validateOrderPolicy(order, index);
  return D.sort(D.collect(conceptDiagnostics, policyDiagnostics));
}

function validateOrder(
  order: RawOrderRecord,
  index: number,
): DiagnosticResult<{
  order: ValidOrder;
  summary: string;
}> {
  const diagnostics = findOrderDiagnostics(order, index);

  if (diagnostics.length > 0) {
    return D.err(diagnostics);
  }

  return D.ok({
    order: order as ValidOrder,
    summary: T.runTemplate(summarizeOrder, order as ValidOrder),
  });
}

function createEventCounts(
  events: readonly PipelineEvent[],
): Record<PipelineEvent["kind"], number> {
  return {
    accepted: events.filter((event) => event.kind === "accepted").length,
    rejected: events.filter((event) => event.kind === "rejected").length,
    enriched: events.filter((event) => event.kind === "enriched").length,
    timedOut: events.filter((event) => event.kind === "timedOut").length,
  };
}

export async function runToolkitPipeline(): Promise<PipelineReport> {
  const iteratorController = I.createController(orderIterator);
  const iterDescription = formatIterMachineDescription(I.describe(orderIterator));
  const iterDiagnostics = I.validate(orderIterator);
  if (iterDiagnostics.length > 0) {
    throw new Error(
      `Iterator diagnostics must stay empty for the sample: ${iterDiagnostics.length}`,
    );
  }

  const iterCollected = iteratorController.collect();
  const orders: readonly RawOrderRecord[] = matchKind(iterCollected, {
    done: (value) => value.values,
    fail: (value) => {
      throw new Error(`Iterator failed: ${String(value.error)}`);
    },
    limit: (value) => {
      throw new Error(`Iterator hit maxSteps=${value.maxSteps}.`);
    },
  });

  const invalidOrders: Array<PipelineReport["invalidOrders"][number]> = [];
  const rows: ReportRow[] = [];
  const events: PipelineEvent[] = [];
  const asyncBoards: Array<PipelineReport["asyncBoards"][number]> = [];
  const validOrders: ValidOrder[] = [];
  const asyncCounts = {
    ok: 0,
    err: 0,
    cancelled: 0,
    timeout: 0,
  };

  for (const [index, order] of orders.entries()) {
    const validation = validateOrder(order, index);

    matchKind(validation, {
      ok: (value) => {
        events.push({
          kind: "accepted",
          orderId: value.value.order.id,
          summary: value.value.summary,
        });

        rows.push(
          C.run(formatReportRow, {
            orderId: value.value.order.id,
            status: "accepted",
            totalCents: value.value.order.totalCents,
            detailText: value.value.summary,
          }),
        );
      },
      err: (value) => {
        const diagnosticsText = C.run(formatDiagnostics, value.diagnostics);
        const groupedDiagnostics = Object.fromEntries(
          Object.entries(D.groupBySource(value.diagnostics)).map(([source, diagnostics]) => [
            source,
            diagnostics.map((diagnostic) => diagnostic.code),
          ]),
        );
        invalidOrders.push({
          id: order.id,
          diagnostics: value.diagnostics.map((diagnostic) => diagnostic.code),
          groupedDiagnostics,
          sharedDiagnostics: value.diagnostics,
          diagnosticsText,
        });
        rows.push(
          C.run(formatReportRow, {
            orderId: order.id,
            status: "rejected",
            totalCents: order.totalCents,
            detailDiagnostics: value.diagnostics,
          }),
        );
        events.push({
          kind: "rejected",
          orderId: order.id,
          reason: diagnosticsText,
        });
      },
    });

    if (validation.kind !== "ok") {
      continue;
    }

    T.assert(summarizeOrder.requires, validation.value.order);
    validOrders.push(validation.value.order);
  }

  const enrichmentBatch = B.task<ValidOrder, EnrichmentBatchOutput>({
    ...enrichValidOrders,
    inputs: validOrders,
  });
  const batchResult = await B.run<ValidOrder, EnrichmentBatchOutput>(enrichmentBatch, {
    now: createClock(5_000),
  });

  const enrichmentOutputs: readonly EnrichmentBatchOutput[] = matchKind(batchResult, {
    ok: (value) => value.values,
    err: (value) => {
      throw new Error(`Enrichment batch failed at index ${value.failedIndex}.`);
    },
    cancelled: (value) => {
      throw new Error(`Enrichment batch cancelled: ${value.reason ?? "unknown"}.`);
    },
  });

  for (const output of enrichmentOutputs) {
    const run = output.run;
    asyncBoards.push({
      orderId: output.order.id,
      status: run.board.status,
      statePath: run.snapshot.statePath,
      traceKinds: run.board.trace.map((event) => event.kind),
    });

    matchKind(run.result, {
      ok: (value) => {
        asyncCounts.ok += 1;
        events.push({
          kind: "enriched",
          orderId: value.value.id,
          risk: value.value.risk,
          route: value.value.route,
        });
      },
      err: (value) => {
        asyncCounts.err += 1;
        rows.push(
          C.run(formatReportRow, {
            orderId: output.order.id,
            status: "failed",
            totalCents: output.order.totalCents,
            detailText: value.error.message,
          }),
        );
      },
      cancelled: (value) => {
        asyncCounts.cancelled += 1;
        rows.push(
          C.run(formatReportRow, {
            orderId: output.order.id,
            status: "failed",
            totalCents: output.order.totalCents,
            detailText: value.reason ?? "cancelled",
          }),
        );
      },
      timeout: (value) => {
        asyncCounts.timeout += 1;
        events.push({
          kind: "timedOut",
          orderId: output.order.id,
          timeoutMs: value.timeoutMs,
        });
        rows.push(
          C.run(formatReportRow, {
            orderId: output.order.id,
            status: "timedOut",
            totalCents: output.order.totalCents,
            detailText: `Timed out after ${value.timeoutMs}ms`,
          }),
        );
      },
    });
  }

  return {
    sampleName: "toolkit-pipeline",
    processedCount: orders.length,
    validCount: orders.length - invalidOrders.length,
    invalidCount: invalidOrders.length,
    routeKeys,
    iterator: {
      status: iteratorController.getBoard().status,
      yieldCount: iteratorController.getBoard().yieldCount,
      traceCount: iteratorController.getBoard().trace.length,
      description: iterDescription,
      trace: formatIterTrace(iteratorController.getBoard().trace),
      snapshotState: iteratorController.getSnapshot().statePath,
    },
    asyncCounts,
    batch: {
      status: batchResult.board.status,
      resultKind: batchResult.kind,
      inputCount: batchResult.board.inputCount,
      concurrency: batchResult.board.concurrency,
      completedCount: batchResult.board.completedCount,
      traceCount: batchResult.board.trace.length,
      description: formatBatchTaskDescription(B.describe(enrichmentBatch)),
      trace: formatBatchTrace(batchResult.board.trace),
      failedIndex: batchResult.kind === "err" ? batchResult.failedIndex : undefined,
    },
    eventCounts: createEventCounts(events),
    captureDescriptions: describeCaptureTasks(),
    conceptDescriptions: conceptDescriptions.map((entry) => entry.text),
    templateDescriptions: templateDescriptions.map((entry) => entry.text),
    invalidOrders,
    asyncBoards,
    rows,
    events,
  };
}
