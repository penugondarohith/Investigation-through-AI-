import type { CaseFile, Evidence, Suspect } from './types';

export type BoardNodeType='suspect'|'evidence'|'location'|'timeline-event'|'witness'|'player-theory'|'investigation-question'|'note';
export type BoardStatus='confirmed'|'disputed'|'unverified';
export type BoardNode={id:string;sourceId?:string;type:BoardNodeType;source:'case'|'player'|'ai';title:string;description:string;details?:unknown;x:number;y:number;status:BoardStatus;groupId?:string;note?:string;collected?:boolean};
export type BoardEdge={id:string;from:string;to:string;label:string;origin:'case'|'player'|'ai';status:'established'|'suggested'|'accepted'|'rejected';reason?:string;evidenceIds?:string[]};
export type BoardGroup={id:string;title:string;color:string};
export type BoardViewport={x:number;y:number;zoom:number};
export type BoardState={nodes:BoardNode[];edges:BoardEdge[];groups:BoardGroup[];viewport:BoardViewport};
export type BoardSuggestion={kind:'connection'|'timeline-gap'|'unanswered-question'|'unsupported-assumption'|'alternative-explanation';title:string;explanation:string;evidenceIds:string[];nodeIds:string[];fromNodeId?:string;toNodeId?:string;label?:string};
export type BoardAnalysis={summary:string;suggestions:BoardSuggestion[]};

export const NODE_TYPES:BoardNodeType[]=['suspect','evidence','location','timeline-event','witness','player-theory','investigation-question','note'];
export const RELATIONSHIP_LABELS=['Supports','Contradicts','Places at location','Connected to','Claims','Witnessed','Occurred before','Occurred after','Possible motive','Unverified association'];
export const boardNodeId=(type:string,sourceId:string)=>`${type}:${encodeURIComponent(sourceId)}`;
const short=(text:string,max=135)=>text.length>max?`${text.slice(0,max-1).trimEnd()}…`:text;
function officialNode(id:string,sourceId:string,type:BoardNodeType,title:string,description:string,details:unknown,x:number,y:number):BoardNode{return {id,sourceId,type,source:'case',title,description:short(description),details,x,y,status:'unverified'}};

export function buildInitialBoard(data:CaseFile):BoardState{
 const nodes:BoardNode[]=[];const columns:Record<string,number>={suspect:90,evidence:410,witness:730,location:1050,'timeline-event':1370};const rows:Record<string,number>={};
 const add=(node:BoardNode)=>{const row=rows[node.type]??0;rows[node.type]=row+1;nodes.push({...node,x:columns[node.type]??1370,y:80+row*178})};
 data.suspects.forEach((s:Suspect)=>add(officialNode(boardNodeId('suspect',s.id),s.id,'suspect',s.name,`${s.occupation}. ${s.relationship} ${s.biography}`,s,0,0)));
 data.evidence.forEach((e:Evidence)=>{add({...officialNode(boardNodeId('evidence',e.id),e.id,'evidence',e.title,e.description,e,0,0),collected:e.discovered});if(e.type.toLowerCase().includes('witness'))add({...officialNode(boardNodeId('witness',e.id),e.id,'witness',`Witness: ${e.title}`,String(e.details?.statement??e.description),e,0,0),collected:e.discovered})});
 const locations=new Map<string,string[]>();data.evidence.forEach(e=>(e.locationIds??[]).forEach(id=>locations.set(id,[...(locations.get(id)??[]),e.id])));
 locations.forEach((ids,id)=>add(officialNode(boardNodeId('location',id),id,'location',id.replace(/[-_]/g,' '),`Referenced by ${ids.length} case record${ids.length===1?'':'s'}.`,ids,0,0)));
 data.timeline.forEach((event,index)=>{const sourceId=event.id??`event-${index+1}`;add(officialNode(boardNodeId('timeline-event',sourceId),sourceId,'timeline-event',event.time,event.event,event,0,0))});
 const lookup=new Map(nodes.filter(n=>n.source==='case').map(n=>[`${n.type}:${n.sourceId}`,n.id]));const edges:BoardEdge[]=[];const seen=new Set<string>();
 const connect=(from:string|undefined,to:string|undefined,label:string,reason='Linked in the generated case record.')=>{if(!from||!to||from===to)return;const key=`${from}|${to}|${label}`;if(seen.has(key))return;seen.add(key);edges.push({id:`case-link:${edges.length+1}`,from,to,label,origin:'case',status:'established',reason})};
 data.evidence.forEach(e=>{const from=lookup.get(`evidence:${e.id}`);(e.suspectIds??[]).forEach(id=>connect(from,lookup.get(`suspect:${id}`),'Connected to'));(e.challengeSuspectIds??[]).forEach(id=>connect(from,lookup.get(`suspect:${id}`),'Contradicts','The generated case marks this record as challenging a suspect statement.'));(e.locationIds??[]).forEach(id=>connect(from,lookup.get(`location:${id}`),'Places at location'));(e.eventIds??[]).forEach(id=>connect(from,lookup.get(`timeline-event:${id}`),'Connected to'));(e.relatedEvidenceIds??[]).forEach(id=>connect(from,lookup.get(`evidence:${id}`),'Connected to'));if(e.type.toLowerCase().includes('witness'))connect(from,lookup.get(`witness:${e.id}`),'Claims')});
 data.timeline.forEach((event,index)=>{const sourceId=event.id??`event-${index+1}`;const from=lookup.get(`timeline-event:${sourceId}`);(event.suspectIds??[]).forEach(id=>connect(from,lookup.get(`suspect:${id}`),'Connected to'))});
 const timelineNodes=nodes.filter(node=>node.type==='timeline-event');timelineNodes.slice(0,-1).forEach((node,index)=>connect(node.id,timelineNodes[index+1].id,'Occurred before','Timeline events are ordered by the case timeline.'));
 return {nodes,edges,groups:[],viewport:{x:25,y:25,zoom:0.72}};
}

export function mergeBoard(initial:BoardState,saved:BoardState|null):BoardState{
 if(!saved)return initial;
 const savedNodes=new Map(saved.nodes.map(node=>[node.id,node]));const official=initial.nodes.map(node=>{const prior=savedNodes.get(node.id);return prior?{...node,x:prior.x,y:prior.y,status:prior.status,note:(prior as any).note,groupId:prior.groupId}:node});
 const custom=saved.nodes.filter(node=>node.source!=='case');
 const nodeIds=new Set([...official,...custom].map(node=>node.id));const caseEdges=initial.edges;const userEdges=saved.edges.filter(edge=>edge.origin!=='case'&&nodeIds.has(edge.from)&&nodeIds.has(edge.to));
 return {nodes:[...official,...custom],edges:[...caseEdges,...userEdges],groups:saved.groups,viewport:saved.viewport};
}

export function createBoardNode(type:'player-theory'|'investigation-question'|'note',title:string,description:string,x:number,y:number):BoardNode{return {id:`player:${crypto.randomUUID()}`,type,source:'player',title,description,details:description,x,y,status:'unverified'}};

export function autoLayout(board:BoardState):BoardState{
 const order:BoardNodeType[]=['suspect','evidence','witness','location','timeline-event','player-theory','investigation-question','note'];const xGap=290,yGap=170,startX=60,startY=65;const counts=new Map<BoardNodeType,number>();const nodes=[...board.nodes].sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type)||a.title.localeCompare(b.title)||a.id.localeCompare(b.id)).map(node=>{const col=order.indexOf(node.type);const row=counts.get(node.type)??0;counts.set(node.type,row+1);return {...node,x:startX+col*xGap,y:startY+row*yGap}});return {...board,nodes};
}
