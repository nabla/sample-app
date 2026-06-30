import type { WebSocketInterface } from "../transport/websocket-interface.js";

interface SequencedMessage {
  seq_id: number;
  [key: string]: unknown;
}

export interface BufferStats {
  queued: number;
  inflight: number;
  totalAcked: number;
}

// #region buffered-audio-stream
// We limit the number of in-flight audio chunks to 90 to avoid overwhelming the server.
// Because the server doesn't accept more than 10 seconds of audio in-flight.
// Here, we limit it to 90 chunks so it's 9 seconds of audio.
const MAX_UNACKED = 90;

// The BufferedAudioStream is used to buffer audio chunks and replay them if the socket drops.
// So even in cases of network issues (disconnects or high latency), we keep the audio and
// we transcribe once the network is back.
export class BufferedAudioStream {
  private ws: WebSocketInterface;
  // Every chunk past the latest cumulative ACK, in send order. The first
  // `sentCount` are on the wire awaiting an ACK; the rest are waiting for a free
  // slot in the window. Acked chunks are dropped off the front; un-acked ones stay
  // so they can be replayed if the socket drops.
  private unacked: SequencedMessage[] = [];
  private sentCount = 0;
  private totalAcked = 0;
  private nextSeqId = 0;

  constructor(socket: WebSocketInterface) {
    this.ws = socket;
  }

  // Point at the new socket and replay the un-acked buffer.
  //
  // Limitation: this recovers only audio that was still un-acked when the socket dropped.
  // Audio the server already acked but hadn't yet turned into FINAL transcript items is
  // gone from the buffer (we drop chunks on ACK), so those finals aren't recovered on an
  // unexpected close. A production app would make sure to keep the audio chunks until the
  // final transcript item corresponding to that audio chunk is received.
  reconnect(socket: WebSocketInterface): void {
    this.ws = socket;
    this.sentCount = 0;
    this.pump();
  }

  // The caller builds the wire message from the seq id we assign — sequencing is the
  // buffer's concern (ACKs reference it, replay relies on its order).
  send(buildMessage: (seqId: number) => SequencedMessage): void {
    this.unacked.push(buildMessage(this.nextSeqId++));
    this.pump();
  }

  handlePacketAck(ack: { ack_id: number }): void {
    // ACKs are cumulative: ack_id acknowledges every chunk up to and including it.
    let acked = 0;
    while (
      acked < this.unacked.length &&
      this.unacked[acked].seq_id <= ack.ack_id
    ) {
      acked++;
    }
    this.unacked.splice(0, acked);
    this.sentCount = Math.max(0, this.sentCount - acked);
    this.totalAcked += acked;
    this.pump();
  }

  getStats(): BufferStats {
    return {
      queued: this.unacked.length - this.sentCount,
      inflight: this.sentCount,
      totalAcked: this.totalAcked,
    };
  }

  // Send chunks until the un-acked window is full (or we run out, or the socket
  // isn't open). While the socket is closed this is a no-op and chunks pile up in
  // `unacked` for the next replay.
  private pump(): void {
    while (
      this.ws.readyState === WebSocket.OPEN &&
      this.sentCount < MAX_UNACKED &&
      this.sentCount < this.unacked.length
    ) {
      this.ws.send(JSON.stringify(this.unacked[this.sentCount]));
      this.sentCount++;
    }
  }
}
// #endregion buffered-audio-stream
