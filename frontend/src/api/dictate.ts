import { encodePcm16ToBase64 } from "./encoding.js";
import { nablaWebSocket } from "../transport/client.js";

export type DictationLocale =
  | "ENGLISH_US"
  | "ENGLISH_UK"
  | "FRENCH_FR"
  | "SPANISH_ES"
  | "SPANISH_MX";

export interface DictatedText {
  type: "DICTATED_TEXT";
  text: string;
}

export interface AudioChunkAck {
  type: "AUDIO_CHUNK_ACK";
  ack_id: number;
}

export type DictateServerMessage =
  | DictatedText
  | AudioChunkAck
  | { type: string };

export const DICTATE_ENCODING = "PCM_S16LE" as const;
export const DICTATE_SAMPLE_RATE_HZ = 16000;

// dictate-ws supports a single dictation locale (unlike transcribe-ws, which takes
// an array of speech locales). Drives the locale picker on the page.
export const DICTATE_LOCALES: { value: DictationLocale; label: string }[] = [
  { value: "ENGLISH_US", label: "English (US)" },
  { value: "ENGLISH_UK", label: "English (UK)" },
  { value: "FRENCH_FR", label: "French (FR)" },
  { value: "SPANISH_ES", label: "Spanish (ES)" },
  { value: "SPANISH_MX", label: "Spanish (MX)" },
];

// #region dictate-messages
// The messages a client sends over dictate-ws.

export function buildDictateConfig(locale: DictationLocale, noteText: string) {
  return {
    type: "CONFIG" as const,
    encoding: DICTATE_ENCODING,
    sample_rate: DICTATE_SAMPLE_RATE_HZ,
    dictation_locale: locale,
    // EXPLICIT means the provider dictates punctuation out loud ("period", "comma").
    punctuation_mode: "EXPLICIT" as const,
    // Tells the API the current text and where the caret is, so the first dictated
    // word is capitalised correctly and output is inserted at the caret. We keep the
    // caret at the end of the existing note with no selection, so dictation appends.
    text_field_context: {
      text: noteText,
      selection_start: noteText.length,
      selection_length: 0,
    },
  };
}

export function buildDictateAudioChunk(seqId: number, pcm: Int16Array) {
  return {
    type: "AUDIO_CHUNK" as const,
    seq_id: seqId,
    payload: encodePcm16ToBase64(pcm),
  };
}

export const DICTATE_END_MESSAGE = {
  type: "END" as const,
};
// #endregion dictate-messages

export async function connectDictateWebSocket(): Promise<WebSocket> {
  return nablaWebSocket("/v1/core/user/dictate-ws", "dictate-protocol");
}
