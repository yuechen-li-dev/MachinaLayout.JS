# Machina Control Room (M0j Sample)

This sample demonstrates MachinaLayout's flat-row workflow:

`LayoutRow[]` authoring → `resolveLayoutRows` → `MachinaReactView` rendering.

It showcases anchor/fixed frames, stack arrangement, z-order overlap, and slot-based React rendering. Machina controls **outer node rectangles**; local shadcn-style components only style **slot internals**.

## Run

```bash
cd samples/control-room
npm install
npm run dev
```

## Numeric controls demonstrated

- **Sidebar left**: edits the `sidebar` row's anchor `left` and updates `main` accordingly.
- **Toolbar gap**: edits `toolbar.arrange.gap` to move fixed toolbar children.
- **Floating z**: edits `floating-action.z` (clamped `-5..5`) to show paint order changes.
