# React Adapter

## Boundary

- Core layout resolution has no React dependency.
- The React adapter consumes a `ResolvedLayoutDocument`.
- The adapter renders absolutely positioned wrappers.
- Slot components render inside those wrappers.

## Basic usage

```tsx
import { MachinaReactView, resolveLayoutRows } from "machinalayout";

const resolved = resolveLayoutRows(rows, rootRect);

const views = {
  header: HeaderView,
  sidebar: SidebarView,
  toolbarButton: ToolbarButtonView,
};

<MachinaReactView layout={resolved} views={views} />;
```

## Slot props

Slot views receive:

- `id`
- `rect`
- `debugLabel`
- `node`

## Root normalization

The adapter uses root-local embedding.

- Rendered node `left = node.rect.x - root.rect.x`
- Rendered node `top = node.rect.y - root.rect.y`
- Root wrapper width/height come from resolved root size.

Example:

- root rect `{ x: 100, y: 200, width: 800, height: 600 }`
- child rect `{ x: 116, y: 212, width: 100, height: 50 }`
- rendered child CSS `left: 16px; top: 12px;`

## CSS boundary

Allowed for Machina wrappers:

- position (`relative`/`absolute`)
- `left` / `top` / `width` / `height`
- `box-sizing`
- `z-index`
- containment/content-visibility
- cosmetic/debug styles

Not allowed as Machina geometry authority:

- flexbox
- grid
- margins
- transforms
- DOM measurement
- CSS classes determining geometry

Slot internals may use normal React/CSS/shadcn-style components. Machina controls only the outer rectangle.
