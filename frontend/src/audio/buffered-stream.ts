interface SequencedMessage {
	seq_id: number;
	[key: string]: unknown;
}

// #region buffered-audio-stream
const MAX_UNACKED = 50;

export class BufferedAudioStream {
	private ws: WebSocket;
	// Every chunk past the latest cumulative ACK, in send order. The first
	// `sentCount` are on the wire awaiting an ACK; the rest are waiting for a free
	// slot in the window. Acked chunks are dropped off the front; un-acked ones stay
	// so they can be replayed if the socket drops.
	private unacked: SequencedMessage[] = [];
	private sentCount = 0;
	private totalAcked = 0;

	constructor(socket: WebSocket) {
		this.ws = socket;
	}

	reconnect(socket: WebSocket): void {
		this.ws = socket;
	}

	sendAndBuffer(message: SequencedMessage): void {
		this.unacked.push(message);
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

	// On reconnect nothing is confirmed on the wire, so replay the whole un-acked
	// buffer from the front (the server dedupes by seq id).
	replayAll(): void {
		this.sentCount = 0;
		this.pump();
	}

	getStats(): {
		queued: number;
		inflight: number;
		totalAcked: number;
	} {
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
