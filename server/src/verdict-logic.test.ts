import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateVerdict, fallbackTextAssessment, validateVerdictReferences, VERDICT_RUBRIC, type VerdictSubmission } from './verdict-logic.js';

const caseData={suspects:[{id:'s1',name:'Avery',alibi:'I was in the archive.'},{id:'s2',name:'Morgan'}],timeline:[{id:'t1',time:'9:00',event:'The gallery closes.'},{id:'t2',time:'9:20',event:'A service door opens.'},{id:'t3',time:'9:30',event:'The diamond is reported missing.'}],evidence:[{id:'e1',title:'Door access record'},{id:'e2',title:'Gallery message'},{id:'e3',title:'Unrelated receipt'}]};
const truth={culpritId:'s1',motive:'Avery wanted to conceal a debt.',method:'A copied service key opened the display room.',sequence:['Gallery closes','Door opens','Diamond reported missing'],explanation:'The access record and message place Avery near the gallery using the copied key.',decisiveClues:['Door access record','Gallery message'],misleadingClues:[],alternatives:[],criticalEvidenceIds:['e1','e2'],orderedTimelineEventIds:['t1','t2','t3'],expectedContradictions:[{evidenceId:'e2',suspectIds:['s1']}],caseVersion:'1.0'};
const submission=(overrides:Partial<VerdictSubmission>={}):VerdictSubmission=>({suspectId:'s1',motive:'Avery wanted to conceal a debt.',method:'A copied service key opened the display room.',timelineEventIds:['t1','t2','t3'],supportingEvidenceIds:['e1','e2'],contradictoryEvidenceIds:[],alibiReasoning:'The archive claim is challenged by the access and message records.',reasoning:'The access log places Avery at the service door. The message gives a second connection, and the sequence fits the missing diamond.',...overrides});
const strong={motive:'strong' as const,method:'strong' as const,alibi:'strong' as const,reasoning:'strong' as const,contradictions:'strong' as const,correctDeductions:['Two records place Avery near the gallery.'],incorrectAssumptions:[],improvementTips:[],citationEvidenceIds:['e1','e2']};

test('correct evidence-supported verdict receives full deterministic points',()=>{
 const result=calculateVerdict({submission:submission(),truth,caseData,assessment:strong});
 assert.equal(result.correct,true);assert.equal(result.score,100);assert.deepEqual(result.rubric,VERDICT_RUBRIC);assert.deepEqual(result.missedCriticalEvidence,[]);
 assert.deepEqual(calculateVerdict({submission:submission(),truth,caseData,assessment:strong}),result);
});

test('correct suspect with weak reasoning is still distinguished from a supported solution',()=>{
 const result=calculateVerdict({submission:submission({motive:'unknown',method:'unknown',timelineEventIds:['t3'],supportingEvidenceIds:[],contradictoryEvidenceIds:[],alibiReasoning:'not sure',reasoning:'I think so because it feels right.'}),truth,caseData,assessment:{...strong,motive:'missing',method:'missing',alibi:'weak',reasoning:'weak',contradictions:'missing'}});
 assert.equal(result.correct,true);assert.ok(result.score<40);assert.equal(result.missedCriticalEvidence.length,2);assert.equal(result.overlookedContradictions.length,1);
});

test('convincing unsupported accusation cannot score the culprit or evidence dimensions',()=>{
 const result=calculateVerdict({submission:submission({suspectId:'s2',supportingEvidenceIds:['e3']}),truth,caseData,assessment:strong});
 assert.equal(result.correct,false);assert.equal(result.categoryScores.culprit,0);assert.equal(result.categoryScores.evidence,0);assert.ok(result.score<75);
});

test('deterministic fallback provides a safe grade when AI assessment fails',()=>{
 const assessment=fallbackTextAssessment({submission:submission({supportingEvidenceIds:['e1'],contradictoryEvidenceIds:['e2']}),truth,caseData,culprit:caseData.suspects[0]});
 assert.equal(assessment.method,'strong');assert.equal(assessment.contradictions,'strong');assert.deepEqual(assessment.citationEvidenceIds,['e1']);
});

test('verdict selection references must be valid and discovered',()=>{
 assert.equal(validateVerdictReferences(submission(),caseData,['e1','e2']),null);
 assert.equal(validateVerdictReferences(submission({supportingEvidenceIds:['e404']}),caseData,['e404'])?.code,'INVALID_EVIDENCE');
 assert.equal(validateVerdictReferences(submission({supportingEvidenceIds:['e3']}),caseData,['e1','e2'])?.code,'EVIDENCE_NOT_DISCOVERED');
 assert.equal(validateVerdictReferences(submission({timelineEventIds:['t-no']}),caseData,['e1','e2'])?.code,'INVALID_TIMELINE_EVENT');
});
