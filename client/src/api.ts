import type { CaseFile, InterrogationAssist, InterrogationState, InterrogationTurn, Result, VerdictSettings, VerdictSubmission } from './types';
import type { BoardAnalysis, BoardState } from './board-model';
const API_BASE_URL=(import.meta.env.VITE_API_URL??'').trim().replace(/\/+$/,'');
const request = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${url}`, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new Error('Could not reach the API. Start the backend server and try again.');
  }

  const body = await response.text();
  let data: { error?: { message?: string } } | T;
  try {
    data = body ? JSON.parse(body) as T : {};
  } catch {
    if(response.status===404&&response.headers.get('content-type')?.includes('text/html'))throw new Error('The API endpoint was not found. Deploy the backend and set VITE_API_URL in the frontend deployment to the backend origin, then redeploy.');
    throw new Error(`The API returned an unreadable response (${response.status}). Check that the backend is running and its logs for errors.`);
  }
  if (!response.ok) {
    const message = (data as { error?: { message?: string } }).error?.message;
    throw new Error(message || `The API request failed (${response.status}).`);
  }
  if (!body) throw new Error(`The API returned an empty response (${response.status}). Check that the backend is running.`);
  return data as T;
};
export const createMystery = (input: Record<string, unknown>) => request<{ id: string }>('/api/mysteries', { method: 'POST', body: JSON.stringify(input) });
export const getMystery = (id: string) => request<CaseFile>(`/api/mysteries/${id}`);
export const getMysteries = () => request<{ cases: { id: string; title: string; category: string; difficulty: string; createdAt: string; accused: boolean }[] }>('/api/mysteries');
export const discoverEvidence = (id: string, evidenceId: string) => request<{ success: boolean }>(`/api/mysteries/${id}/evidence/${evidenceId}/discover`, { method: 'POST' });
export const submitVerdict = (id:string,submission:VerdictSubmission) => request<Result>(`/api/mysteries/${id}/accusations`,{method:'POST',body:JSON.stringify(submission)});
export const getVerdictSettings=()=>request<VerdictSettings>('/api/verdict-rubric');
export const getResults = (id: string) => request<Result>(`/api/mysteries/${id}/results`);
export const getInterrogation = (id:string,suspectId:string) => request<InterrogationState>(`/api/mysteries/${id}/interrogations/${suspectId}`);
export const askSuspect = (id:string,suspectId:string,question:string,evidenceIds:string[]) => request<{turn:InterrogationTurn;state:InterrogationState}>(`/api/mysteries/${id}/interrogations/${suspectId}`,{method:'POST',body:JSON.stringify({question,evidenceIds})});
export const saveInterrogationNotes=(id:string,suspectId:string,notes:string)=>request<{success:boolean}>(`/api/mysteries/${id}/interrogations/${suspectId}/notes`,{method:'PUT',body:JSON.stringify({notes})});
export const assistInterrogation=(id:string,suspectId:string,action:'follow-up'|'review'|'compare')=>request<InterrogationAssist>(`/api/mysteries/${id}/interrogations/${suspectId}/assist`,{method:'POST',body:JSON.stringify({action})});
const boardPayload=(board:BoardState)=>({...board,edges:board.edges.filter(edge=>edge.origin!=='case')});
export const getBoard=(id:string)=>request<{board:BoardState|null;updatedAt:string|null}>(`/api/mysteries/${id}/board`);
export const saveBoard=(id:string,board:BoardState)=>request<{success:boolean;updatedAt:string}>(`/api/mysteries/${id}/board`,{method:'PUT',body:JSON.stringify({board:boardPayload(board)})});
export const analyzeBoard=(id:string,board:BoardState)=>request<BoardAnalysis>(`/api/mysteries/${id}/board/analyze`,{method:'POST',body:JSON.stringify({board:boardPayload(board)})});
