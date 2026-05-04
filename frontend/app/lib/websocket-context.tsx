'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getWsUrl } from './backend';

type DataType = 'fleet' | 'anomalies';
type MessageHandler = (data: any) => void;

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (type: DataType, handler: MessageHandler) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<number | null>(null);
  // Stable ref — never reassigned, so handlers survive re-renders
  const handlersRef = React.useRef<Map<DataType, Set<MessageHandler>>>(new Map([
    ['fleet', new Set()],
    ['anomalies', new Set()],
  ]));

  useEffect(() => {
    const connectWebSocket = () => {
      // Don't create a new socket if one is already open or connecting
      if (
        socketRef.current &&
        (socketRef.current.readyState === WebSocket.OPEN ||
          socketRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      try {
        const wsUrl = getWsUrl('/ws/combined');
        console.log('[WS] Connecting to', wsUrl);
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          console.log('[WS] Connected');
          setIsConnected(true);
          // Clear any pending reconnect timer
          if (reconnectTimeoutRef.current !== null) {
            window.clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            const type = message.type as DataType;

            if (type && handlersRef.current.has(type)) {
              // Pass message.data directly — backend wraps payload in { type, data }
              const payload = message.data ?? message;
              handlersRef.current.get(type)?.forEach((handler) => {
                try {
                  handler(payload);
                } catch (err) {
                  console.error(`[WS] Error in "${type}" handler:`, err);
                }
              });
            } else {
              console.warn('[WS] Received message with unknown type:', type, message);
            }
          } catch (err) {
            console.error('[WS] Failed to parse message:', err, event.data);
          }
        };

        ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          // onclose will fire after onerror, so reconnect logic lives there
        };

        ws.onclose = (event) => {
          console.log(`[WS] Disconnected (code=${event.code}), reconnecting in 3s…`);
          setIsConnected(false);
          socketRef.current = null;
          // Schedule reconnect only if not already scheduled
          if (reconnectTimeoutRef.current === null) {
            reconnectTimeoutRef.current = window.setTimeout(() => {
              reconnectTimeoutRef.current = null;
              connectWebSocket();
            }, 3000);
          }
        };
      } catch (err) {
        console.error('[WS] Failed to create WebSocket:', err);
        if (reconnectTimeoutRef.current === null) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectWebSocket();
          }, 3000);
        }
      }
    };

    connectWebSocket();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []); // ← runs ONCE on mount only

  /**
   * subscribe is wrapped in useCallback with empty deps so it gets a STABLE
   * reference across renders. Consumers can safely put it in their own
   * useEffect dep arrays without triggering infinite loops.
   */
  const subscribe = useCallback((type: DataType, handler: MessageHandler): (() => void) => {
    const handlers = handlersRef.current.get(type);
    if (handlers) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }
    // Fallback: type wasn't pre-registered (shouldn't happen, but safe)
    const newSet = new Set<MessageHandler>([handler]);
    handlersRef.current.set(type, newSet);
    return () => newSet.delete(handler);
  }, []); // stable — handlersRef.current never changes identity

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a <WebSocketProvider>');
  }
  return context;
}