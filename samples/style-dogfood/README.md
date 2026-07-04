# MachinaStyle Dogfood

This sample authors component styles in `src/style.ts`, lowers them to checked-in `src/generated.css`, and imports that CSS normally from React.

```bash
npm install
npm run generate:style
npm run build
```

The page intentionally stays small: a control panel with token swatches, buttons, cards, badges, a field, and a state matrix. Its purpose is to exercise MachinaStyle tokens, semantic records, explicit layers, `S.compose`, `S.with`, `S.set`, `S.inherit`, `S.unset`, validation diagnostics, and deterministic CSS serialization.
