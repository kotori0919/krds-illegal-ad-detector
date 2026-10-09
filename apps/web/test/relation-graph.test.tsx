import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { RelationGraph } from "../src/screens/RelationGraph.js";
import type { EvidenceGraphSlice } from "@krds-detector/contracts";
afterEach(cleanup);
const graph:EvidenceGraphSlice={nodes:[{id:"p",kind:"Page",label:"https://site.example/"},{id:"e",kind:"Element",label:"#ad",findingId:"f1",adRelated:true},{id:"d",kind:"Domain",label:"observed.example"}],edges:[{from:"p",to:"e",kind:"CONTAINS",evidenceKinds:["official-finding"]},{from:"e",to:"d",kind:"LINKS_TO"}],truncated:false};
it("supports keyboard selection with provenance and the same original record identity",()=>{
  render(<RelationGraph slice={graph} onSelectFinding={()=>undefined}/>);
  const node=screen.getByRole("button",{name:"원본 요소 f1"});
  node.focus();fireEvent.keyDown(node,{key:"Enter"});
  expect(screen.getByRole("region",{name:"선택한 관계 근거"}).textContent).toContain("원본 요소 · #ad");
  expect(screen.getByRole("button",{name:"원본 기록 f1 열기"})).toBeDefined();
  fireEvent.keyDown(screen.getByRole("button",{name:"관계 LINKS_TO 2"}),{key:" "});
  expect(screen.getByRole("region",{name:"선택한 관계 근거"}).textContent).toContain("LINKS_TO");
  expect(screen.getByRole("region",{name:"선택한 관계 근거"}).textContent).toContain("소유권을 뜻하지 않습니다");
});
it("prioritizes the original witness after forty pages and opens its original record outside a filtered list",()=>{
  const nodes=Array.from({length:55},(_,i)=>({id:`p${String(i).padStart(2,"0")}`,kind:"Page" as const,label:`https://site.example/${i}`}));
  const slice:EvidenceGraphSlice={nodes:[...nodes,{id:"witness",kind:"Element",label:"#hidden-ad",findingId:"f-outside-filter"}],edges:[{from:"p54",to:"witness",kind:"CONTAINS",evidenceKinds:["official-finding"]}],truncated:false};
  function FilteredReview(){const [record,setRecord]=useState<string>();return <><p>현재 목록: f-visible</p><RelationGraph slice={slice} onSelectFinding={setRecord}/>{record?<aside aria-label="원본 탐지 상세">{record}</aside>:null}</>;}
  render(<FilteredReview/>);
  const drawing=screen.getByRole("group",{name:"관측 관계 그림"});
  const witness=within(drawing).getByRole("button",{name:"원본 요소 f-outside-filter"});
  expect(within(drawing).getByRole("button",{name:"페이지 https://site.example/54"})).toBeDefined();
  witness.focus();fireEvent.keyDown(witness,{key:"Enter"});
  fireEvent.click(screen.getByRole("button",{name:"원본 기록 f-outside-filter 열기"}));
  expect(screen.getByRole("complementary",{name:"원본 탐지 상세"}).textContent).toBe("f-outside-filter");
  expect(screen.getByText("현재 목록: f-visible")).toBeDefined();
});
it("makes fetched nodes and edges beyond the first page selectable without losing endpoint witnesses",()=>{
  const nodes=Array.from({length:55},(_,i)=>({id:`e${String(i).padStart(2,"0")}`,kind:"Element" as const,label:`#ad-${i}`,findingId:`f${i}`}));
  const edges=nodes.slice(1).map(node=>({from:nodes[0]!.id,to:node.id,kind:"CONTAINS" as const,evidenceKinds:["official-finding"]}));
  render(<RelationGraph slice={{nodes,edges,truncated:false}} onSelectFinding={()=>undefined}/>);
  fireEvent.click(screen.getByText("관계 항목과 연결 목록"));
  expect(screen.getByRole("list",{name:"선택 가능한 관계 항목"}).children.length).toBe(40);
  fireEvent.click(screen.getByRole("button",{name:"다음 항목"}));
  fireEvent.click(screen.getByRole("button",{name:"원본 요소 · f54"}));
  expect(screen.getByRole("button",{name:"원본 기록 f54 열기"})).toBeDefined();
  fireEvent.click(screen.getByRole("button",{name:"다음 연결"}));
  fireEvent.click(screen.getByRole("button",{name:"#ad-0 → #ad-54 · CONTAINS"}));
  expect(screen.getByRole("button",{name:"원본 기록 f0 열기"})).toBeDefined();
  expect(screen.getByRole("button",{name:"원본 기록 f54 열기"})).toBeDefined();
});
