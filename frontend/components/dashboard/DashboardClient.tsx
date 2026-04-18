"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { formatDate, parseError } from "@/lib/utils";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { AppHeader } from "@/components/layout/AppHeader";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { useAuthStore } from "@/store/auth-store";
import { useSessionStore } from "@/store/session-store";

export function DashboardClient() {
  const router = useRouter();
  const user = useAuthGuard();
  const token = useAuthStore((state) => state.accessToken);
  const { sessions, hasLoadedSessions, setSessions, upsertSession, removeSession } = useSessionStore();

  const [isLoading, setIsLoading] = useState(!hasLoadedSessions);
  const [error, setError] = useState<string | null>(null);
  const [studentEmail, setStudentEmail] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolveSessionId = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] ?? "";
    } catch {
      return trimmed;
    }
  };

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadSessions = async () => {
      try {
        const response = await api.listSessions(token);
        if (isMounted) {
          setSessions(response);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(parseError(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSessions();

    return () => {
      isMounted = false;
    };
  }, [setSessions, token]);

  useEffect(() => {
    if (hasLoadedSessions) {
      setIsLoading(false);
    }
  }, [hasLoadedSessions]);

  if (!user) {
    return <LoadingScreen label="Checking your workspace..." />;
  }

  if (isLoading) {
    return <LoadingScreen label="Loading your sessions..." />;
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-panel p-6 md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-ocean">Dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">Session command center</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Launch a live mentoring room by student email, reconnect to active sessions, or join from a shared link.
              </p>
            </div>
            <div className="rounded-3xl bg-slate-950 px-4 py-3 text-sm text-white">
              Logged in as <span className="font-semibold">{user.role}</span>
            </div>
          </div>

          {error ? <div className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <form
              className="rounded-3xl border border-slate-200 bg-white p-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!token || user.role !== "mentor") {
                  return;
                }

                setError(null);
                startTransition(async () => {
                  try {
                    const session = await api.createSession(token, { studentEmail });
                    upsertSession(session);
                    setStudentEmail("");
                    router.push(`/session/${session.id}`);
                  } catch (submitError) {
                    setError(parseError(submitError));
                  }
                });
              }}
            >
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">Mentor Action</p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">Create a session</h2>
              <p className="mt-2 text-sm text-slate-600">
                Enter the student&apos;s account email and MentorSync will open a room for both of you.
              </p>
              <input
                required
                type="email"
                disabled={user.role !== "mentor"}
                className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-ocean disabled:cursor-not-allowed disabled:bg-slate-100"
                placeholder="student@domain.com"
                value={studentEmail}
                onChange={(event) => setStudentEmail(event.target.value)}
              />
              <button
                type="submit"
                disabled={isPending || user.role !== "mentor"}
                className="mt-4 w-full rounded-2xl bg-mint px-4 py-3 font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Creating..." : "Create and open room"}
              </button>
            </form>

            <form
              className="rounded-3xl border border-slate-200 bg-white p-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!token) {
                  return;
                }

                setError(null);
                startTransition(async () => {
                  try {
                    const sessionId = resolveSessionId(joinInput);
                    const session = await api.joinSession(token, sessionId);
                    upsertSession(session);
                    setJoinInput("");
                    router.push(`/session/${session.id}`);
                  } catch (submitError) {
                    setError(parseError(submitError));
                  }
                });
              }}
            >
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">Quick Join</p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">Join by link or session ID</h2>
              <p className="mt-2 text-sm text-slate-600">
                Paste a room link or a session ID to enter the workspace without searching for anything manually.
              </p>
              <input
                required
                className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-ocean"
                placeholder="Session link or session UUID"
                value={joinInput}
                onChange={(event) => setJoinInput(event.target.value)}
              />
              <button
                type="submit"
                disabled={isPending}
                className="mt-4 w-full rounded-2xl bg-ocean px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Joining..." : "Join session"}
              </button>
            </form>
          </div>
        </section>

        <section className="panel-dark p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">Recent Sessions</p>
              <h2 className="mt-3 text-2xl font-semibold">Your live room history</h2>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200">{sessions.length} rooms</span>
          </div>

          <div className="mt-6 space-y-3">
            {sessions.length ? (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:border-mint/40 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{session.status}</p>
                      <p className="mt-2 break-all text-sm font-medium text-white">{session.id}</p>
                    </div>
                    <span className="rounded-full bg-mint/20 px-3 py-1 text-xs text-mint">
                      {formatDate(session.created_at)}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/session/${session.id}`}
                      className="rounded-full bg-white px-3 py-2 text-sm font-medium text-ink transition hover:bg-mint hover:text-white"
                    >
                      Open room
                    </Link>
                    <button
                      type="button"
                      className="rounded-full border border-white/20 px-3 py-2 text-sm text-white transition hover:border-white/40"
                      onClick={async () => {
                        const shareLink =
                          typeof window === "undefined"
                            ? `/session/${session.id}`
                            : `${window.location.origin}/session/${session.id}`;
                        await navigator.clipboard.writeText(shareLink);
                      }}
                    >
                      Copy join link
                    </button>
                    {user.role === "mentor" && user.id === session.mentor_id ? (
                      <button
                        type="button"
                        disabled={isPending || pendingDeleteId === session.id}
                        className="rounded-full border border-rose-400/40 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => {
                          if (!token) {
                            return;
                          }

                          const confirmed = window.confirm(
                            "Delete this room permanently? This will remove its chat history and code snapshots too.",
                          );
                          if (!confirmed) {
                            return;
                          }

                          setError(null);
                          setPendingDeleteId(session.id);
                          startTransition(async () => {
                            try {
                              await api.deleteSession(token, session.id);
                              removeSession(session.id);
                            } catch (deleteError) {
                              setError(parseError(deleteError));
                            } finally {
                              setPendingDeleteId(null);
                            }
                          });
                        }}
                      >
                        {pendingDeleteId === session.id ? "Deleting..." : "Delete room"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-slate-300">
                No sessions yet. Create one by student email or join from a shared room link.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
