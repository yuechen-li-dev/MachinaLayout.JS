import { describe, it } from "vitest";

import { M } from "../../src/machina";

type Board = { provider: Record<string, string> };
type Event = { type: "edit"; field: string; value: string } | { type: "toggle"; day: number };

describe("scoped transition types", () => {
  it("narrows event payloads and rejects unknown event keys at compile time", () => {
    M.on<Board, Event, "edit">("edit", {
      do: (board, event) => {
        board.provider[event.field] = event.value;
        // @ts-expect-error edit events do not contain toggle fields
        event.day;
      },
    });

    // @ts-expect-error event keys must belong to Event["type"]
    M.on<Board, Event, "missing">("missing", {});
  });
});
