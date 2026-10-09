import { useId, useMemo, useState } from "react";
import type { EvidenceGraphSlice, EvidenceNode } from "@krds-detector/contracts";

const layers: Record<EvidenceNode["kind"], number> = {Page:0,Frame:1,Element:1,Creative:2,Resource:3,Domain:3,Landing:3,Redirect:3};
const kinds: Record<EvidenceNode["kind"], string> = {Page:"페이지",Frame:"프레임",Element:"원본 요소",Creative:"이미지",Resource:"자료",Domain:"호스트",Landing:"기록된 링크",Redirect:"관측 리디렉션"};

/** Fixed layers retain original IDs; relation projections never establish ownership. */
export function RelationGraph({slice,onSelectFinding}:{slice:EvidenceGraphSlice;onSelectFinding?:(id:string)=>void}) {
  const marker=useId().replaceAll(":","");
  const [selected,setSelected]=useState<{kind:"node";id:string}|{kind:"edge";index:number}>();
  const [nodePage,setNodePage]=useState(0);
  const [edgePage,setEdgePage]=useState(0);
  const allNodes=useMemo(()=>new Map(slice.nodes.map(node=>[node.id,node])),[slice]);
  const orderedNodes=useMemo(()=>{
    const ordered:EvidenceNode[]=[];
    const seen=new Set<string>();
    const add=(node:EvidenceNode)=>{if(!seen.has(node.id)){seen.add(node.id);ordered.push(node);}};
    const stable=(a:EvidenceNode,b:EvidenceNode)=>layers[a.kind]-layers[b.kind]||a.id.localeCompare(b.id);
    for(const witness of slice.nodes.filter(node=>node.findingId).sort(stable)){
      add(witness);
      const adjacent=new Set(slice.edges.flatMap(edge=>edge.from===witness.id?[edge.to]:edge.to===witness.id?[edge.from]:[]));
      for(const context of slice.nodes.filter(node=>adjacent.has(node.id)&&(node.kind==="Page"||node.kind==="Frame")).sort(stable))add(context);
    }
    for(const node of [...slice.nodes].sort((a,b)=>Number(!!b.adRelated)-Number(!!a.adRelated)||stable(a,b)))add(node);
    return ordered;
  },[slice]);
  const nodePages=Math.max(1,Math.ceil(orderedNodes.length/40));
  const edgePages=Math.max(1,Math.ceil(slice.edges.length/40));
  const currentNodePage=Math.min(nodePage,nodePages-1);
  const currentEdgePage=Math.min(edgePage,edgePages-1);
  const layout=useMemo(()=>{
    const nodes=orderedNodes.slice(currentNodePage*40,(currentNodePage+1)*40);
    const rows=[0,0,0,0];
    const positions=new Map(nodes.map(node=>{const layer=layers[node.kind];const row=rows[layer]!;rows[layer]=row+1;return [node.id,{node,x:layer*240+20,y:row*76+24}] as const;}));
    return {nodes,positions,height:Math.max(160,...rows.map(n=>n*76+32))};
  },[orderedNodes,currentNodePage]);
  const node=selected?.kind==="node"?allNodes.get(selected.id):undefined;
  const edge=selected?.kind==="edge"?slice.edges[selected.index]:undefined;
  const witnesses=node?[node]:edge?[allNodes.get(edge.from),allNodes.get(edge.to)].filter((n):n is EvidenceNode=>!!n):[];
  const records=[...new Set(witnesses.flatMap(n=>n.findingId?[n.findingId]:[]))];
  return <section aria-label="근거 관계 시각화" className="relation-graph">
    <p>고정된 방향: 페이지 → 관측 요소·이미지 → 자료·기록된 링크. 현재 {layout.nodes.length}개 표시 · 전체 {slice.nodes.length}개. 탐지 원본 요소와 연결된 페이지를 먼저 표시합니다.</p>
    <div className="relation-drawing"><svg viewBox={`0 0 960 ${layout.height}`} role="group" aria-label="관측 관계 그림">
      <defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker></defs>
      {slice.edges.map((e,index)=>{
        const from=layout.positions.get(e.from),to=layout.positions.get(e.to);
        if(!from||!to)return null;
        return <g key={`${e.from}-${e.to}-${e.kind}`} role="button" tabIndex={0} aria-label={`관계 ${e.kind} ${index+1}`} aria-pressed={selected?.kind==="edge"&&selected.index===index}
          onClick={()=>setSelected({kind:"edge",index})} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelected({kind:"edge",index});}}}>
          <title>{e.kind} · {e.evidenceKinds?.join(", ")??"관측 연결"}</title>
          <path d={`M${from.x+205},${from.y+26} C${from.x+230},${from.y+26} ${to.x-25},${to.y+26} ${to.x},${to.y+26}`} fill="none" stroke="currentColor" markerEnd={`url(#${marker})`} />
        </g>;
      })}
      {layout.nodes.map(n=>{
        const p=layout.positions.get(n.id)!;
        return <g key={n.id} transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={0} aria-label={`${kinds[n.kind]} ${n.findingId??n.label}`} aria-pressed={selected?.kind==="node"&&selected.id===n.id}
          onClick={()=>setSelected({kind:"node",id:n.id})} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelected({kind:"node",id:n.id});}}}>
          <rect width="205" height="54" rx="6" /><text x="10" y="23">{kinds[n.kind]}{n.findingId?` · ${n.findingId}`:""}</text><text x="10" y="43">{n.label.slice(0,22)}{n.label.length>22?"…":""}</text>
        </g>;
      })}
    </svg></div>
    {selected?<div role="region" aria-label="선택한 관계 근거">
      <p>{node?`${kinds[node.kind]} · ${node.label}`:edge?`관계 종류: ${edge.kind}`:"표시 범위 밖 항목"}</p>
      <p>관측 연결의 출처: {edge?.evidenceKinds?.join(", ")??(node?.adRelated?"탐지 근거에 연결된 관측":"수집된 주소·요소")}. 유사성은 동일성·소유권을 뜻하지 않습니다.</p>
      {records.map(id=><button type="button" className="secondary" key={id} disabled={!onSelectFinding} onClick={()=>onSelectFinding?.(id)}>원본 기록 {id} 열기</button>)}
      {!records.length?<p>연결된 공식 기록 번호가 없습니다. 아래 관계 목록에서 관측 주소와 출처를 확인하세요.</p>:null}
    </div>:<p>항목이나 연결을 선택하면 출처와 원본 기록을 확인할 수 있습니다. 키보드 Tab·Enter로도 선택할 수 있습니다.</p>}
    <details><summary>관계 항목과 연결 목록</summary>
      <nav aria-label="관계 항목 페이지"><button type="button" className="secondary" disabled={currentNodePage===0} onClick={()=>setNodePage(currentNodePage-1)}>이전 항목</button><span role="status">항목 {currentNodePage+1} / {nodePages}쪽</span><button type="button" className="secondary" disabled={currentNodePage===nodePages-1} onClick={()=>setNodePage(currentNodePage+1)}>다음 항목</button></nav>
      <ul aria-label="선택 가능한 관계 항목">{layout.nodes.map(n=><li key={n.id}><button type="button" className="secondary" aria-pressed={selected?.kind==="node"&&selected.id===n.id} onClick={()=>setSelected({kind:"node",id:n.id})}>{kinds[n.kind]} · {n.findingId??n.label}</button></li>)}</ul>
      <nav aria-label="관계 연결 페이지"><button type="button" className="secondary" disabled={currentEdgePage===0} onClick={()=>setEdgePage(currentEdgePage-1)}>이전 연결</button><span role="status">연결 {currentEdgePage+1} / {edgePages}쪽</span><button type="button" className="secondary" disabled={currentEdgePage===edgePages-1} onClick={()=>setEdgePage(currentEdgePage+1)}>다음 연결</button></nav>
      <ul aria-label="선택 가능한 관계 연결">{slice.edges.slice(currentEdgePage*40,(currentEdgePage+1)*40).map((e,offset)=>{const index=currentEdgePage*40+offset;return <li key={`${e.from}-${e.to}-${index}`}><button type="button" className="secondary" aria-pressed={selected?.kind==="edge"&&selected.index===index} onClick={()=>setSelected({kind:"edge",index})}>{allNodes.get(e.from)?.label??e.from} → {allNodes.get(e.to)?.label??e.to} · {e.kind}</button></li>;})}</ul>
    </details>
  </section>;
}
