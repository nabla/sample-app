import { encodePcm16ToBase64 } from "./encoding.js";
import { nablaWebSocket } from "../transport/client.js";

export type Speaker = "DOCTOR" | "PATIENT" | "UNSPECIFIED";

export interface TranscriptItem {
	id: string;
	text: string;
	start_offset_ms: number;
	end_offset_ms: number;
	is_final: boolean;
	speaker_type?: Speaker;
}

// What the server sends back: a transcript item, or a cumulative audio-chunk ack.
export type TranscribeServerMessage =
	| ({ type: "TRANSCRIPT_ITEM" } & TranscriptItem)
	| { type: "AUDIO_CHUNK_ACK"; ack_id: number };

export const TRANSCRIBE_ENCODING = "PCM_S16LE" as const;
export const TRANSCRIBE_SAMPLE_RATE_HZ = 16000;
export const TRANSCRIBE_STREAM_ID = "stream1";
export const TRANSCRIBE_SPEECH_LOCALES = ["ENGLISH_US", "FRENCH_FR"] as const;

// #region transcribe-messages
// The messages a client sends over transcribe-ws.

export function buildTranscribeConfig() {
	return {
		type: "CONFIG" as const,
		encoding: TRANSCRIBE_ENCODING,
		sample_rate: TRANSCRIBE_SAMPLE_RATE_HZ,
		speech_locales: TRANSCRIBE_SPEECH_LOCALES,
		streams: [
			{
				id: TRANSCRIBE_STREAM_ID,
				speaker_type: "UNSPECIFIED",
			},
		],
		enable_audio_chunk_ack: true,
		split_by_sentence: true,
	};
}

export function buildAudioChunk(seqId: number, pcm: Int16Array) {
	return {
		type: "AUDIO_CHUNK" as const,
		stream_id: TRANSCRIBE_STREAM_ID,
		seq_id: seqId,
		payload: encodePcm16ToBase64(pcm),
	};
}

export const TRANSCRIBE_END_MESSAGE = {
	type: "END" as const,
};
// #endregion transcribe-messages

export async function connectTranscribeWebSocket(): Promise<WebSocket> {
	return nablaWebSocket("/v1/core/user/transcribe-ws", "transcribe-protocol");
}
