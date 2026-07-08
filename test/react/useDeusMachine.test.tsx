/* @vitest-environment jsdom */
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createMachinaDebugOverlayMachine,
  getMachinaDebugOverlayBehavior,
  type DeusPathInput,
  type DeusMachine,
} from "../../src/deus";
import { useDeusMachine } from "../../src/react";
import type { UseDeusMachineOptions, UseDeusMachineResult } from "../../src/react";

type Board = { count: number };
type Event = { type: "inc" } | { type: "resetState" };
const machine: DeusMachine<Board, Event> = {
  initial: ["idle"],
  states: [{ path: ["idle"] }, { path: ["active"] }],
  transitions: [
    { key: "inc", from: ["idle"], event: "inc", to: ["active"], do: (b) => b.count++ },
    { key: "active.inc", from: ["active"], event: "inc", do: (b) => b.count++ },
    { key: "resetState", from: ["active"], event: "resetState", to: ["idle"] },
  ],
};

function Harness(props: {
  initial: Board | (() => Board);
  options?: UseDeusMachineOptions<DeusPathInput>;
  onValue: (value: UseDeusMachineResult<Board, Event>) => void;
}) {
  const value = useDeusMachine(machine, props.initial, props.options);
  props.onValue(value);
  return (
    <div>
      {value.board.count}:{value.state.join("/")}
    </div>
  );
}

describe("React useDeusMachine", () => {
  it("initializes from a board value", () => {
    let hook!: UseDeusMachineResult<Board, Event>;
    render(<Harness initial={{ count: 1 }} onValue={(v) => (hook = v)} />);
    expect(hook.board.count).toBe(1);
    expect(hook.snapshot.stepIndex).toBe(0);
    expect(hook.state).toEqual(["idle"]);
  });

  it("initializes from a factory lazily", () => {
    const factory = vi.fn(() => ({ count: 2 }));
    let hook!: UseDeusMachineResult<Board, Event>;
    render(<Harness initial={factory} onValue={(v) => (hook = v)} />);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(hook.board.count).toBe(2);
  });

  it("hydrates from an explicit initial state", () => {
    let hook!: UseDeusMachineResult<Board, Event>;
    render(
      <Harness
        initial={{ count: 1 }}
        options={{ initialState: ["active"] }}
        onValue={(v) => (hook = v)}
      />,
    );
    expect(hook.state).toEqual(["active"]);
  });

  it("hydrates from a board factory and explicit initial state", () => {
    const factory = vi.fn(() => ({ count: 3 }));
    let hook!: UseDeusMachineResult<Board, Event>;
    render(
      <Harness
        initial={factory}
        options={{ initialState: ["active"] }}
        onValue={(v) => (hook = v)}
      />,
    );
    expect(factory).toHaveBeenCalledTimes(1);
    expect(hook.state).toEqual(["active"]);
    expect(hook.board.count).toBe(3);
  });

  it("dispatches, returns result, tracks trace, reflects mutations, and avoids stale snapshots", () => {
    let hook!: UseDeusMachineResult<Board, Event>;
    render(<Harness initial={{ count: 0 }} onValue={(v) => (hook = v)} />);
    let result: ReturnType<typeof hook.dispatch> | undefined;
    act(() => {
      result = hook.dispatch({ type: "inc" });
    });
    expect(result?.snapshot.state).toEqual(["active"]);
    act(() => {});
    expect(hook.board.count).toBe(1);
    expect(hook.lastTrace?.selectedTransition?.key).toBe("inc");
    act(() => {
      hook.dispatch({ type: "inc" });
      hook.dispatch({ type: "inc" });
    });
    expect(hook.board.count).toBe(3);
    expect(hook.snapshot.stepIndex).toBe(3);
  });

  it("resets to the original or provided board and clears trace", () => {
    let hook!: UseDeusMachineResult<Board, Event>;
    render(<Harness initial={() => ({ count: 4 })} onValue={(v) => (hook = v)} />);
    act(() => hook.dispatch({ type: "inc" }));
    expect(hook.lastTrace).not.toBeNull();
    act(() => hook.reset());
    expect(hook.board.count).toBe(4);
    expect(hook.lastTrace).toBeNull();
    expect(hook.snapshot.stepIndex).toBe(0);
    act(() => hook.reset({ count: 9 }));
    expect(hook.board.count).toBe(9);
  });

  it("does not keep resetting to initialState on rerender", () => {
    let hook!: UseDeusMachineResult<Board, Event>;
    const rendered = render(
      <Harness
        initial={{ count: 0 }}
        options={{ initialState: ["active"] }}
        onValue={(v) => (hook = v)}
      />,
    );
    act(() => {
      hook.dispatch({ type: "resetState" });
    });
    expect(hook.state).toEqual(["idle"]);
    rendered.rerender(
      <Harness
        initial={{ count: 999 }}
        options={{ initialState: ["active"] }}
        onValue={(v) => (hook = v)}
      />,
    );
    expect(hook.state).toEqual(["idle"]);
    expect(hook.board.count).toBe(0);
  });

  it("surfaces invalid initialState like snapshot hydration", () => {
    expect(() =>
      render(
        <Harness
          initial={{ count: 0 }}
          options={{ initialState: ["missing"] }}
          onValue={() => {}}
        />,
      ),
    ).toThrow(expect.objectContaining({ code: "UnknownDeusStatePath" }));
  });

  it("drives the debug overlay machine", () => {
    const debugMachine = createMachinaDebugOverlayMachine();
    let debug!: UseDeusMachineResult<
      import("../../src/deus").MachinaDebugOverlayBoard,
      import("../../src/deus").MachinaDebugOverlayEvent
    >;
    function DebugHarness() {
      debug = useDeusMachine(debugMachine, {
        mode: "collapsed",
        labels: true,
        borders: true,
      } as import("../../src/deus").MachinaDebugOverlayBoard);
      return null;
    }
    render(<DebugHarness />);
    act(() => debug.dispatch({ type: "showOverlay" }));
    expect(getMachinaDebugOverlayBehavior(debug.board).visible).toBe(true);
  });
});
