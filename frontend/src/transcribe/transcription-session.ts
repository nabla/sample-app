import {
  buildAudioChunk,
  buildTranscribeConfig,
  connectTranscribeWebSocket,
  TRANSCRIBE_END_MESSAGE,
  type TranscribeServerMessage,
  type TranscriptItem,
} from "../api/transcribe.js";
import { BufferedAudioStream, type BufferStats } from "./buffered-stream.js";
import { Transcript } from "./transcript.js";
import type { WebSocketInterface } from "../transport/websocket-interface.js";

// A live transcription session. It owns the accumulated transcript and the current
// connection; push PCM in with sendAudio(), get items out via onTranscriptItem(). A
// session can span several streams — stop() ends the current one, keeping the
// transcript, start() opens a fresh one and keeps accumulating.
export class TranscriptionSession {
  private transcript = new Transcript();
  private socket: WebSocketInterface | null = null;
  private bufferedAudioStream: BufferedAudioStream | null = null;
  private serverClosed: Promise<void> = Promise.resolve();

  // Items are shifted onto a session-wide timeline by timelineBaseMs. Each new socket —
  // a new take or a reconnect — snapshots it to where the transcript currently ends, so
  // the socket's 0-based offsets continue past existing items instead of restarting.
  private timelineBaseMs = 0;

  private itemListener: (item: TranscriptItem) => void = () => {};
  private closeListener: (code: number, reason: string) => void = () => {};

  // The socket factory is injected so a caller can supply a custom socket wrapper.
  constructor(
    private readonly socketFactory: () => Promise<WebSocketInterface> = connectTranscribeWebSocket,
  ) {}

  onTranscriptItem(listener: (item: TranscriptItem) => void): void {
    this.itemListener = listener;
  }

  onClose(listener: (code: number, reason: string) => void): void {
    this.closeListener = listener;
  }

  items(): TranscriptItem[] {
    return this.transcript.items();
  }
  clear(): void {
    this.transcript.clear();
    this.timelineBaseMs = 0;
  }

  // Open a fresh stream (new socket + buffer, CONFIG sent).
  // The accumulated transcript is kept, so start() after stop() continues it.
  async start(): Promise<void> {
    const socket = await this.startNewSocket();
    this.bufferedAudioStream = new BufferedAudioStream(socket);
  }

  // New socket, same buffer → replay the un-acked audio to recover a dropped stream.
  async reconnect(): Promise<void> {
    if (!this.bufferedAudioStream) {
      throw new Error("No buffered audio stream to reconnect, call start() first");
    }
    const socket = await this.startNewSocket();
    this.bufferedAudioStream.reconnect(socket);
  }

  // Graceful end: send END and wait for the server to flush the transcript & close.
  async stop(): Promise<void> {
    if (!this.socket) {
      return;
    }
    if (this.socket.readyState === WebSocket.OPEN) {
      this.send(TRANSCRIBE_END_MESSAGE);
    }
    this.socket = null;
    this.bufferedAudioStream = null;
    await this.serverClosed;
  }

  sendAudio(pcm: Int16Array): void {
    this.bufferedAudioStream?.send((seqId) => buildAudioChunk(seqId, pcm));
  }

  // Start a new socket and wire it up
  private async startNewSocket(): Promise<WebSocketInterface> {
    // Continue from where the transcript currently ends, so a new take or a reconnect's
    // replayed items land after the existing ones instead of restarting at zero.
    this.timelineBaseMs = this.maxEndOffsetMs();

    const socket = await this.socketFactory();
    this.socket = socket;
    this.listen(socket);
    this.send(buildTranscribeConfig());
    return socket;
  }

  private send(message: object): void {
    this.socket?.send(JSON.stringify(message));
  }

  // #region receive-transcript
  // Wire up the socket: accumulate TRANSCRIPT_ITEMs, feed ACKs to the send buffer, and
  // resolve `serverClosed` when the server closes — that close is how we know the
  // server has flushed everything after END.
  private listen(socket: WebSocketInterface): void {
    this.serverClosed = new Promise<void>((resolve) => {
      socket.addEventListener("close", (event) => {
        this.closeListener(event.code, event.reason);
        resolve();
      });
    });
    socket.onmessage = (event: MessageEvent<string>) => {
      const message = JSON.parse(event.data) as TranscribeServerMessage;
      if (message.type === "AUDIO_CHUNK_ACK") {
        this.bufferedAudioStream?.handlePacketAck({ ack_id: message.ack_id });
      } else if (message.type === "TRANSCRIPT_ITEM") {
        const item = this.shiftToSessionTimeline(message);
        this.transcript.add(item);
        this.itemListener(item);
      }
    };
  }
  // #endregion receive-transcript

  // Re-express a socket-local item on the session timeline — offsets shifted by the base
  // snapshotted when the socket opened — so takes and reconnects don't restart at zero.
  private shiftToSessionTimeline(item: TranscriptItem): TranscriptItem {
    return {
      ...item,
      start_offset_ms: item.start_offset_ms + this.timelineBaseMs,
      end_offset_ms: item.end_offset_ms + this.timelineBaseMs,
    };
  }

  // The furthest point the transcript currently reaches — the base for the next socket.
  private maxEndOffsetMs(): number {
    return this.transcript
      .items()
      .reduce((max, item) => Math.max(max, item.end_offset_ms), 0);
  }

  //----------------------------------------------------
  // Demonstration / in-depth purpose only
  //----------------------------------------------------

  // Seed the transcript with externally-sourced items
  addItems(items: TranscriptItem[]): void {
    for (const item of items) {
      this.transcript.add(item);
    }
  }

  // Get the buffer statistics
  getBufferStatistics(): BufferStats {
    return (
      this.bufferedAudioStream?.getStats() ?? {
        queued: 0,
        inflight: 0,
        totalAcked: 0,
      }
    );
  }

  // Simulate a disconnect by hard-closing the socket
  disconnect(): void {
    this.socket?.close();
  }
}
