# Machina Commands

`machinalayout/command` adds a narrow bridge from columnar command tables to explicit command render records.

Core thesis:

- buttons are renderings of commands
- author commands as tables
- validate by cell
- lower to command records
- JSX is the boundary target, not the source of truth

MachinaCommand does not execute commands. It makes command/button definitions table-shaped and validates them by cell.

Boundary:

- no command palette
- no toolbar framework
- no permissions engine
- no routing
- no menu system
- no shortcut manager
- no async orchestration
- no button renderer

## Command table schema

```ts
import { Command } from "machinalayout/command";
import { Table } from "machinalayout/table";

const setupCommands = Table.defineWithSchema({
  id: "setupCommands",
  schema: Command.commandSchema(),
  columns: {
    command: ["provider", "resource", "service", "availability"],
    label: [
      "Create provider",
      "Create resource",
      "Create service",
      "Create availability",
    ],
    busyLabel: ["Creating...", "Creating...", "Creating...", "Creating..."],
    doneLabel: [
      "Provider created",
      "Resource created",
      "Service created",
      "Availability created",
    ],
    testId: [
      "setup-create-provider",
      "setup-create-resource",
      "setup-create-service",
      "setup-create-availability",
    ],
    disabled: [
      !!currentBusyStep || !!board.provider,
      !!currentBusyStep || !board.provider || !!board.resource,
      !!currentBusyStep || !board.resource || !!board.service,
      !!currentBusyStep || !board.service || !!board.availabilityRule,
    ],
    busy: [
      currentBusyStep === "provider",
      currentBusyStep === "resource",
      currentBusyStep === "service",
      currentBusyStep === "availability",
    ],
    done: [
      !!board.provider,
      !!board.resource,
      !!board.service,
      !!board.availabilityRule,
    ],
    description: [undefined, undefined, undefined, undefined],
    variant: [undefined, undefined, undefined, undefined],
  },
});
```

Optional columns still stay table-shaped. In schema-authored tables that means using explicit `undefined` cells when you want the optional column present but empty.

## Lowering command tables

```ts
import { Command } from "machinalayout/command";

const commands = Command.commandsFromTable(setupCommands);
```

Each row becomes one explicit `CommandRecord`:

```ts
{
  kind: "command",
  command: "provider",
  label: "Create provider",
  busyLabel: "Creating...",
  doneLabel: "Provider created",
  testId: "setup-create-provider",
  disabled: false,
  busy: false,
  done: true,
}
```

The core helper stops there. It does not render JSX and it does not run the command.

## Label resolution

`Command.resolveCommandLabel(command)` mirrors common button-label branching:

```ts
const label = Command.resolveCommandLabel(command);
```

Resolution order:

- `busyLabel` when `busy`
- else `doneLabel` when `done`
- else `label`

## Manual React rendering

Keep command execution and rendering at the app boundary:

```tsx
{commands.map((command) => (
  <Button
    key={command.command}
    data-testid={command.testId}
    disabled={command.disabled}
    onClick={() => void runStep(command.command)}
    type="button"
  >
    {Command.resolveCommandLabel(command)}
  </Button>
))}
```

This keeps dependency direction clean:

- `machinalayout/command` depends on table authoring
- Dispatch, Deus, or app code still owns behavior
- JSX rendering stays in the app or adapter layer

## Validation and diagnostics

Use `Command.validateCommandTable(table)` when you want diagnostics without throwing.

```ts
const diagnostics = Command.validateCommandTable(setupCommands);
```

Example diagnostics:

```txt
error InvalidCommandId at setupCommands.command[2]
  Command id must be a non-empty string.
```

```txt
error DuplicateCommandTestId at setupCommands.testId[3]
  Test id "setup-create-provider" already appears at row 0.
```

Duplicate command ids and duplicate `testId` values are rejected.

## Description helpers

`Command.describeCommands(commands, setupCommands.id)` returns a compact summary:

- `commandCount`
- `busyCount`
- `doneCount`
- `disabledCount`
- `tableId`

Use it for previews, audit artifacts, and documentation rather than runtime behavior.
