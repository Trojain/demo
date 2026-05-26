import type { TickerPrice, TriggerEvent } from '../types';

export type SocketMessage =
  | { type: 'ticker.updated'; payload: TickerPrice }
  | { type: 'trigger.created'; payload: TriggerEvent }
  | { type: 'connected'; payload: { time: string } };

export interface RealtimeOptions {
  /** 收到行情或触发事件后的统一处理函数 */
  onMessage: (message: SocketMessage) => void;
  /** 多次连接失败后的提示函数，避免开发环境误报 */
  onConnectionLost: () => void;
}

function getDefaultWsUrl() {
  const configuredUrl = import.meta.env.VITE_WS_BASE_URL as string | undefined;
  if (configuredUrl) {
    return configuredUrl;
  }

  // 开发环境直连后端，避开 Vite WebSocket 代理偶发 ECONNRESET。
  if (import.meta.env.DEV) {
    return 'ws://localhost:3001/ws';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}

export function createRealtimeConnection(options: RealtimeOptions) {
  let socket: WebSocket | undefined;
  let closedByClient = false;
  let reconnectTimer: number | undefined;
  let failedCount = 0;
  const wsUrl = getDefaultWsUrl();

  const connect = () => {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      failedCount = 0;
    };

    socket.onmessage = (event) => {
      options.onMessage(JSON.parse(event.data) as SocketMessage);
    };

    socket.onclose = () => {
      if (closedByClient) {
        return;
      }

      failedCount += 1;
      if (failedCount >= 3) {
        options.onConnectionLost();
      }

      reconnectTimer = window.setTimeout(connect, Math.min(1000 * failedCount, 5000));
    };
  };

  connect();

  return () => {
    closedByClient = true;
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
    }
    socket?.close();
  };
}
