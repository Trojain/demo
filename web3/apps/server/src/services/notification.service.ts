import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';

export class NotificationService {
  private wss?: WebSocketServer;

  bind(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (socket) => {
      socket.send(JSON.stringify({ type: 'connected', payload: { time: new Date().toISOString() } }));
    });
  }

  broadcast(type: string, payload: unknown) {
    const message = JSON.stringify({ type, payload });
    this.wss?.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }
}
