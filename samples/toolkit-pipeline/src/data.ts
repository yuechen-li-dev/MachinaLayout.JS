import {
  CT,
  type Assert,
  type Equal,
  type KebabCase,
  type KindValues,
  type TupleValues,
} from "machinalayout/comptime";

export const orderStatuses = CT.tuple("new", "paid", "fulfilled", "cancelled");
export type OrderStatus = TupleValues<typeof orderStatuses>;

type _statusCheck = Assert<Equal<OrderStatus, "new" | "paid" | "fulfilled" | "cancelled">>;

export const orderCurrencies = CT.tuple("USD");
export type OrderCurrency = TupleValues<typeof orderCurrencies>;

export const pipelineRoutes = CT.object({
  intake: "/orders/intake",
  export: "/orders/export",
  diagnostics: "/orders/diagnostics",
});

export const routeKeys = CT.keys(pipelineRoutes);

export type RawOrderRecord = {
  id: string;
  customerId?: string;
  status: OrderStatus | "unknown";
  totalCents: number;
  currency: OrderCurrency;
  items: number;
};

export const rawOrders: readonly RawOrderRecord[] = [
  {
    id: "order-001",
    customerId: "customer-a",
    status: "new",
    totalCents: 1299,
    currency: "USD",
    items: 2,
  },
  {
    id: "order-002",
    customerId: "customer-b",
    status: "paid",
    totalCents: 4599,
    currency: "USD",
    items: 5,
  },
  {
    id: "bad-order",
    status: "new",
    totalCents: -100,
    currency: "USD",
    items: 1,
  },
] as const;

export type PipelineEvent =
  | {
      kind: "accepted";
      orderId: string;
      summary: string;
    }
  | {
      kind: "rejected";
      orderId: string;
      reason: string;
    }
  | {
      kind: "enriched";
      orderId: string;
      risk: "normal" | "review";
      route: string;
    }
  | {
      kind: "timedOut";
      orderId: string;
      timeoutMs: number;
    };

export type PipelineEventKind = KindValues<PipelineEvent>;

type _eventKindCheck = Assert<
  Equal<PipelineEventKind, "accepted" | "rejected" | "enriched" | "timedOut">
>;

export type ReportSectionSlug = KebabCase<"AsyncSummary">;
export const asyncSummarySlug: ReportSectionSlug = "async-summary";
