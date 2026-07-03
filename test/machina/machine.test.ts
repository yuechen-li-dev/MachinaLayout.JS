import { describe, expect, it } from "vitest";
import { createDeusSnapshot, DeusMachinaError, stepDeusMachine } from "../../src/deus";
import { M, choose, machine, on, state } from "../../src/machina";

type Board = {
  captured?: boolean;
  startY?: number;
  offset?: number;
  tempK?: number;
  mode?: string;
  order?: string[];
  previous?: string;
};

type Event =
  | { type: "thumb:press"; y: number }
  | { type: "pointer:move"; y: number }
  | { type: "pointer:up" }
  | { type: "tick" };

describe("machina Deus authoring helpers", () => {
  it("creates state rows with copied paths and hooks", () => {
    const path = ["dragging"];
    const onEnter = (board: Board) => {
      board.captured = true;
    };
    const onExit = (board: Board) => {
      board.captured = false;
    };

    const row = state<Board, Event>(path, { onEnter, onExit });

    expect(row).toEqual({ path: ["dragging"], onEnter, onExit });
    expect(row.path).not.toBe(path);
  });

  it("creates exact event transitions and copies options", () => {
    const from = ["idle"];
    const to = ["dragging"];
    const action = (board: Board, event: Event) => {
      if (event.type === "thumb:press") board.startY = event.y;
    };
    const when = () => true;
    const score = () => 4;
    const reason = () => "pressed";

    const row = on<Board, Event>("thumb:press", from, to, action, { when, score, reason });

    expect(row).toMatchObject({
      key: "idle:thumb:press->dragging",
      event: "thumb:press",
      from: ["idle"],
      to: ["dragging"],
      do: action,
      when,
      score,
      reason,
    });
    expect(row.from).not.toBe(from);
    expect(row.to).not.toBe(to);
  });

  it("lets custom transition keys win and marks dynamic target keys", () => {
    const dynamic = () => ["idle"];
    expect(on<Board, Event>("tick", ["idle"], ["idle"], undefined, { key: "custom" }).key).toBe(
      "custom",
    );
    expect(on<Board, Event>("tick", ["controller", "advance"], dynamic).key).toBe(
      "controller/advance:tick->dynamic",
    );
  });

  it("runs an M.state/M.on machine through the Deus kernel", () => {
    const dragMachine = machine<Board, Event>({
      initial: ["idle"],
      states: [
        state(["idle"]),
        state(["dragging"], {
          onEnter: (board) => {
            board.captured = true;
          },
          onExit: (board) => {
            board.captured = false;
          },
        }),
      ],
      transitions: [
        on("thumb:press", ["idle"], ["dragging"], (board, event) => {
          if (event.type === "thumb:press") board.startY = event.y;
        }),
        on("pointer:move", ["dragging"], ["dragging"], (board, event) => {
          if (event.type === "pointer:move") board.offset = event.y - (board.startY ?? 0);
        }),
        on("pointer:up", ["dragging"], ["idle"]),
      ],
    });

    let result = stepDeusMachine(dragMachine, createDeusSnapshot<Board, Event>(dragMachine, {}), {
      type: "thumb:press",
      y: 10,
    });
    expect(result.snapshot.state).toEqual(["dragging"]);
    expect(result.snapshot.board).toMatchObject({ captured: true, startY: 10 });

    result = stepDeusMachine(dragMachine, result.snapshot, { type: "pointer:move", y: 17 });
    expect(result.snapshot.board.offset).toBe(7);

    result = stepDeusMachine(dragMachine, result.snapshot, { type: "pointer:up" });
    expect(result.snapshot.state).toEqual(["idle"]);
    expect(result.snapshot.board.captured).toBe(false);
  });

  it("creates utility transitions and preserves candidate and option fields", () => {
    const heat = {
      key: "heat",
      when: (board: Board) => (board.tempK ?? 0) < 292.15,
      score: 90,
      reason: "cold",
      do: (board: Board) => {
        board.mode = "heat";
      },
    };
    const cool = {
      key: "cool",
      score: (board: Board) => ((board.tempK ?? 0) > 299.15 ? 88 : 0),
      reason: () => "warm",
      do: (board: Board) => {
        board.mode = "cool";
      },
    };
    const outerDo = (board: Board) => {
      board.order?.push("outer");
    };
    const hysteresis = { previous: (board: Board) => board.previous, margin: 5 };

    const row = choose<Board, Event>("tick", ["decide"], ["apply"], [heat, cool], {
      when: () => true,
      score: 1,
      reason: "choose mode",
      hysteresis,
      do: outerDo,
    });

    expect(row.key).toBe("decide:tick->apply:utility");
    expect(row.utility?.map((candidate) => candidate.key)).toEqual(["heat", "cool"]);
    expect(row.utility?.[0]).toMatchObject({ key: "heat", when: heat.when, score: 90 });
    expect(row.utility?.[0]).not.toHaveProperty("to");
    expect(row).toMatchObject({
      when: row.when,
      score: 1,
      reason: "choose mode",
      hysteresis,
      do: outerDo,
    });
  });

  it("lets custom utility keys win and marks dynamic utility target keys", () => {
    const dynamic = () => ["apply"];
    const candidates = [{ key: "idle", score: 0 }];
    expect(
      choose<Board, Event>("tick", ["decide"], ["apply"], candidates, { key: "custom" }).key,
    ).toBe("custom");
    expect(choose<Board, Event>("tick", ["decide"], dynamic, candidates).key).toBe(
      "decide:tick->dynamic:utility",
    );
  });

  it("runs utility choices and preserves candidate-before-transition action order", () => {
    const controller = M.machine<Board, Event>({
      initial: ["decide"],
      states: [M.state(["decide"]), M.state(["apply"])],
      transitions: [
        M.choose(
          "tick",
          ["decide"],
          ["apply"],
          [
            {
              key: "heat",
              when: (board) => (board.tempK ?? 0) < 292.15,
              score: 90,
              do: (board) => board.order?.push("candidate"),
            },
            { key: "idle", score: 0, do: (board) => board.order?.push("idle") },
          ],
          { do: (board) => board.order?.push("outer") },
        ),
      ],
    });

    const result = stepDeusMachine(
      controller,
      createDeusSnapshot<Board, Event>(controller, { tempK: 280, order: [] }),
      {
        type: "tick",
      },
    );

    expect(result.snapshot.state).toEqual(["apply"]);
    expect(result.snapshot.board.order).toEqual(["candidate", "outer"]);
    expect(result.trace.selectedTransition?.utility?.selected?.key).toBe("heat");
  });

  it("passes hysteresis through existing Deus utility semantics", () => {
    const controller = M.machine<Board, Event>({
      initial: ["decide"],
      states: [M.state(["decide"]), M.state(["apply"])],
      transitions: [
        M.choose(
          "tick",
          ["decide"],
          ["apply"],
          [
            {
              key: "previous",
              score: 10,
              do: (board) => {
                board.mode = "previous";
              },
            },
            {
              key: "next",
              score: 12,
              do: (board) => {
                board.mode = "next";
              },
            },
          ],
          { hysteresis: { previous: (board) => board.previous, margin: 5 } },
        ),
      ],
    });

    const result = stepDeusMachine(
      controller,
      createDeusSnapshot<Board, Event>(controller, { previous: "previous" }),
      {
        type: "tick",
      },
    );

    expect(result.snapshot.board.mode).toBe("previous");
  });

  it("delegates machine validation to defineDeusMachine", () => {
    expect(() =>
      M.machine<Board, Event>({
        initial: ["idle"],
        states: [M.state(["idle"]), M.state(["idle"])],
        transitions: [],
      }),
    ).toThrow(DeusMachinaError);
  });

  it("exports named helpers and M namespace helpers", () => {
    expect(machine).toBe(M.machine);
    expect(state).toBe(M.state);
    expect(on).toBe(M.on);
    expect(choose).toBe(M.choose);
  });
});
