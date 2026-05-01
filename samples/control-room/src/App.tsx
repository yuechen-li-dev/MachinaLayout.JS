import { useMemo, useState } from "react";
import { MachinaReactView, resolveLayoutRows, type ResolvedLayoutDocument } from "../../../src/index";
import { buildDemoRows } from "./demoLayout";
import { createViews } from "./views";

const ROOT_RECT = { x: 0, y: 0, width: 1100, height: 720 };

export function App() {
  const [sidebarLeft, setSidebarLeft] = useState(16);
  const [toolbarGap, setToolbarGap] = useState(8);
  const [floatingZ, setFloatingZ] = useState(3);
  const [debug, setDebug] = useState(false);

  const resolved: ResolvedLayoutDocument = useMemo(
    () => resolveLayoutRows(buildDemoRows({ sidebarLeft, toolbarGap, floatingZ: Math.max(-5, Math.min(5, floatingZ)) }), ROOT_RECT),
    [sidebarLeft, toolbarGap, floatingZ]
  );

  const reset = () => {
    setSidebarLeft(16);
    setToolbarGap(8);
    setFloatingZ(3);
    setDebug(false);
  };

  const views = useMemo(
    () =>
      createViews(resolved, {
        sidebarLeft,
        toolbarGap,
        floatingZ,
        debug,
        setSidebarLeft,
        setToolbarGap,
        setFloatingZ: (n) => setFloatingZ(Math.max(-5, Math.min(5, n))),
        setDebug,
        reset,
      }),
    [resolved, sidebarLeft, toolbarGap, floatingZ, debug]
  );

  return (
    <div className="page-shell">
      <MachinaReactView layout={resolved} views={views} debug={debug} className="control-room" nodeContainment="layout-paint" nodeContentVisibility="none" />
    </div>
  );
}
