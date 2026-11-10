import { describe, expect, it } from "vitest";
import { T } from "../../src/concept";
import { type EffectError, I, IteratorReusedError, type WorkflowSnapshot } from "../../src/iter";

// Claudefood: an order-fulfilment workflow — parallel lookups, a reservation,
// a charge that can fail (compensated), and logged time.

const Customer = T.concept({
  id: "Customer",
  fields: { id: T.string({ nonEmpty: true }), cardToken: T.string({ nonEmpty: true }) },
});
type Customer = T.Infer<typeof Customer>;

const Order = T.concept({
  id: "Order",
  closed: true,
  fields: {
    id: T.string({ nonEmpty: true }),
    customerId: T.string({ nonEmpty: true }),
    currency: T.oneOf("USD", "EUR"),
    totalCents: T.number({ int: true, min: 0 }),
    items: T.number({ int: true, min: 1 }),
  },
});
type Order = T.Infer<typeof Order>;

const fetchCustomer = I.effect<[id: string], Customer>("fetchCustomer", { response: Customer });
const fetchFxRate = I.effect<[currency: string], number>("fetchFxRate", {
  response: T.number({ finite: true, min: 0 }),
});
const reserveStock = I.effect<[orderId: string, items: number], { reservationId: string }>(
  "reserveStock",
);
const chargeCard = I.effect<[token: string, cents: number], { chargeId: string }>("chargeCard");
const releaseStock = I.effect<[reservationId: string], null>("releaseStock");

const fulfil = I.workflow({
  id: "fulfilOrder",
  input: Order,
  run: function* (order: Order) {
    const [customer, rate] = yield* I.all([
      fetchCustomer(order.customerId),
      fetchFxRate(order.currency),
    ]);
    const reservation = yield* reserveStock(order.id, order.items);
    const charge = yield* I.attempt(
      chargeCard(customer.cardToken, Math.round(order.totalCents * rate)),
    );
    if (!charge.ok) {
      yield* releaseStock(reservation.reservationId);
      return { status: "declined", reason: charge.error.message } as const;
    }
    const at = yield* I.now();
    return { status: "fulfilled", chargeId: charge.value.chargeId, at } as const;
  },
});

const order: Order = {
  id: "o-1",
  customerId: "c-1",
  currency: "EUR",
  totalCents: 1000,
  items: 2,
};
const customer: Customer = { id: "c-1", cardToken: "tok_1" };

function countingHandlers() {
  const calls: string[] = [];
  const track =
    <TArgs extends readonly unknown[], TResult>(name: string, run: (...args: TArgs) => TResult) =>
    async (...args: TArgs) => {
      calls.push(name);
      await Promise.resolve();
      return run(...args);
    };
  return {
    calls,
    handlers: [
      fetchCustomer.handle(track("fetchCustomer", () => customer)),
      fetchFxRate.handle(track("fetchFxRate", () => 1.1)),
      reserveStock.handle(track("reserveStock", () => ({ reservationId: "r-9" }))),
      chargeCard.handle(track("chargeCard", () => ({ chargeId: "ch-5" }))),
      releaseStock.handle(track("releaseStock", () => null)),
      I.now.handle(track("now", () => 1_700_000_000_000)),
    ],
  };
}

describe("claudefood: typed effects", () => {
  it("keeps response types through yield* (compile-time)", () => {
    I.workflow({
      id: "types",
      run: function* () {
        const c = yield* fetchCustomer("c");
        const token: string = c.cardToken;
        // @ts-expect-error — Customer has no `email`
        void c.email;
        const [x, rate] = yield* I.all([fetchCustomer("c"), fetchFxRate("EUR")]);
        const n: number = rate;
        const attempted = yield* I.attempt(fetchFxRate("EUR"));
        if (attempted.ok) {
          const r: number = attempted.value;
          void r;
        } else {
          const e: EffectError = attempted.error;
          void e;
        }
        return [token, x.id, n] as const;
      },
    });
    expect(true).toBe(true);
  });
});

describe("claudefood: scripted testing (no async, no mocks)", () => {
  it("reads like the spec", () => {
    const run = I.drive(fulfil, order);
    expect(run.pending).toEqual([
      { name: "fetchCustomer", args: ["c-1"] },
      { name: "fetchFxRate", args: ["EUR"] },
    ]);
    run.expectAll([fetchCustomer, fetchFxRate]).respond(customer, 1.1);
    run.expect(reserveStock, ["o-1", 2]).respond({ reservationId: "r-9" });
    run.expect(chargeCard, ["tok_1", 1100]).respond({ chargeId: "ch-5" });
    run.expect(I.now).respond(42);
    expect(run.result).toMatchObject({
      kind: "done",
      value: { status: "fulfilled", chargeId: "ch-5", at: 42 },
    });
  });

  it("tests the compensation path by failing one effect", () => {
    const run = I.drive(fulfil, order).respond(customer, 1.1);
    run.expect(reserveStock).respond({ reservationId: "r-9" });
    run.expect(chargeCard).fail("card declined", { name: "CardDeclined" });
    run.expect(releaseStock, ["r-9"]).respond(null);
    expect(run.result).toMatchObject({
      kind: "done",
      value: { status: "declined", reason: "card declined" },
    });
  });

  it("explains a wrong expectation in one line", () => {
    const run = I.drive(fulfil, order).respond(customer, 1.1);
    expect(() => run.expect(chargeCard)).toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected workflow to wait on chargeCard(…), but it waits on reserveStock("o-1",2).]`,
    );
  });

  it("type-checks parallel responses as a tuple", () => {
    const run = I.drive(fulfil, order);
    const step = run.expectAll([fetchCustomer, fetchFxRate]);
    // @ts-expect-error — fetchFxRate responds with a number
    expect(() => step.respond(customer, "1.1")).not.toThrow();
  });

  it("type-checks responses against the effect", () => {
    const run = I.drive(fulfil, order).respond(customer, 1.1);
    // @ts-expect-error — reserveStock responds with { reservationId: string }
    expect(() => run.expect(reserveStock).respond({ id: 1 })).not.toThrow();
  });
});

describe("claudefood: snapshot, resume, replay", () => {
  it("suspends, survives JSON, and resumes without re-running logged effects", async () => {
    const first = countingHandlers();
    const partial = await I.run(fulfil, order, { handlers: first.handlers, maxSteps: 2 });
    expect(partial.kind).toBe("suspended");
    expect(first.calls).toEqual(["fetchCustomer", "fetchFxRate", "reserveStock"]);

    const stored = JSON.parse(JSON.stringify(partial.snapshot)) as unknown;

    const second = countingHandlers();
    const resumed = await I.resume(fulfil, stored, { handlers: second.handlers });
    expect(resumed).toMatchObject({
      kind: "done",
      value: { status: "fulfilled", chargeId: "ch-5", at: 1_700_000_000_000 },
    });
    expect(second.calls).toEqual(["chargeCard", "now"]); // nothing replayed live
    expect(resumed.snapshot.log).toHaveLength(4);
  });

  it("reports a code change as ReplayDivergence instead of doing the wrong thing", async () => {
    const { handlers } = countingHandlers();
    const partial = await I.run(fulfil, order, { handlers, maxSteps: 2 });

    const reordered = I.workflow({
      id: "fulfilOrder",
      run: function* (o: Order) {
        const reservation = yield* reserveStock(o.id, o.items); // moved first
        return reservation;
      },
    });
    const resumed = await I.resume(reordered, partial.snapshot, { handlers });
    expect(resumed.kind).toBe("diverged");
    if (resumed.kind === "diverged") {
      expect(resumed.diagnostics[0]?.message).toMatchInlineSnapshot(
        `"step 0: workflow yielded reserveStock("o-1",2) but the log has all[fetchCustomer("c-1"), fetchFxRate("EUR")]; the workflow code changed since this snapshot"`,
      );
    }
  });

  it("names nondeterminism when only the arguments differ", () => {
    let clock = 1;
    const sloppy = I.workflow({
      id: "sloppy",
      run: function* () {
        return yield* reserveStock(`batch-${clock++}`, 1); // reads ambient state
      },
    });
    const first = I.drive(sloppy, undefined);
    first.respond({ reservationId: "r" });
    const replay = I.drive(sloppy, undefined, { log: first.snapshot().log });
    expect(replay.result?.kind).toBe("diverged");
    if (replay.result?.kind === "diverged") {
      expect(replay.result.diagnostics[0]?.message).toContain("make it an effect");
    }
  });

  it("validates untrusted snapshots with paths", async () => {
    const resumed = await I.resume(fulfil, {
      kind: "workflowSnapshot",
      workflowId: "fulfilOrder",
      input: { ...order, totalCents: -5 },
      log: [{ calls: [{ name: "fetchCustomer", args: ["c-1"] }], parallel: false, outcome: [] }],
    });
    expect(resumed.kind).toBe("invalid");
    if (resumed.kind === "invalid") {
      expect(resumed.diagnostics[0]?.message).toContain("did you mean 'outcomes'");
      expect(resumed.diagnostics.map((d) => `${d.code}@${d.path}`)).toEqual([
        "InvalidWorkflowSnapshot@log[0].outcomes",
        "InvalidWorkflowInput@input.totalCents",
      ]);
    }
  });

  it("re-checks logged responses against the effect's concept on replay", () => {
    const run = I.drive(fulfil, order).respond(customer, 1.1);
    const tampered: WorkflowSnapshot<Order> = {
      ...run.snapshot(),
      log: [
        {
          ...run.snapshot().log[0]!,
          outcomes: [
            { kind: "ok", value: { id: "c-1" } }, // cardToken missing
            { kind: "ok", value: 1.1 },
          ],
        },
      ],
    };
    const replay = I.drive(fulfil, order, { log: tampered.log });
    expect(replay.result?.kind).toBe("diverged");
    if (replay.result?.kind === "diverged") {
      expect(replay.result.diagnostics[0]).toMatchObject({
        code: "InvalidReplayResponse",
        step: 0,
      });
      expect(replay.result.diagnostics[0]?.message).toContain("cardToken");
    }
  });
});

describe("claudefood: live contract checks", () => {
  it("turns a response that breaks its concept into an effect error the workflow can see", async () => {
    const flaky = I.workflow({
      id: "flaky",
      run: function* () {
        return yield* I.attempt(fetchFxRate("EUR"));
      },
    });
    const result = await I.run(flaky, undefined, {
      handlers: [fetchFxRate.handle(() => Number.NaN)],
    });
    expect(result.kind).toBe("done");
    if (result.kind === "done" && !result.value.ok) {
      expect(result.value.error.name).toBe("InvalidEffectResponse");
    }
  });

  it("refuses responses that cannot be logged", () => {
    const clocky = I.workflow({
      id: "clocky",
      run: function* () {
        return yield* I.attempt(I.effect<[], Date>("today")());
      },
    });
    const result = I.runSync(clocky, undefined, {
      handlers: [I.effect<[], Date>("today").handle(() => new Date(0))],
    });
    expect(result.kind === "done" && !result.value.ok && result.value.error.name).toBe(
      "UnserializableEffectResponse",
    );
  });

  it("reports missing handlers without logging anything, then resumes", async () => {
    const partial = await I.run(fulfil, order, { handlers: [] });
    expect(partial.kind).toBe("invalid");
    if (partial.kind === "invalid") {
      expect(partial.diagnostics.map((d) => d.code)).toEqual([
        "MissingEffectHandler",
        "MissingEffectHandler",
      ]);
      expect(partial.snapshot.log).toEqual([]);
    }
    const { handlers } = countingHandlers();
    expect((await I.resume(fulfil, partial.snapshot, { handlers })).kind).toBe("done");
  });

  it("rejects bad workflow input with concept diagnostics", () => {
    const result = I.runSync(fulfil, { ...order, curency: "EUR" } as unknown as Order);
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.diagnostics[0]?.message).toContain("did you mean 'currency'");
    }
  });
});

describe("claudefood: lowering to IterMachine", () => {
  it("drives a generator workflow through the explicit controller", () => {
    const sync = [
      fetchCustomer.handle(() => customer),
      fetchFxRate.handle(() => 1.1),
      reserveStock.handle(() => ({ reservationId: "r-9" })),
      chargeCard.handle(() => ({ chargeId: "ch-5" })),
      I.now.handle(() => 7),
    ];
    const controller = I.createController(I.toMachine(fulfil, order, { handlers: sync }), {
      trace: true,
    });
    const collected = controller.collect();
    expect(collected.kind).toBe("done");
    expect(collected.values.map((entry) => entry.calls.map((call) => call.name).join("+"))).toEqual(
      ["fetchCustomer+fetchFxRate", "reserveStock", "chargeCard", "now"],
    );
    expect(controller.getBoard().cursor.log).toHaveLength(4);
    expect(controller.getSnapshot().statePath).toEqual(["done"]);
  });
});

describe("one-shot iterators", () => {
  function* numbers() {
    yield 1;
    yield 2;
  }

  it("I.once turns silent empty second passes into an error", () => {
    const items = I.once(numbers(), "numbers()");
    expect([...items]).toEqual([1, 2]);
    expect(() => [...items]).toThrow(IteratorReusedError);
  });

  it("I.seq is re-iterable", () => {
    const items = I.seq(numbers);
    expect([...items]).toEqual([1, 2]);
    expect([...items]).toEqual([1, 2]);
  });
});
