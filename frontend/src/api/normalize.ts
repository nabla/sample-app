import { nablaFetch } from "../transport/client.js";
import type { ClinicalNote } from "./note.js";

// The full response is a FHIR Condition list (plus family history and observations).
// The sample displays only the primary coding and status of each condition.
export interface Condition {
  coding: {
    code: string;
    display: string;
  };
  clinical_status?: string;
}

export interface NormalizedData {
  conditions: Condition[];
}

export async function generateNormalizedData(
  note: ClinicalNote,
): Promise<NormalizedData> {
  const response = await nablaFetch("/v1/core/user/generate-normalized-data", {
    method: "POST",
    body: JSON.stringify({
      note,
    }),
  });
  return response.json() as Promise<NormalizedData>;
}
