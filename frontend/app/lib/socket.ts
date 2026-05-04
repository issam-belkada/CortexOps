import { getWsUrl } from './backend';

export type WebSocketHandlers = {
  onOpen?: () => void;
  onMessage: (event: MessageEvent) => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
};

export function connectWebSocket(path: string, handlers: WebSocketHandlers) {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let mounted = true;

  const cleanup = () => {
    mounted = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    socket?.close();
    socket = null;
  };

  const connect = () => {
    if (!mounted) return;
    if (socket && socket.readyState !== WebSocket.CLOSED) return;

    const url = getWsUrl(path);
    console.log(`Connecting to WebSocket: ${url}`);

    socket = new WebSocket(url);

    socket.onopen = () => {
      handlers.onOpen?.();
    };

    socket.onmessage = handlers.onMessage;

    socket.onerror = (event) => {
      handlers.onError?.(event);
    };

    socket.onclose = () => {
      handlers.onClose?.();
      if (!mounted) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      reconnectTimer = setTimeout(() => {
        socket = null;
        connect();
      }, 2000);
    };
  };

  connect();

  return cleanup;
}
