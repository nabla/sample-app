import type { WebSocketInterface } from "./transcribe-socket.js";

export type ConnectionStatus = "connecting" | "connected" | "closed";

// A WebSocketInterface that reports every frame it sends and receives, and can hold
// incoming frames back to simulate latency. The in-depth page wraps its socket in
// this to drive the raw WS-message log and the latency spike, so that observability
// lives entirely outside the session — the core stays unaware of it.
export class LoggedSocket implements WebSocketInterface {
  private messageHandler: ((event: MessageEvent<string>) => void) | null = null;

  constructor(
    private readonly socket: WebSocket,
    private readonly onFrame: (
      direction: "send" | "recv",
      raw: string,
    ) => void,
    // Incoming frames are held this long before reaching the session — the
    // in-depth page raises it to simulate latency (ACKs back up, the window fills).
    private readonly receiveLatencyMs: () => number = () => 0,
  ) {
    // Own the raw onmessage so we can log every frame and optionally delay handing
    // it to the session's handler (set via this wrapper's onmessage).
    socket.onmessage = (event: MessageEvent<string>) => {
      this.onFrame("recv", event.data);
      const handler = this.messageHandler;
      if (!handler) {
        return;
      }
      const latency = this.receiveLatencyMs();
      if (latency > 0) {
        setTimeout(() => handler(event), latency);
      } else {
        handler(event);
      }
    };
  }

  get readyState(): number {
    return this.socket.readyState;
  }

  send(data: string): void {
    this.onFrame("send", data);
    this.socket.send(data);
  }

  close(): void {
    this.socket.close();
  }

  get onmessage(): ((event: MessageEvent<string>) => void) | null {
    return this.messageHandler;
  }
  set onmessage(handler: ((event: MessageEvent<string>) => void) | null) {
    this.messageHandler = handler;
  }

  addEventListener(type: "close", listener: () => void): void {
    // Hold close behind the same latency as messages: a slow link must not deliver
    // the close before the final frames queued ahead of it, or stop() (which awaits
    // close to know the server flushed) would miss the last transcript items.
    this.socket.addEventListener(type, () => {
      const latency = this.receiveLatencyMs();
      if (latency > 0) {
        setTimeout(listener, latency);
      } else {
        listener();
      }
    });
  }
}

// Wraps a socket opener so the resulting factory reports the connection lifecycle
// (connecting → connected → closed) and every frame, all outside the session. The
// status straddles socket creation — "connecting"/"connected" fire around the open,
// before any socket instance exists — so it lives here in the opener rather than on
// LoggedSocket, which only knows about frames. The opener is passed in (rather than
// imported) to keep this transport wrapper independent of any specific API.
export function openObservedSocket(
  openSocket: () => Promise<WebSocket>,
  onFrame: (direction: "send" | "recv", raw: string) => void,
  onStatus: (status: ConnectionStatus) => void,
  getReceiveLatencyMs: () => number = () => 0,
): () => Promise<WebSocketInterface> {
  return async () => {
    onStatus("connecting");
    const socket = await openSocket();
    onStatus("connected");
    socket.addEventListener("close", () => onStatus("closed"));
    return new LoggedSocket(socket, onFrame, getReceiveLatencyMs);
  };
}
