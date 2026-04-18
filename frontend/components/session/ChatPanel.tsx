"use client";

import { useMemo, useState } from "react";

import { formatDate } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";
import type { MessageRecord, SessionRecord } from "@/types/session";

function CodeBubble({ message }: { message: string }) {
  const isCode = message.includes("```") || message.includes("\n");

  if (isCode) {
    return (
      <pre className="overflow-x-auto rounded-2xl bg-slate-950/90 p-4 font-mono text-xs leading-6 text-emerald-200">
        <code>{message.replaceAll("```", "")}</code>
      </pre>
    );
  }

  return <p className="whitespace-pre-wrap text-sm leading-6">{message}</p>;
}

function senderLabel(message: MessageRecord, currentUser: AuthUser, session: SessionRecord | null) {
  if (message.sender_id === currentUser.id) {
    return `You (${currentUser.role})`;
  }

  if (session?.mentor_id === message.sender_id) {
    return "Mentor";
  }

  if (session?.student_id === message.sender_id) {
    return "Student";
  }

  return message.sender_id.slice(0, 8);
}

export function ChatPanel({
  messages,
  currentUser,
  session,
  onSend,
  sending,
}: {
  messages: MessageRecord[];
  currentUser: AuthUser;
  session: SessionRecord | null;
  onSend: (message: string) => Promise<void>;
  sending: boolean;
}) {
  const [draft, setDraft] = useState("");

  const orderedMessages = useMemo(
    () =>
      [...messages].sort(
        (left, right) =>
          new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime() || left.id.localeCompare(right.id),
      ),
    [messages],
  );

  return (
    <div className="flex h-full flex-col rounded-[28px] border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">Live Chat</p>
        <h3 className="mt-2 text-xl font-semibold text-ink">Session conversation</h3>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {orderedMessages.length ? (
          orderedMessages.map((message) => {
            const isOwn = message.sender_id === currentUser.id;
            return (
              <article
                key={message.id}
                className={`rounded-3xl px-4 py-3 ${isOwn ? "bg-ocean text-white" : "bg-slate-100 text-slate-800"}`}
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] opacity-80">
                  <span>{senderLabel(message, currentUser, session)}</span>
                  <span>{formatDate(message.timestamp)}</span>
                </div>
                <CodeBubble message={message.message} />
              </article>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No messages yet. Say hello or drop a code snippet to start collaborating.
          </div>
        )}
      </div>

      <form
        className="border-t border-slate-100 p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!draft.trim()) {
            return;
          }

          await onSend(draft);
          setDraft("");
        }}
      >
        <textarea
          rows={4}
          className="w-full resize-none rounded-3xl border border-slate-200 px-4 py-3 outline-none transition focus:border-ocean"
          placeholder="Send a message or paste code..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          disabled={sending}
          className="mt-3 w-full rounded-2xl bg-ink px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send message"}
        </button>
      </form>
    </div>
  );
}
