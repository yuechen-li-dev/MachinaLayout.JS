# Frames and Stack

## Rects

Resolved rectangles are numeric records:

- `x`
- `y`
- `width`
- `height`

## `AbsoluteFrame`

Absolute frame gives explicit parent-local position and size.

- `x = parent.x + frame.x`
- `y = parent.y + frame.y`
- `width = frame.width`
- `height = frame.height`

## `AnchorFrame`

Anchor requires exactly two horizontal constraints from `left`, `right`, `width`, and exactly two vertical constraints from `top`, `bottom`, `height`.

Supported horizontal cases:

- `left + width`
- `right + width`
- `left + right`

Supported vertical cases:

- `top + height`
- `bottom + height`
- `top + bottom`

Invalid combinations fail. Negative resolved sizes fail.

## `FixedFrame`

Fixed frame is size-only.

- It cannot resolve by itself.
- It is valid as a direct child of `StackArrange`.
- Otherwise resolution fails with `FixedFrameWithoutArranger`.

## `StackArrange`

Stack is ordered sequence arrangement over direct children.

- Direct children must be `FixedFrame`.
- Axis: `horizontal` or `vertical`.
- Supports `gap` and `padding`.
- `justify`: `start` | `center` | `end` | `space-between`
- `align`: `start` | `center` | `end`

Deliberate exclusions:

- no shrink
- no stretch
- no weights
- no wrap
- no margins

### Toolbar example

```ts
{
  id: "toolbar",
  frame: { kind: "anchor", left: 240, right: 0, top: 64, height: 56 },
  arrange: {
    kind: "stack",
    axis: "horizontal",
    gap: 8,
    padding: { top: 8, right: 8, bottom: 8, left: 8 },
    justify: "start",
    align: "center",
  },
}

{ id: "button-a", parent: "toolbar", frame: { kind: "fixed", width: 120, height: 40 } }
{ id: "button-b", parent: "toolbar", frame: { kind: "fixed", width: 96, height: 40 } }
```

Stack computes positions by arithmetic over order, fixed sizes, gap, and padding.

> Stack is ordered arithmetic, not Flexbox.
