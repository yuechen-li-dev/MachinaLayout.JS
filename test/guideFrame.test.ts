import { describe, expect, it } from "vitest";
import { MachinaLayoutError, flattenResolvedTree, lerpResolvedLayouts, resolveLayoutRows, toResolvedTree, type LayoutRow } from "../src";

const root = { x: 0, y: 0, width: 600, height: 400 };
const expectCode = (fn:()=>unknown, code:string)=>{ try{fn(); throw new Error("no");}catch(e){ expect((e as MachinaLayoutError).code).toBe(code);} };

describe("guide frame runtime",()=>{
  it("basic one-axis placement",()=>{
    const rows: LayoutRow[] = [
      { id:"root", frame:{kind:"root"}},
      { id:"inspector", parent:"root", frame:{kind:"absolute", x:300,y:0,width:100,height:100}},
      { id:"toolbar", parent:"root", frame:{kind:"guide", left:{ref:"inspector", edge:"right", offset:8}, right:16, top:16, height:48 }},
    ];
    const r = resolveLayoutRows(rows, root);
    expect(r.nodes.toolbar.rect).toEqual({ x:408, y:16, width:176, height:48});
  });
  it("vertical placement",()=>{
    const rows: LayoutRow[] = [{id:"root",frame:{kind:"root"}},{id:"button",parent:"root",frame:{kind:"absolute",x:0,y:50,width:50,height:20}},{id:"tip",parent:"root",frame:{kind:"guide",top:{ref:"button",edge:"bottom",offset:6},height:64,left:10,width:200}}];
    expect(resolveLayoutRows(rows, root).nodes.tip.rect.y).toBe(76);
  });
  it("allows outside parent",()=>{
    const rows: LayoutRow[] = [{id:"root",frame:{kind:"root"}},{id:"a",parent:"root",frame:{kind:"absolute",x:0,y:0,width:50,height:50}},{id:"b",parent:"root",frame:{kind:"guide",left:{ref:"a",edge:"left",offset:-100},width:20,top:0,height:20}}];
    expect(resolveLayoutRows(rows, root).nodes.b.rect.x).toBe(-100);
  });
  it("target can appear later in order",()=>{
    const rows: LayoutRow[] = [{id:"root",frame:{kind:"root"}},{id:"guide",parent:"root",order:0,frame:{kind:"guide",left:{ref:"target",edge:"right"},width:20,top:0,height:20}},{id:"target",parent:"root",order:1,frame:{kind:"absolute",x:30,y:0,width:10,height:10}}];
    expect(resolveLayoutRows(rows, root).nodes.guide.rect.x).toBe(40);
  });
  it("errors",()=>{
    expectCode(()=>resolveLayoutRows([{id:"root",frame:{kind:"root"}},{id:"g",parent:"root",frame:{kind:"guide",left:{ref:"missing",edge:"right"},width:10,top:0,height:10}}],root),"GuideTargetNotFound");
    expectCode(()=>resolveLayoutRows([{id:"root",frame:{kind:"root"}},{id:"g",parent:"root",frame:{kind:"guide",left:{ref:"g",edge:"right"},width:10,top:0,height:10}}],root),"GuideSelfReference");
    expectCode(()=>resolveLayoutRows([{id:"root",frame:{kind:"root"}},{id:"a",parent:"root",frame:{kind:"guide",left:{ref:"b",edge:"right"},width:10,top:0,height:10}},{id:"b",parent:"root",frame:{kind:"guide",left:{ref:"a",edge:"right"},width:10,top:0,height:10}}],root),"GuideReferenceCycle");
    expectCode(()=>resolveLayoutRows([{id:"root",frame:{kind:"root"}},{id:"g",parent:"root",frame:{kind:"guide",left:{ref:"root",edge:"top" as any},width:10,top:0,height:10}}],root),"GuideInvalidEdgeForAxis");
  });
  it("tree/flatten and lerp preserve guide metadata",()=>{
    const rowsA: LayoutRow[] = [{id:"root",frame:{kind:"root"}},{id:"n",parent:"root",frame:{kind:"anchor",left:0,top:0,width:10,height:10}}];
    const rowsB: LayoutRow[] = [{id:"root",frame:{kind:"root"}},{id:"n",parent:"root",frame:{kind:"guide",left:0,top:0,width:10,height:10}}];
    const rb = resolveLayoutRows(rowsB, root);
    expect(toResolvedTree(rb).children[0].frame.kind).toBe("guide");
    expect(flattenResolvedTree(toResolvedTree(rb))[1].frame.kind).toBe("guide");
    expect(lerpResolvedLayouts(resolveLayoutRows(rowsA, root), rb, 0.5).nodes.n.frame.kind).toBe("guide");
  });
});
