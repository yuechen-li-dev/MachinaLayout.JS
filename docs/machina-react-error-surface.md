# Machina React error surface

`MachinaReactView` can now render a visible diagnostic surface when Machina layout/render work fails at runtime.

This exists for the cases where a blank app surface is worse than an explicit failure:

- humans need to see what broke
- browser automation and LLM inspection need rendered diagnostics
- the console remains useful, but it should not be the only visible source of truth

This does not change layout resolver semantics. It does not remove thrown errors from strict paths. It does not replace tests.

## Default behavior

By default, `MachinaReactView` enables an error boundary surface:

```tsx
<MachinaReactView layout={layout} views={views} />
```

If synchronous layout/render preparation fails inside the adapter, or if a descendant React view throws during render, the visible surface renders:

- error code
- error name
- message
- diagnostics/details when available
- optional stack output

The default title is:

```txt
MachinaLayout render failed
```

The surface also notes:

```txt
The error was also reported to the console.
```

Console output remains secondary, not replaced.

## Adapter props

`MachinaReactView` accepts these error-surface props:

- `errorBoundary?: boolean`
- `errorFallback?: React.ComponentType<MachinaReactErrorSurfaceProps>`
- `showErrorStack?: boolean`
- `onMachinaError?: (diagnostic: MachinaErrorDiagnostic, error: unknown) => void`

Default behavior:

- `errorBoundary` defaults to `true`
- `showErrorStack` defaults to `false`

## Custom fallback

Provide a replacement surface if the default UI does not fit your app:

```tsx
import type { MachinaReactErrorSurfaceProps } from "machinalayout/react";

function AppFallback({ diagnostic }: MachinaReactErrorSurfaceProps) {
  return (
    <div>
      <h1>MachinaLayout render failed</h1>
      <pre>{diagnostic.code}</pre>
      <pre>{diagnostic.message}</pre>
    </div>
  );
}

<MachinaReactView layout={layout} views={views} errorFallback={AppFallback} />;
```

Custom fallbacks receive the normalized `MachinaErrorDiagnostic`.

## Strict throw-through mode

Disable the boundary when a test or harness should observe the original throw directly:

```tsx
<MachinaReactView layout={layout} errorBoundary={false} />
```

This preserves throw-through behavior for strict render assertions.

## Error normalization

Core exports `normalizeMachinaError(error)` and `MachinaErrorDiagnostic` so adapters can reuse the same diagnostic shape.

The normalizer preserves known Machina codes when available and safely handles:

- `MachinaLayoutError`
- other `Error` instances
- non-`Error` thrown values

The diagnostic shape is:

```ts
type MachinaErrorDiagnostic = {
  code: string;
  name: string;
  message: string;
  details?: readonly string[];
  cause?: string;
  stack?: string;
};
```

## Adapter scope

M33b ships the visible error surface for React first.

The normalization helpers are reusable by other adapters, but Vue and React Native are not changed here beyond shared core exports.
