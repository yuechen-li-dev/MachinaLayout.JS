# Machina Control Room (M0 Sample)

This sample demonstrates:

- flat `LayoutRow[]` authoring,
- `AnchorFrame` / `FixedFrame` / `FillFrame` / `StackArrange`,
- sibling-local z-order,
- view-based React rendering (with slot fallback),
- numeric layout edits.
- typed `UiLength` anchor constraints (`px` and normalized `ui`).

## Run

```bash
cd samples/control-room
npm install
npm run dev
```

## Controls

- **Sidebar left**
- **Toolbar gap**
- **Floating z**
- **Debug**
- **Containment / content visibility** (when enabled in the sample UI)

## Boundary

Machina controls outer rectangles. Sample components control view internals (using `view ?? slot`).


Toolbar demo includes a `toolbar-fill` FillFrame node between Inspect and Reset, so status content automatically consumes remaining width.

- node-level `offset` demo (`floating-action` uses a small post-placement nudge).


This sample now also demonstrates `MachinaTextView` for lightweight parsed text rendering inside existing views.
It also includes a minimal vertical-rhythm demo via `leading` and `valign` policy in header/toolbar text.


This sample keeps `views` as stable component references and sends changing control state through `viewData` / `nodeData`.
