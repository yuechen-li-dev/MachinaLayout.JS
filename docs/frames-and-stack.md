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

- Direct children must be `FixedFrame` or `FillFrame`.
- Axis: `horizontal` or `vertical`.
- Supports `gap` and `padding`.
- `justify`: `start` | `center` | `end` | `space-between`
- `align`: `start` | `center` | `end`

Deliberate exclusions:

- no shrink
- no stretch
- no shrink/basis/min/max negotiation
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


## RootFrame

`RootFrame` is `{ kind: "root" }` and is valid only on the root row (`parent === undefined`).

- Root geometry is still copied from `rootRect` passed by the caller.
- `resolveFrame(parent, { kind: "root" })` throws `RootFrameWithoutRoot`.
- Non-root rows with `RootFrame` are rejected during compile with `RootFrameNotRoot`.


## `FillFrame`

`FillFrame` is valid only as a direct child of `StackArrange`.

- `weight` defaults to `1` and must be finite and `> 0`.
- `cross` defaults to `"fill"`.
- `cross: "fill"` uses stack content cross size.
- numeric `cross` is explicit cross size and must be finite/non-negative.

Fill children consume all remaining main-axis space after fixed sizes and gaps. When one or more fill children exist, `justify` has no additional free space to distribute.
