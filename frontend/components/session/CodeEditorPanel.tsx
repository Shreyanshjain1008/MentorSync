"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import type * as MonacoNamespace from "monaco-editor";

import type { AuthUser, UserRole } from "@/types/auth";
import type { CodeSyncEvent } from "@/types/session";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type EditorInstance = MonacoNamespace.editor.IStandaloneCodeEditor;
type MonacoInstance = typeof MonacoNamespace;

const roleAccent = {
  mentor: {
    badge: "bg-teal-400/15 text-teal-200 ring-1 ring-inset ring-teal-400/30",
    cursorClass: "remote-mentor-cursor",
    lineClass: "remote-mentor-line",
  },
  student: {
    badge: "bg-amber-400/15 text-amber-200 ring-1 ring-inset ring-amber-300/30",
    cursorClass: "remote-student-cursor",
    lineClass: "remote-student-line",
  },
} as const;

export function CodeEditorPanel({
  currentUser,
  language,
  code,
  remoteCodeEvent,
  remoteParticipantRole,
  onLanguageChange,
  onCodeChange,
}: {
  currentUser: AuthUser;
  language: "javascript" | "python";
  code: string;
  remoteCodeEvent: CodeSyncEvent | null;
  remoteParticipantRole: UserRole | null;
  onLanguageChange: (language: "javascript" | "python") => void;
  onCodeChange: (payload: { code: string; cursorPosition: number | null }) => void;
}) {
  const editorRef = useRef<EditorInstance | null>(null);
  const monacoRef = useRef<MonacoInstance | null>(null);
  const applyingRemoteChangeRef = useRef(false);
  const remoteDecorationIdsRef = useRef<string[]>([]);
  const lastPayloadRef = useRef<{ code: string; cursorPosition: number | null }>({
    code,
    cursorPosition: null,
  });
  const lastAppliedExternalCodeRef = useRef(code);

  useEffect(() => {
    lastPayloadRef.current.code = code;
  }, [code]);

  useEffect(() => {
    if (!editorRef.current) {
      lastAppliedExternalCodeRef.current = code;
      return;
    }

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model || model.getValue() === code || lastAppliedExternalCodeRef.current === code) {
      return;
    }

    applyingRemoteChangeRef.current = true;
    editor.executeEdits("external-sync", [
      {
        range: model.getFullModelRange(),
        text: code,
      },
    ]);
    applyingRemoteChangeRef.current = false;
    lastAppliedExternalCodeRef.current = code;
    lastPayloadRef.current.code = code;
  }, [code]);

  useEffect(() => {
    if (!remoteCodeEvent || !editorRef.current || !monacoRef.current) {
      return;
    }


    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor.getModel();
    if (!model) {
      return;
    }

    if (model.getValue() !== remoteCodeEvent.code) {
      applyingRemoteChangeRef.current = true;
      editor.executeEdits("remote-sync", [
        {
          range: model.getFullModelRange(),
          text: remoteCodeEvent.code,
        },
      ]);
      applyingRemoteChangeRef.current = false;
      lastAppliedExternalCodeRef.current = remoteCodeEvent.code;
      lastPayloadRef.current.code = remoteCodeEvent.code;
    }

    if (typeof remoteCodeEvent.cursor_position === "number") {
      const position = model.getPositionAt(remoteCodeEvent.cursor_position);
      const accent = roleAccent[remoteParticipantRole ?? "student"];
      const remoteRoleLabel = remoteParticipantRole ?? "participant";

      remoteDecorationIdsRef.current = editor.deltaDecorations(remoteDecorationIdsRef.current, [
        {
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 1),
          options: {
            className: accent.cursorClass,
            linesDecorationsClassName: accent.lineClass,
            hoverMessage: { value: `${remoteRoleLabel} is editing here` },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        },
      ]);
      editor.revealPositionInCenterIfOutsideViewport(position);
    }
  }, [currentUser.id, remoteCodeEvent, remoteParticipantRole]);

  const editorOptions = useMemo<MonacoNamespace.editor.IStandaloneEditorConstructionOptions>(
    () => ({
      fontSize: 14,
      minimap: { enabled: false },
      smoothScrolling: true,
      padding: { top: 18, bottom: 18 },
      scrollBeyondLastLine: false,
      tabSize: 2,
      wordWrap: "on",
      automaticLayout: true,
      fontFamily: "var(--font-ibm-plex-mono)",
      readOnly: false,
      domReadOnly: false,
      folding: true,
      lineNumbersMinChars: 3,
    }),
    [],
  );

  const localRoleAccent = roleAccent[currentUser.role];
  const remoteRoleAccent = remoteParticipantRole ? roleAccent[remoteParticipantRole] : roleAccent.student;

  return (
    <div className="flex h-full flex-col rounded-[28px] border border-slate-200 bg-[#06111B]">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-4 text-white">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400">Code Workspace</p>
          <h3 className="mt-2 text-xl font-semibold">Monaco live sync</h3>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.18em]">
            <span className={`rounded-full px-3 py-1 ${localRoleAccent.badge}`}>You: {currentUser.role}</span>
            <span className={`rounded-full px-3 py-1 ${remoteRoleAccent.badge}`}>
              Remote: {remoteParticipantRole ?? "waiting"}
            </span>
          </div>
        </div>

        <select
          className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm outline-none"
          value={language}
          onChange={(event) => onLanguageChange(event.target.value as "javascript" | "python")}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
        </select>
      </div>

      <div className="flex-1 overflow-hidden rounded-b-[28px]">
        <MonacoEditor
          height="100%"
          language={language}
          defaultValue={code}
          theme="vs-dark"
          options={editorOptions}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;

            editor.updateOptions({ readOnly: false });

            setTimeout(() => {
              editor.focus();
            }, 100);

            editor.onDidChangeModelContent(() => {
              if (applyingRemoteChangeRef.current) {
                return;
              }

              const model = editor.getModel();
              const position = editor.getPosition();
              if (!model) {
                return;
              }

              const nextPayload = {
                code: model.getValue(),
                cursorPosition: position ? model.getOffsetAt(position) : null,
              };

              lastPayloadRef.current = nextPayload;
              onCodeChange(nextPayload);
            });

            editor.onDidChangeCursorPosition(() => {
              if (applyingRemoteChangeRef.current) {
                return;
              }

              const model = editor.getModel();
              const position = editor.getPosition();
              if (!model || !position) {
                return;
              }

              const nextPayload = {
                code: model.getValue(),
                cursorPosition: model.getOffsetAt(position),
              };

              if (
                nextPayload.code === lastPayloadRef.current.code &&
                nextPayload.cursorPosition === lastPayloadRef.current.cursorPosition
              ) {
                return;
              }

              lastPayloadRef.current = nextPayload;
              onCodeChange(nextPayload);
            });
          }}
        />
      </div>
    </div>
  );
}

