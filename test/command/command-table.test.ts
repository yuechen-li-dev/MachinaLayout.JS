import { describe, expect, it } from "vitest";
import * as root from "../../src/index";
import {
  Command,
  commandSchema,
  commandsFromTable,
  describeCommands,
  resolveCommandLabel,
  validateCommandTable,
  type CommandRecord,
} from "../../src/command";
import { Table, TableError } from "../../src/table";

function setupCommandsTable() {
  return Table.define({
    id: "setupCommands",
    columns: {
      command: ["provider", "resource", "service", "availability"] as const,
      label: [
        "Create provider",
        "Create resource",
        "Create service",
        "Create availability",
      ] as const,
      busyLabel: ["Creating...", "Creating...", "Creating...", "Creating..."] as const,
      doneLabel: [
        "Provider created",
        "Resource created",
        "Service created",
        "Availability created",
      ] as const,
      testId: [
        "setup-create-provider",
        "setup-create-resource",
        "setup-create-service",
        "setup-create-availability",
      ] as const,
      disabled: [true, false, false, true] as const,
      busy: [false, true, false, false] as const,
      done: [true, false, false, true] as const,
      description: [
        "Create the provider shell",
        undefined,
        "Create a service record",
        undefined,
      ] as const,
      variant: ["primary", undefined, "secondary", undefined] as const,
    },
  });
}

describe("command tables", () => {
  it("Command.commandSchema returns a table schema", () => {
    expect(Command.commandSchema()).toEqual({
      kind: "tableSchema",
      columns: {
        command: { kind: "string" },
        label: { kind: "string" },
        busyLabel: { kind: "string", optional: true },
        doneLabel: { kind: "string", optional: true },
        testId: { kind: "string", optional: true },
        disabled: { kind: "boolean" },
        busy: { kind: "boolean" },
        done: { kind: "boolean" },
        description: { kind: "string", optional: true },
        variant: { kind: "string", optional: true },
      },
    });
  });

  it("Command.commandsFromTable lowers a columnar table to records", () => {
    expect(Command.commandsFromTable(setupCommandsTable())).toEqual([
      {
        kind: "command",
        command: "provider",
        label: "Create provider",
        busyLabel: "Creating...",
        doneLabel: "Provider created",
        testId: "setup-create-provider",
        disabled: true,
        busy: false,
        done: true,
        description: "Create the provider shell",
        variant: "primary",
      },
      {
        kind: "command",
        command: "resource",
        label: "Create resource",
        busyLabel: "Creating...",
        doneLabel: "Resource created",
        testId: "setup-create-resource",
        disabled: false,
        busy: true,
        done: false,
      },
      {
        kind: "command",
        command: "service",
        label: "Create service",
        busyLabel: "Creating...",
        doneLabel: "Service created",
        testId: "setup-create-service",
        disabled: false,
        busy: false,
        done: false,
        description: "Create a service record",
        variant: "secondary",
      },
      {
        kind: "command",
        command: "availability",
        label: "Create availability",
        busyLabel: "Creating...",
        doneLabel: "Availability created",
        testId: "setup-create-availability",
        disabled: true,
        busy: false,
        done: true,
      },
    ]);
  });

  it("works with schema table", () => {
    const authored = Table.defineWithSchema({
      id: "setupCommands",
      schema: Command.commandSchema(),
      columns: setupCommandsTable().columns,
    });

    const commands = Command.commandsFromTable(authored);
    expect(commands[0]?.command).toBe("provider");
  });

  it("preserves row order", () => {
    const commands = Command.commandsFromTable(setupCommandsTable());
    expect(commands.map((command) => command.command)).toEqual([
      "provider",
      "resource",
      "service",
      "availability",
    ]);
  });

  it("optional busyLabel doneLabel testId description and variant flow through", () => {
    const commands = Command.commandsFromTable(setupCommandsTable());
    expect(commands[0]).toMatchObject({
      busyLabel: "Creating...",
      doneLabel: "Provider created",
      testId: "setup-create-provider",
      description: "Create the provider shell",
      variant: "primary",
    });
    expect(commands[1]).not.toHaveProperty("description");
    expect(commands[1]).not.toHaveProperty("variant");
  });

  it("Command.resolveCommandLabel returns label by default", () => {
    expect(
      Command.resolveCommandLabel({
        kind: "command",
        command: "provider",
        label: "Create provider",
        disabled: false,
        busy: false,
        done: false,
      }),
    ).toBe("Create provider");
  });

  it("Command.resolveCommandLabel returns busyLabel when busy", () => {
    expect(
      Command.resolveCommandLabel({
        kind: "command",
        command: "provider",
        label: "Create provider",
        busyLabel: "Creating...",
        disabled: false,
        busy: true,
        done: false,
      }),
    ).toBe("Creating...");
  });

  it("Command.resolveCommandLabel returns doneLabel when done and not busy", () => {
    expect(
      Command.resolveCommandLabel({
        kind: "command",
        command: "provider",
        label: "Create provider",
        doneLabel: "Provider created",
        disabled: false,
        busy: false,
        done: true,
      }),
    ).toBe("Provider created");
  });

  it("busy label wins over done label if both busy and done", () => {
    expect(
      Command.resolveCommandLabel({
        kind: "command",
        command: "provider",
        label: "Create provider",
        busyLabel: "Creating...",
        doneLabel: "Provider created",
        disabled: false,
        busy: true,
        done: true,
      }),
    ).toBe("Creating...");
  });

  it("Command.describeCommands returns counts", () => {
    expect(
      Command.describeCommands(Command.commandsFromTable(setupCommandsTable()), "setupCommands"),
    ).toEqual({
      kind: "commandTableDescription",
      tableId: "setupCommands",
      commandCount: 4,
      busyCount: 1,
      doneCount: 2,
      disabledCount: 2,
    });
  });

  it("missing command column reports MissingCommandColumn", () => {
    const diagnostics = Command.validateCommandTable(
      Table.define({
        id: "setupCommands",
        columns: {
          label: ["Create provider"],
          disabled: [false],
          busy: [false],
          done: [false],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingCommandColumn",
        tableId: "setupCommands",
        column: "command",
        path: "setupCommands.command",
      }),
    );
  });

  it("invalid command id reports diagnostic", () => {
    const diagnostics = Command.validateCommandTable(
      Table.define({
        id: "setupCommands",
        columns: {
          ...setupCommandsTable().columns,
          command: ["", "resource", "service", "availability"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidCommandId",
        column: "command",
        row: 0,
        path: "setupCommands.command[0]",
      }),
    );
  });

  it("invalid label reports diagnostic", () => {
    const diagnostics = Command.validateCommandTable(
      Table.define({
        id: "setupCommands",
        columns: {
          ...setupCommandsTable().columns,
          label: ["Create provider", "", "Create service", "Create availability"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidCommandLabel",
        column: "label",
        row: 1,
      }),
    );
  });

  it("invalid disabled busy and done report diagnostics", () => {
    const diagnostics = Command.validateCommandTable(
      Table.define({
        id: "setupCommands",
        columns: {
          ...setupCommandsTable().columns,
          disabled: [true, "no", false, true],
          busy: [false, true, "yes", false],
          done: [true, false, false, "done"],
        },
      }),
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "InvalidCommandDisabled",
          column: "disabled",
          row: 1,
        }),
        expect.objectContaining({
          code: "InvalidCommandBusy",
          column: "busy",
          row: 2,
        }),
        expect.objectContaining({
          code: "InvalidCommandDone",
          column: "done",
          row: 3,
        }),
      ]),
    );
  });

  it("invalid optional busyLabel doneLabel testId description and variant report diagnostics", () => {
    const diagnostics = Command.validateCommandTable(
      Table.define({
        id: "setupCommands",
        columns: {
          ...setupCommandsTable().columns,
          busyLabel: [7, "Creating...", "Creating...", "Creating..."],
          doneLabel: ["Provider created", false, "Service created", "Availability created"],
          testId: [
            "setup-create-provider",
            {},
            "setup-create-service",
            "setup-create-availability",
          ],
          description: [undefined, "ok", 1, undefined],
          variant: ["primary", undefined, false, undefined],
        },
      }),
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "InvalidCommandBusyLabel",
          column: "busyLabel",
          row: 0,
        }),
        expect.objectContaining({
          code: "InvalidCommandDoneLabel",
          column: "doneLabel",
          row: 1,
        }),
        expect.objectContaining({
          code: "InvalidCommandTestId",
          column: "testId",
          row: 1,
        }),
        expect.objectContaining({
          code: "InvalidCommandDescription",
          column: "description",
          row: 2,
        }),
        expect.objectContaining({
          code: "InvalidCommandVariant",
          column: "variant",
          row: 2,
        }),
      ]),
    );
  });

  it("duplicate command reports diagnostic", () => {
    const diagnostics = Command.validateCommandTable(
      Table.define({
        id: "setupCommands",
        columns: {
          ...setupCommandsTable().columns,
          command: ["provider", "provider", "service", "availability"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateCommand",
        column: "command",
        row: 1,
        message: 'Command "provider" already appears at row 0.',
      }),
    );
  });

  it("duplicate testId reports diagnostic", () => {
    const diagnostics = Command.validateCommandTable(
      Table.define({
        id: "setupCommands",
        columns: {
          ...setupCommandsTable().columns,
          testId: [
            "setup-create-provider",
            "setup-create-provider",
            "setup-create-service",
            "setup-create-availability",
          ],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateCommandTestId",
        column: "testId",
        row: 1,
        message: 'Test id "setup-create-provider" already appears at row 0.',
      }),
    );
  });

  it("diagnostics include table id column row and path", () => {
    const diagnostics = Command.validateCommandTable(
      Table.define({
        id: "setupCommands",
        columns: {
          ...setupCommandsTable().columns,
          done: [true, false, "nope", true],
        },
      }),
    );

    expect(diagnostics).toContainEqual({
      severity: "error",
      code: "InvalidCommandDone",
      message: "Command done must be a boolean.",
      tableId: "setupCommands",
      column: "done",
      row: 2,
      path: "setupCommands.done[2]",
    });
  });

  it("Command.commandsFromTable throws TableError on invalid table", () => {
    expect(() =>
      Command.commandsFromTable(
        Table.define({
          id: "setupCommands",
          columns: {
            ...setupCommandsTable().columns,
            command: ["provider", "resource", "", "availability"],
          },
        }),
      ),
    ).toThrow(TableError);
  });

  it("Command.validateCommandTable returns diagnostics without throwing", () => {
    expect(() =>
      Command.validateCommandTable(
        Table.define({
          id: "setupCommands",
          columns: {
            ...setupCommandsTable().columns,
            label: ["Create provider", "", "Create service", "Create availability"],
          },
        }),
      ),
    ).not.toThrow();
  });
});

describe("command exports and typing", () => {
  it("exports the command namespace only from the command subpath", () => {
    expect(Command.commandSchema).toBeTypeOf("function");
    expect(Command.commandsFromTable).toBeTypeOf("function");
    expect(Command.validateCommandTable).toBeTypeOf("function");
    expect(Command.describeCommands).toBeTypeOf("function");
    expect(Command.resolveCommandLabel).toBeTypeOf("function");
    expect("Command" in root).toBe(false);
  });

  it("exports named helpers", () => {
    expect(commandSchema).toBeTypeOf("function");
    expect(commandsFromTable).toBeTypeOf("function");
    expect(validateCommandTable).toBeTypeOf("function");
    expect(describeCommands).toBeTypeOf("function");
    expect(resolveCommandLabel).toBeTypeOf("function");
  });

  it("CommandRecord has expected fields", () => {
    const record: CommandRecord = {
      kind: "command",
      command: "provider",
      label: "Create provider",
      busyLabel: "Creating...",
      doneLabel: "Provider created",
      testId: "setup-create-provider",
      disabled: false,
      busy: false,
      done: true,
      description: "Create the provider shell",
      variant: "primary",
    };

    expect(record.command).toBe("provider");
    expect(record.done).toBe(true);
  });
});
