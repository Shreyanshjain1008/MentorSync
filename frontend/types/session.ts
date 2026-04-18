export type SessionStatus = "pending" | "active" | "completed";

export interface SessionRecord {
  id: string;
  mentor_id: string;
  student_id: string;
  status: SessionStatus;
  created_at: string;
}

export interface MessageRecord {
  id: string;
  session_id: string;
  sender_id: string;
  message: string;
  timestamp: string;
}

export interface CodeSyncEvent {
  type: "code_sync";
  session_id: string;
  sender_id: string;
  client_id?: string | null;
  code: string;
  cursor_position: number | null;
  updated_at: string;
}

export interface CodeSnapshotRecord {
  code: string;
  updated_at: string;
}

export interface ChatEvent {
  type: "chat_message";
  id: string;
  session_id: string;
  sender_id: string;
  message: string;
  timestamp: string;
}

export interface SignalingEvent {
  type: "signal";
  session_id: string;
  sender_id: string;
  signal_type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

