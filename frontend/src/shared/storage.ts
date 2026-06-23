import type { ClinicalNote } from "../api/note.js";
import type { TranscriptItem } from "../api/transcribe.js";

export function saveTranscriptItems(items: TranscriptItem[]): void {
	localStorage.setItem("nabla_transcript_items", JSON.stringify(items));
}

export function saveClinicalNote(note: ClinicalNote): void {
	localStorage.setItem("nabla_generated_note", JSON.stringify(note));
}
