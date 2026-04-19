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

export const getReport   = ()          => api.get("/api/attendance/report");
export const getLogs     = ()          => api.get("/api/attendance/logs");
export const clearLogs   = ()          => api.delete("/api/attendance/clear-logs");
export const getIdentities = ()        => api.get("/api/register/identities");
export const uploadEmbedding = (form: FormData) =>
  api.post("/api/register/upload-embedding", form);
