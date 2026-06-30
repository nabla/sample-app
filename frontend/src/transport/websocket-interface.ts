// A type wrapping a WebSocket, so we can wrap actual WebSockets
// in custom wrappers for debugging or instrumentation.
export interface WebSocketInterface {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  addEventListener(type: "close", listener: (event: CloseEvent) => void): void;
}
