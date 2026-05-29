import type { Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'

type ClientSend = (type: string, payload: unknown) => void
type ClientMessageHandler = (message: unknown, send: ClientSend) => void | (() => void)

export class NotificationService {
  private wss?: WebSocketServer

  bind(server: Server, onClientMessage?: ClientMessageHandler) {
    this.wss = new WebSocketServer({ server, path: '/ws' })
    this.wss.on('connection', socket => {
      let cleanupClientSubscription: (() => void) | undefined
      const send: ClientSend = (type, payload) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type, payload }))
        }
      }

      socket.send(JSON.stringify({ type: 'connected', payload: { time: new Date().toISOString() } }))
      socket.on('message', raw => {
        if (!onClientMessage) {
          return
        }

        try {
          cleanupClientSubscription?.()
          cleanupClientSubscription = onClientMessage(JSON.parse(raw.toString()), send) ?? undefined
        } catch (error) {
          send('error', { message: error instanceof Error ? error.message : 'WebSocket 请求处理失败' })
        }
      })
      socket.on('close', () => {
        cleanupClientSubscription?.()
      })
    })
  }

  broadcast(type: string, payload: unknown) {
    const message = JSON.stringify({ type, payload })
    this.wss?.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(message)
      }
    })
  }
}
