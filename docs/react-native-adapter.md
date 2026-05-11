# React Native adapter

`MachinaReactNativeView` renders a `ResolvedLayoutDocument` into nested React Native `View` wrappers.

## Import

```ts
import { MachinaReactNativeView } from "machinalayout/react-native";
```

## Peer dependency

Install React Native in your app. `machinalayout` declares `react-native` as an optional peer.

## Basic example

```tsx
<MachinaReactNativeView
  layout={layout}
  views={{ Panel: PanelView }}
  viewData={{ Panel: { title: "Now Playing" } }}
  nodeData={{ sidebar: { selected: true } }}
  layers={{ base: { z: 0 }, overlay: { z: 2 } }}
  debug={false}
/>
```

## Supported concepts

- `view`/`slot` lookup (`view` wins over `slot`)
- `viewData`/`nodeData`
- layer + node z sorting
- parent-local coordinate normalization
- optional debug borders/labels

## Differences vs React DOM adapter

- uses React Native `View`/`Text`
- numeric style values
- no `className`
- no DOM data attributes
- no containment/content-visibility

## Not included

- text renderer
- portals
- DOM-only features
