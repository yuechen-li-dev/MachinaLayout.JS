/* @vitest-environment jsdom */
import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  View: ({ children, ...props }: any) => React.createElement("rn-view", props, children),
  Text: ({ children, ...props }: any) => React.createElement("rn-text", props, children),
}));

import type { DeusMachine } from "../../src/deus";
import { useDeusMachine } from "../../src/react-native";
import type { UseDeusMachineResult } from "../../src/react-native";

type Board = { count: number };
type Event = { type: "inc" };
const machine: DeusMachine<Board, Event> = {
  initial: ["idle"],
  states: [{ path: ["idle"] }, { path: ["active"] }],
  transitions: [{ key: "inc", from: ["idle"], event: "inc", to: ["active"], do: (b) => b.count++ }],
};

describe("React Native useDeusMachine", () => {
  it("exports the hook and supports core dispatch/reset behavior without the DOM adapter", () => {
    let hook!: UseDeusMachineResult<Board, Event>;
    function Harness() {
      hook = useDeusMachine(machine, { count: 0 });
      return React.createElement("Text", null, hook.board.count);
    }
    act(() => {
      create(React.createElement(Harness));
    });
    let result: ReturnType<typeof hook.dispatch> | undefined;
    act(() => {
      result = hook.dispatch({ type: "inc" });
    });
    expect(result?.snapshot.state).toEqual(["active"]);
    expect(hook.board.count).toBe(1);
    expect(hook.lastTrace?.selectedTransition?.key).toBe("inc");
    act(() => hook.reset({ count: 5 }));
    expect(hook.board.count).toBe(5);
    expect(hook.lastTrace).toBeNull();
  });
});
