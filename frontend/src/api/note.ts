import { nablaFetch } from "../transport/client.js";
import type { TranscriptItem } from "./transcribe.js";

// A generated clinical note.
export interface NoteSection {
  key: string;
  title: string;
  text: string;
}

export interface ClinicalNote {
  title?: string;
  sections: NoteSection[];
  locale?: string;
  template_key?: string;
}

interface GenerateNoteResponse {
  note: ClinicalNote;
}

export async function generateNote(params: {
  transcriptItems: TranscriptItem[];
  patientContext: string;
}): Promise<ClinicalNote> {
  // /!\ To build a valid transcript, keep only the **final** transcript items
  // /!\ and sort them by `start_offset_ms` in ascending order.
  const transcript = params.transcriptItems
    .filter((item) => item.is_final)
    .sort((a, b) => a.start_offset_ms - b.start_offset_ms);

  // Generate the note using the generated transcript and patient context
  const response = await nablaFetch("/v1/core/user/generate-note", {
    method: "POST",
    body: JSON.stringify({
      unstructured_context: params.patientContext || undefined,
      structured_context: {
        encounter_date: new Date().toISOString().split("T")[0],
      },
      transcript_items: transcript.map((item) => ({
        text: item.text,
        speaker_type: item.speaker_type ?? "UNSPECIFIED",
      })),
    }),
  });
  const responseBody = (await response.json()) as GenerateNoteResponse;
  return responseBody.note;
}
