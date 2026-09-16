# Viewport2D

`machinalayout/viewport2d` contains framework-neutral coordinate conversion, centered zoom, and pan transforms for static two-dimensional engineering surfaces.

It accepts plain client bounds and viewport rectangles. Applications retain ownership of semantic coordinates, input events, and persistence. The package does not schedule animation frames or own document state.

```ts
import { clientPointToViewport, panViewport, zoomViewport } from "machinalayout/viewport2d";
```

The surface was extracted from the event-driven viewport pattern used by MachinaCanvas for reuse in TOMinaL Formboard. It contains no harness or Formboard semantics.

Fit bounds remain application-owned because the meaningful target (board, selection, sheet, or scene) is semantic. A workspace should expose one fit action and call that same action from visible controls and keyboard commands.
