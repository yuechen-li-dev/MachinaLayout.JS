# Explicit capture

`machinalayout/capture` adds a small utility surface for closure-like behavior with visible dependencies.

Closures are allowed. TypeScript and frontend code use them constantly.

This module exists for cases where hidden captured state makes authoring, inspection, testing, or LLM collaboration harder than it needs to be.

```txt
Closures hide the environment.
Capture records expose it.
```

Or:

```txt
A closure is just a function with a secret backpack.
MachinaCapture makes the backpack visible.
```

## Why

This:

```ts
const renderItem = (item: Item) => render(item, theme, currentUser, dispatch);
```

hides the real inputs.

This:

```ts
import { C } from "machinalayout/capture";

const renderItem = C.task({
  id: "renderItem",
  env: {
    theme,
    currentUser,
    dispatch,
  },
  run: (env, item: Item) => render(item, env.theme, env.currentUser, env.dispatch),
});
```

makes the dependency backpack visible.

That means the environment is:

- visible
- inspectable
- testable
- updateable by copy
- describable to humans and LLMs
- optionally validated

## API

`machinalayout/capture` exports:

- `CaptureTask`
- `CaptureTaskDescription`
- `CaptureDiagnostic`
- `C.task`
- `C.run`
- `C.withEnv`
- `C.rebind`
- `C.map`
- `C.describe`
- `C.validate`
- `rebindCaptureTask`
- `describeCaptureTask`
- `formatCaptureTaskDescription`
- `validateCaptureTask`
- `formatCaptureDiagnostics`

## Formatter example

```ts
import { C } from "machinalayout/capture";

const formatMeasurement = C.task({
  id: "formatMeasurement",
  env: { unitSystem },
  run: (env, value: number) => formatCanvasMeasurement(value, env.unitSystem),
});

const text = C.run(formatMeasurement, 32);
```

## Event handler / command example

```ts
import { C } from "machinalayout/capture";

const selectObject = C.task({
  id: "selectObject",
  env: { dispatch },
  run: (env, objectId: string) => env.dispatch({ kind: "select", id: objectId }),
});
```

## Copy/update env

```ts
import { C } from "machinalayout/capture";

const darkRender = C.withEnv(renderCard, {
  theme: darkTheme,
});
```

`C.withEnv` performs a shallow merge and returns a new task. It does not mutate the original task or environment.

`C.withEnv` intentionally preserves task identity. Use it when you mean "same task, different env values."

## Rebind named variants

```ts
import { C } from "machinalayout/capture";

const formatMoneyFr = C.rebind(formatMoney, {
  id: "formatMoneyFr",
  description: "Format money for French report output.",
  envPatch: {
    locale: "fr-FR",
  },
});
```

`C.rebind` is the named variant helper. It returns a new task, preserves `run`, and lets you update identity and environment together without mutating the original task.

Use this distinction:

- `C.withEnv`: same task identity, different env values
- `C.rebind`: new task identity/description, optionally different env

## Description and validation

`C.describe(task)` returns a small serializable description without dumping environment values:

```ts
const summary = C.describe(selectObject);
```

```ts
{
  kind: "task",
  id: "selectObject",
  description: undefined,
  envKeys: ["dispatch"],
  hasRun: true,
}
```

`C.validate(task)` reports shape issues such as missing ids, non-function runners, and invalid descriptions.

## Boundaries

This module does not:

- ban closures
- analyze closure capture statically
- add a transform or macro
- sandbox runtime access
- replace React hooks
- introduce a DI framework
- require JSON serialization

It is just a narrow authoring surface for visible-env tasks.

See also: [`samples/toolkit-pipeline`](../samples/toolkit-pipeline) and the [Machina toolkit dogfood report](machina-toolkit-dogfood-report.md) for a backend-style sample that uses capture tasks alongside concepts, iterators, async tasks, and match helpers.
