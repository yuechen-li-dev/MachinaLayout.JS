import { describe, expect, it } from "vitest";
import {
  createDeusSnapshot,
  defineDeusMachine,
  pendingResultTransitionTemplate,
  pendingResultTransitionsFromTable,
  stepDeusMachine,
  transitionsFromTemplateTable,
  validatePendingResultTransitionTable,
  validateTransitionTemplateTable,
  type DeusTransitionTemplate,
} from "../../src/deus";
import { Table, TableError } from "../../src/table";

const idle = ["idle"] as const;
const providerPending = ["providerPending"] as const;
const resourcePending = ["resourcePending"] as const;

function pendingResultsTable() {
  return Table.define({
    id: "pendingResultRows",
    columns: {
      entity: ["provider", "resource"] as const,
      pending: [providerPending, resourcePending] as const,
      successEvent: ["providerCreated", "resourceCreated"] as const,
      failureEvent: ["providerFailed", "resourceFailed"] as const,
      successTarget: ["provider", "resource"] as const,
      successPayload: ["provider", "resource"] as const,
      failurePayload: ["message", "message"] as const,
      to: [idle, idle] as const,
    },
  });
}

describe("deus transition template tables", () => {
  it("expands template rows in source order", () => {
    const table = Table.define({
      id: "templateRows",
      columns: {
        name: ["alpha", "beta"] as const,
      },
    });
    const template: DeusTransitionTemplate = {
      kind: "deusTransitionTemplate",
      id: "pairTemplate",
      requiredColumns: ["name"],
      expand: (row) => [
        { key: `${row.name}.one`, from: ["idle"], event: `${row.name}:one` },
        { key: `${row.name}.two`, from: ["idle"], event: `${row.name}:two` },
      ],
    };

    const transitions = transitionsFromTemplateTable(table, template);
    expect(transitions.map((transition) => transition.key)).toEqual([
      "alpha.one",
      "alpha.two",
      "beta.one",
      "beta.two",
    ]);
  });

  it("validates missing required generic template columns", () => {
    const diagnostics = validateTransitionTemplateTable(
      Table.define({
        id: "templateRows",
        columns: {
          name: ["alpha"],
        },
      }),
      {
        kind: "deusTransitionTemplate",
        id: "pairTemplate",
        requiredColumns: ["name", "event"],
        expand: () => [],
      },
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingTemplateColumn",
        tableId: "templateRows",
        column: "event",
        path: "templateRows.event",
      }),
    );
  });

  it("wraps template expansion failures as table diagnostics", () => {
    const template: DeusTransitionTemplate = {
      kind: "deusTransitionTemplate",
      id: "boomTemplate",
      requiredColumns: [],
      expand: () => {
        throw new Error("boom");
      },
    };

    expect(() =>
      transitionsFromTemplateTable(
        Table.define({
          id: "templateRows",
          columns: {
            id: ["alpha"],
          },
        }),
        template,
      ),
    ).toThrow(TableError);

    try {
      transitionsFromTemplateTable(
        Table.define({
          id: "templateRows",
          columns: {
            id: ["alpha"],
          },
        }),
        template,
      );
      expect.unreachable("expected TableError");
    } catch (error) {
      const tableError = error as TableError;
      expect(tableError.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "TemplateExpansionError",
          tableId: "templateRows",
          row: 0,
          path: "templateRows[0]",
        }),
      );
    }
  });

  it("rejects duplicate emitted transition keys from generic templates", () => {
    const diagnostics = validateTransitionTemplateTable(
      Table.define({
        id: "templateRows",
        columns: {
          name: ["alpha", "beta"],
        },
      }),
      {
        kind: "deusTransitionTemplate",
        id: "dupeTemplate",
        requiredColumns: ["name"],
        expand: () => [{ key: "duplicate", from: ["idle"], event: "go" }],
      },
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateTemplateTransitionKey",
        tableId: "templateRows",
        row: 1,
        path: "templateRows[1]",
      }),
    );
  });

  it("exposes pending result template required columns", () => {
    expect(pendingResultTransitionTemplate().requiredColumns).toEqual([
      "pending",
      "successEvent",
      "failureEvent",
      "successTarget",
      "successPayload",
      "failurePayload",
      "to",
    ]);
  });

  it("emits success and failure transition pairs for each pending result row", () => {
    const transitions = pendingResultTransitionsFromTable(pendingResultsTable());
    expect(transitions.map((transition) => transition.key)).toEqual([
      "provider.providerCreated",
      "provider.providerFailed",
      "resource.resourceCreated",
      "resource.resourceFailed",
    ]);
  });

  it("emitted success transitions write success payloads and clear errorMessage", () => {
    const [successTransition] = pendingResultTransitionsFromTable(pendingResultsTable());
    const board: Record<string, unknown> = { errorMessage: "old" };

    successTransition?.do?.(board, {
      type: "providerCreated",
      provider: { id: "provider-1" },
    });

    expect(board.provider).toEqual({ id: "provider-1" });
    expect(board.errorMessage).toBeUndefined();
  });

  it("emitted failure transitions write the error payload", () => {
    const [, failureTransition] = pendingResultTransitionsFromTable(pendingResultsTable());
    const board: Record<string, unknown> = {};

    failureTransition?.do?.(board, {
      type: "providerFailed",
      message: "no provider",
    });

    expect(board.errorMessage).toBe("no provider");
  });

  it("supports a custom error target", () => {
    const [, failureTransition] = pendingResultTransitionsFromTable(pendingResultsTable(), {
      errorTarget: "failureReason",
    });
    const board: Record<string, unknown> = {};

    failureTransition?.do?.(board, {
      type: "providerFailed",
      message: "no provider",
    });

    expect(board.failureReason).toBe("no provider");
    expect(board.errorMessage).toBeUndefined();
  });

  it("honors explicit success and failure key columns", () => {
    const transitions = pendingResultTransitionsFromTable(
      Table.define({
        id: "pendingResultRows",
        columns: {
          entity: ["provider"],
          pending: [providerPending],
          successEvent: ["providerCreated"],
          failureEvent: ["providerFailed"],
          successTarget: ["provider"],
          successPayload: ["provider"],
          failurePayload: ["message"],
          to: [idle],
          successKey: ["custom.success"],
          failureKey: ["custom.failure"],
        },
      }),
    );

    expect(transitions.map((transition) => transition.key)).toEqual([
      "custom.success",
      "custom.failure",
    ]);
  });

  it("derives fallback keys when entity is absent", () => {
    const transitions = pendingResultTransitionsFromTable(
      Table.define({
        id: "pendingResultRows",
        columns: {
          pending: [providerPending],
          successEvent: ["providerCreated"],
          failureEvent: ["providerFailed"],
          successTarget: ["provider"],
          successPayload: ["provider"],
          failurePayload: ["message"],
          to: [idle],
        },
      }),
    );

    expect(transitions.map((transition) => transition.key)).toEqual([
      "pendingResultRows.0.providerCreated",
      "pendingResultRows.0.providerFailed",
    ]);
  });

  it("reports missing pending columns with specific diagnostics", () => {
    const diagnostics = validatePendingResultTransitionTable(
      Table.define({
        id: "pendingResultRows",
        columns: {
          successEvent: ["providerCreated"],
          failureEvent: ["providerFailed"],
          successTarget: ["provider"],
          successPayload: ["provider"],
          failurePayload: ["message"],
          to: [idle],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingPendingStateColumn",
        tableId: "pendingResultRows",
        column: "pending",
        path: "pendingResultRows.pending",
      }),
    );
  });

  it("reports invalid event, target, payload, and state cells", () => {
    const diagnostics = validatePendingResultTransitionTable(
      Table.define({
        id: "pendingResultRows",
        columns: {
          entity: ["provider"],
          pending: [[" "]],
          successEvent: [7],
          failureEvent: ["providerFailed"],
          successTarget: [""],
          successPayload: [""],
          failurePayload: [null],
          to: [7],
        },
      }),
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "InvalidTemplateState",
          column: "pending",
          row: 0,
          path: "pendingResultRows.pending[0]",
        }),
        expect.objectContaining({
          code: "InvalidTemplateEvent",
          column: "successEvent",
          row: 0,
          path: "pendingResultRows.successEvent[0]",
        }),
        expect.objectContaining({
          code: "InvalidTemplateTargetField",
          column: "successTarget",
          row: 0,
          path: "pendingResultRows.successTarget[0]",
        }),
        expect.objectContaining({
          code: "InvalidTemplatePayloadField",
          column: "successPayload",
          row: 0,
          path: "pendingResultRows.successPayload[0]",
        }),
        expect.objectContaining({
          code: "InvalidTemplatePayloadField",
          column: "failurePayload",
          row: 0,
          path: "pendingResultRows.failurePayload[0]",
        }),
        expect.objectContaining({
          code: "InvalidTemplateState",
          column: "to",
          row: 0,
          path: "pendingResultRows.to[0]",
        }),
      ]),
    );
  });

  it("reports duplicate expanded keys against the source row and column", () => {
    const diagnostics = validatePendingResultTransitionTable(
      Table.define({
        id: "pendingResultRows",
        columns: {
          entity: ["provider", "provider"],
          pending: [providerPending, resourcePending],
          successEvent: ["providerCreated", "providerCreated"],
          failureEvent: ["providerFailed", "resourceFailed"],
          successTarget: ["provider", "resource"],
          successPayload: ["provider", "resource"],
          failurePayload: ["message", "message"],
          to: [idle, idle],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateTemplateTransitionKey",
        tableId: "pendingResultRows",
        column: "entity",
        row: 1,
        path: "pendingResultRows.entity[1]",
      }),
    );
  });

  it("emitted pending result transitions work in the existing Deus runtime", () => {
    const transitions = pendingResultTransitionsFromTable(pendingResultsTable());
    const machine = defineDeusMachine({
      initial: providerPending,
      states: [{ path: idle }, { path: providerPending }, { path: resourcePending }],
      transitions,
    });
    const board: Record<string, unknown> = { errorMessage: "old" };

    const stepped = stepDeusMachine(machine, createDeusSnapshot(machine, board), {
      type: "providerCreated",
      provider: { id: "provider-1" },
    });

    expect(stepped.snapshot.state).toEqual(idle);
    expect(board.provider).toEqual({ id: "provider-1" });
    expect(board.errorMessage).toBeUndefined();
  });
});
