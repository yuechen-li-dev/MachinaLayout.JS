import { describe, expect, it } from "vitest";

import {
  createDeusSnapshot,
  defineDeusMachine,
  hydrateDeusSnapshot,
  stepDeusMachine,
} from "../../src/deus";
import { M } from "../../src/machina";

type Board = { log: string[] };
type Event = { type: "goto" | "push" | "pop" | "stay" | "conditional" };

const root = ["root"] as const;
const child = ["child"] as const;
const nested = ["nested"] as const;

const machine = defineDeusMachine<Board, Event>({
  initial: root,
  states: [{ path: root }, { path: child }, { path: nested }],
  transitions: [
    {
      key: "goto",
      from: root,
      event: "goto",
      to: M.goto(child),
      do: (board) => board.log.push("goto"),
    },
    {
      key: "push",
      from: root,
      event: "push",
      to: M.push(child),
      do: (board) => board.log.push("push"),
    },
    { key: "nested", from: child, event: "push", to: M.push(nested) },
    {
      key: "pop-child",
      from: child,
      event: "pop",
      to: M.pop(),
      do: (board) => board.log.push("pop"),
    },
    { key: "pop-nested", from: nested, event: "pop", to: M.pop() },
    { key: "stay", from: root, event: "stay", to: M.stay(), do: (board) => board.log.push("stay") },
    { key: "conditional", from: root, event: "conditional", to: () => M.push(child) },
  ],
});

describe("Deus stack control", () => {
  it("creates immutable, serializable control records", () => {
    expect(M.goto(child)).toEqual({ kind: "goto", state: child });
    expect(M.push(child)).toEqual({ kind: "push", state: child });
    expect(M.pop()).toEqual({ kind: "pop" });
    expect(M.stay()).toEqual({ kind: "stay" });
    expect(Object.isFrozen(M.push(child))).toBe(true);
  });

  it("keeps plain and goto targets stack-neutral, while push/pop are LIFO", () => {
    let snapshot = createDeusSnapshot(machine, { log: [] });
    snapshot = stepDeusMachine(machine, snapshot, { type: "goto" }).snapshot;
    expect(snapshot).toMatchObject({ state: child, stack: [] });
    snapshot = createDeusSnapshot(machine, { log: [] });
    snapshot = stepDeusMachine(machine, snapshot, { type: "push" }).snapshot;
    expect(snapshot).toMatchObject({ state: child, stack: [{ returnState: root }] });
    snapshot = stepDeusMachine(machine, snapshot, { type: "push" }).snapshot;
    expect(snapshot.stack).toEqual([{ returnState: root }, { returnState: child }]);
    snapshot = stepDeusMachine(machine, snapshot, { type: "pop" }).snapshot;
    expect(snapshot).toMatchObject({ state: child, stack: [{ returnState: root }] });
    snapshot = stepDeusMachine(machine, snapshot, { type: "pop" }).snapshot;
    expect(snapshot).toMatchObject({ state: root, stack: [] });
  });

  it("preserves state and stack for stay and undefined targets, while actions still run", () => {
    const stayed = stepDeusMachine(machine, createDeusSnapshot(machine, { log: [] }), {
      type: "stay",
    }).snapshot;
    expect(stayed).toMatchObject({ state: root, stack: [], board: { log: ["stay"] } });
    const conditional = stepDeusMachine(machine, createDeusSnapshot(machine, { log: [] }), {
      type: "conditional",
    }).snapshot;
    expect(conditional).toMatchObject({ state: child, stack: [{ returnState: root }] });
  });

  it("rejects an empty pop explicitly", () => {
    const popped = defineDeusMachine<Board, Event>({
      ...machine,
      transitions: [{ key: "pop", from: root, event: "pop", to: M.pop() }],
    });
    expect(() =>
      stepDeusMachine(popped, createDeusSnapshot(popped, { log: [] }), { type: "pop" }),
    ).toThrow(expect.objectContaining({ code: "DEUS_STACK_POP_EMPTY" }));
  });

  it("serializes, hydrates, defaults old snapshots, and validates return states", () => {
    const snapshot = stepDeusMachine(machine, createDeusSnapshot(machine, { log: [] }), {
      type: "push",
    }).snapshot;
    expect(JSON.parse(JSON.stringify(snapshot)).stack).toEqual([{ returnState: root }]);
    expect(
      hydrateDeusSnapshot(machine, { board: { log: [] }, statePath: child, stack: snapshot.stack })
        .stack,
    ).toEqual(snapshot.stack);
    expect(hydrateDeusSnapshot(machine, { board: { log: [] }, statePath: child }).stack).toEqual(
      [],
    );
    expect(() =>
      hydrateDeusSnapshot(machine, { board: { log: [] }, stack: [{ returnState: ["missing"] }] }),
    ).toThrow(expect.objectContaining({ code: "DEUS_STACK_INVALID_RETURN_STATE" }));
  });
});
