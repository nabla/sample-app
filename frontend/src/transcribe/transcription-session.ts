import {
  buildAudioChunk,
  buildTranscribeConfig,
  connectTranscribeWebSocket,
  TRANSCRIBE_END_MESSAGE,
  type TranscribeServerMessage,
  type TranscriptItem,
} from "../api/transcribe.js";
import { BufferedAudioStream } from "./buffered-stream.js";
import { Transcript } from "./transcript.js";
import type { WebSocketInterface } from "../transport/websocket-interface.js";

export interface BufferStats {
  queued: number;
  inflight: number;
  totalAcked: number;
}

// A live transcription session. It owns the accumulated transcript and the current
// connection; push PCM in with sendAudio(), get items out via onTranscriptItem(). A
// session can span several streams — stop() ends the current one, keeping the
// transcript, start() opens a fresh one and keeps accumulating.
export class TranscriptionSession {
  private transcript = new Transcript();
  private socket: WebSocketInterface | null = null;
  private bufferedAudioStream: BufferedAudioStream | null = null;
  private serverClosed: Promise<void> = Promise.resolve();

  private itemListener: (item: TranscriptItem) => void = () => {};

  // The socket factory is injected so a caller can supply a custom socket wrapper.
  constructor(
    private readonly socketFactory: () => Promise<WebSocketInterface> = connectTranscribeWebSocket,
  ) {}

  onTranscriptItem(listener: (item: TranscriptItem) => void): void {
    this.itemListener = listener;
  }

  items(): TranscriptItem[] {
    return this.transcript.items();
  }
  clear(): void {
    this.transcript.clear();
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
  // server has flushedx everything after END.
  private listen(socket: WebSocketInterface): void {
    this.serverClosed = new Promise<void>((resolve) => {
      socket.addEventListener("close", () => {
        // Note: you should implement proper close code handling
        // See API documentation on socket success/error codes
        resolve();
      });
    });
    socket.onmessage = (event: MessageEvent<string>) => {
      const message = JSON.parse(event.data) as TranscribeServerMessage;
      if (message.type === "AUDIO_CHUNK_ACK") {
        this.bufferedAudioStream?.handlePacketAck({ ack_id: message.ack_id });
      } else if (message.type === "TRANSCRIPT_ITEM") {
        this.transcript.add(message);
        this.itemListener(message);
      }
    };
  }
  // #endregion receive-transcript

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
