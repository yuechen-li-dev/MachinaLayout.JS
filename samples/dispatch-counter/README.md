# Dispatch Counter sample

A tiny integration of `machinalayout/dispatch` with MachinaLayout + React.

What this sample demonstrates:

- MachinaDispatch as a columnar event table.
- `dispatchEvent(state, event, DISPATCH)` for deterministic updates.
- No router/store/state-management framework.
- MachinaLayout placing the UI records.
- React components as payloads rendered by `MachinaReactView`.

## Run

```bash
# from repo root
npm run build

cd samples/dispatch-counter
npm install
npm run dev
```

## Build

```bash
npm run build
```
