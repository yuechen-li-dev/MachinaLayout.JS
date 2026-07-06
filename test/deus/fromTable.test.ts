import { describe, expect, it } from "vitest";
import {
  createDeusSnapshot,
  defineDeusMachine,
  stepDeusMachine,
  transitionsFromTable,
  type DeusTransitionRow,
  type DeusTransitionsFromTableOptions,
  validateTransitionsTable,
} from "../../src/deus";
import { Table, TableError } from "../../src/table";

type Board = {
  log: string[];
  slots: string[];
  selectedDateKey?: string;
  selectedSlotKey?: string;
};
type Event =
  | { type: "openPicker" }
  | { type: "keepCurrentTime" }
  | { type: "slotsLoaded"; slots: string[] }
  | { type: "selectDate"; dateKey: string };

const available = ["available"] as const;
const picker = ["picker"] as const;

function pickerTable() {
  return Table.define({
    id: "pickerTransitions",
    columns: {
      key: ["openPicker", "keepCurrentTime", "picker.slotsLoaded", "picker.selectDate"] as const,
      from: [available, picker, picker, picker] as const,
      event: ["openPicker", "keepCurrentTime", "slotsLoaded", "selectDate"] as const,
      to: [picker, available, undefined, undefined] as const,
      do: [
        undefined,
        undefined,
        (board: Board, event: Event) => {
          if (event.type !== "slotsLoaded") {
            return;
          }
          board.slots = [...event.slots];
          board.log.push("slotsLoaded");
        },
        (board: Board, event: Event) => {
          if (event.type !== "selectDate") {
            return;
          }
          board.selectedDateKey = event.dateKey;
          board.selectedSlotKey = undefined;
          board.log.push("selectDate");
        },
      ] as const,
    },
  });
}

describe("deus transitions from machina tables", () => {
  it("builds transitions from a columnar table", () => {
    const transitions = transitionsFromTable(pickerTable());

    expect(transitions).toEqual([
      { key: "openPicker", from: ["available"], event: "openPicker", to: ["picker"] },
      {
        key: "keepCurrentTime",
        from: ["picker"],
        event: "keepCurrentTime",
        to: ["available"],
      },
      {
        key: "picker.slotsLoaded",
        from: ["picker"],
        event: "slotsLoaded",
        do: expect.any(Function),
      },
      {
        key: "picker.selectDate",
        from: ["picker"],
        event: "selectDate",
        do: expect.any(Function),
      },
    ]);
  });

  it("builds transitions from a schema table", () => {
    const authored = Table.defineWithSchema({
      id: "pickerTransitions",
      schema: Table.schema({
        key: Table.string(),
        from: Table.unknown(),
        event: Table.enum(["openPicker", "keepCurrentTime", "slotsLoaded", "selectDate"] as const),
        to: Table.optional(Table.unknown()),
        do: Table.optional(Table.unknown()),
      }),
      columns: pickerTable().columns,
    });

    const transitions = transitionsFromTable(authored);
    expect(transitions[0]).toMatchObject({
      key: "openPicker",
      from: ["available"],
      event: "openPicker",
    });
  });

  it("preserves transition row order", () => {
    const transitions = transitionsFromTable(pickerTable());
    expect(transitions.map((transition) => transition.key)).toEqual([
      "openPicker",
      "keepCurrentTime",
      "picker.slotsLoaded",
      "picker.selectDate",
    ]);
  });

  it("lowers simple from event to rows correctly", () => {
    const transitions = transitionsFromTable(pickerTable());
    expect(transitions[0]).toEqual({
      key: "openPicker",
      from: ["available"],
      event: "openPicker",
      to: ["picker"],
    });
    expect(transitions[1]).toEqual({
      key: "keepCurrentTime",
      from: ["picker"],
      event: "keepCurrentTime",
      to: ["available"],
    });
  });

  it("lowers action rows with do correctly", () => {
    const transitions = transitionsFromTable(pickerTable());

    expect(transitions[2]).toMatchObject({
      key: "picker.slotsLoaded",
      from: ["picker"],
      event: "slotsLoaded",
      do: expect.any(Function),
    });
    expect(transitions[2]).not.toHaveProperty("to");
  });

  it("returns transitions that work in the existing Deus runtime", () => {
    const transitions = transitionsFromTable(pickerTable()) as readonly DeusTransitionRow<
      Board,
      Event
    >[];
    const machine = defineDeusMachine<Board, Event>({
      initial: available,
      states: [{ path: available }, { path: picker }],
      transitions,
    });

    const board: Board = { log: [], slots: [] };
    const opened = stepDeusMachine(machine, createDeusSnapshot(machine, board), {
      type: "openPicker",
    });
    expect(opened.snapshot.state).toEqual(picker);

    const loaded = stepDeusMachine(machine, opened.snapshot, {
      type: "slotsLoaded",
      slots: ["09:00", "09:30"],
    });
    expect(board.slots).toEqual(["09:00", "09:30"]);
    expect(loaded.snapshot.state).toEqual(picker);

    stepDeusMachine(machine, loaded.snapshot, {
      type: "selectDate",
      dateKey: "2026-07-05",
    });
    expect(board.selectedDateKey).toBe("2026-07-05");
    expect(board.selectedSlotKey).toBeUndefined();
  });

  it("reports a missing key column", () => {
    const diagnostics = validateTransitionsTable(
      Table.define({
        id: "pickerTransitions",
        columns: {
          from: [available],
          event: ["openPicker"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingTransitionKeyColumn",
        tableId: "pickerTransitions",
        column: "key",
        path: "pickerTransitions.key",
      }),
    );
  });

  it("reports a missing from column", () => {
    const diagnostics = validateTransitionsTable(
      Table.define({
        id: "pickerTransitions",
        columns: {
          key: ["openPicker"],
          event: ["openPicker"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingTransitionFromColumn",
        tableId: "pickerTransitions",
        column: "from",
        path: "pickerTransitions.from",
      }),
    );
  });

  it("reports a missing event column", () => {
    const diagnostics = validateTransitionsTable(
      Table.define({
        id: "pickerTransitions",
        columns: {
          key: ["openPicker"],
          from: [available],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingTransitionEventColumn",
        tableId: "pickerTransitions",
        column: "event",
        path: "pickerTransitions.event",
      }),
    );
  });

  it("reports an empty key", () => {
    const diagnostics = validateTransitionsTable(
      Table.define({
        id: "pickerTransitions",
        columns: {
          key: [""],
          from: [available],
          event: ["openPicker"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidTransitionKey",
        tableId: "pickerTransitions",
        column: "key",
        row: 0,
        path: "pickerTransitions.key[0]",
      }),
    );
  });

  it("rejects duplicate transition keys", () => {
    const diagnostics = validateTransitionsTable(
      Table.define({
        id: "pickerTransitions",
        columns: {
          key: ["openPicker", "openPicker"],
          from: [available, picker],
          event: ["openPicker", "keepCurrentTime"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateTransitionKey",
        tableId: "pickerTransitions",
        column: "key",
        row: 1,
        path: "pickerTransitions.key[1]",
        message: 'Transition key "openPicker" already appears at row 0.',
      }),
    );
  });

  it("reports an invalid event cell", () => {
    const diagnostics = validateTransitionsTable(
      Table.define({
        id: "pickerTransitions",
        columns: {
          key: ["openPicker"],
          from: [available],
          event: [7],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidTransitionEvent",
        tableId: "pickerTransitions",
        column: "event",
        row: 0,
        path: "pickerTransitions.event[0]",
      }),
    );
  });

  it("reports an invalid action cell", () => {
    const diagnostics = validateTransitionsTable(
      Table.define({
        id: "pickerTransitions",
        columns: {
          key: ["openPicker"],
          from: [available],
          event: ["openPicker"],
          do: [null],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidTransitionAction",
        tableId: "pickerTransitions",
        column: "do",
        row: 0,
        path: "pickerTransitions.do[0]",
      }),
    );
  });

  it("reports an invalid to cell", () => {
    const diagnostics = validateTransitionsTable(
      Table.define({
        id: "pickerTransitions",
        columns: {
          key: ["openPicker"],
          from: [available],
          event: ["openPicker"],
          to: [7],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidTransitionTo",
        tableId: "pickerTransitions",
        column: "to",
        row: 0,
        path: "pickerTransitions.to[0]",
      }),
    );
  });

  it("reports an invalid from cell", () => {
    const diagnostics = validateTransitionsTable(
      Table.define({
        id: "pickerTransitions",
        columns: {
          key: ["openPicker"],
          from: ["available"],
          event: ["openPicker"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidTransitionFrom",
        tableId: "pickerTransitions",
        column: "from",
        row: 0,
        path: "pickerTransitions.from[0]",
      }),
    );
  });

  it("returns diagnostics without throwing", () => {
    expect(() =>
      validateTransitionsTable(
        Table.define({
          id: "pickerTransitions",
          columns: {
            key: [""],
            from: [available],
            event: ["openPicker"],
          },
        }),
      ),
    ).not.toThrow();
  });

  it("throws TableError on invalid transition tables", () => {
    expect(() =>
      transitionsFromTable(
        Table.define({
          id: "pickerTransitions",
          columns: {
            key: [""],
            from: [available],
            event: ["openPicker"],
          },
        }),
      ),
    ).toThrow(TableError);
  });

  it("supports custom transition column names", () => {
    const authored = Table.define({
      id: "pickerTransitions",
      columns: {
        transitionKey: ["openPicker"],
        source: [available],
        dispatch: ["openPicker"],
        target: [picker],
        action: [undefined],
      },
    });
    const options: DeusTransitionsFromTableOptions<
      "transitionKey",
      "source",
      "dispatch",
      "target",
      "action"
    > = {
      keyColumn: "transitionKey",
      fromColumn: "source",
      eventColumn: "dispatch",
      toColumn: "target",
      doColumn: "action",
    };

    const transitions = transitionsFromTable(authored, options);
    expect(transitions).toEqual([
      {
        key: "openPicker",
        from: ["available"],
        event: "openPicker",
        to: ["picker"],
      },
    ]);
  });

  it("preserves schema enum event inference when used from the event column", () => {
    const authored = Table.defineWithSchema({
      id: "pickerTransitions",
      schema: Table.schema({
        key: Table.string(),
        from: Table.unknown(),
        event: Table.enum(["openPicker", "keepCurrentTime"] as const),
        to: Table.optional(Table.unknown()),
        do: Table.optional(Table.unknown()),
      }),
      columns: {
        key: ["openPicker", "keepCurrentTime"],
        from: [available, picker],
        event: ["openPicker", "keepCurrentTime"],
        to: [picker, available],
        do: [undefined, undefined],
      },
    });

    const transitions = transitionsFromTable(authored);
    const eventKey = transitions[0]?.event;
    expect(eventKey).toBe("openPicker");
    // biome-ignore lint/correctness/noConstantCondition: compile-time type assertion block
    if (false) {
      type EventKey = NonNullable<(typeof transitions)[number]["event"]>;
      const validEventKey: EventKey = "openPicker";
      void validEventKey;
      // @ts-expect-error schema enum key inference should stay narrow
      const invalidEventKey: EventKey = "other";
      void invalidEventKey;
    }
  });
});
