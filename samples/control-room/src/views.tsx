import { MachinaTextView, formatRect, type ResolvedLayoutDocument } from "../../../src/index";
import { Badge } from "./components/ui/Badge";
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";
import { Input } from "./components/ui/Input";
import { Label } from "./components/ui/Label";
import { Separator } from "./components/ui/Separator";

type InspectorProps = {
  sidebarLeft: number;
  toolbarGap: number;
  floatingZ: number;
  debug: boolean;
  setSidebarLeft: (n: number) => void;
  setToolbarGap: (n: number) => void;
  setFloatingZ: (n: number) => void;
  setDebug: (value: boolean) => void;
  reset: () => void;
};

function toIntegerOrPrevious(rawValue: string, previous: number): number {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return previous;
  }
  return Math.trunc(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createViews(layout: ResolvedLayoutDocument, inspector: InspectorProps) {
  return {
    RootShell: () => <div className="slot-root" />,
    MainShell: () => <div className="slot-main" />,
    ToolbarShell: () => <div className="slot-toolbar" />,
    Header: () => (
      <Card><div className="slot-header"><div><h1>Machina Control Room</h1><MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "Edit **rows**. Resolve `rects`. Render views." }, variant: "caption", leading: "tight", valign: "center" }} style={{ height: "auto" }} /></div><Badge>M0 Demo</Badge></div></Card>
    ),
    Sidebar: () => (
      <Card><h3>Layout Nodes</h3><ul className="mono">{["root","header","sidebar","main","toolbar","preview","inspector","floating-action"].map((id)=><li key={id}>{id}</li>)}</ul><Separator /><p className="mono">z -5 background · z 0 default · z 5 top</p></Card>
    ),
    RunButton: () => <Button>Run</Button>,
    InspectButton: () => <Button>Inspect</Button>,
    ToolbarStatus: () => <Card><MachinaTextView text={{ kind: "text", source: { kind: "machina-text", text: "Status: **FillFrame** consumes remaining toolbar width" }, variant: "mono", wrap: "none", overflow: "ellipsis", leading: "tight", valign: "center" }} style={{ height: "auto" }} /></Card>,
    ResetButton: () => <Button onClick={inspector.reset}>Reset</Button>,
    Preview: () => (
      <Card><h3>Resolved Rectangles</h3><table className="mono"><thead><tr><th>id</th><th>rect</th><th>z</th></tr></thead><tbody>{["header","sidebar","main","toolbar","preview","inspector","floating-action","debug-badge"].map((id)=>{const n=layout.nodes[id];return <tr key={id}><td>{id}</td><td>{n ? formatRect(n.rect) : "-"}</td><td>{n?.z ?? 0}</td></tr>;})}</tbody></table></Card>
    ),
    Inspector: () => (
      <Card><h3>Inspector</h3><div className="control"><Label>Sidebar left</Label><div><Button onClick={()=>inspector.setSidebarLeft(inspector.sidebarLeft-2)}>-2</Button><Input type="number" value={inspector.sidebarLeft} onChange={(e)=>inspector.setSidebarLeft(toIntegerOrPrevious(e.target.value, inspector.sidebarLeft))} /><Button onClick={()=>inspector.setSidebarLeft(inspector.sidebarLeft+2)}>+2</Button></div></div><div className="control"><Label>Toolbar gap</Label><div><Button onClick={()=>inspector.setToolbarGap(Math.max(0, inspector.toolbarGap-1))}>-1</Button><Input type="number" min={0} value={inspector.toolbarGap} onChange={(e)=>inspector.setToolbarGap(Math.max(0, toIntegerOrPrevious(e.target.value, inspector.toolbarGap)))} /><Button onClick={()=>inspector.setToolbarGap(inspector.toolbarGap+1)}>+1</Button></div></div><div className="control"><Label>Floating z (-5..5)</Label><div><Button onClick={()=>inspector.setFloatingZ(clamp(inspector.floatingZ-1, -5, 5))}>-1</Button><Input type="number" min={-5} max={5} value={inspector.floatingZ} onChange={(e)=>inspector.setFloatingZ(clamp(toIntegerOrPrevious(e.target.value, inspector.floatingZ), -5, 5))} /><Button onClick={()=>inspector.setFloatingZ(clamp(inspector.floatingZ+1, -5, 5))}>+1</Button></div></div><div className="control"><Label>Debug outlines</Label><Button onClick={()=>inspector.setDebug(!inspector.debug)}>{inspector.debug ? "On" : "Off"}</Button></div></Card>
    ),
    FloatingAction: () => <Card><strong>Layer Probe</strong> <Badge>z={inspector.floatingZ}</Badge></Card>,
    DebugBadge: () => <Card><Badge>Debug Layer z=4</Badge></Card>,
  };
}
