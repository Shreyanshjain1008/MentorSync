import { apiRequest } from "@/lib/http";
import type { AuthResponse, LoginPayload, SignupPayload } from "@/types/auth";
import type { CodeSnapshotRecord, MessageRecord, SessionRecord } from "@/types/session";

export const api = {
  signup(payload: SignupPayload) {
    return apiRequest<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload: LoginPayload) {
    return apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listSessions(token: string) {
    return apiRequest<SessionRecord[]>("/sessions", { token });
  },
  getSession(token: string, sessionId: string) {
    return apiRequest<SessionRecord>(`/sessions/${sessionId}`, { token });
  },
  createSession(token: string, payload: { studentId?: string; studentEmail?: string }) {
    return apiRequest<SessionRecord>("/sessions/create", {
      method: "POST",
      token,
      body: JSON.stringify({
        student_id: payload.studentId || null,
        student_email: payload.studentEmail || null,
      }),
    });
  },
  joinSession(token: string, sessionId: string) {
    return apiRequest<SessionRecord>(`/sessions/join/${sessionId}`, {
      method: "POST",
      token,
    });
  },
  endSession(token: string, sessionId: string) {
    return apiRequest<SessionRecord>(`/sessions/end/${sessionId}`, {
      method: "POST",
      token,
    });
  },
  getCodeSnapshot(token: string, sessionId: string) {
    return apiRequest<CodeSnapshotRecord | null>(`/sessions/${sessionId}/code`, {
      token,
    });
  },
  saveCodeSnapshot(token: string, sessionId: string, code: string) {
    return apiRequest<CodeSnapshotRecord>(`/sessions/${sessionId}/code`, {
      method: "POST",
      token,
      body: JSON.stringify({ code }),
    });
  },
  deleteSession(token: string, sessionId: string) {
    return apiRequest<void>(`/sessions/${sessionId}`, {
      method: "DELETE",
      token,
    });
  },
  listMessages(token: string, sessionId: string) {
    return apiRequest<MessageRecord[]>(`/messages/${sessionId}`, { token });
  },
  sendMessage(token: string, sessionId: string, message: string) {
    return apiRequest<MessageRecord>(`/messages/${sessionId}`, {
      method: "POST",
      token,
      body: JSON.stringify({ message }),
    });
  },
};
