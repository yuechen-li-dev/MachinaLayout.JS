# MachinaCanvas UI Components

```txt
Figma designs pages.
MachinaCanvas compiles pages.
```

M30o treats UI components as structured canvas objects with code lowering
targets. A `uiComponent` object has normal canvas bounds, a built-in component
ID, serializable props, and optional export naming metadata.

The editor preview is deliberately view-only. Built-in Button, Card, Input, and
Badge previews render on the SVG artboard through `foreignObject`, but they do
not execute arbitrary React components, hooks, backend calls, routing, dispatch,
or form submission.

The `.mcanvas` export remains the semantic handoff. UI component object TOML
stores `[component]` and `[props]` blocks so humans and LLMs can patch component
intent without digging through generated code.

`generated-page.tsx` is a lossy React/MachinaLayout lowering artifact. It is a
working page shell a developer can edit and wire to real app logic later. It is
not a complete round-trip source for MachinaCanvas.
