# Adapter overview

Machina adapters ask you to learn one layout model: Machina records. The framework adapter only asks for components in that framework.

Layout geometry stays in `LayoutRow[]` + resolved rectangles from core APIs. Adapter differences are host-renderer details (DOM versus React Native style primitives), not separate layout dialects.

## Adapter comparison

| Adapter | Import path | Host primitive | View registry type | Supports DOM containment? | Notes |
| --- | --- | --- | --- | --- | --- |
| React DOM | `machinalayout/react` | DOM `div` wrappers | React components | Yes | Supports DOM data attributes plus `className`/`style` hooks for host wrappers. |
| React Native | `machinalayout/react-native` | React Native `View` wrappers | React Native components | No | Uses numeric RN styles; no DOM props or containment/content-visibility policy. |
| Vue DOM | `machinalayout/vue` | DOM `div` wrappers | Vue components | Yes | Adapter uses `h()` internally; app code can stay in normal Vue SFC/template component usage. |

## Import guidance

- Subpath imports are preferred for adapters: `machinalayout/react`, `machinalayout/react-native`, and `machinalayout/vue`.
- Root imports remain valid during `0.x` compatibility windows.
