# DeusMachina

DeusMachina is MachinaLayout's tiny behavioral kernel. It is deliberately small: utility judgment, explicit row-first state machines, stack-style state paths, deterministic stepping, and trace output.

It is **not** full Dominatus. It does not include LLM arbitration, tools, async workflows, actors, persistence, schedulers, React hooks, or external actuators.

## Import

```ts
import { defineDeusMachine, judgeUtility, stepDeusMachine } from "machinalayout/deus";
```

## Utility judgment

`judgeUtility(context, candidates, options)` evaluates candidates in author order. Omitted `when` means eligible, ineligible candidates stay in the trace with score `0`, finite scores are required, and the highest eligible score wins. Ties are stable by first candidate order. Optional hysteresis can keep a previous candidate until a challenger beats it by the configured margin.

## Row-first machines

Machines are authored as rows:

```ts
defineDeusMachine({
  initial: ["debugOverlay", "collapsed"],
  states: [{ path: ["debugOverlay", "collapsed"] }],
  transitions: [{ key: "show", from: ["debugOverlay", "collapsed"], event: "showOverlay" }],
});
```

Hierarchy comes from stack paths such as `debugOverlay/nonInteractiveOverlay`, not from nested object trees. A step considers transitions from the leaf path first, then ancestors upward, preserving transition row order inside each path.

## Step traces and mutable boards

`stepDeusMachine` returns a new snapshot and a trace containing considered transitions, eligibility, scores, selected transition, and any inner utility judgment. The board is preserved by reference; user actions may mutate it. Machine definitions are treated as immutable.

## Debug overlay example

The `createMachinaDebugOverlayMachine` helper models the controlled overlay modes used by the React adapter:

- `collapsed`: no blocking overlay.
- `nonInteractiveOverlay`: labels and borders can be visible while `pointer-events: none` keeps automation and app interactions unblocked.
- `interactivePanel`: visible panel UI with pointer interaction enabled.

Use `getMachinaDebugOverlayBehavior(board)` when rendering controlled overlay UI.
