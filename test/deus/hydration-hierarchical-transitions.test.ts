import { describe, expect, it } from "vitest";
import {
  assertDeusStatePath,
  createDeusSnapshot,
  defineDeusMachine,
  formatDeusPath,
  hydrateDeusSnapshot,
  parseDeusPath,
  stepDeusMachine,
} from "../../src/deus";

type Board = {
  log: string[];
  route?: string;
};

type Event =
  | { type: "navigateSettings" }
  | { type: "logout" }
  | { type: "openModal" }
  | { type: "noop" };

const app = ["app"] as const;
const authenticated = ["app", "authenticated"] as const;
const home = ["app", "authenticated", "home"] as const;
const settings = ["app", "authenticated", "settings"] as const;
const modal = ["app", "authenticated", "modal"] as const;
const signedOut = ["signedOut"] as const;

function createFrontendMachine() {
  return defineDeusMachine<Board, Event>({
    initial: home,
    states: [
      { path: app, onEnter: (board) => board.log.push("enter app") },
      { path: authenticated, onEnter: (board) => board.log.push("enter authenticated") },
      { path: home, onEnter: (board) => board.log.push("enter home") },
      { path: settings, onEnter: (board) => board.log.push("enter settings") },
      { path: modal, onEnter: (board) => board.log.push("enter modal") },
      { path: signedOut, onEnter: (board) => board.log.push("enter signedOut") },
    ],
    transitions: [
      { key: "root.logout", from: app, event: "logout", to: "/signedOut" },
      {
        key: "auth.navigateSettings",
        from: authenticated,
        event: "navigateSettings",
        to: "settings",
      },
      {
        key: "home.navigateSettings",
        from: home,
        event: "navigateSettings",
        to: settings,
        score: 2,
      },
      { key: "auth.openModal", from: authenticated, event: "openModal", to: "modal" },
    ],
  });
}

describe("Deus hydration and hierarchical transition ergonomics", () => {
  it("preserves initial snapshot behavior without statePath", () => {
    const machine = createFrontendMachine();
    const board = { log: [] as string[] };

    const snapshot = createDeusSnapshot(machine, board);

    expect(snapshot.state).toEqual(home);
    expect(snapshot.board).toBe(board);
    expect(board.log).toEqual([]);
  });

  it("hydrates from array and string state paths without replaying transition actions", () => {
    const machine = createFrontendMachine();
    const arrayBoard = { log: [] as string[] };
    const stringBoard = { log: [] as string[] };

    const arraySnapshot = createDeusSnapshot(machine, { board: arrayBoard, statePath: settings });
    const stringSnapshot = createDeusSnapshot(machine, {
      board: stringBoard,
      statePath: "app/authenticated/home",
    });

    expect(arraySnapshot.state).toEqual(settings);
    expect(stringSnapshot.state).toEqual(home);
    expect(arrayBoard.log).toEqual([]);
    expect(stringBoard.log).toEqual([]);
  });

  it("supports explicit hydration helper and optional enter hooks", () => {
    const machine = createFrontendMachine();
    const board = { log: [] as string[] };

    const snapshot = hydrateDeusSnapshot(machine, {
      board,
      statePath: "app/authenticated/settings",
      runEnter: true,
    });

    expect(snapshot.state).toEqual(settings);
    expect(board.log).toEqual(["enter app", "enter authenticated", "enter settings"]);
  });

  it("rejects invalid hydration paths and does not mutate inputs", () => {
    const machine = createFrontendMachine();
    const board = { log: [] as string[] };
    const options = { board, statePath: ["app", "missing"] as const };

    expect(() => createDeusSnapshot(machine, options)).toThrow(
      expect.objectContaining({ code: "UnknownDeusStatePath" }),
    );
    expect(options.statePath).toEqual(["app", "missing"]);
    expect(board.log).toEqual([]);
  });

  it("round-trips string paths and validates machine paths", () => {
    const machine = createFrontendMachine();
    const parsed = parseDeusPath("app/authenticated/home");

    expect(parsed).toEqual(home);
    expect(formatDeusPath(parsed)).toBe("app/authenticated/home");
    expect(() => assertDeusStatePath(machine, "app/authenticated/settings")).not.toThrow();
    expect(() => assertDeusStatePath(machine, "app/unknown")).toThrow(
      expect.objectContaining({ code: "UnknownDeusStatePath" }),
    );
  });

  it("keeps leaf transitions ahead of parent transitions and records searched paths", () => {
    const machine = createFrontendMachine();
    const result = stepDeusMachine(
      machine,
      createDeusSnapshot(machine, { board: { log: [] as string[] }, statePath: home }),
      { type: "navigateSettings" },
    );

    expect(result.snapshot.state).toEqual(settings);
    expect(result.trace.selectedTransition?.key).toBe("home.navigateSettings");
    expect(result.trace.transitionOwnerPath).toEqual(home);
    expect(result.trace.usedParentTransition).toBe(false);
    expect(result.trace.searchedTransitionPaths).toEqual([home, authenticated, app]);
    expect(JSON.stringify(result.trace)).toContain("searchedTransitionPaths");
  });

  it("falls back to parent and root transitions and resolves relative targets from the owner path", () => {
    const machine = createFrontendMachine();
    const start = createDeusSnapshot(machine, { board: { log: [] as string[] }, statePath: home });

    const parentResult = stepDeusMachine(machine, start, { type: "openModal" });
    expect(parentResult.snapshot.state).toEqual(modal);
    expect(parentResult.trace.selectedTransition?.key).toBe("auth.openModal");
    expect(parentResult.trace.transitionOwnerPath).toEqual(authenticated);
    expect(parentResult.trace.usedParentTransition).toBe(true);

    const rootResult = stepDeusMachine(machine, start, { type: "logout" });
    expect(rootResult.snapshot.state).toEqual(signedOut);
    expect(rootResult.trace.selectedTransition?.key).toBe("root.logout");
    expect(rootResult.trace.transitionOwnerPath).toEqual(app);
    expect(rootResult.trace.usedParentTransition).toBe(true);
  });

  it("preserves no-op behavior when no transition matches", () => {
    const machine = createFrontendMachine();
    const snapshot = createDeusSnapshot(machine, {
      board: { log: [] as string[] },
      statePath: home,
    });

    const result = stepDeusMachine(machine, snapshot, { type: "noop" });

    expect(result.snapshot.state).toEqual(home);
    expect(result.trace.selectedTransition).toBeUndefined();
    expect(result.trace.searchedTransitionPaths).toEqual([home, authenticated, app]);
  });

  it("rejects invalid relative parent targets during validation", () => {
    expect(() =>
      defineDeusMachine<Board, Event>({
        initial: home,
        states: [{ path: app }, { path: authenticated }, { path: home }],
        transitions: [
          { key: "bad", from: authenticated, event: "navigateSettings", to: "missing" },
        ],
      }),
    ).toThrow(expect.objectContaining({ code: "UnknownDeusStatePath" }));
  });

  it("hydrates frontend-shaped route state and uses parent navigation from nested app states", () => {
    const machine = createFrontendMachine();
    const board = { log: [] as string[], route: "/app/authenticated/home" };
    const hydrated = hydrateDeusSnapshot(machine, {
      board,
      statePath: "app/authenticated/home",
    });

    const settingsResult = stepDeusMachine(machine, hydrated, { type: "openModal" });
    const logoutResult = stepDeusMachine(machine, hydrated, { type: "logout" });

    expect(hydrated.state).toEqual(home);
    expect(settingsResult.snapshot.state).toEqual(modal);
    expect(logoutResult.snapshot.state).toEqual(signedOut);
  });
});
