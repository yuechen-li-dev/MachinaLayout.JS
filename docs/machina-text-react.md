# MachinaText React Renderer (M2c)

`MachinaTextView` renders MachinaText content inside a rectangle already owned by a parent view. It does not participate in Machina layout resolution, sizing, or measurement.

## Component

- `MachinaTextView`
- `MachinaTextViewProps`

### `text` input forms

- `string`: parsed as `{ kind: "machina-text", text }`
- `MachinaTextSource`: parsed directly (`plain` stays literal)
- `MachinaTextSpec`: parses `spec.source` and applies text policy
- `MachinaTextDocument`: rendered directly with default policy

## Policy fields

Supported policy fields:

- `variant`: `body | label | caption | title | mono`
- `wrap`: `word | none`
- `overflow`: `clip | ellipsis | scroll`
- `align`: `start | center | end`

Defaults are `body`, `word`, `clip`, `start`.

## Link behavior boundary

Links render as standard `<a>` tags.

- optional `linkTarget`
- if `_blank`, renderer sets `rel="noreferrer noopener"`
- optional `onLinkClick(href, event)` callback

No routing, dispatch, or action semantics are implemented.

## Diagnostics

Parsing diagnostics never throw. Best-effort content still renders.

Set `showDiagnostics` to render parser diagnostics for development.
