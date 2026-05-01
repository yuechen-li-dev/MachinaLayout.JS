import { formatRect, type ResolvedLayoutDocument } from "../../../src/index";
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

export function createViews(layout: ResolvedLayoutDocument, inspector: InspectorProps) {
  return {
    RootShell: () => <div className="slot-root" />,
    MainShell: () => <div className="slot-main" />,
    ToolbarShell: () => <div className="slot-toolbar" />,
    Header: () => (
      <Card><div className="slot-header"><div><h1>Machina Control Room</h1><p>Edit rows. Resolve rectangles. Render components.</p></div><Badge>M0 Demo</Badge></div></Card>
    ),
    Sidebar: () => (
      <Card><h3>Layout Nodes</h3><ul className="mono">{["root","header","sidebar","main","toolbar","preview","inspector","floating-action"].map((id)=><li key={id}>{id}</li>)}</ul><Separator /><p className="mono">z -5 background · z 0 default · z 5 top</p></Card>
    ),
    RunButton: () => <Button>Run</Button>,
    InspectButton: () => <Button>Inspect</Button>,
    ToolbarStatus: () => <Card><div className="mono">Status: FillFrame consumes remaining toolbar width</div></Card>,
    ResetButton: () => <Button onClick={inspector.reset}>Reset</Button>,
    Preview: () => (
      <Card><h3>Resolved Rectangles</h3><table className="mono"><thead><tr><th>id</th><th>rect</th><th>z</th></tr></thead><tbody>{["header","sidebar","main","toolbar","preview","inspector","floating-action","debug-badge"].map((id)=>{const n=layout.nodes[id];return <tr key={id}><td>{id}</td><td>{n ? formatRect(n.rect) : "-"}</td><td>{n?.z ?? 0}</td></tr>;})}</tbody></table></Card>
    ),
    Inspector: () => (
      <Card><h3>Inspector</h3><div className="control"><Label>Sidebar left</Label><div><Button onClick={()=>inspector.setSidebarLeft(inspector.sidebarLeft-2)}>-2</Button><Input type="number" value={inspector.sidebarLeft} onChange={(e)=>inspector.setSidebarLeft(Number(e.target.value)||0)} /><Button onClick={()=>inspector.setSidebarLeft(inspector.sidebarLeft+2)}>+2</Button></div></div><div className="control"><Label>Toolbar gap</Label><div><Button onClick={()=>inspector.setToolbarGap(inspector.toolbarGap-1)}>-1</Button><Input type="number" value={inspector.toolbarGap} onChange={(e)=>inspector.setToolbarGap(Number(e.target.value)||0)} /><Button onClick={()=>inspector.setToolbarGap(inspector.toolbarGap+1)}>+1</Button></div></div><div className="control"><Label>Floating z (-5..5)</Label><div><Input type="number" min={-5} max={5} value={inspector.floatingZ} onChange={(e)=>inspector.setFloatingZ(Number(e.target.value)||0)} /></div></div><div className="control"><Label>Debug outlines</Label><Button onClick={()=>inspector.setDebug(!inspector.debug)}>{inspector.debug ? "On" : "Off"}</Button></div></Card>
    ),
    FloatingAction: () => <Card><strong>Layer Probe</strong> <Badge>z={inspector.floatingZ}</Badge></Card>,
    DebugBadge: () => <Card><Badge>Debug Layer z=4</Badge></Card>,
  };
}
