# Vue adapter (`machinalayout/vue`)

`MachinaVueView` renders a `ResolvedLayoutDocument` into DOM wrappers plus Vue view components.

- Import path: `import { MachinaVueView } from "machinalayout/vue";`
- Peer dependency: `vue` (`>=3.4 <4`).
- Layout remains Machina records/resolved docs; users do **not** write template loops/directives for structural layout.
- The adapter uses Vue `h()` internally so consumers can use it as a normal Vue component.

## Basic usage

```vue
<script setup lang="ts">
import { MachinaVueView } from "machinalayout/vue";

const views = {
  Panel: {
    props: ["id"],
    template: `<div>panel: {{ id }}</div>`,
  },
};
</script>

<template>
  <MachinaVueView :layout="layout" :views="views" :view-data="viewData" :node-data="nodeData" />
</template>
```

## Props note

To avoid conflicts with Vue fallthrough attrs, root/node styling props are:

- `rootClass`, `rootStyle`
- `nodeClass`, `nodeStyle`

(Instead of React-style `className` / `style` names.)

## Supported

- `view ?? slot` lookup
- `viewData` / `nodeData`
- layer/z sorting (`layer z`, then `node z`, then sibling order)
- DOM containment/content-visibility policy
- debug mode
- parent-local coordinate normalization

## Not included in A3a

- Vue Router integration
- Pinia/state abstractions
- directives abstraction layer
- text renderer
- portals/reparenting
