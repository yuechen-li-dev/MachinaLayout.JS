# Machina Control Room (M0 Sample)

This sample demonstrates:

- flat `LayoutRow[]` authoring,
- `AnchorFrame` / `FixedFrame` / `FillFrame` / `StackArrange`,
- sibling-local z-order,
- slot-based React rendering,
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

Machina controls outer rectangles. Sample components control slot internals.


Toolbar demo includes a `toolbar-fill` FillFrame node between Inspect and Reset, so status content automatically consumes remaining width.
