"use client";

import { create } from "zustand";

import type { MessageRecord, SessionRecord } from "@/types/session";

interface SessionState {
  sessions: SessionRecord[];
  messages: Record<string, MessageRecord[]>;
  hasLoadedSessions: boolean;
  activeLanguage: "javascript" | "python";
  setSessions: (sessions: SessionRecord[]) => void;
  upsertSession: (session: SessionRecord) => void;
  removeSession: (sessionId: string) => void;
  setMessages: (sessionId: string, messages: MessageRecord[]) => void;
  appendMessage: (sessionId: string, message: MessageRecord) => void;
  setActiveLanguage: (language: "javascript" | "python") => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  messages: {},
  hasLoadedSessions: false,
  activeLanguage: "python",
  setSessions: (sessions) => set({ sessions, hasLoadedSessions: true }),
  upsertSession: (session) =>
    set((state) => ({
      hasLoadedSessions: true,
      sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)],
    })),
  removeSession: (sessionId) =>
    set((state) => {
      const nextMessages = { ...state.messages };
      delete nextMessages[sessionId];

      return {
        hasLoadedSessions: true,
        sessions: state.sessions.filter((item) => item.id !== sessionId),
        messages: nextMessages,
      };
    }),
  setMessages: (sessionId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...messages].sort(
          (left, right) =>
            new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime() || left.id.localeCompare(right.id),
        ),
      },
    })),
  appendMessage: (sessionId, message) =>
    set((state) => {
      const existing = state.messages[sessionId] ?? [];
      const deduped = existing.filter((item) => item.id !== message.id);
      const nextMessages = [...deduped, message].sort(
        (left, right) =>
          new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime() || left.id.localeCompare(right.id),
      );

      return {
        messages: {
          ...state.messages,
          [sessionId]: nextMessages,
        },
      };
    }),
  setActiveLanguage: (language) => set({ activeLanguage: language }),
}));
