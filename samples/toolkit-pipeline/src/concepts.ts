import {
  type ConceptDiagnostic,
  formatConceptDescription,
  formatTemplateDescription,
  T,
} from "machinalayout/concept";
import { orderCurrencies, orderStatuses } from "./data.js";

export const HasId = T.concept({
  id: "HasId",
  description: "Records that expose a stable order identifier.",
  fields: {
    id: T.string({ nonEmpty: true }),
  },
});

export const OrderShape = T.concept({
  id: "OrderShape",
  description: "The raw backend order payload shape.",
  fields: {
    id: T.string({ nonEmpty: true }),
    customerId: T.string({ nonEmpty: true }),
    status: T.oneOf(...orderStatuses),
    totalCents: T.number({ int: true }),
    currency: T.oneOf(...orderCurrencies),
    items: T.number({ int: true, min: 1 }),
  },
});

export const PricedOrder = T.compose({
  id: "PricedOrder",
  description: "Order records ready for pricing, validation, and export work.",
  concepts: [HasId, OrderShape],
});

/** Derived from the concept — previously a hand-written `T.All<[...]>` that had drifted (status: string vs OrderStatus). */
export type ValidOrder = T.Infer<typeof PricedOrder>;

export const summarizeOrder = T.template({
  id: "summarizeOrder",
  description: "Summarize an order before export-side enrichment.",
  requires: PricedOrder,
  run: (order) =>
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
