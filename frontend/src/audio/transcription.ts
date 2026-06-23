import {
	buildAudioChunk,
	buildTranscribeConfig,
	connectTranscribeWebSocket,
	TRANSCRIBE_END_MESSAGE,
	type TranscribeServerMessage,
	type TranscriptItem,
} from "../api/transcribe.js";
import {
	collectFinalTranscriptItems,
	createSession,
	recordTranscriptItem,
	type TranscriptionSession,
} from "../shared/transcription-session.js";
import { type AudioSource, openAudioStream } from "./audio-source.js";

// A transcription that is actively running. `audioComplete` resolves on its own
// when a WAV file finishes streaming; for the microphone it only ends when you
// call `finish()`.
export type LiveTranscription = {
	audioComplete: Promise<void>;
	finish: () => Promise<TranscriptItem[]>;
};

export async function startTranscription(
	audioSource: AudioSource,
	onItem: (item: TranscriptItem) => void,
	signal?: AbortSignal,
): Promise<LiveTranscription> {
	const socket = await connectTranscribeWebSocket();
	const session = createSession(socket);
	const serverClosed = receiveUntilServerClose(session, onItem);
	sendConfig(socket);

	const audio = await openAudioStream(audioSource, (chunk) =>
		sendAudioChunk(session, chunk),
	);

	// Graceful shutdown: stop sending audio, tell the server we're done, then wait
	// for it to flush the remaining transcript items and close the socket itself.
	let finishing: Promise<TranscriptItem[]> | null = null;
	async function finish(): Promise<TranscriptItem[]> {
		// Stop sending audio
		audio.stop();
		await audio.completed;
		// Tell the server we're done
		if (socket.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify(TRANSCRIBE_END_MESSAGE));
		}
		// Wait for the server to flush the remaining transcript items and close the socket
		await serverClosed;
		// Collect the final transcript items
		return collectFinalTranscriptItems(session);
	}

	// If the encounter is restarted, abandon the session immediately.
	signal?.addEventListener(
		"abort",
		() => {
			audio.stop();
			if (socket.readyState === WebSocket.OPEN) {
				socket.close();
			}
		},
		{
			once: true,
		},
	);

	return {
		audioComplete: audio.completed,
		finish: () => (finishing ??= finish()),
	};
}

// The server flushes its remaining transcript items after we send END and then
// closes the socket — that close is the signal that everything has arrived.
function receiveUntilServerClose(
	session: TranscriptionSession,
	onItem: (item: TranscriptItem) => void,
): Promise<void> {
	return new Promise<void>((resolve) => {
		// When the server closes the socket, we resolve the promise
		session.socket.addEventListener("close", () => resolve());
		
		// When we receive a message from the server, we handle it by calling the onItem callback
		session.socket.onmessage = (event: MessageEvent<string>) => {
			const message = JSON.parse(event.data) as TranscribeServerMessage;
			if (message.type === "AUDIO_CHUNK_ACK" && message.ack_id !== undefined) {
				session.bufferedAudioStream.handlePacketAck({
					ack_id: message.ack_id,
				});
			} else if (message.type === "TRANSCRIPT_ITEM") {
				recordTranscriptItem(session, message);
				onItem(message);
			}
		};
	});
}

function sendConfig(socket: WebSocket): void {
	socket.send(JSON.stringify(buildTranscribeConfig()));
}

function sendAudioChunk(
	session: TranscriptionSession,
	audioChunk: Int16Array,
): void {
	session.bufferedAudioStream.sendAndBuffer(
		buildAudioChunk(session.nextChunkSequenceNumber++, audioChunk),
	);
}
