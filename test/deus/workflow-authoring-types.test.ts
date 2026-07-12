import { describe, it } from "vitest";

import { M } from "../../src/machina";

type Board = { value: string; allowed: boolean };
type Event = { type: "edit"; value: string } | { type: "submit" };

describe("workflow authoring types", () => {
  it("binds board/event types and narrows child on callbacks", () => {
    M.workflow<Board, Event>(["form"], ({ on, scope, goto, relative }) => [
      scope(relative("editing", "value"), [
        on("edit", {
          do: (board, event) => {
            board.value = event.value;
            // @ts-expect-error edit events do not contain submit-only data
            event.missing;
          },
          when: (board, event) => board.allowed && event.value.length > 0,
          to: (_board, event) => (event.value ? goto("done") : undefined),
        }),
      ]),
      scope("done", [on("submit", {})]),
    ]);

    M.workflow<Board, Event>(["form"], ({ on, scope }) => [
      scope("editing", [
        // @ts-expect-error event keys must belong to Event["type"]
        on("missing", {}),
      ]),
    ]);
  });
});
