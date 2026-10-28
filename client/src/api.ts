import type { CaseFile, Result } from './types';
const request = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new Error('Could not reach the API. Start the backend server and try again.');
  }

  const body = await response.text();
  let data: { error?: { message?: string } } | T;
  try {
    data = body ? JSON.parse(body) as T : {};
  } catch {
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
export const accuse = (id: string, suspectId: string) => request<Result>(`/api/mysteries/${id}/accusations`, { method: 'POST', body: JSON.stringify({ suspectId }) });
export const getResults = (id: string) => request<Result>(`/api/mysteries/${id}/results`);
