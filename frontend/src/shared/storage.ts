import type { TranscriptItem } from "../api/transcribe.js";

export function saveTranscriptItems(items: TranscriptItem[]): void {
  localStorage.setItem("nabla_transcript_items", JSON.stringify(items));
}
