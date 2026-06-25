// Single source of truth for the Nabla Core API documentation links the app points
// to, so URLs aren't scattered across pages. Update one here and every reference follows.
export const DOCUMENTATION_LINKS = {
	transcribeWs: "https://docs.nabla.com/user/transcribe-ws",
	dictateWs: "https://docs.nabla.com/api/dictate-ws",
	generateNote: "https://docs.nabla.com/user/generate-note",
	generateNormalizedData: "https://docs.nabla.com/user/generate-normalized-data",
	generatePatientInstructions: "https://docs.nabla.com/user/generate-patient-instructions",
} as const;
