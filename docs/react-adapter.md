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

## Coordinate normalization

Core resolved rects are global/root-space coordinates.

The React adapter renders nested absolutely positioned DOM wrappers, so each node
wrapper is positioned in its parent-local DOM coordinate space:

- `left = node.rect.x - parent.rect.x`
- `top = node.rect.y - parent.rect.y`

The outer wrapper represents the root coordinate space and uses the resolved root
width/height. The root node itself renders at local `left: 0` and `top: 0`.

Examples:

- root rect `{ x: 100, y: 200, width: 800, height: 600 }`
- child rect `{ x: 116, y: 212, width: 100, height: 50 }`
- rendered child CSS `left: 16px; top: 12px;`

Nested example:

- parent rect `{ x: 268, y: 88, width: 816, height: 616 }`
- child rect `{ x: 284, y: 104, width: 784, height: 48 }`
- rendered child CSS `left: 16px; top: 16px;`

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
