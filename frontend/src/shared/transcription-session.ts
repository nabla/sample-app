import type { TranscriptItem } from "../api/transcribe.js";
import { BufferedAudioStream } from "../audio/buffered-stream.js";

export type TranscriptionSession = {
	socket: WebSocket;
	bufferedAudioStream: BufferedAudioStream;
	nextChunkSequenceNumber: number;
	stopAudio: (() => void) | null;
	// Every transcript item, keyed by id — partials and re-sent finals are deduped
	// (the latest version of an item wins).
	transcriptItemsById: Map<string, TranscriptItem>;
};

export function createSession(socket: WebSocket): TranscriptionSession {
	return {
		socket,
		bufferedAudioStream: new BufferedAudioStream(socket),
		nextChunkSequenceNumber: 0,
		stopAudio: null,
		transcriptItemsById: new Map(),
	};
}

// Records an item, deduping by id (a final overwrites its earlier partial).
export function recordTranscriptItem(
	session: TranscriptionSession,
	item: TranscriptItem,
): void {
	session.transcriptItemsById.set(item.id, item);
}

export function currentTranscriptItems(
	session: TranscriptionSession,
): TranscriptItem[] {
	return [...session.transcriptItemsById.values()];
}

export function collectFinalTranscriptItems(
	session: TranscriptionSession | null,
): TranscriptItem[] {
	if (!session) {
		return [];
	}
	const items = currentTranscriptItems(session);
	const finalItems = items.filter((item) => item.is_final);
	// Items aren't guaranteed to arrive in order, so sort by start time. Fall back
	// to whatever we have if nothing was finalized.
	return (finalItems.length > 0 ? finalItems : items).sort(
		(firstItem, secondItem) =>
			firstItem.start_offset_ms - secondItem.start_offset_ms,
	);
}

