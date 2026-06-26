import type { WebSocketInterface } from "./websocket-interface.js";

export type ConnectionStatus = "connecting" | "connected" | "closed";

const noopHandler = (): void => {};

// A WebSocketInterface that reports its own connection lifecycle (connecting →
// connected → closed) and every frame it sends/receives, and can hold incoming frames
// back to simulate latency.
export class InstrumentedWebSocket implements WebSocketInterface {
  private socket: WebSocket | null = null;
  private messageHandler: (event: MessageEvent<string>) => void = noopHandler;

  constructor(
    private readonly openSocket: () => Promise<WebSocket>,
    private readonly onFrame: (direction: "send" | "recv", raw: string) => void,
    private readonly onStatus: (status: ConnectionStatus) => void,
    private readonly getReceiveLatencyMs: () => number = () => 0,
  ) {
  }

  async open(): Promise<void> {
    this.onStatus("connecting");
    const socket = await this.openSocket();
    this.onStatus("connected");
    this.socket = socket;
    socket.addEventListener("close", () => this.onStatus("closed"));
    socket.onmessage = (event) => this.handleIncomingFrame(event);
  }

  private handleIncomingFrame(event: MessageEvent<string>): void {
    const handler = this.messageHandler;
    this.afterReceiveLatency(() => {
      this.onFrame("recv", event.data);
      handler(event);
    });
  }

  private afterReceiveLatency(action: () => void): void {
    const latency = this.getReceiveLatencyMs();
    if (latency > 0) {
      setTimeout(action, latency);
    } else {
      action();
    }
  }

  // --- WebSocketInterface ---

  get readyState(): number {
    return this.socket?.readyState ?? WebSocket.CONNECTING;
  }

  send(data: string): void {
    this.onFrame("send", data);
    this.socket?.send(data);
  }

  close(): void {
    this.socket?.close();
  }

  get onmessage(): ((event: MessageEvent<string>) => void) | null {
    return this.messageHandler;
  }
  set onmessage(handler: ((event: MessageEvent<string>) => void) | null) {
    this.messageHandler = handler ?? noopHandler;
  }

  addEventListener(type: "close", listener: () => void): void {
    this.socket?.addEventListener(type, () => this.afterReceiveLatency(listener));
  }
}
