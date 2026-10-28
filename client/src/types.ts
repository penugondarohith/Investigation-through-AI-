export type Evidence = { id: string; type: string; title: string; description: string; timestamp?: string; discovered: boolean; details?: Record<string, unknown> };
export type Suspect = { id: string; name: string; age?: string; occupation: string; biography: string; relationship: string; motive: string; alibi: string };
export type CaseFile = { id: string; title: string; category: string; difficulty: string; introduction: string; suspects: Suspect[]; evidence: Evidence[]; timeline: { time: string; event: string }[]; status: string };
export type Result = { correct: boolean; selectedSuspect: string; culprit: string; motive: string; explanation: string; decisiveClues: string[]; misleadingClues: string[]; timeline: { time: string; event: string }[]; alternatives: string[] };
