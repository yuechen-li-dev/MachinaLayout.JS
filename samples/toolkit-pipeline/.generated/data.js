import { CT } from "machinalayout/comptime";
export const orderStatuses = CT.tuple("new", "paid", "fulfilled", "cancelled");
export const orderCurrencies = CT.tuple("USD");
export const pipelineRoutes = CT.object({
    intake: "/orders/intake",
    export: "/orders/export",
    diagnostics: "/orders/diagnostics",
});
export const routeKeys = CT.keys(pipelineRoutes);
export const rawOrders = [
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
];
export const asyncSummarySlug = "async-summary";
