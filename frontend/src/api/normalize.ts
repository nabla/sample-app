import { type AsyncJob, pollUntilSucceeded } from "./async-job.js";
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
  const submitResponse = await nablaFetch(
    "/v1/core/user/generate-normalized-data-async",
    {
      method: "POST",
      body: JSON.stringify({ note }),
    },
  );
  const { id } = (await submitResponse.json()) as AsyncJob;

  return pollUntilSucceeded<NormalizedData>(() =>
    nablaFetch(`/v1/core/user/generate-normalized-data-async/${id}`).then(
      (response) => response.json() as Promise<AsyncJob<NormalizedData>>,
    ),
  );
}
