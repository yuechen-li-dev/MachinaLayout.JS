import {
  T,
  formatConceptDescription,
  formatTemplateDescription,
  type ConceptDiagnostic,
} from "machinalayout/concept";
import type { OrderCurrency, OrderStatus } from "./data.js";

export type ValidOrder = T.All<
  [
    T.HasId,
    T.HasField<"customerId", string>,
    T.HasField<"status", OrderStatus>,
    T.HasField<"totalCents", number>,
    T.HasField<"currency", OrderCurrency>,
    T.HasField<"items", number>,
  ]
>;

export const HasId = T.concept({
  id: "HasId",
  description: "Records that expose a stable order identifier.",
  fields: {
    id: T.string(),
  },
});

export const OrderShape = T.concept({
  id: "OrderShape",
  description: "The raw backend order payload shape.",
  fields: {
    id: T.string(),
    customerId: T.string(),
    status: T.string(),
    totalCents: T.number(),
    currency: T.string(),
    items: T.number(),
  },
});

export const PricedOrder = T.compose({
  id: "PricedOrder",
  description: "Order records ready for pricing, validation, and export work.",
  concepts: [HasId, OrderShape],
});

export const summarizeOrder = T.template({
  id: "summarizeOrder",
  description: "Summarize an order before export-side enrichment.",
  requires: PricedOrder,
  run: (order: ValidOrder) =>
    `${order.id} (${order.status}) for ${order.customerId}: ${order.items} items, ${order.totalCents} cents`,
});

export const conceptDescriptions = [HasId, OrderShape, PricedOrder].map((concept) => ({
  description: T.describe(concept),
  text: formatConceptDescription(T.describe(concept)),
}));

export const templateDescriptions = [
  {
    description: T.describeTemplate(summarizeOrder),
    text: formatTemplateDescription(T.describeTemplate(summarizeOrder)),
  },
];

export function findConceptDiagnostics(value: unknown): readonly ConceptDiagnostic[] {
  return T.validate(PricedOrder, value);
}
