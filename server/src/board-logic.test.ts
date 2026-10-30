import assert from 'node:assert/strict';
import test from 'node:test';
import { caseNodeTypeIndex, validateBoardAnalysis, validateBoardState } from './board-logic.js';

const official=new Map([['suspect:s1',{type:'suspect',sourceId:'s1'}],['evidence:e1',{type:'evidence',sourceId:'e1'}],['location:hotel',{type:'location',sourceId:'hotel'}],['timeline-event:t1',{type:'timeline-event',sourceId:'t1'}]]);
const state=()=>({nodes:[{id:'suspect:s1',sourceId:'s1',type:'suspect',source:'case',title:'Avery',description:'Suspect profile',x:10,y:20,status:'unverified'},{id:'evidence:e1',sourceId:'e1',type:'evidence',source:'case',title:'Access log',description:'Door entry record',x:300,y:20,status:'unverified'},{id:'player:theory-1',type:'player-theory',source:'player',title:'Theory',description:'A player idea',x:600,y:20,status:'unverified'}],edges:[{id:'player-link:1',from:'evidence:e1',to:'suspect:s1',label:'Contradicts',origin:'player',status:'accepted'}],groups:[],viewport:{x:0,y:0,zoom:1}});

test('board nodes can save when all case references and group assignments are valid',()=>{
 const parsed=validateBoardState(state(),official);
 assert.equal(parsed.nodes.length,3);
 assert.equal(parsed.edges[0].from,'evidence:e1');
});

test('unknown node IDs and invalid case node types are rejected',()=>{
 const invalid=state();invalid.edges[0].to='suspect:missing';
 assert.throws(()=>validateBoardState(invalid,official),/missing node/);
 const forged=state();forged.nodes[0].type='evidence';
 assert.throws(()=>validateBoardState(forged,official),/not part of this case/);
 const swapped=state();swapped.nodes[0].sourceId='e1';
 assert.throws(()=>validateBoardState(swapped,official),/not part of this case/);
});

test('duplicate nodes, duplicate relationships, and forged official links are rejected',()=>{
 const duplicateNode=state();duplicateNode.nodes.push({...duplicateNode.nodes[0]});
 assert.throws(()=>validateBoardState(duplicateNode,official),/node IDs must be unique/);
 const duplicateLink=state();duplicateLink.edges.push({...duplicateLink.edges[0],id:'player-link:2',from:'suspect:s1',to:'evidence:e1'});
 assert.throws(()=>validateBoardState(duplicateLink,official),/Duplicate board connections/);
 const forgedOfficial=state();forgedOfficial.edges[0].origin='case';
 assert.throws(()=>validateBoardState(forgedOfficial,official),/generated from case facts/);
});

test('assistant suggestions must cite discovered evidence and nodes on the board',()=>{
 const valid={summary:'The records raise one useful timing question.',suggestions:[{kind:'connection',title:'Compare entry with the message',explanation:'The access record and message refer to the same time window.',evidenceIds:['e1'],nodeIds:['evidence:e1','suspect:s1'],fromNodeId:'evidence:e1',toNodeId:'suspect:s1',label:'Contradicts'}]};
 assert.equal(validateBoardAnalysis(valid,['evidence:e1','suspect:s1'],['e1']).suggestions.length,1);
 assert.throws(()=>validateBoardAnalysis(valid,['evidence:e1','suspect:s1'],[]),/not been discovered/);
 const invented={...valid,suggestions:[{...valid.suggestions[0],toNodeId:'suspect:unknown',nodeIds:['evidence:e1','suspect:unknown']}]};
 assert.throws(()=>validateBoardAnalysis(invented,['evidence:e1','suspect:s1'],['e1']),/outside this board/);
});

test('case node IDs are derived from real case entities',()=>{
 const index=caseNodeTypeIndex({suspects:[{id:'s1'}],evidence:[{id:'e1',type:'witness',locationIds:['hotel']}],timeline:[{id:'t1'}]});
 assert.equal(index.get('suspect:s1')?.type,'suspect');assert.equal(index.get('evidence:e1')?.type,'evidence');assert.equal(index.get('witness:e1')?.type,'witness');assert.equal(index.get('location:hotel')?.type,'location');assert.equal(index.get('timeline-event:t1')?.type,'timeline-event');
});
