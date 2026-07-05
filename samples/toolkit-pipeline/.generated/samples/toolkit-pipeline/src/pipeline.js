import { A } from "machinalayout/async";
import { C, formatCaptureTaskDescription } from "machinalayout/capture";
import { T } from "machinalayout/concept";
import { D } from "machinalayout/diagnostics";
import { I, formatIterMachineDescription, formatIterTrace } from "machinalayout/iter";
import { matchKind } from "machinalayout/match";
import { conceptDescriptions, findConceptDiagnostics, summarizeOrder, templateDescriptions, } from "./concepts.js";
import { orderStatuses, pipelineRoutes, rawOrders, routeKeys, } from "./data.js";
function createClock(startAt) {
    let tick = startAt;
    return () => {
        const current = tick;
        tick += 1;
        return current;
    };
}
function toOrderPath(index, path) {
    return path ? `orders[${index}].${path}` : `orders[${index}]`;
}
function validateOrderPolicy(order, index) {
    const diagnostics = [];
    if (order.totalCents < 0) {
        diagnostics.push(D.error({
            source: "toolkit-pipeline",
            path: toOrderPath(index, "totalCents"),
            code: "ORDER_NEGATIVE_TOTAL",
            message: "Order total must be non-negative.",
            details: [`value: ${order.totalCents}`],
        }));
    }
    if (!orderStatuses.includes(order.status)) {
        diagnostics.push(D.error({
            source: "toolkit-pipeline",
            path: toOrderPath(index, "status"),
            code: "ORDER_UNSUPPORTED_STATUS",
            message: `Order status '${order.status}' is not part of the allowed status tuple.`,
            details: [`value: ${order.status}`],
        }));
    }
    if (order.items <= 0) {
        diagnostics.push(D.error({
            source: "toolkit-pipeline",
            path: toOrderPath(index, "items"),
            code: "ORDER_INVALID_ITEM_COUNT",
            message: "Orders must contain at least one item.",
            details: [`value: ${order.items}`],
        }));
    }
    return diagnostics;
}
const formatMoney = C.task({
    id: "formatMoney",
    description: "Format order totals for the primary report locale.",
    env: {
        locale: "en-US",
        currency: "USD",
    },
    run: (env, cents) => new Intl.NumberFormat(env.locale, {
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
    run: (env, diagnostics) => D.format(diagnostics, env),
});
const formatReportRow = C.task({
    id: "formatReportRow",
    description: "Shape deterministic report rows from pipeline outcomes.",
    env: {
        primary: formatMoney,
        secondary: formatMoneyFr,
        diagnostics: formatDiagnostics,
    },
    run: (env, input) => ({
        orderId: input.orderId,
        status: input.status,
        primaryAmount: C.run(env.primary, input.totalCents),
        secondaryAmount: C.run(env.secondary, input.totalCents),
        detail: input.detailText ?? C.run(env.diagnostics, input.detailDiagnostics ?? []),
    }),
});
const orderIterator = I.machine({
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
        timeoutOrderIds: ["order-002"],
        persistedAt: "2026-07-05T12:00:00.000Z",
    },
    run: async (env, order, ctx) => {
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
function describeCaptureTasks() {
    const describeTask = (task) => {
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
function findOrderDiagnostics(order, index) {
    const conceptDiagnostics = D.from(findConceptDiagnostics(order), {
        source: "concept",
    }).map((diagnostic) => ({
        ...diagnostic,
        path: toOrderPath(index, diagnostic.path),
    }));
    const policyDiagnostics = validateOrderPolicy(order, index);
    return D.sort(D.collect(conceptDiagnostics, policyDiagnostics));
}
function validateOrder(order, index) {
    const diagnostics = findOrderDiagnostics(order, index);
    if (diagnostics.length > 0) {
        return D.err(diagnostics);
    }
    return D.ok({
        order: order,
        summary: T.runTemplate(summarizeOrder, order),
    });
}
function createEventCounts(events) {
    return {
        accepted: events.filter((event) => event.kind === "accepted").length,
        rejected: events.filter((event) => event.kind === "rejected").length,
        enriched: events.filter((event) => event.kind === "enriched").length,
        timedOut: events.filter((event) => event.kind === "timedOut").length,
    };
}
export async function runToolkitPipeline() {
    const iteratorController = I.createController(orderIterator);
    const iterDescription = formatIterMachineDescription(I.describe(orderIterator));
    const iterDiagnostics = I.validate(orderIterator);
    if (iterDiagnostics.length > 0) {
        throw new Error(`Iterator diagnostics must stay empty for the sample: ${iterDiagnostics.length}`);
    }
    const iterCollected = iteratorController.collect();
    const orders = matchKind(iterCollected, {
        done: (value) => value.values,
        fail: (value) => {
            throw new Error(`Iterator failed: ${String(value.error)}`);
        },
        limit: (value) => {
            throw new Error(`Iterator hit maxSteps=${value.maxSteps}.`);
        },
    });
    const invalidOrders = [];
    const rows = [];
    const events = [];
    const asyncBoards = [];
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
                rows.push(C.run(formatReportRow, {
                    orderId: value.value.order.id,
                    status: "accepted",
                    totalCents: value.value.order.totalCents,
                    detailText: value.value.summary,
                }));
            },
            err: (value) => {
                const diagnosticsText = C.run(formatDiagnostics, value.diagnostics);
                const groupedDiagnostics = Object.fromEntries(Object.entries(D.groupBySource(value.diagnostics)).map(([source, diagnostics]) => [
                    source,
                    diagnostics.map((diagnostic) => diagnostic.code),
                ]));
                invalidOrders.push({
                    id: order.id,
                    diagnostics: value.diagnostics.map((diagnostic) => diagnostic.code),
                    groupedDiagnostics,
                    sharedDiagnostics: value.diagnostics,
                    diagnosticsText,
                });
                rows.push(C.run(formatReportRow, {
                    orderId: order.id,
                    status: "rejected",
                    totalCents: order.totalCents,
                    detailDiagnostics: value.diagnostics,
                }));
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
        const clock = createClock(1_000 + asyncBoards.length * 100);
        const run = await A.runSnapshot(enrichOrder, validation.value.order, {
            now: clock,
        });
        asyncBoards.push({
            orderId: validation.value.order.id,
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
                rows.push(C.run(formatReportRow, {
                    orderId: validation.value.order.id,
                    status: "failed",
                    totalCents: validation.value.order.totalCents,
                    detailText: value.error.message,
                }));
            },
            cancelled: (value) => {
                asyncCounts.cancelled += 1;
                rows.push(C.run(formatReportRow, {
                    orderId: validation.value.order.id,
                    status: "failed",
                    totalCents: validation.value.order.totalCents,
                    detailText: value.reason ?? "cancelled",
                }));
            },
            timeout: (value) => {
                asyncCounts.timeout += 1;
                events.push({
                    kind: "timedOut",
                    orderId: validation.value.order.id,
                    timeoutMs: value.timeoutMs,
                });
                rows.push(C.run(formatReportRow, {
                    orderId: validation.value.order.id,
                    status: "timedOut",
                    totalCents: validation.value.order.totalCents,
                    detailText: `Timed out after ${value.timeoutMs}ms`,
                }));
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
