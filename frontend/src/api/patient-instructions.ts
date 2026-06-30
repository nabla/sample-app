import { nablaFetch } from "../transport/client.js";
import type { ClinicalNote } from "./note.js";

export type RecipientType = "PATIENT" | "PARENT";

export type InstructionsLocale =
  | "ENGLISH_US"
  | "ENGLISH_UK"
  | "SPANISH_ES"
  | "SPANISH_MX"
  | "FRENCH_FR"
  | "ARABIC_EG"
  | "MANDARIN_CN"
  | "PORTUGUESE_PT"
  | "RUSSIAN_RU";

interface PatientInstructionsResponse {
  instructions: string;
}

export async function generatePatientInstructions(params: {
  note: ClinicalNote;
  instructions_locale: InstructionsLocale;
  recipient_type?: RecipientType;
}): Promise<string> {
  const response = await nablaFetch(
    "/v1/core/user/generate-patient-instructions",
    {
      method: "POST",
      body: JSON.stringify(params),
    },
  );
  const responseBody = (await response.json()) as PatientInstructionsResponse;
  return responseBody.instructions;
}
