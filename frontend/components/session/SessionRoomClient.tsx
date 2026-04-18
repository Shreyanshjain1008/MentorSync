"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { ChatPanel } from "@/components/session/ChatPanel";
import { CodeEditorPanel } from "@/components/session/CodeEditorPanel";
import { VideoPanel } from "@/components/session/VideoPanel";
import type { UserRole } from "@/types/auth";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWebSocket } from "@/hooks/use-websocket";
import { api } from "@/lib/api";
import { formatDate, parseError } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useSessionStore } from "@/store/session-store";
import type { ChatEvent, CodeSyncEvent, MessageRecord, SessionRecord, SignalingEvent } from "@/types/session";

export function SessionRoomClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const user = useAuthGuard();
  const token = useAuthStore((state) => state.accessToken);
  const { sessions, upsertSession, messages, setMessages, appendMessage, activeLanguage, setActiveLanguage } =
    useSessionStore();
  const cachedSession = useMemo(
    () => sessions.find((candidate) => candidate.id === sessionId) ?? null,
    [sessionId, sessions],
  );
  const [session, setSession] = useState<SessionRecord | null>(cachedSession);
  const [code, setCode] = useState("# Start collaborating live...\n");
  const [latestCodeEvent, setLatestCodeEvent] = useState<CodeSyncEvent | null>(null);
  const [latestSignal, setLatestSignal] = useState<SignalingEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!cachedSession);
  const [isSendingMessage, startMessageTransition] = useTransition();
  const [isEndingSession, startEndTransition] = useTransition();
  const codeSyncTimeoutRef = useRef<number | null>(null);
  const codeClientIdRef = useRef(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `code-client-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const pendingCodeSyncRef = useRef<{ code: string; cursorPosition: number | null } | null>(null);
  const lastSentCodeSyncRef = useRef<{ code: string; cursorPosition: number | null }>({
    code: "# Start collaborating live...\n",
    cursorPosition: null,
  });
  const lastCodeSnapshotAtRef = useRef<string | null>(null);
  const lastRemoteCodeAtRef = useRef<number>(0);
  const lastRemoteCodeEventRef = useRef<{
    updatedAt: string;
    code: string;
    cursorPosition: number | null;
    senderId: string;
  } | null>(null);
  const hasRedirectedRef = useRef(false);

  const codeSocketRef = useRef<WebSocket | null>(null);

  const flushPendingCodeSync = useCallback(() => {
    const pendingPayload = pendingCodeSyncRef.current;
    if (!pendingPayload || codeSocketRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }

    codeSocketRef.current.send(
      JSON.stringify({
        code: pendingPayload.code,
        cursor_position: pendingPayload.cursorPosition,
        client_id: codeClientIdRef.current,
      }),
    );
    lastSentCodeSyncRef.current = pendingPayload;
    return true;
  }, []);

  const sessionMessages = messages[sessionId] ?? [];
  const shareLink =
    typeof window === "undefined" ? `/session/${sessionId}` : `${window.location.origin}/session/${sessionId}`;

  const redirectToDashboard = useCallback(() => {
    if (hasRedirectedRef.current) {
      return;
    }

    hasRedirectedRef.current = true;
    router.replace("/dashboard");
  }, [router]);

  useEffect(() => {
    if (!cachedSession) {
      return;
    }

    setSession((currentSession) => currentSession ?? cachedSession);
    setIsLoading(false);
  }, [cachedSession]);

  const dashboardSession = useMemo(() => cachedSession ?? session, [cachedSession, session]);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    let isMounted = true;

    const bootstrapSession = async () => {
      try {
        if (cachedSession) {
          setSession(cachedSession);
          setIsLoading(false);
        }

        const sessionPromise = cachedSession
          ? cachedSession.status === "pending"
            ? api.joinSession(token, sessionId)
            : Promise.resolve(cachedSession)
          : (async () => {
              const existingSession = await api.getSession(token, sessionId);
              if (existingSession.status === "pending") {
                return api.joinSession(token, sessionId);
              }
              return existingSession;
            })();

        const [resolvedSession, history, snapshot] = await Promise.all([
          sessionPromise,
          api.listMessages(token, sessionId),
          api.getCodeSnapshot(token, sessionId),
        ]);

        if (!isMounted) {
          return;
        }

        setSession(resolvedSession);
        upsertSession(resolvedSession);
        setMessages(sessionId, history);
        if (snapshot) {
          const snapshotUpdatedAt = new Date(snapshot.updated_at).getTime();
          const hasNewerRemoteEvent =
            !Number.isNaN(snapshotUpdatedAt) && snapshotUpdatedAt < lastRemoteCodeAtRef.current;

          if (!hasNewerRemoteEvent) {
            lastCodeSnapshotAtRef.current = snapshot.updated_at;
            setCode(snapshot.code);
            lastSentCodeSyncRef.current = {
              code: snapshot.code,
              cursorPosition: null,
            };
          }
        }
      } catch (loadError) {
        if (isMounted) {
          setError(parseError(loadError));
        }
      } finally {
        if (isMounted && !cachedSession) {
          setIsLoading(false);
        }
      }
    };

    void bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, [cachedSession, sessionId, setMessages, token, upsertSession, user]);

  useEffect(() => {
    return () => {
      if (codeSyncTimeoutRef.current) {
        window.clearTimeout(codeSyncTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (latestSignal?.signal_type === "session-ended") {
      redirectToDashboard();
    }
  }, [latestSignal, redirectToDashboard]);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    let isDisposed = false;

    const pollCodeSnapshot = async () => {
      try {
        const snapshot = await api.getCodeSnapshot(token, sessionId);
        const pendingPayload = pendingCodeSyncRef.current;
        const hasLocalPendingChanges =
          !!pendingPayload &&
          (pendingPayload.code !== lastSentCodeSyncRef.current.code ||
            pendingPayload.cursorPosition !== lastSentCodeSyncRef.current.cursorPosition);

        if (
          !snapshot ||
          isDisposed ||
          hasLocalPendingChanges ||
          snapshot.updated_at === lastCodeSnapshotAtRef.current
        ) {
          return;
        }

        lastCodeSnapshotAtRef.current = snapshot.updated_at;
        setCode((currentCode) => (currentCode === snapshot.code ? currentCode : snapshot.code));
      } catch {
        // Keep polling quiet; websocket remains the primary path.
      }
    };

    const interval = window.setInterval(() => {
      if (codeSocketRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      void pollCodeSnapshot();
    }, 2500);

    return () => {
      isDisposed = true;
      window.clearInterval(interval);
    };
  }, [sessionId, token, user]);

  const chatSocket = useWebSocket<ChatEvent>({
    path: `/ws/chat/${sessionId}`,
    token,
    enabled: Boolean(token && user),
    onMessage: useCallback(
      (payload) => {
        const message: MessageRecord = {
          id: payload.id,
          session_id: payload.session_id,
          sender_id: payload.sender_id,
          message: payload.message,
          timestamp: payload.timestamp,
        };
        appendMessage(sessionId, message);
      },
      [appendMessage, sessionId],
    ),
  });

  const codeSocket = useWebSocket<CodeSyncEvent>({
    path: `/ws/code/${sessionId}`,
    token,
    enabled: Boolean(token && user && dashboardSession?.status !== "completed"),
    onMessage: useCallback(
      (payload) => {
        if (!user) {
          return;
        }

        if (payload.client_id && payload.client_id === codeClientIdRef.current) {
          return;
        }

        const remoteUpdatedAt = new Date(payload.updated_at).getTime();
        const previousRemoteEvent = lastRemoteCodeEventRef.current;
        const isDuplicateEvent =
          previousRemoteEvent?.updatedAt === payload.updated_at &&
          previousRemoteEvent.code === payload.code &&
          previousRemoteEvent.cursorPosition === payload.cursor_position &&
          previousRemoteEvent.senderId === payload.sender_id;

        if (isDuplicateEvent) {
          return;
        }

        if (!Number.isNaN(remoteUpdatedAt) && remoteUpdatedAt < lastRemoteCodeAtRef.current) {
          return;
        }

        if (!Number.isNaN(remoteUpdatedAt)) {
          lastRemoteCodeAtRef.current = Math.max(lastRemoteCodeAtRef.current, remoteUpdatedAt);
        }

        lastRemoteCodeEventRef.current = {
          updatedAt: payload.updated_at,
          code: payload.code,
          cursorPosition: payload.cursor_position,
          senderId: payload.sender_id,
        };

        if (!previousRemoteEvent || previousRemoteEvent.code !== payload.code) {
          lastCodeSnapshotAtRef.current = payload.updated_at;
        }

        setLatestCodeEvent(payload);
        setCode((currentCode) => (currentCode === payload.code ? currentCode : payload.code));
      },
      [user],
    ),
    onOpen: useCallback(
      (socket: WebSocket) => {
        codeSocketRef.current = socket;
        flushPendingCodeSync();
      },
      [flushPendingCodeSync],
    ),
  });

  useEffect(() => {
    codeSocketRef.current = codeSocket.current;
  });

  const signalingSocket = useWebSocket<SignalingEvent>({
    path: `/ws/signaling/${sessionId}`,
    token,
    enabled: Boolean(token && user && dashboardSession?.status !== "completed"),
    onMessage: useCallback((payload) => {
      setLatestSignal(payload);
    }, []),
  });

  const remoteParticipantRole: UserRole | null = useMemo(() => {
    if (!dashboardSession || !latestCodeEvent) {
      return null;
    }

    if (latestCodeEvent.sender_id === dashboardSession.mentor_id) {
      return "mentor";
    }

    if (latestCodeEvent.sender_id === dashboardSession.student_id) {
      return "student";
    }

    return null;
  }, [dashboardSession, latestCodeEvent, user?.id]);

  const isCompletedSession = dashboardSession?.status === "completed";
  const canEndSession = Boolean(dashboardSession && user?.role === "mentor" && dashboardSession.mentor_id === user?.id);

  if (!user || isLoading) {
    return <LoadingScreen label="Entering the session room..." />;
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <div className="glass-panel mb-6 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-ocean">Session Room</p>
            <h1 className="mt-2 break-all text-3xl font-semibold tracking-tight text-ink">{sessionId}</h1>
            <p className="mt-2 text-sm text-slate-600">
              Status: <span className="font-medium text-ink">{dashboardSession?.status ?? "active"}</span>
              {dashboardSession?.created_at ? ` | Created ${formatDate(dashboardSession.created_at)}` : ""}
            </p>
            <p className="mt-2 break-all text-xs text-slate-500">Share link: {shareLink}</p>
          </div>
          <div className="flex min-w-[260px] flex-col gap-2 xl:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-ocean hover:text-ocean"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareLink);
                }}
              >
                Copy join link
              </button>
              <div className="rounded-full bg-slate-950 px-4 py-2 text-sm text-white">
                {user.email} | {user.role}
              </div>
            </div>
            {canEndSession || isCompletedSession ? (
              <button
                type="button"
                disabled={!canEndSession || isEndingSession || isCompletedSession}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 xl:w-auto"
                onClick={() => {
                  if (!token || isCompletedSession || !canEndSession) {
                    return;
                  }

                  startEndTransition(async () => {
                    try {
                      const endedSession = await api.endSession(token, sessionId);
                      setSession(endedSession);
                      upsertSession(endedSession);

                      if (signalingSocket.current?.readyState === WebSocket.OPEN) {
                        signalingSocket.current.send(
                          JSON.stringify({
                            signal_type: "session-ended",
                            payload: { endedBy: user.id },
                          }),
                        );
                      }

                      redirectToDashboard();
                    } catch (endError) {
                      setError(parseError(endError));
                    }
                  });
                }}
              >
                {isCompletedSession ? "Session Completed" : isEndingSession ? "Ending session..." : "End Session For Everyone"}
              </button>
            ) : null}
          </div>
        </div>
        {error ? <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.3fr_0.85fr]">
        <div className="min-h-[640px]">
          <VideoPanel currentUser={user} sessionId={sessionId} signalingSocket={signalingSocket} latestSignal={latestSignal} />
        </div>

        <div className="min-h-[640px]">
          <CodeEditorPanel
            currentUser={user}
            language={activeLanguage}
            code={code}
            remoteCodeEvent={latestCodeEvent}
            remoteParticipantRole={remoteParticipantRole}
            onLanguageChange={setActiveLanguage}
            onCodeChange={({ code: nextCode, cursorPosition }) => {
              setCode((currentCode) => (currentCode === nextCode ? currentCode : nextCode));

              pendingCodeSyncRef.current = {
                code: nextCode,
                cursorPosition,
              };

              if (codeSyncTimeoutRef.current) {
                window.clearTimeout(codeSyncTimeoutRef.current);
              }

              const codeChanged = nextCode !== lastSentCodeSyncRef.current.code;
              const cursorChanged = cursorPosition !== lastSentCodeSyncRef.current.cursorPosition;
              if (!codeChanged && !cursorChanged) {
                return;
              }

              codeSyncTimeoutRef.current = window.setTimeout(() => {
                const pendingPayload = pendingCodeSyncRef.current;
                if (!pendingPayload) {
                  return;
                }

                const stillChanged =
                  pendingPayload.code !== lastSentCodeSyncRef.current.code ||
                  pendingPayload.cursorPosition !== lastSentCodeSyncRef.current.cursorPosition;
                if (!stillChanged) {
                  return;
                }

                if (flushPendingCodeSync()) {
                  return;
                }

                codeSyncTimeoutRef.current = window.setTimeout(() => {
                  if (!flushPendingCodeSync() && token) {
                    void api
                      .saveCodeSnapshot(token, sessionId, pendingPayload.code)
                      .then((snapshot) => {
                        lastCodeSnapshotAtRef.current = snapshot.updated_at;
                      })
                      .catch(() => {
                        // Fallback save failed; next edit or poll will retry.
                      });
                  }
                }, 120);
              }, codeChanged ? 70 : 35);
            }}
          />
        </div>

        <div className="min-h-[640px]">
          <ChatPanel
            currentUser={user}
            session={dashboardSession}
            messages={sessionMessages}
            sending={isSendingMessage}
            onSend={async (message) => {
              startMessageTransition(async () => {
                try {
                  if (chatSocket.current?.readyState === WebSocket.OPEN) {
                    chatSocket.current.send(JSON.stringify({ message }));
                    return;
                  }

                  if (!token) {
                    throw new Error("Unable to send message right now.");
                  }

                  const savedMessage = await api.sendMessage(token, sessionId, message);
                  appendMessage(sessionId, savedMessage);
                } catch (sendError) {
                  setError(parseError(sendError));
                }
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}
