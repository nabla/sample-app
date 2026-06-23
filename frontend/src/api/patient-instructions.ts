import { nablaFetch } from "../transport/client.js";
import type { ClinicalNote } from "./note.js";

// Full schema: https://docs.nabla.com/user/generate-patient-instructions
export type RecipientType = "PATIENT" | "PARENT";

interface PatientInstructionsResponse {
	instructions: string;
}

export async function generatePatientInstructions(params: {
	note: ClinicalNote;
	instructions_locale: string;
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
