"use client";

import { useEffect, useRef } from "react";

import { env } from "@/lib/env";

interface UseWebSocketOptions<TIncoming> {
  path: string;
  token: string | null;
  onMessage: (payload: TIncoming) => void;
  onOpen?: (socket: WebSocket) => void;
  enabled?: boolean;
}

export function useWebSocket<TIncoming>({
  path,
  token,
  onMessage,
  onOpen,
  enabled = true,
}: UseWebSocketOptions<TIncoming>) {
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
  }, [onMessage, onOpen]);

  useEffect(() => {
    if (!enabled || !token) {
      return;
    }

    let isDisposed = false;

    const connect = () => {
      const separator = path.includes("?") ? "&" : "?";
      const socket = new WebSocket(`${env.wsBaseUrl}${path}${separator}token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
        onOpenRef.current?.(socket);
      };

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as TIncoming;
        onMessageRef.current(payload);
      };

      socket.onclose = () => {
        if (isDisposed) {
          return;
        }

        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 10000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled, path, token]);

  return socketRef;
}
