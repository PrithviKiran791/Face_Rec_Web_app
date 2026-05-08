// frontend/lib/api.ts
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

// Function to set the Clerk token for API requests
export const setApiToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

// ── Attendance ───────────────────────────────────────────────────────────────
export const getReport   = ()          => api.get("/api/attendance/report");
export const getLogs     = ()          => api.get("/api/attendance/logs");
export const clearLogs   = ()          => api.delete("/api/attendance/clear-logs");
export const getIdentities = ()        => api.get("/api/register/identities");
export const uploadEmbedding = (form: FormData) =>
  api.post("/api/register/upload-embedding", form);

// ── Groups ───────────────────────────────────────────────────────────────────
export const getGroups         = ()                          => api.get("/api/groups");
export const createGroup       = (data: { name: string; description?: string }) => api.post("/api/groups", data);
export const updateGroup       = (id: string, data: { name?: string; description?: string }) => api.put(`/api/groups/${id}`, data);
export const deleteGroup       = (id: string)               => api.delete(`/api/groups/${id}`);
export const getGroupMembers   = (id: string)               => api.get(`/api/groups/${id}/members`);
export const addGroupMembers   = (id: string, identities: string[]) => api.post(`/api/groups/${id}/members`, { identities });
export const removeGroupMembers = (id: string, identities: string[]) => api.delete(`/api/groups/${id}/members`, { data: { identities } });

// ── Sessions ─────────────────────────────────────────────────────────────────
export type SessionPayload = {
  name: string;
  group_id: string;
  day_of_week?: string;
  start_time: string;
  end_time: string;
  late_threshold_minutes?: number;
};
export const getSessions       = (groupId?: string)         => api.get("/api/sessions", { params: groupId ? { group_id: groupId } : {} });
export const createSession     = (data: SessionPayload)     => api.post("/api/sessions", data);
export const updateSession     = (id: string, data: Partial<SessionPayload>) => api.put(`/api/sessions/${id}`, data);
export const deleteSession     = (id: string)               => api.delete(`/api/sessions/${id}`);
export const getTodaySessions  = ()                         => api.get("/api/sessions/today");
export const getSessionAttendance = (id: string, date?: string) =>
  api.get(`/api/sessions/${id}/attendance`, { params: date ? { date } : {} });

// ── Absentees ────────────────────────────────────────────────────────────────
export const getTodayAbsentees = (groupId?: string, sessionId?: string) =>
  api.get("/api/absentees/today", {
    params: {
      ...(groupId ? { group_id: groupId } : {}),
      ...(sessionId ? { session_id: sessionId } : {}),
    },
  });
