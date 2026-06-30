import type { WebSocketInterface } from "./websocket-interface.js";

export type ConnectionStatus = "connecting" | "connected" | "closed";

const noopHandler = (): void => {};

// A WebSocketInterface that reports its own connection lifecycle (connecting →
// connected → closed) and every frame it sends/receives, and can hold incoming frames
// back to simulate latency.
export class InstrumentedWebSocket implements WebSocketInterface {
  private socket: WebSocket | null = null;
  private messageHandler: (event: MessageEvent<string>) => void = noopHandler;
  private readonly pendingFrameTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    private readonly openSocket: () => Promise<WebSocket>,
    private readonly onFrame: (direction: "send" | "recv", raw: string) => void,
    private readonly onStatus: (status: ConnectionStatus) => void,
    private readonly getReceiveLatencyMs: () => number = () => 0,
  ) {}

  async open(): Promise<void> {
    this.onStatus("connecting");
    const socket = await this.openSocket();
    this.onStatus("connected");
    this.socket = socket;
    socket.addEventListener("close", () => {
      this.cancelPendingFrames();
      this.onStatus("closed");
    });
    socket.onmessage = (event) => this.handleIncomingFrame(event);
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

  addEventListener(type: "close", listener: (event: CloseEvent) => void): void {
    this.socket?.addEventListener(type, listener);
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
    if (latency <= 0) {
      action();
      return;
    }
    const timer = setTimeout(() => {
      this.pendingFrameTimers.delete(timer);
      action();
    }, latency);
    this.pendingFrameTimers.add(timer);
  }

  private cancelPendingFrames(): void {
    for (const timer of this.pendingFrameTimers) {
      clearTimeout(timer);
    }
    this.pendingFrameTimers.clear();
  }
}
