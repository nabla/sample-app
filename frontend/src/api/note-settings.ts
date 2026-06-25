import { nablaFetch } from "../transport/client.js";

export type NoteLocale = "ENGLISH_US" | "ENGLISH_UK" | "FRENCH_FR";

// A note template from Nabla's library. Fetch these via listNoteTemplates() instead
// of hardcoding, so the integration inherits new/improved templates automatically.
export interface NoteTemplate {
	key: string;
	title: string;
	description: string;
}

export interface NoteSettings {
	note_template_key: string;
	note_locale: NoteLocale;
}

interface ListTemplatesResponse {
	templates: NoteTemplate[];
}

// The templates available to the current user for note generation.
export async function listNoteTemplates(): Promise<NoteTemplate[]> {
	const response = await nablaFetch("/v1/core/user/note-settings/templates");
	const responseBody = (await response.json()) as ListTemplatesResponse;
	return responseBody.templates;
}

// Sets the user's note settings; subsequent generate-note calls use this template.
export async function updateNoteSettings(params: {
	noteTemplateKey: string;
	noteLocale: NoteLocale;
}): Promise<NoteSettings> {
	const response = await nablaFetch("/v1/core/user/note-settings", {
		method: "PATCH",
		body: JSON.stringify({
			note_template_key: params.noteTemplateKey,
			note_locale: params.noteLocale,
		}),
	});
	return response.json() as Promise<NoteSettings>;
}
